import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the ownership transfer
    const transfer = await prisma.ownershipTransfer.findUnique({
      where: { token },
      include: {
        church: true
      }
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    // Check if transfer is still valid
    if (transfer.status !== 'PENDING') {
      return NextResponse.json({ error: 'This invitation has already been processed' }, { status: 400 })
    }

    if (new Date() > transfer.expiresAt) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 })
    }

    // Check if the user email matches
    if (session.user.email !== transfer.inviteeEmail) {
      return NextResponse.json({ error: 'You can only accept invitations sent to your email' }, { status: 403 })
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user is already part of this church
    if (user.churchId === transfer.churchId) {
      return NextResponse.json({ error: 'You are already a member of this church' }, { status: 400 })
    }

    // Start transaction to handle the ownership transfer
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update the user's church and role
      await tx.user.update({
        where: { id: user.id },
        data: {
          churchId: transfer.churchId,
          role: transfer.inviteeRole as any
        }
      })

      // Update the transfer status
      await tx.ownershipTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date()
        }
      })

      // If this is a retirement transfer, schedule the current owner for deactivation
      if (transfer.retireCurrentOwner && transfer.currentOwnerRetireAt) {
        const currentOwner = await tx.user.findUnique({
          where: { id: transfer.invitedBy }
        })

        if (currentOwner) {
          // We'll handle the actual deactivation with a scheduled job
          // For now, just mark the transfer as needing retirement processing
          await tx.ownershipTransfer.update({
            where: { id: transfer.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date()
            }
          })
        }
      }

      // Create activity log
      await tx.activity.create({
        data: {
          type: 'MUSICIAN_SIGNED_UP', // We'll add a new type for ownership transfers later
          description: `${user.firstName} ${user.lastName} accepted ownership invitation as ${transfer.inviteeRole.toLowerCase().replace('_', ' ')}`,
          churchId: transfer.churchId,
          userId: user.id,
          metadata: {
            transferId: transfer.id,
            role: transfer.inviteeRole,
            retireCurrentOwner: transfer.retireCurrentOwner
          }
        }
      })
    })

    // Send confirmation emails
    try {
      // Email to new owner
      await resend.emails.send({
        from: 'Church Music Scheduler <noreply@churchmusicscheduler.com>',
        to: transfer.inviteeEmail,
        subject: `Welcome to ${transfer.church.name}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #660033;">Welcome to ${transfer.church.name}!</h2>
            
            <p>Congratulations! You've successfully accepted your invitation to join ${transfer.church.name} as a ${transfer.inviteeRole.toLowerCase().replace('_', ' ')}.</p>
            
            <p>You now have full access to:</p>
            <ul>
              <li>Manage events and schedules</li>
              <li>Invite and manage musicians</li>
              <li>Send communications to your team</li>
              <li>Access all church settings and data</li>
            </ul>
            
            ${transfer.retireCurrentOwner ? `
              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #92400e; margin: 0 0 8px 0;">Ownership Transfer Complete</h4>
                <p style="color: #92400e; margin: 0;">
                  The previous owner will lose access to this account in 30 days. You are now the primary owner.
                </p>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL}/dashboard" style="background-color: #660033; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              If you have any questions, don't hesitate to reach out to your team or our support.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
              Church Music Scheduler - Simplifying church music coordination
            </p>
          </div>
        `
      })

      // Email to current owner (inviter)
      const inviter = await prisma.user.findUnique({
        where: { id: transfer.invitedBy }
      })

      if (inviter) {
        await resend.emails.send({
          from: 'Church Music Scheduler <noreply@churchmusicscheduler.com>',
          to: inviter.email,
          subject: `${user.firstName} ${user.lastName} accepted your ownership invitation`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #660033;">Ownership Invitation Accepted</h2>
              
              <p>Great news! ${user.firstName} ${user.lastName} has accepted your invitation to join ${transfer.church.name} as a ${transfer.inviteeRole.toLowerCase().replace('_', ' ')}.</p>
              
              ${transfer.retireCurrentOwner ? `
                <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="color: #92400e; margin: 0 0 8px 0;">Your Account Retirement</h4>
                  <p style="color: #92400e; margin: 0;">
                    As requested, your account will be deactivated on ${new Date(transfer.currentOwnerRetireAt!).toLocaleDateString()}. 
                    The billing will continue with the current payment method, but your login credentials will become inactive.
                  </p>
                  <p style="color: #92400e; margin: 8px 0 0 0;">
                    You'll receive reminders 3 days before your account is deactivated.
                  </p>
                </div>
              ` : `
                <p>They now have full access to manage your church's music scheduling. Your account remains active with full access.</p>
              `}
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="color: #9ca3af; font-size: 12px;">
                Church Music Scheduler - Simplifying church music coordination
              </p>
            </div>
          `
        })
      }
    } catch (emailError) {
      console.error('Error sending confirmation emails:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({ 
      message: 'Invitation accepted successfully',
      churchName: transfer.church.name,
      role: transfer.inviteeRole
    })
  } catch (error) {
    console.error('Error accepting ownership transfer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 