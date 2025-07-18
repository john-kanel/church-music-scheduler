import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'

const prisma = new PrismaClient()
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    // Verify cron job authorization (you might want to add a secret)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const twentyDaysAgo = new Date(now.getTime() - (20 * 24 * 60 * 60 * 1000))
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000))

    // 1. Send 20-day reminders for pending transfers
    const pendingTransfers = await prisma.ownershipTransfer.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lte: twentyDaysAgo
        },
        reminderSentAt: null,
        expiresAt: {
          gt: now
        }
      },
      include: {
        church: true
      }
    })

    for (const transfer of pendingTransfers) {
      try {
        // Get inviter details
        const inviter = await prisma.user.findUnique({
          where: { id: transfer.invitedBy },
          select: { firstName: true, lastName: true, email: true }
        })

        if (inviter) {
          const daysRemaining = Math.ceil((transfer.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          
          await resend.emails.send({
            from: 'Church Music Pro <noreply@churchmusicpro.com>',
            to: inviter.email,
            subject: `Reminder: Ownership invitation still pending`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #660033;">Ownership Invitation Reminder</h2>
                
                <p>Hello ${inviter.firstName},</p>
                
                <p>This is a reminder that your ownership invitation to <strong>${transfer.inviteeEmail}</strong> is still pending.</p>
                
                <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="color: #92400e; margin: 0 0 8px 0;">Invitation Status</h4>
                  <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                    <li><strong>Status:</strong> ${transfer.status}</li>
                    <li><strong>Invited:</strong> ${transfer.inviteeEmail}</li>
                    <li><strong>Role:</strong> ${transfer.inviteeRole.replace('_', ' ')}</li>
                    <li><strong>Expires in:</strong> ${daysRemaining} days</li>
                    ${transfer.retireCurrentOwner ? '<li><strong>⚠️ You will lose access in 30 days</strong></li>' : ''}
                  </ul>
                </div>
                
                <p>The invitation will continue to charge your current payment method. If the invitation is not accepted, it will expire automatically.</p>
                
                <p>If you need to resend the invitation or have questions, you can manage your invitations in your dashboard.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.NEXTAUTH_URL}/transfer-ownership" style="background-color: #660033; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Manage Invitations
                  </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="color: #9ca3af; font-size: 12px;">
                  Church Music Pro - Simplifying church music coordination
                </p>
              </div>
            `
          })

          // Mark reminder as sent
          await prisma.ownershipTransfer.update({
            where: { id: transfer.id },
            data: { reminderSentAt: now }
          })
        }
      } catch (emailError) {
        console.error(`Error sending reminder for transfer ${transfer.id}:`, emailError)
      }
    }

    // 2. Send 3-day warnings for upcoming account deactivations
    const upcomingDeactivations = await prisma.ownershipTransfer.findMany({
      where: {
        status: 'COMPLETED',
        retireCurrentOwner: true,
        currentOwnerRetireAt: {
          gte: now,
          lte: threeDaysFromNow
        }
      },
      include: {
        church: true
      }
    })

    for (const transfer of upcomingDeactivations) {
      try {
        // Get the retiring owner details
        const retiringOwner = await prisma.user.findUnique({
          where: { id: transfer.invitedBy },
          select: { firstName: true, lastName: true, email: true }
        })

        if (retiringOwner && transfer.currentOwnerRetireAt) {
          const daysUntilDeactivation = Math.ceil((transfer.currentOwnerRetireAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          
          await resend.emails.send({
            from: 'Church Music Pro <noreply@churchmusicpro.com>',
            to: retiringOwner.email,
            subject: `Important: Your account will be deactivated in ${daysUntilDeactivation} days`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Account Deactivation Notice</h2>
                
                <p>Hello ${retiringOwner.firstName},</p>
                
                <p>This is an important reminder that your Church Music Pro account will be deactivated in <strong>${daysUntilDeactivation} days</strong> on ${transfer.currentOwnerRetireAt.toLocaleDateString()}.</p>
                
                <div style="background-color: #fef2f2; border: 1px solid #dc2626; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="color: #dc2626; margin: 0 0 8px 0;">What this means:</h4>
                  <ul style="color: #dc2626; margin: 0; padding-left: 20px;">
                    <li>Your login credentials will become inactive</li>
                    <li>You will no longer be able to access ${transfer.church.name}'s account</li>
                    <li>The billing will continue with the current payment method</li>
                    <li>All church data will remain intact for the new owner</li>
                  </ul>
                </div>
                
                <p>This deactivation was requested when you transferred ownership of your church account. The new owner now has full access to manage the account.</p>
                
                <p>If you have any questions or concerns, please contact our support team before your account is deactivated.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.NEXTAUTH_URL}/support" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Contact Support
                  </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="color: #9ca3af; font-size: 12px;">
                  Church Music Pro - Simplifying church music coordination
                </p>
              </div>
            `
          })
        }
      } catch (emailError) {
        console.error(`Error sending deactivation warning for transfer ${transfer.id}:`, emailError)
      }
    }

    // 3. Actually deactivate accounts that are due
    const accountsToDeactivate = await prisma.ownershipTransfer.findMany({
      where: {
        status: 'COMPLETED',
        retireCurrentOwner: true,
        currentOwnerRetireAt: {
          lte: now
        }
      }
    })

    for (const transfer of accountsToDeactivate) {
      try {
        // Get the retiring owner
        const retiringOwner = await prisma.user.findUnique({
          where: { id: transfer.invitedBy },
          select: { firstName: true, lastName: true, email: true }
        })

        if (retiringOwner) {
          // Deactivate the user account (set inactive flag or change role)
          await prisma.user.update({
            where: { id: transfer.invitedBy },
            data: {
              // We could add an isActive field, or change their role to something inactive
              // For now, we'll just change their password to something they can't guess
              password: 'DEACTIVATED_' + Date.now()
            }
          })

          // Send final deactivation email
          await resend.emails.send({
            from: 'Church Music Pro <noreply@churchmusicpro.com>',
            to: retiringOwner.email,
            subject: 'Your Church Music Pro account has been deactivated',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Account Deactivated</h2>
                
                <p>Hello ${retiringOwner.firstName},</p>
                
                <p>Your Church Music Pro account has been deactivated as requested when you transferred ownership of your church account.</p>
                
                <div style="background-color: #f3f4f6; border: 1px solid #d1d5db; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="color: #374151; margin: 0 0 8px 0;">Account Status:</h4>
                  <ul style="color: #374151; margin: 0; padding-left: 20px;">
                    <li>Your login credentials are now inactive</li>
                    <li>Billing continues with the current payment method</li>
                    <li>All church data remains safe with the new owner</li>
                    <li>This change is permanent</li>
                  </ul>
                </div>
                
                <p>Thank you for using Church Music Pro. If you need to access a church music scheduling system in the future, you're welcome to create a new account or join another church's existing account.</p>
                
                <p>If you have any questions, please contact our support team.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.NEXTAUTH_URL}/support" style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Contact Support
                  </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="color: #9ca3af; font-size: 12px;">
                  Church Music Pro - Simplifying church music coordination
                </p>
              </div>
            `
          })

          console.log(`Deactivated account for user ${transfer.invitedBy}`)
        }
      } catch (error) {
        console.error(`Error deactivating account for transfer ${transfer.id}:`, error)
      }
    }

    // 4. Mark expired transfers
    await prisma.ownershipTransfer.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lte: now
        }
      },
      data: {
        status: 'EXPIRED'
      }
    })

    return NextResponse.json({
      message: 'Ownership reminders processed',
      remindersSent: pendingTransfers.length,
      warningsSent: upcomingDeactivations.length,
      accountsDeactivated: accountsToDeactivate.length
    })
  } catch (error) {
    console.error('Error processing ownership reminders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 