import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendReferralPromotionEmail, sendNotificationEmail } from '@/lib/resend'

export async function POST(request: NextRequest) {
  try {
    // Simple auth check - in production you'd want proper cron authentication
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find emails scheduled to be sent (due now or overdue)
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
      take: 50 // Process up to 50 emails at a time
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

        // Mark as sent
        await prisma.emailSchedule.update({
          where: { id: email.id },
          data: {
            sentAt: new Date()
          }
        })

        // Update church referral email sent timestamp if this is a referral email
        if (email.emailType === 'REFERRAL_PROMOTION') {
          await prisma.church.update({
            where: { id: email.churchId },
            data: { referralEmailSentAt: new Date() }
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
      take: 20 // Process up to 20 messages at a time
    })

    let messageSuccessCount = 0
    let messageErrorCount = 0

    if (scheduledMessages.length > 0) {
      console.log(`📧 Processing ${scheduledMessages.length} scheduled messages`)

      for (const message of scheduledMessages) {
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

    return NextResponse.json({
      message: `Processed ${scheduledEmails.length} scheduled emails and ${scheduledMessages.length} scheduled messages`,
      emails: {
        processed: scheduledEmails.length,
        successful: successCount,
        failed: errorCount
      },
      messages: {
        processed: scheduledMessages.length,
        successful: messageSuccessCount,
        failed: messageErrorCount
      }
    })

  } catch (error) {
    console.error('Error processing scheduled emails:', error)
    return NextResponse.json(
      { error: 'Failed to process scheduled emails' },
      { status: 500 }
    )
  }
} 