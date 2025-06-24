import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendInvitationEmail } from '@/lib/resend'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is director or associate director
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user || !['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Directors only' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, name } = body

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      )
    }

    // Check if pastor already exists as a user
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      // If user exists, just send them a notification email
      // In the future, we could add them directly to pastor settings
      return NextResponse.json({
        message: 'Pastor already has an account. They can configure notification preferences in their settings.'
      })
    }

    // Check if invitation already exists
    const existingInvitation = await prisma.invitation.findUnique({
      where: {
        email_churchId: {
          email,
          churchId: user.churchId
        }
      }
    })

    if (existingInvitation && existingInvitation.status === 'PENDING') {
      return NextResponse.json(
        { error: 'Invitation already sent to this email' },
        { status: 400 }
      )
    }

    // Create invitation for pastor
    const invitation = await prisma.invitation.create({
      data: {
        email,
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || '',
        role: 'PASTOR',
        churchId: user.churchId,
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    })

    // Send invitation email
    try {
      await sendInvitationEmail(
        email,
        name,
        user.firstName + ' ' + user.lastName,
        user.church.name,
        invitation.token,
        'pastor-notifications' // Custom template for pastor invitations
      )
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError)
      // Don't fail the request if email fails
    }

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'MUSICIAN_INVITED',
        description: `Pastor ${name} invited to receive automated notifications`,
        churchId: user.churchId,
        userId: user.id,
        metadata: {
          inviteeEmail: email,
          inviteeName: name,
          role: 'PASTOR'
        }
      }
    })

    return NextResponse.json({
      message: 'Pastor invitation sent successfully',
      invitation
    })

  } catch (error) {
    console.error('Error sending pastor invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 