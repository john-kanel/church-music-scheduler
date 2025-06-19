import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not defined in environment variables')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// Send invitation email
export async function sendInvitationEmail(
  to: string,
  recipientName: string,
  parishName: string,
  inviteLink: string,
  inviterName: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Church Music Scheduler <onboarding@resend.dev>',
      to,
      subject: `You're invited to join ${parishName}'s Music Ministry`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎵 Music Ministry Invitation</h1>
          </div>
          
          <div style="background: white; padding: 40px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${recipientName}!</h2>
            
            <p style="color: #666; line-height: 1.6; font-size: 16px;">
              ${inviterName} has invited you to join <strong>${parishName}'s Music Ministry</strong>. 
              We're excited to have you be part of our musical worship community!
            </p>
            
            <div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
              <h3 style="margin: 0 0 10px 0; color: #333;">What you'll get access to:</h3>
              <ul style="color: #666; margin: 0; padding-left: 20px;">
                <li>Event scheduling and calendar</li>
                <li>Music file sharing and downloads</li>
                <li>Communication with other musicians</li>
                <li>Assignment notifications and responses</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
              This invitation will expire in 7 days. If you have any questions, please contact ${inviterName}.
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                Sent by Church Music Scheduler
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
Hello ${recipientName}!

${inviterName} has invited you to join ${parishName}'s Music Ministry.

What you'll get access to:
• Event scheduling and calendar
• Music file sharing and downloads  
• Communication with other musicians
• Assignment notifications and responses

Accept your invitation: ${inviteLink}

This invitation will expire in 7 days. If you have any questions, please contact ${inviterName}.

---
Sent by Church Music Scheduler
      `
    })

    if (error) {
      console.error('Error sending invitation email:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to send invitation email:', error)
    throw error
  }
}

// Send message email
export async function sendMessageEmail(
  to: string,
  recipientName: string,
  subject: string,
  message: string,
  senderName: string,
  parishName: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Church Music Scheduler <onboarding@resend.dev>',
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #667eea; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${parishName}</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Music Ministry</p>
          </div>
          
          <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">${subject}</h2>
            
            <div style="color: #666; line-height: 1.6; font-size: 16px; white-space: pre-wrap;">
${message}
            </div>
            
            <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
              <p style="color: #999; font-size: 14px; margin: 0;">
                Sent by <strong>${senderName}</strong> from ${parishName}
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
${subject}

Hello ${recipientName},

${message}

---
Sent by ${senderName} from ${parishName}
      `
    })

    if (error) {
      console.error('Error sending message email:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to send message email:', error)
    throw error
  }
} 