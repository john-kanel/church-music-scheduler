import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resend } from '@/lib/resend'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subject, message, userEmail, userName, churchName } = await request.json()

    if (!subject || !message) {
      return NextResponse.json({ error: 'Feature title and description are required' }, { status: 400 })
    }

    // Create the email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
          <h2 style="color: #1f2937; margin: 0 0 10px 0;">💡 Feature Request from Church Music Pro</h2>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">
            Received: ${new Date().toLocaleString()}
          </p>
        </div>
        
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #1f2937; margin: 0 0 15px 0;">User Information</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${userName || 'Not provided'}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail || 'Not provided'}</p>
          <p style="margin: 5px 0;"><strong>Church:</strong> ${churchName || 'Not provided'}</p>
        </div>
        
        <div style="background-color: #fffbeb; padding: 20px; border: 1px solid #f59e0b; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0;">🎯 Feature Title</h3>
          <p style="margin: 0; font-size: 16px; font-weight: 500; color: #1f2937;">${subject}</p>
        </div>
        
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h3 style="color: #1f2937; margin: 0 0 15px 0;">📝 Description</h3>
          <div style="white-space: pre-wrap; line-height: 1.5; color: #374151;">${message}</div>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; font-size: 12px; color: #1e40af;">
            🚀 This feature request was submitted through the Church Music Pro platform.
          </p>
        </div>
        
        <div style="margin-top: 15px; padding: 10px; background-color: #f9fafb; border-radius: 8px;">
          <p style="margin: 0; font-size: 11px; color: #6b7280; text-align: center;">
            Consider this idea for future product development and roadmap planning.
          </p>
        </div>
      </div>
    `

    // Send email to support/development team
    await resend.emails.send({
      from: 'Church Music Pro <noreply@churchmusicpro.com>',
      to: 'john.kanel@hey.com',
      subject: `💡 Feature Request: ${subject}`,
      html: emailHtml,
      replyTo: userEmail || undefined
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feature request email error:', error)
    return NextResponse.json({ error: 'Failed to send feature request' }, { status: 500 })
  }
} 