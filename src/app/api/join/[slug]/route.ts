import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcrypt'
import { prisma } from '@/lib/db'
import { Resend } from 'resend'
import { getEmailLogoHtml } from '@/components/emails/email-logo'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

// Create unique visitor ID from IP and User Agent
function createVisitorId(ip: string, userAgent: string): string {
  return crypto.createHash('sha256').update(ip + userAgent).digest('hex')
}

// Track page view
async function trackPageView(inviteLinkId: string, request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const visitorId = createVisitorId(ip, userAgent)

    await prisma.invitePageView.upsert({
      where: {
        inviteLinkId_visitorId: {
          inviteLinkId,
          visitorId
        }
      },
      update: {
        viewedAt: new Date()
      },
      create: {
        inviteLinkId,
        visitorId,
        ipAddress: ip,
        userAgent
      }
    })
  } catch (error) {
    console.error('Error tracking page view:', error)
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    // Find the active invitation link
    const inviteLink = await prisma.musicianInviteLink.findUnique({
      where: { slug },
      include: {
        church: {
          select: {
            id: true,
            name: true,
            groups: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        }
      }
    })

    if (!inviteLink) {
      return NextResponse.json({ error: 'Invitation link not found' }, { status: 404 })
    }

    if (!inviteLink.isActive) {
      return NextResponse.json({ error: 'This invitation link is no longer active' }, { status: 410 })
    }

    // Track page view
    await trackPageView(inviteLink.id, request)

    return NextResponse.json({
      church: {
        id: inviteLink.church.id,
        name: inviteLink.church.name,
        groups: inviteLink.church.groups
      }
    })
  } catch (error) {
    console.error('Error fetching invitation link:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    // Find the active invitation link
    const inviteLink = await prisma.musicianInviteLink.findUnique({
      where: { slug },
      include: {
        church: {
          select: {
            id: true,
            name: true,
            users: {
              where: {
                role: { in: ['DIRECTOR', 'PASTOR', 'ASSOCIATE_DIRECTOR', 'ASSOCIATE_PASTOR'] }
              },
              select: {
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    })

    if (!inviteLink) {
      return NextResponse.json({ error: 'Invitation link not found' }, { status: 404 })
    }

    if (!inviteLink.isActive) {
      return NextResponse.json({ error: 'This invitation link is no longer active' }, { status: 410 })
    }

    const body = await request.json()
    const {
      email,
      firstName,
      lastName,
      phone,
      password,
      instruments = [],
      skillLevel = 'INTERMEDIATE',
      yearsExperience,
      groupIds = []
    } = body

    // Validate required fields
    if (!email || !firstName || !lastName || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        phone,
        password: hashedPassword,
        role: 'MUSICIAN',
        churchId: inviteLink.church.id,
        instruments,
        skillLevel,
        yearsExperience,
        invitedVia: 'invitation_link',
        isVerified: true // Auto-verify users who sign up via invitation link
      }
    })

    // Add user to selected groups
    if (groupIds.length > 0) {
      await prisma.groupMember.createMany({
        data: groupIds.map((groupId: string) => ({
          userId: user.id,
          groupId
        }))
      })
    }

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'MUSICIAN_JOINED_VIA_LINK',
        description: `${firstName} ${lastName} joined via invitation link`,
        churchId: inviteLink.church.id,
        userId: user.id,
        metadata: {
          slug,
          email,
          groupIds
        }
      }
    })

    // Send welcome email to the new musician
    try {
      await resend.emails.send({
        from: 'Church Music Pro <no-reply@churchmusicpro.com>',
        to: [email],
        subject: `Welcome to ${inviteLink.church.name}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${getEmailLogoHtml()}
            
            <h2 style="color: #660033; margin-bottom: 20px;">Welcome to ${inviteLink.church.name}!</h2>
            
            <p>Hi ${firstName},</p>
            
            <p>Welcome to ${inviteLink.church.name}'s music ministry! Your account has been successfully created.</p>
            
            <p><strong>Your Login Details:</strong></p>
            <p>Email: ${email}</p>
            <p>You can now log in to view upcoming events, sign up for services, and stay connected with your music ministry.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL}/auth/signin" style="background-color: #660033; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Sign In to Your Account
              </a>
            </div>
            
            <p>If you have any questions, please don't hesitate to reach out to your music director.</p>
            
            <p>Blessings,<br>The Church Music Pro Team</p>
          </div>
        `
      })
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError)
    }

    // Send notification email to directors/pastors
    try {
      const directors = inviteLink.church.users
      if (directors.length > 0) {
        await resend.emails.send({
          from: 'Church Music Pro <no-reply@churchmusicpro.com>',
          to: directors.map((d: any) => d.email),
          subject: `New Musician Joined: ${firstName} ${lastName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              ${getEmailLogoHtml()}
              
              <h2 style="color: #660033; margin-bottom: 20px;">New Musician Joined Your Ministry</h2>
              
              <p>Great news! A new musician has joined ${inviteLink.church.name} through your invitation link.</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Musician Details:</strong></p>
                <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                <p><strong>Email:</strong> ${email}</p>
                ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
                <p><strong>Instruments:</strong> ${instruments.join(', ') || 'Not specified'}</p>
                <p><strong>Skill Level:</strong> ${skillLevel}</p>
                ${yearsExperience ? `<p><strong>Years Experience:</strong> ${yearsExperience}</p>` : ''}
                ${groupIds.length > 0 ? `<p><strong>Groups Joined:</strong> ${groupIds.length} group(s)</p>` : ''}
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXTAUTH_URL}/musicians" style="background-color: #660033; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  View Musicians
                </a>
              </div>
              
              <p>You can now assign them to events and include them in your music ministry communications.</p>
              
              <p>Blessings,<br>The Church Music Pro Team</p>
            </div>
          `
        })
      }
    } catch (emailError) {
      console.error('Error sending notification email:', emailError)
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! Check your email for login details.'
    })
  } catch (error) {
    console.error('Error processing signup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 