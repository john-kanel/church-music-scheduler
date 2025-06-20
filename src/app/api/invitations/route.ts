import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendInvitationEmail } from '@/lib/resend'
import { logActivity } from '@/lib/activity'
import bcrypt from 'bcryptjs'

// GET /api/invitations - List invitations for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING, ACCEPTED, EXPIRED

    // Build filter
    const whereClause: any = {
      churchId: session.user.churchId
    }

    if (status) {
      whereClause.status = status
    }

    const invitations = await prisma.invitation.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ invitations })
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}

// POST /api/invitations - Send new invitation(s)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can send invitations
    if (!['DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { type, data } = body

    if (type === 'single') {
      // Single invitation
      const { email, firstName, lastName, phone } = data

      // Validation
      if (!email || !firstName || !lastName) {
        return NextResponse.json(
          { error: 'Email, first name, and last name are required' },
          { status: 400 }
        )
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        if (existingUser.churchId === session.user.churchId) {
          return NextResponse.json(
            { error: 'This person is already a member of your church' },
            { status: 400 }
          )
        } else {
          return NextResponse.json(
            { error: 'This email is already registered with another church' },
            { status: 400 }
          )
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email,
          churchId: session.user.churchId,
          status: 'PENDING'
        }
      })

      if (existingInvitation) {
        return NextResponse.json(
          { error: 'A pending invitation already exists for this email' },
          { status: 400 }
        )
      }

      // Get church and inviter information for email
      const church = await prisma.church.findUnique({
        where: { id: session.user.churchId },
        select: { name: true }
      })

      const inviter = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true }
      })

      if (!church || !inviter) {
        return NextResponse.json(
          { error: 'Unable to retrieve church or inviter information' },
          { status: 500 }
        )
      }

      // Send email invitation with auto-generated password
      let emailResult: any = null
      try {
        const inviteLink = `${process.env.NEXTAUTH_URL}/auth/signin?email=${encodeURIComponent(email)}`
        emailResult = await sendInvitationEmail(
          email,
          `${firstName} ${lastName}`,
          church.name,
          inviteLink,
          `${inviter.firstName} ${inviter.lastName}`
        )
      } catch (emailError: any) {
        console.error('Failed to send invitation email:', emailError)
        
        // Check if this is a development mode restriction
        if (emailError.message?.includes('Development mode')) {
          // In development mode, we still create the user but show a different message
          console.log('🚀 Development mode: Creating user account without sending actual email')
        } else {
          return NextResponse.json(
            { 
              error: 'Failed to send invitation email. Please check the email address and try again.',
              details: process.env.NODE_ENV === 'development' ? emailError.message : undefined
            },
            { status: 500 }
          )
        }
      }

      // If email failed but we're in development mode, generate a temporary password anyway
      if (!emailResult) {
        emailResult = {
          temporaryPassword: Math.random().toString(36).slice(-8),
          data: { id: `dev-${Date.now()}` }
        }
      }

      // Create user account with hashed temporary password
      const hashedPassword = await bcrypt.hash(emailResult.temporaryPassword, 12)
      
      const newUser = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          phone: phone || null,
          password: hashedPassword,
          role: 'MUSICIAN',
          churchId: session.user.churchId,
          isVerified: false, // User needs to change password on first login
          emailNotifications: true,
          smsNotifications: phone ? true : false
        }
      })

      // Create invitation record for tracking
      const invitation = await prisma.invitation.create({
        data: {
          email,
          firstName,
          lastName,
          phone,
          churchId: session.user.churchId,
          invitedBy: session.user.id,
          token: generateInvitationToken(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      })

      // Log activity
      await logActivity({
        type: 'MUSICIAN_INVITED',
        description: `Invited musician: ${firstName} ${lastName}`,
        churchId: session.user.churchId,
        userId: session.user.id,
        metadata: {
          musicianEmail: email,
          musicianName: `${firstName} ${lastName}`,
          invitationId: invitation.id
        }
      })

      // Determine success message based on environment and email result
      let successMessage = 'Invitation sent successfully! The musician can now sign in with their email and temporary password.'
      
      if (process.env.NODE_ENV === 'development') {
        const senderEmail = process.env.RESEND_SENDER_EMAIL || 'john.kanel@hey.com'
        if (email !== senderEmail) {
          successMessage = `Development mode: User account created successfully! Email was simulated (check console logs). Login credentials: ${email} / ${emailResult.temporaryPassword}`
        }
      }

      return NextResponse.json({
        message: successMessage,
        invitation,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: `${newUser.firstName} ${newUser.lastName}`
        },
        credentials: {
          email: email,
          temporaryPassword: emailResult.temporaryPassword
        },
        isDevelopmentMode: process.env.NODE_ENV === 'development' && email !== (process.env.RESEND_SENDER_EMAIL || 'john.kanel@hey.com')
      }, { status: 201 })

    } else if (type === 'bulk') {
      // Bulk invitations from CSV data
      const { invitations } = data

      if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
        return NextResponse.json(
          { error: 'Invitations array is required' },
          { status: 400 }
        )
      }

      const results = {
        successful: [] as Array<{
          email: string;
          firstName: string;
          lastName: string;
          invitationId: string;
          userId: string;
          temporaryPassword: string;
        }>,
        failed: [] as Array<{
          email: string;
          error: string;
        }>
      }

      // Get church info once for all invitations
      const church = await prisma.church.findUnique({
        where: { id: session.user.churchId },
        select: { name: true }
      })

      const inviter = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true }
      })

      if (!church || !inviter) {
        return NextResponse.json(
          { error: 'Unable to retrieve church or inviter information' },
          { status: 500 }
        )
      }

      // Process each invitation
      for (const inviteData of invitations) {
        const { email, firstName, lastName, phone } = inviteData

        try {
          // Validation
          if (!email || !firstName || !lastName) {
            results.failed.push({
              email,
              error: 'Email, first name, and last name are required'
            })
            continue
          }

          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email }
          })

          if (existingUser) {
            results.failed.push({
              email,
              error: existingUser.churchId === session.user.churchId 
                ? 'This person is already a member of your church'
                : 'This email is already registered with another church'
            })
            continue
          }

          // Check for existing pending invitation
          const existingInvitation = await prisma.invitation.findFirst({
            where: {
              email,
              churchId: session.user.churchId,
              status: 'PENDING'
            }
          })

          if (existingInvitation) {
            results.failed.push({
              email,
              error: 'A pending invitation already exists for this email'
            })
            continue
          }

          // Send email invitation
          let emailResult: any = null
          try {
            const inviteLink = `${process.env.NEXTAUTH_URL}/auth/signin?email=${encodeURIComponent(email)}`
            emailResult = await sendInvitationEmail(
              email,
              `${firstName} ${lastName}`,
              church.name,
              inviteLink,
              `${inviter.firstName} ${inviter.lastName}`
            )
          } catch (emailError: any) {
            console.error('Failed to send invitation email:', emailError)
            results.failed.push({
              email,
              error: 'Failed to send invitation email'
            })
            continue
          }

          // Create user account
          const hashedPassword = await bcrypt.hash(emailResult.temporaryPassword, 12)
          
          const newUser = await prisma.user.create({
            data: {
              email,
              firstName,
              lastName,
              phone: phone || null,
              password: hashedPassword,
              role: 'MUSICIAN',
              churchId: session.user.churchId,
              isVerified: false,
              emailNotifications: true,
              smsNotifications: phone ? true : false
            }
          })

          // Create invitation record
          const invitation = await prisma.invitation.create({
            data: {
              email,
              firstName,
              lastName,
              phone,
              churchId: session.user.churchId,
              invitedBy: session.user.id,
              token: generateInvitationToken(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          })

          // Log activity
          await logActivity({
            type: 'MUSICIAN_INVITED',
            description: `Invited musician: ${firstName} ${lastName}`,
            churchId: session.user.churchId,
            userId: session.user.id,
            metadata: {
              musicianEmail: email,
              musicianName: `${firstName} ${lastName}`,
              invitationId: invitation.id
            }
          })

          results.successful.push({
            email,
            firstName,
            lastName,
            invitationId: invitation.id,
            userId: newUser.id,
            temporaryPassword: emailResult.temporaryPassword
          })

        } catch (error) {
          console.error(`Error processing invitation for ${email}:`, error)
          results.failed.push({
            email,
            error: 'Failed to process invitation'
          })
        }
      }

      return NextResponse.json({
        message: `Processed ${invitations.length} invitations. ${results.successful.length} successful, ${results.failed.length} failed.`,
        results
      }, { status: 200 })

    } else {
      return NextResponse.json(
        { error: 'Invalid invitation type. Must be "single" or "bulk"' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error sending invitation:', error)
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
}

function generateInvitationToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
} 