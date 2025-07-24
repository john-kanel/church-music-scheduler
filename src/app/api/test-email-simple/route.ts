import { NextRequest, NextResponse } from 'next/server'
import { 
  sendInvitationEmail,
  sendWelcomeEmail,
  sendPaymentConfirmationEmail,
  resend,
  getLogoHTML
} from '@/lib/resend'

import { render } from '@react-email/render'
import { ReferralInvitationEmail } from '@/components/emails/referral-invitation'
import { getEmailLogoHtml } from '../../../components/emails/email-logo'

const TEST_EMAIL = 'john.kanel@hey.com'

export async function POST() {
  console.log('🎵 Starting Simplified Email Test...')
  console.log(`📧 Sending key emails to: ${TEST_EMAIL}`)
  
  const emailResults: string[] = []
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  // 1. Test Invitation Email
  try {
    console.log('1️⃣ Testing Invitation Email...')
    await sendInvitationEmail(
      TEST_EMAIL,
      'John Kanel',
      'St. Mary\'s Catholic Church',
      'https://churchmusicpro.com/auth/signin',
      'Sarah Thompson',
      'TempPass123!'
    )
    emailResults.push('✅ Invitation email sent')
    console.log('✅ Invitation email successful')
    await delay(2000)
  } catch (error) {
    console.error('❌ Invitation email failed:', error)
    emailResults.push(`❌ Invitation email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // 2. Test Welcome Email
  try {
    console.log('2️⃣ Testing Welcome Email...')
    await sendWelcomeEmail(
      TEST_EMAIL,
      'John Kanel',
      'St. Mary\'s Catholic Church',
      30
    )
    emailResults.push('✅ Welcome email sent')
    console.log('✅ Welcome email successful')
    await delay(2000)
  } catch (error) {
    console.error('❌ Welcome email failed:', error)
    emailResults.push(`❌ Welcome email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // 3. Test Payment Confirmation Email
  try {
    console.log('3️⃣ Testing Payment Confirmation Email...')
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
    console.log('✅ Payment confirmation email successful')
    await delay(2000)
  } catch (error) {
    console.error('❌ Payment confirmation email failed:', error)
    emailResults.push(`❌ Payment confirmation email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // 4. Test Basic HTML Email (Referral Invitation)
  try {
    console.log('4️⃣ Testing Referral Invitation Email (React Component)...')
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
    console.log('✅ Referral invitation email successful')
    await delay(2000)
  } catch (error) {
    console.error('❌ Referral invitation email failed:', error)
    emailResults.push(`❌ Referral invitation email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // 5. Test Simple HTML Email
  try {
    console.log('5️⃣ Testing Simple HTML Email...')
    await resend.emails.send({
      from: 'Church Music Pro <noreply@churchmusicpro.com>',
      to: TEST_EMAIL,
      subject: '🎵 Church Music Pro - Template Showcase',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
            ${getEmailLogoHtml()}
            <h1 style="color: #333; margin: 0; font-size: 24px;">📧 Email Template Showcase</h1>
          </div>
          
          <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Hello John,
            </p>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              This email showcases the Church Music Pro branding and template design. All emails now feature:
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #660033; margin: 0 0 15px 0;">✨ Brand Features:</h3>
              <ul style="color: #333; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>Church Music Pro Logo</strong> at the top</li>
                <li><strong>Consistent color scheme</strong> (maroon #660033)</li>
                <li><strong>Professional layout</strong> with clean typography</li>
                <li><strong>Responsive design</strong> for all devices</li>
                <li><strong>Clear call-to-action</strong> sections</li>
              </ul>
            </div>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              This completes the email template testing. Check your inbox for all the different email types!
            </p>
          </div>
        </div>
      `
    })
    emailResults.push('✅ Simple HTML email sent')
    console.log('✅ Simple HTML email successful')
  } catch (error) {
    console.error('❌ Simple HTML email failed:', error)
    emailResults.push(`❌ Simple HTML email failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  console.log('🎉 Email testing completed!')

  return NextResponse.json({
    success: true,
    message: 'Email testing completed!',
    testEmail: TEST_EMAIL,
    results: emailResults,
    summary: [
      '1. Invitation Email (New musician invite with credentials)',
      '2. Welcome Email (Trial signup confirmation)',
      '3. Payment Confirmation (Subscription payment success)',
      '4. Referral Invitation (React component email)',
      '5. Simple HTML Email (Template showcase)'
    ]
  })
} 