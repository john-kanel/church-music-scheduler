import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'

const prisma = new PrismaClient()
// Conditionally initialize Resend for local development
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is director or pastor
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user || (user.role !== 'DIRECTOR' && user.role !== 'ASSOCIATE_DIRECTOR' && user.role !== 'PASTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch ownership transfers for this church
    const transfers = await prisma.ownershipTransfer.findMany({
      where: { churchId: user.churchId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ transfers })
  } catch (error) {
    console.error('Error fetching ownership transfers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is director or pastor
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user || (user.role !== 'DIRECTOR' && user.role !== 'ASSOCIATE_DIRECTOR' && user.role !== 'PASTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, firstName, lastName, role, retireCurrentOwner } = body

    // Validate input
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    // Check if email is already a user in this church
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        churchId: user.churchId
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'This email is already associated with a user in your church' },
        { status: 400 }
      )
    }

    // Check if there's already a pending transfer for this email
    const existingTransfer = await prisma.ownershipTransfer.findFirst({
      where: {
        inviteeEmail: email,
        churchId: user.churchId,
        status: 'PENDING'
      }
    })

    if (existingTransfer) {
      return NextResponse.json(
        { error: 'There is already a pending invitation for this email' },
        { status: 400 }
      )
    }

    // Create the ownership transfer
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now

    let currentOwnerRetireAt = null
    if (retireCurrentOwner) {
      currentOwnerRetireAt = new Date()
      currentOwnerRetireAt.setDate(currentOwnerRetireAt.getDate() + 30)
    }

    const transfer = await prisma.ownershipTransfer.create({
      data: {
        inviteeEmail: email,
        inviteeFirstName: firstName || null,
        inviteeLastName: lastName || null,
        inviteeRole: role,
        retireCurrentOwner,
        currentOwnerRetireAt,
        expiresAt,
        churchId: user.churchId,
        invitedBy: user.id
      }
    })

    // Send invitation email
    const inviteLink = `${process.env.NEXTAUTH_URL}/accept-ownership/${transfer.token}`
    const churchName = user.church?.name || 'Church'
    const inviterName = `${user.firstName} ${user.lastName}`

    try {
      // Send email (if Resend is configured)
      if (resend) {
        await resend.emails.send({
          from: 'Church Music Pro <noreply@churchmusicpro.com>',
          to: email,
          subject: `Invitation to join ${churchName} as ${role.toLowerCase().replace('_', ' ')}`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #660033;">You've been invited to join ${churchName}</h2>
            
            <p>Hello${firstName ? ` ${firstName}` : ''},</p>
            
            <p>${inviterName} has invited you to join <strong>${churchName}</strong> as a <strong>${role.toLowerCase().replace('_', ' ')}</strong> on Church Music Pro.</p>
            
            <p>As a ${role.toLowerCase().replace('_', ' ')}, you'll have full access to:</p>
            <ul>
              <li>Manage events and schedules</li>
              <li>Invite and manage musicians</li>
              <li>Send communications</li>
              <li>Access all church data and settings</li>
            </ul>
            
            ${retireCurrentOwner ? `
              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #92400e; margin: 0 0 8px 0;">Important: Ownership Transfer</h4>
                <p style="color: #92400e; margin: 0;">
                  ${inviterName} has chosen to transfer ownership to you and will retire their account 30 days after you accept this invitation.
                </p>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="background-color: #660033; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              This invitation will expire in 30 days. If you have any questions, please contact ${inviterName} directly.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
              Church Music Pro - Simplifying church music coordination
            </p>
          </div>
        `
        })
      } else {
        console.log('Email simulation (no RESEND_API_KEY):', { 
          to: email, 
          subject: `Invitation to join ${churchName} as ${role.toLowerCase().replace('_', ' ')}` 
        })
      }
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError)
      // Don't fail the request if email fails, just log it
    }

    return NextResponse.json({ 
      message: 'Invitation sent successfully',
      transfer: {
        id: transfer.id,
        inviteeEmail: transfer.inviteeEmail,
        inviteeRole: transfer.inviteeRole,
        status: transfer.status,
        expiresAt: transfer.expiresAt,
        retireCurrentOwner: transfer.retireCurrentOwner
      }
    })
  } catch (error) {
    console.error('Error creating ownership transfer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is director or pastor
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user || (user.role !== 'DIRECTOR' && user.role !== 'ASSOCIATE_DIRECTOR' && user.role !== 'PASTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const transferId = searchParams.get('id')

    if (!transferId) {
      return NextResponse.json({ error: 'Transfer ID is required' }, { status: 400 })
    }

    // Find the transfer and verify it belongs to this church
    const transfer = await prisma.ownershipTransfer.findFirst({
      where: {
        id: transferId,
        churchId: user.churchId
      }
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Only allow deletion of pending transfers
    if (transfer.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending transfers can be deleted' }, 
        { status: 400 }
      )
    }

    // Delete the transfer
    await prisma.ownershipTransfer.delete({
      where: { id: transferId }
    })

    return NextResponse.json({ message: 'Transfer deleted successfully' })
  } catch (error) {
    console.error('Error deleting ownership transfer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 