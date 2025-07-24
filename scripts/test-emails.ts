import { 
  sendInvitationEmail,
  sendMessageEmail,
  sendWelcomeEmail,
  sendPaymentConfirmationEmail,
  sendReferralPromotionEmail
} from '../src/lib/resend.js'

import {
  sendMusicianEventNotification,
  sendPastorMonthlyReport,
  sendPastorDailyDigest
} from '../src/lib/automation-emails.js'

import { resend } from '../src/lib/resend.js'

const TEST_EMAIL = 'john.kanel@hey.com'

async function sendAllTestEmails() {
  console.log('🎵 Starting Church Music Pro Email Copy Test...')
  console.log(`📧 All emails will be sent to: ${TEST_EMAIL}`)
  
  try {
    // 1. Invitation Email
    console.log('\n1️⃣ Sending Invitation Email...')
    await sendInvitationEmail(
      TEST_EMAIL,
      'John Kanel',
      'St. Mary\'s Catholic Church',
      'https://churchmusicpro.com/auth/signin',
      'Sarah Thompson',
      'TempPass123!'
    )
    console.log('✅ Invitation email sent')

    // 2. Welcome Email
    console.log('\n2️⃣ Sending Welcome Email...')
    await sendWelcomeEmail(
      TEST_EMAIL,
      'John Kanel',
      'St. Mary\'s Catholic Church',
      30
    )
    console.log('✅ Welcome email sent')

    // 3. Payment Confirmation Email
    console.log('\n3️⃣ Sending Payment Confirmation Email...')
    await sendPaymentConfirmationEmail(
      TEST_EMAIL,
      'John Kanel',
      'St. Mary\'s Catholic Church',
      'Professional Plan',
      35.00,
      'month',
      'January 28, 2025'
    )
    console.log('✅ Payment confirmation email sent')

    // 4. Referral Promotion Email
    console.log('\n4️⃣ Sending Referral Promotion Email...')
    await sendReferralPromotionEmail(
      TEST_EMAIL,
      'John Kanel',
      'St. Mary\'s Catholic Church',
      'STMARYS2024'
    )
    console.log('✅ Referral promotion email sent')

    // 5. Message Email
    console.log('\n5️⃣ Sending Message Email...')
    await sendMessageEmail(
      TEST_EMAIL,
      'John Kanel',
      'Rehearsal Update for Sunday Service',
      'Hi John,\n\nJust wanted to let you know that we\'ve moved tomorrow\'s rehearsal from 7:00 PM to 6:30 PM. Please arrive a few minutes early so we can run through the new hymn arrangement.\n\nLooking forward to seeing you there!\n\nBlessings,\nSarah',
      'Sarah Thompson',
      'St. Mary\'s Catholic Church'
    )
    console.log('✅ Message email sent')

    // 6. Musician Event Notification
    console.log('\n6️⃣ Sending Musician Event Notification...')
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
    console.log('✅ Musician event notification sent')

    // 7. Pastor Monthly Report
    console.log('\n7️⃣ Sending Pastor Monthly Report...')
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
    console.log('✅ Pastor monthly report sent')

    // 8. Pastor Daily Digest
    console.log('\n8️⃣ Sending Pastor Daily Digest...')
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
    console.log('✅ Pastor daily digest sent')

    // 9. Referral Invitation Email (React Component)
    console.log('\n9️⃣ Sending Referral Invitation Email...')
    const { render } = await import('@react-email/render')
    const { ReferralInvitationEmail } = await import('../src/components/emails/referral-invitation')
    
    const referralHtml = await render(ReferralInvitationEmail({
      referrerName: 'Sarah Thompson',
      referrerChurchName: 'St. Mary\'s Catholic Church',
      referralCode: 'STMARYS2024',
      recipientName: 'John Kanel'
    }))

    if (resend) {
      await resend.emails.send({
        from: 'Church Music Pro <noreply@churchmusicpro.com>',
        to: TEST_EMAIL,
        subject: 'Join St. Mary\'s Catholic Church on Church Music Pro!',
        html: referralHtml
      })
    } else {
      console.log('⚠️ Skipping email (RESEND_API_KEY not configured)')
    }
    console.log('✅ Referral invitation email sent')

    // 10. Referral Success Notification Email (React Component)
    console.log('\n🔟 Sending Referral Success Notification Email...')
    const { ReferralSuccessNotification } = await import('../src/components/emails/referral-success-notification')
    
    const successHtml = await render(ReferralSuccessNotification({
      referrerName: 'John Kanel',
      referrerChurchName: 'St. Mary\'s Catholic Church',
      referredPersonName: 'Father Michael',
      referredChurchName: 'Holy Trinity Parish',
      monthlyReward: 35,
      totalRewardsEarned: 3,
      totalMoneySaved: 89.97
    }))

    if (resend) {
      await resend.emails.send({
        from: 'Church Music Pro <noreply@churchmusicpro.com>',
        to: TEST_EMAIL,
        subject: 'Congratulations! Your Referral Was Successful',
        html: successHtml
      })
    } else {
      console.log('⚠️ Skipping email (RESEND_API_KEY not configured)')
    }
    console.log('✅ Referral success notification sent')

    console.log('\n🎉 All email tests completed successfully!')
    console.log(`📧 Check ${TEST_EMAIL} for all 10 email templates`)
    console.log('\n📋 Email Summary:')
    console.log('   1. Invitation Email (New musician invite)')
    console.log('   2. Welcome Email (Trial signup)')
    console.log('   3. Payment Confirmation (Subscription payment)')
    console.log('   4. Referral Promotion (Earn free months)')
    console.log('   5. Message Email (Communication between users)')
    console.log('   6. Musician Event Notification (Automated reminder)')
    console.log('   7. Pastor Monthly Report (Monthly schedule summary)')
    console.log('   8. Pastor Daily Digest (Daily activity updates)')
    console.log('   9. Referral Invitation (Invite other churches)')
    console.log('   10. Referral Success (Successful referral reward)')

  } catch (error) {
    console.error('❌ Error sending test emails:', error)
    process.exit(1)
  }
}

// Run the test
sendAllTestEmails() 