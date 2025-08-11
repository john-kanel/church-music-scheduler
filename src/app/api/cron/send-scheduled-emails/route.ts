import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/resend'
import { getEmailLogoHtml } from '@/components/emails/email-logo'

export async function POST(request: NextRequest) {
  try {
    // Optional: simple bearer token check for cron
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    // Pull due, unsent emails (limit batch size)
    const schedules = await prisma.emailSchedule.findMany({
      where: {
        sentAt: null,
        scheduledFor: { lte: now }
      },
      take: 200,
      orderBy: { scheduledFor: 'asc' }
    })

    for (const schedule of schedules) {
      try {
        // Handle event update digest
        if (schedule.metadata && (schedule.metadata as any).type === 'EVENT_UPDATE_DIGEST') {
          const eventId = (schedule.metadata as any).eventId as string
          const user = await prisma.user.findUnique({ where: { id: schedule.userId } })
          if (!user || !user.emailNotifications) {
            await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'User disabled or missing' } })
            continue
          }

          // Collect changes since last send (simplified: fetch current hymns and basic event info)
          const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
              eventType: true,
              hymns: { include: { servicePart: true }, orderBy: [{ servicePart: { order: 'asc' } }, { createdAt: 'asc' }] }
            }
          })
          if (!event) {
            await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'Event not found' } })
            continue
          }

          const musicList = event.hymns.map((h, i) => `${i + 1}. ${h.servicePart?.name || 'Other'}: ${h.title}${h.notes ? ` (${h.notes})` : ''}`).join('\n')

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
                ${getEmailLogoHtml()}
                <h1 style="color: #333; margin: 0; font-size: 22px;">Daily Update Digest</h1>
              </div>
              <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <p>Hi ${user.firstName || ''},</p>
                <p>There were updates to the event <strong>${event.name}</strong> scheduled for ${new Date(event.startTime).toLocaleString()}.</p>
                <div style="background-color:#f8fafc; padding:16px; border-radius:8px; margin-top:12px;">
                  <h3 style="margin:0 0 8px 0;">Music & Service Parts</h3>
                  <div style="white-space: pre-line; font-family: monospace; color:#374151;">${musicList}</div>
                </div>
              </div>
            </div>
          `

          if (process.env.RESEND_API_KEY) {
            await resend.emails.send({
              from: 'Church Music Pro <notifications@churchmusicpro.com>',
              to: user.email,
              subject: `Daily Digest: Updates to ${event.name}`,
              html
            })
          } else {
            console.log('[Digest email simulated]', { to: user.email })
          }

          await prisma.notificationLog.create({
            data: {
              type: 'EVENT_UPDATED',
              churchId: schedule.churchId,
              eventId: event.id,
              recipientEmail: user.email,
              recipientName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              subject: `Daily Digest: Updates to ${event.name}`,
              metadata: { type: 'EVENT_UPDATE_DIGEST' }
            }
          })

          await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: new Date() } })
        } else {
          // Unknown email - mark as processed to avoid blocking
          await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'Unhandled type' } })
        }
      } catch (err: any) {
        await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { attempts: schedule.attempts + 1, lastAttemptAt: new Date(), errorReason: err?.message?.slice(0, 200) || 'send error' } })
      }
    }

    return NextResponse.json({ processed: schedules.length })
  } catch (error) {
    console.error('Failed to process scheduled emails', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendReferralPromotionEmail, sendNotificationEmail } from '@/lib/resend'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const TIMEOUT_MS = 25000 // 25 seconds to stay well under most cron timeout limits
  
  try {
    // Simple auth check - in production you'd want proper cron authentication
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find emails scheduled to be sent (due now or overdue)
    // Reduced batch size to prevent timeouts
    const scheduledEmails = await prisma.emailSchedule.findMany({
      where: {
        sentAt: null, // Not yet sent
        scheduledFor: {
          lte: new Date() // Due now or overdue
        },
        attempts: {
          lt: 3 // Haven't exceeded max attempts
        }
      },
      include: {
        church: true,
        user: true
      },
      take: 10 // Reduced from 50 to 10 to prevent timeouts
    })

    if (scheduledEmails.length === 0) {
      return NextResponse.json({ 
        message: 'No scheduled emails to process',
        processed: 0 
      })
    }

    console.log(`📧 Processing ${scheduledEmails.length} scheduled emails`)

    let successCount = 0
    let errorCount = 0

    for (const email of scheduledEmails) {
      // Check timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.log(`⏰ Timeout reached, stopping email processing. Processed ${successCount} emails successfully.`)
        break
      }
      
      try {
        // Update attempt counter
        await prisma.emailSchedule.update({
          where: { id: email.id },
          data: {
            attempts: email.attempts + 1,
            lastAttemptAt: new Date()
          }
        })

        // Process based on email type
        switch (email.emailType) {
          case 'REFERRAL_PROMOTION':
            const metadata = email.metadata as any
            await sendReferralPromotionEmail(
              email.user.email,
              `${email.user.firstName} ${email.user.lastName}`.trim(),
              metadata?.churchName || email.church.name,
              metadata?.referralCode || email.church.referralCode
            )
            break
          
          default:
            console.warn(`Unknown email type: ${email.emailType}`)
            continue
        }

        // Mark as sent and update church timestamp if needed in a single transaction
        if (email.emailType === 'REFERRAL_PROMOTION') {
          await prisma.$transaction([
            prisma.emailSchedule.update({
              where: { id: email.id },
              data: { sentAt: new Date() }
            }),
            prisma.church.update({
              where: { id: email.churchId },
              data: { referralEmailSentAt: new Date() }
            })
          ])
        } else {
          await prisma.emailSchedule.update({
            where: { id: email.id },
            data: { sentAt: new Date() }
          })
        }

        successCount++
        console.log(`✅ Sent ${email.emailType} email to ${email.user.email}`)

      } catch (emailError) {
        console.error(`❌ Failed to send ${email.emailType} email to ${email.user.email}:`, emailError)
        
        // Mark error if max attempts reached
        if (email.attempts + 1 >= 3) {
          await prisma.emailSchedule.update({
            where: { id: email.id },
            data: {
              errorReason: String(emailError)
            }
          })
        }
        
        errorCount++
      }
    }

    // Also process scheduled messages
    const scheduledMessages = await prisma.communication.findMany({
      where: {
        isScheduled: true,
        sentAt: null,
        scheduledFor: {
          lte: new Date()
        }
      },
      include: {
        church: true,
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      take: 5 // Reduced from 20 to 5 to prevent timeouts
    })

    let messageSuccessCount = 0
    let messageErrorCount = 0

    if (scheduledMessages.length > 0) {
      console.log(`📧 Processing ${scheduledMessages.length} scheduled messages`)

      for (const message of scheduledMessages) {
        // Check timeout
        if (Date.now() - startTime > TIMEOUT_MS) {
          console.log(`⏰ Timeout reached, stopping message processing. Processed ${messageSuccessCount} messages successfully.`)
          break
        }
        
        try {
          // Get recipients
          const recipients = await prisma.user.findMany({
            where: {
              id: { in: message.recipients },
              emailNotifications: true
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          })

          const churchName = message.church?.name || 'Church Music Ministry'
          const senderName = `${message.sender.firstName} ${message.sender.lastName}`

          // Send emails to recipients
          for (const recipient of recipients) {
            try {
              await sendNotificationEmail(
                recipient.email,
                `${recipient.firstName} ${recipient.lastName}`,
                message.subject,
                message.message,
                senderName,
                churchName
              )
            } catch (emailError) {
              console.error(`Failed to send scheduled message to ${recipient.email}:`, emailError)
            }
          }

          // Mark message as sent
          await prisma.communication.update({
            where: { id: message.id },
            data: {
              sentAt: new Date(),
              isScheduled: false
            }
          })

          // Create activity log
          await prisma.activity.create({
            data: {
              type: 'MESSAGE_SENT',
              description: `Sent scheduled message: ${message.subject}`,
              churchId: message.churchId,
              userId: message.sentBy,
              metadata: {
                subject: message.subject,
                recipientCount: recipients.length,
                messageType: 'SCHEDULED'
              }
            }
          })

          messageSuccessCount++
          console.log(`✅ Sent scheduled message: ${message.subject}`)

        } catch (messageError) {
          console.error(`❌ Failed to process scheduled message ${message.id}:`, messageError)
          messageErrorCount++
        }
      }
    }

    const executionTime = Date.now() - startTime
    const timedOut = executionTime > TIMEOUT_MS
    
    return NextResponse.json({
      message: `Processed ${scheduledEmails.length} scheduled emails and ${scheduledMessages.length} scheduled messages${timedOut ? ' (TIMED OUT)' : ''}`,
      emails: {
        processed: scheduledEmails.length,
        successful: successCount,
        failed: errorCount
      },
      messages: {
        processed: scheduledMessages.length,
        successful: messageSuccessCount,
        failed: messageErrorCount
      },
      executionTimeMs: executionTime,
      timedOut: timedOut
    })

  } catch (error) {
    console.error('Error processing scheduled emails:', error)
    return NextResponse.json(
      { error: 'Failed to process scheduled emails' },
      { status: 500 }
    )
  }
} 