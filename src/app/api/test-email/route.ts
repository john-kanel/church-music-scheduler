import { NextRequest, NextResponse } from 'next/server'
import { 
  sendInvitationEmail,
  sendMessageEmail,
  sendWelcomeEmail,
  sendPaymentConfirmationEmail,
  sendReferralPromotionEmail,
  resend
} from '@/lib/resend'

import {
  sendMusicianEventNotification,
  sendPastorMonthlyReport,
  sendPastorDailyDigest
} from '@/lib/automation-emails'

import { render } from '@react-email/render'
import { ReferralInvitationEmail } from '@/components/emails/referral-invitation'
import { ReferralSuccessNotification } from '@/components/emails/referral-success-notification'
import { getEmailLogoHtml } from '../../../components/emails/email-logo'

const TEST_EMAIL = 'john.kanel@hey.com'

export async function POST() {
  console.log('🎵 Starting Church Music Pro Email Copy Test...')
  console.log(`📧 All emails will be sent to: ${TEST_EMAIL}`)
  
  try {
    const emailResults = []

    // Helper function to add delay between emails
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // 1. Invitation Email
    console.log('1️⃣ Sending Invitation Email...')
    try {
      await sendInvitationEmail(
        TEST_EMAIL,
        'John Kanel',
        'St. Mary\'s Catholic Church',
        'https://churchmusicpro.com/auth/signin',
        'Sarah Thompson',
        'TempPass123!'
      )
      emailResults.push('✅ Invitation email sent')
      await delay(1000) // 1 second delay
    } catch (error) {
      console.error('Error sending invitation email:', error)
      emailResults.push('❌ Invitation email failed')
    }

    // 2. Welcome Email
    console.log('2️⃣ Sending Welcome Email...')
    await sendWelcomeEmail(
      TEST_EMAIL,
      'John Kanel',
      'St. Mary\'s Catholic Church',
      30
    )
    emailResults.push('✅ Welcome email sent')

    // 3. Payment Confirmation Email
    console.log('3️⃣ Sending Payment Confirmation Email...')
    await sendPaymentConfirmationEmail(
      TEST_EMAIL,
      'John Kanel',
      'St. Mary\'s Catholic Church',
      'Professional Plan',
      35.00,
      'month',
      'January 28, 2025'
    )
    emailResults.push('✅ Payment confirmation email sent')

    // 4. Referral Promotion Email
    console.log('4️⃣ Sending Referral Promotion Email...')
    await sendReferralPromotionEmail(
      TEST_EMAIL,
      'John Kanel',
      'St. Mary\'s Catholic Church',
      'STMARYS2024'
    )
    emailResults.push('✅ Referral promotion email sent')

    // 5. Message Email
    console.log('5️⃣ Sending Message Email...')
    await sendMessageEmail(
      TEST_EMAIL,
      'John Kanel',
      'Rehearsal Update for Sunday Service',
      'Hi John,\n\nJust wanted to let you know that we\'ve moved tomorrow\'s rehearsal from 7:00 PM to 6:30 PM. Please arrive a few minutes early so we can run through the new hymn arrangement.\n\nLooking forward to seeing you there!\n\nBlessings,\nSarah',
      'Sarah Thompson',
      'St. Mary\'s Catholic Church'
    )
    emailResults.push('✅ Message email sent')

    // 6. Musician Event Notification
    console.log('6️⃣ Sending Musician Event Notification...')
    const sampleEvent = {
      name: 'Sunday Morning Mass',
      startTime: new Date('2025-01-26T10:00:00Z'),
      endTime: new Date('2025-01-26T11:00:00Z'),
      location: 'Main Sanctuary',
      description: 'Traditional Sunday morning service with full choir and organ',
      assignments: [
        { user: { firstName: 'Sarah', lastName: 'Thompson' } },
        { user: { firstName: 'Michael', lastName: 'Davis' } },
        { user: { firstName: 'Emily', lastName: 'Rodriguez' } }
      ]
    }
    
    await sendMusicianEventNotification(
      TEST_EMAIL,
      'John',
      sampleEvent,
      24
    )
    emailResults.push('✅ Musician event notification sent')

    // 7. Pastor Monthly Report
    console.log('7️⃣ Sending Pastor Monthly Report...')
    const sampleEvents = [
      {
        name: 'Sunday Mass - Week 1',
        startTime: new Date('2025-01-05T10:00:00Z'),
        location: 'Main Sanctuary',
        assignments: [
          { user: { firstName: 'Sarah', lastName: 'Thompson' } },
          { user: { firstName: 'John', lastName: 'Kanel' } }
        ]
      },
      {
        name: 'Wednesday Evening Prayer',
        startTime: new Date('2025-01-08T19:00:00Z'),
        location: 'Chapel',
        assignments: [
          { user: { firstName: 'Emily', lastName: 'Rodriguez' } }
        ]
      },
      {
        name: 'Sunday Mass - Week 2',
        startTime: new Date('2025-01-12T10:00:00Z'),
        location: 'Main Sanctuary',
        assignments: [
          { user: { firstName: 'Michael', lastName: 'Davis' } },
          { user: { firstName: 'Sarah', lastName: 'Thompson' } }
        ]
      }
    ]

    await sendPastorMonthlyReport(
      TEST_EMAIL,
      'Father John',
      'St. Mary\'s Catholic Church',
      sampleEvents,
      new Date('2025-01-01')
    )
    emailResults.push('✅ Pastor monthly report sent')

    // 8. Pastor Daily Digest
    console.log('8️⃣ Sending Pastor Daily Digest...')
    const sampleActivities = [
      {
        description: 'Sarah Thompson created Sunday Morning Mass event',
        createdAt: new Date('2025-01-27T09:15:00Z')
      },
      {
        description: 'John Kanel accepted assignment for Sunday Morning Mass',
        createdAt: new Date('2025-01-27T10:30:00Z')
      },
      {
        description: 'Emily Rodriguez was invited to join the music ministry',
        createdAt: new Date('2025-01-27T14:20:00Z')
      }
    ]

    await sendPastorDailyDigest(
      TEST_EMAIL,
      'Father John',
      'St. Mary\'s Catholic Church',
      sampleActivities,
      new Date()
    )
    emailResults.push('✅ Pastor daily digest sent')

    // 9. Referral Invitation Email (React Component)
    console.log('9️⃣ Sending Referral Invitation Email...')
    const referralHtml = await render(ReferralInvitationEmail({
      referrerName: 'Sarah Thompson',
      referrerChurchName: 'St. Mary\'s Catholic Church',
      referralCode: 'STMARYS2024',
      recipientName: 'John Kanel'
    }))

    await resend.emails.send({
      from: 'Church Music Pro <noreply@churchmusicpro.com>',
      to: TEST_EMAIL,
      subject: 'Join St. Mary\'s Catholic Church on Church Music Pro!',
      html: referralHtml
    })
    emailResults.push('✅ Referral invitation email sent')

    // 10. Referral Success Notification Email (React Component)
    console.log('🔟 Sending Referral Success Notification Email...')
    const successHtml = await render(ReferralSuccessNotification({
      referrerName: 'John Kanel',
      referrerChurchName: 'St. Mary\'s Catholic Church',
      referredPersonName: 'Father Michael',
      referredChurchName: 'Holy Trinity Parish',
              monthlyReward: 35,
      totalRewardsEarned: 3,
      totalMoneySaved: 89.97
    }))

    await resend.emails.send({
      from: 'Church Music Pro <noreply@churchmusicpro.com>',
      to: TEST_EMAIL,
      subject: 'Congratulations! Your Referral Was Successful',
      html: successHtml
    })
    emailResults.push('✅ Referral success notification sent')

    console.log('🎉 All email tests completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'All 10 email templates sent successfully!',
      testEmail: TEST_EMAIL,
      results: emailResults,
      summary: [
        '1. Invitation Email (New musician invite)',
        '2. Welcome Email (Trial signup)',
        '3. Payment Confirmation (Subscription payment)',
        '4. Referral Promotion (Earn free months)',
        '5. Message Email (Communication between users)',
        '6. Musician Event Notification (Automated reminder)',
        '7. Pastor Monthly Report (Monthly schedule summary)',
        '8. Pastor Daily Digest (Daily activity updates)',
        '9. Referral Invitation (Invite other churches)',
        '10. Referral Success (Successful referral reward)'
      ]
    })

  } catch (error) {
    console.error('❌ Error sending test emails:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send test emails',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 