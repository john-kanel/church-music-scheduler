import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendInvitationEmail } from '@/lib/resend'

// GET /api/invitations - List invitations for the parish
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.parishId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING, ACCEPTED, EXPIRED

    // Build filter
    const whereClause: any = {
      parishId: session.user.parishId
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
    
    if (!session?.user?.parishId) {
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
        if (existingUser.parishId === session.user.parishId) {
          return NextResponse.json(
            { error: 'This person is already a member of your parish' },
            { status: 400 }
          )
        } else {
          return NextResponse.json(
            { error: 'This email is already registered with another parish' },
            { status: 400 }
          )
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email,
          parishId: session.user.parishId,
          status: 'PENDING'
        }
      })

      if (existingInvitation) {
        return NextResponse.json(
          { error: 'A pending invitation already exists for this email' },
          { status: 400 }
        )
      }

      // Create invitation
      const invitation = await prisma.invitation.create({
        data: {
          email,
          firstName,
          lastName,
          phone,
          parishId: session.user.parishId,
          invitedBy: session.user.id,
          token: generateInvitationToken(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      })

      // Get parish and inviter information for email
      const parish = await prisma.parish.findUnique({
        where: { id: session.user.parishId },
        select: { name: true }
      })

      const inviter = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true }
      })

      // Send email invitation
      if (parish && inviter) {
        try {
          const inviteLink = `${process.env.NEXTAUTH_URL}/auth/signup?token=${invitation.token}`
          await sendInvitationEmail(
            email,
            `${firstName} ${lastName}`,
            parish.name,
            inviteLink,
            `${inviter.firstName} ${inviter.lastName}`
          )
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError)
          // Don't fail the whole request if email fails
        }
      }

      return NextResponse.json({
        message: 'Invitation sent successfully',
        invitation
      }, { status: 201 })

    } else if (type === 'bulk') {
      // Bulk invitations
      const { invitations: bulkInvitations } = data

      if (!Array.isArray(bulkInvitations) || bulkInvitations.length === 0) {
        return NextResponse.json(
          { error: 'At least one invitation is required' },
          { status: 400 }
        )
      }

      const results: {
        successful: any[]
        failed: Array<{ email: string; error: string }>
      } = {
        successful: [],
        failed: []
      }

      // Process each invitation
      for (const inv of bulkInvitations) {
        try {
          const { email, firstName, lastName, phone } = inv

          // Basic validation
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
              error: existingUser.parishId === session.user.parishId 
                ? 'Already a member of your parish'
                : 'Email registered with another parish'
            })
            continue
          }

          // Check for existing pending invitation
          const existingInvitation = await prisma.invitation.findFirst({
            where: {
              email,
              parishId: session.user.parishId,
              status: 'PENDING'
            }
          })

          if (existingInvitation) {
            results.failed.push({
              email,
              error: 'Pending invitation already exists'
            })
            continue
          }

          // Create invitation
          const invitation = await prisma.invitation.create({
            data: {
              email,
              firstName,
              lastName,
              phone,
              parishId: session.user.parishId,
              invitedBy: session.user.id,
              token: generateInvitationToken(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
          })

          results.successful.push(invitation)

          // Send email invitation (get parish info outside loop if doing many)
          try {
            const parish = await prisma.parish.findUnique({
              where: { id: session.user.parishId },
              select: { name: true }
            })

            const inviter = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { firstName: true, lastName: true }
            })

            if (parish && inviter) {
              const inviteLink = `${process.env.NEXTAUTH_URL}/auth/signup?token=${invitation.token}`
              await sendInvitationEmail(
                email,
                `${firstName} ${lastName}`,
                parish.name,
                inviteLink,
                `${inviter.firstName} ${inviter.lastName}`
              )
            }
          } catch (emailError) {
            console.error('Failed to send invitation email:', emailError)
            // Don't fail the invitation if email fails
          }

        } catch (error) {
          results.failed.push({
            email: inv.email,
            error: 'Failed to create invitation'
          })
        }
      }

      return NextResponse.json({
        message: `Sent ${results.successful.length} invitations successfully`,
        results
      }, { status: 201 })

    } else {
      return NextResponse.json(
        { error: 'Invalid invitation type' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error sending invitations:', error)
    return NextResponse.json(
      { error: 'Failed to send invitations' },
      { status: 500 }
    )
  }
}

// Helper function to generate invitation token
function generateInvitationToken(): string {
  return Math.random().toString(36).substr(2, 9) + 
         Math.random().toString(36).substr(2, 9) +
         Date.now().toString(36)
} 