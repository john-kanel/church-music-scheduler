import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not defined in environment variables')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// Generate a random password for new users
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Development mode email simulation
function simulateEmailInDev(emailData: any, tempPassword: string) {
  console.log('\n=== DEVELOPMENT MODE: EMAIL SIMULATION ===')
  console.log('To:', emailData.to)
  console.log('From:', emailData.from)
  console.log('Subject:', emailData.subject)
  console.log('Temporary Password:', tempPassword)
  console.log('=== EMAIL CONTENT ===')
  console.log(emailData.text)
  console.log('=== END EMAIL SIMULATION ===\n')
  
  return {
    data: { id: `dev-email-${Date.now()}` },
    temporaryPassword: tempPassword
  }
}

// Send invitation email with auto-generated credentials
export async function sendInvitationEmail(
  to: string,
  recipientName: string,
  churchName: string,
  inviteLink: string,
  inviterName: string,
  temporaryPassword?: string
) {
  try {
    const tempPassword = temporaryPassword || generateTemporaryPassword()
    
    // Use verified domain for all environments
    const fromAddress = 'Church Music Scheduler <noreply@churchmusicscheduler.com>'
    
    const emailData = {
      from: fromAddress,
      to,
      subject: `You're invited to join ${churchName}'s Music Ministry`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <!-- Logo Section - Space for Parish Logo -->
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #667eea;">
            <div style="height: 80px; background: #e9ecef; border: 2px dashed #adb5bd; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
              <span style="color: #6c757d; font-size: 14px;">Church Logo Will Appear Here</span>
            </div>
            <h1 style="color: #333; margin: 0; font-size: 28px;">🎵 Music Ministry Invitation</h1>
          </div>
          
          <div style="background: white; padding: 40px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${recipientName}!</h2>
            
            <p style="color: #666; line-height: 1.6; font-size: 16px;">
              ${inviterName} has invited you to join <strong>${churchName}'s Music Ministry</strong>. 
              We're excited to have you be part of our musical worship community!
            </p>

            <!-- Login Credentials Box -->
            <div style="margin: 30px 0; padding: 25px; background: #f1f5f9; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">🔐 Your Login Credentials</h3>
              <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p style="margin: 5px 0; color: #374151;"><strong>Username/Email:</strong> ${to}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 16px;">${tempPassword}</code></p>
              </div>
              <div style="background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  ⚠️ <strong>Important:</strong> Please change your password after your first login for security.
                </p>
              </div>
            </div>
            
            <div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
              <h3 style="margin: 0 0 10px 0; color: #333;">What you'll get access to:</h3>
              <ul style="color: #666; margin: 0; padding-left: 20px;">
                <li>Event scheduling and calendar</li>
                <li>Music file sharing and downloads</li>
                <li>Communication with other musicians</li>
                <li>Assignment notifications and responses</li>
                <li>Group management and collaboration</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-bottom: 10px;">
                Accept Invitation & Sign In
              </a>
              <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">
                Or visit: <a href="${process.env.NEXTAUTH_URL || 'https://yourapp.com'}/auth/signin" style="color: #667eea;">${process.env.NEXTAUTH_URL || 'https://yourapp.com'}/auth/signin</a>
              </p>
            </div>
            
            <div style="background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 3px solid #ef4444; margin: 20px 0;">
              <h4 style="margin: 0 0 5px 0; color: #dc2626;">Next Steps:</h4>
              <ol style="color: #991b1b; margin: 0; padding-left: 20px; font-size: 14px;">
                <li>Click the invitation link above</li>
                <li>Sign in with your email and temporary password</li>
                <li>Change your password to something secure</li>
                <li>Complete your profile information</li>
                <li>Start participating in music ministry!</li>
              </ol>
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

${inviterName} has invited you to join ${churchName}'s Music Ministry.

LOGIN CREDENTIALS:
Username: ${to}
Temporary Password: ${tempPassword}

IMPORTANT: Please change your password after your first login for security.

What you'll get access to:
• Event scheduling and calendar
• Music file sharing and downloads  
• Communication with other musicians
• Assignment notifications and responses
• Group management and collaboration

NEXT STEPS:
1. Visit: ${process.env.NEXTAUTH_URL || 'https://yourapp.com'}/auth/signin
2. Sign in with your email and temporary password
3. Change your password to something secure
4. Complete your profile information
5. Start participating in music ministry!

Accept your invitation: ${inviteLink}

This invitation will expire in 7 days. If you have any questions, please contact ${inviterName}.

---
Sent by Church Music Scheduler
      `
    }

    // Send the email using verified domain
    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      console.error('Error sending invitation email:', error)
      
      // Provide more helpful error messages
      if (error.message?.includes('You can only send testing emails')) {
        throw new Error('Email sending failed: Domain verification issue. Please check your Resend domain configuration.')
      }
      
      throw error
    }

    return { data, temporaryPassword: tempPassword }
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
  churchName: string
) {
  try {
    // Use verified domain for all environments
    const fromAddress = 'Church Music Scheduler <noreply@churchmusicscheduler.com>'
    
    const emailData = {
      from: fromAddress,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #667eea; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${churchName}</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Music Ministry</p>
          </div>
          
          <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">${subject}</h2>
            
            <div style="color: #666; line-height: 1.6; font-size: 16px; white-space: pre-wrap;">
${message}
            </div>
            
            <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
              <p style="color: #999; font-size: 14px; margin: 0;">
                Sent by <strong>${senderName}</strong> from ${churchName}
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
Sent by ${senderName} from ${churchName}
      `
    }

    // Send the email using verified domain
    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      console.error('Error sending message email:', error)
      
      // Provide more helpful error messages
      if (error.message?.includes('You can only send testing emails')) {
        throw new Error('Email sending failed: Domain verification issue. Please check your Resend domain configuration.')
      }
      
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to send message email:', error)
    throw error
  }
}

// Alias for sendMessageEmail to maintain compatibility
export const sendNotificationEmail = sendMessageEmail; 