import { NextRequest, NextResponse } from 'next/server'
import { resend, getLogoHTML } from '@/lib/resend'
import { getEmailLogoHtml } from '../../../components/emails/email-logo'

export async function POST() {
  console.log('🧪 Testing single email send...')
  
  try {
    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY environment variable not set'
      }, { status: 500 })
    }

    console.log('📧 Sending test email...')
    
    // Send a simple test email
    const result = await resend.emails.send({
      from: 'Church Music Scheduler <noreply@churchmusicscheduler.com>',
      to: 'john.kanel@hey.com',
      subject: '🎵 Church Music Scheduler - Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
            ${getEmailLogoHtml()}
            <h1 style="color: #333; margin: 0; font-size: 24px;">🧪 Email System Test</h1>
          </div>
          
          <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Hello John,
            </p>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              This is a test email to verify that the Church Music Scheduler email system is working correctly.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #660033; margin: 0 0 10px 0;">✅ Test Results:</h3>
              <ul style="color: #333; margin: 0; padding-left: 20px;">
                <li>Email delivery system: Working</li>
                <li>Logo integration: Working</li>
                <li>HTML formatting: Working</li>
                <li>Styling: Working</li>
              </ul>
            </div>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              If you received this email, the system is ready to send all 10 email templates for copy proofing.
            </p>
            
            <p style="color: #666; font-size: 14px; font-style: italic; margin-top: 30px;">
              This is a test email sent at ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `
    })

    console.log('✅ Email sent successfully:', result)

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully!',
      emailId: result.data?.id,
      recipient: 'john.kanel@hey.com'
    })

  } catch (error) {
    console.error('❌ Error sending test email:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 