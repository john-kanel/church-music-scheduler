import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendReferralPromotionEmail } from '@/lib/resend'

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

    return NextResponse.json({
      message: `Processed ${scheduledEmails.length} scheduled emails`,
      processed: scheduledEmails.length,
      successful: successCount,
      failed: errorCount
    })

  } catch (error) {
    console.error('Error processing scheduled emails:', error)
    return NextResponse.json(
      { error: 'Failed to process scheduled emails' },
      { status: 500 }
    )
  }
} 