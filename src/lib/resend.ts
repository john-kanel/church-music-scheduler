import { Resend } from 'resend'
import { getEmailLogoHtml } from '../components/emails/email-logo'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not defined in environment variables')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// Email-safe logo HTML (using text-based logo for guaranteed compatibility)
const LOGO_HTML = `
  <div style="text-align: center; margin: 20px 0;">
    <div style="
      background: linear-gradient(135deg, #660033 0%, #8B0045 100%);
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      display: inline-block;
      font-family: 'Georgia', serif;
      box-shadow: 0 4px 8px rgba(102, 0, 51, 0.3);
    ">
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">♪ Church Music Scheduler</div>
      <div style="font-size: 12px; opacity: 0.9; letter-spacing: 1px;">ORGANIZE • SCHEDULE • WORSHIP</div>
    </div>
  </div>
`;

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
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
            ${getEmailLogoHtml()}
            <h1 style="color: #333; margin: 0; font-size: 28px;">🎵 Music Ministry Invitation</h1>
          </div>
          
          <div style="background: white; padding: 40px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${recipientName}!</h2>
            
            <p style="color: #666; line-height: 1.6; font-size: 16px;">
              ${inviterName} has invited you to join <strong>${churchName}'s Music Ministry</strong>. 
              We're excited to have you be part of our musical worship community!
            </p>

            <!-- Login Credentials Box -->
            <div style="margin: 30px 0; padding: 25px; background: #FDF2F8; border-radius: 8px; border-left: 4px solid #660033;">
              <h3 style="margin: 0 0 15px 0; color: #660033; font-size: 18px;">🔐 Your Login Credentials</h3>
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
            
            <div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #660033;">
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
                 style="background: #660033; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-bottom: 10px;">
                Accept Invitation & Sign In
              </a>
              <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">
                Or visit: <a href="${process.env.NEXTAUTH_URL || 'https://yourapp.com'}/auth/signin" style="color: #660033;">${process.env.NEXTAUTH_URL || 'https://yourapp.com'}/auth/signin</a>
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
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
            ${getEmailLogoHtml()}
            <h1 style="color: #333; margin: 0; font-size: 24px;">${churchName}</h1>
            <p style="color: #6B7280; margin: 5px 0 0 0;">Music Ministry</p>
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

// Send welcome email after trial signup
export async function sendWelcomeEmail(
  to: string,
  recipientName: string,
  churchName: string,
  trialDaysRemaining: number = 30
) {
  try {
    const fromAddress = 'Church Music Scheduler <support@churchmusicscheduler.com>'
    
    const emailData = {
      from: fromAddress,
      to,
      subject: 'Welcome to Church Music Scheduler - Your 30-Day Trial Starts Now!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <!-- Logo Section -->
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
            ${getEmailLogoHtml()}
            <div style="margin-bottom: 20px;"></div>
          </div>
          
          <div style="background: white; padding: 40px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${recipientName}!</h2>
            
            <p style="color: #666; line-height: 1.6; font-size: 16px;">
              Congratulations on signing up for Church Music Scheduler! We're excited to help ${churchName} streamline your music ministry.
            </p>

            <!-- Trial Information Box -->
            <div style="margin: 30px 0; padding: 25px; background: #FDF2F8; border-radius: 8px; border-left: 4px solid #660033;">
              <h3 style="margin: 0 0 15px 0; color: #660033; font-size: 20px;">🚀 Your Free Trial is Active!</h3>
              <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p style="margin: 5px 0; color: #374151; font-size: 16px;"><strong>✅ No credit card required</strong></p>
                <p style="margin: 5px 0; color: #374151; font-size: 16px;"><strong>✅ ${trialDaysRemaining} days of full access</strong></p>
                <p style="margin: 5px 0; color: #374151; font-size: 16px;"><strong>✅ All features unlocked</strong></p>
              </div>
              <div style="background: #FDF2F8; padding: 12px; border-radius: 6px; border-left: 3px solid #660033;">
                <p style="margin: 0; color: #660033; font-size: 14px;">
                  💡 <strong>Perfect timing:</strong> You have plenty of time to explore all features and see how Church Music Scheduler can transform your music ministry!
                </p>
              </div>
            </div>
            
            <!-- Getting Started Section -->
            <div style="margin: 30px 0; padding: 20px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
              <h3 style="margin: 0 0 15px 0; color: #15803d; font-size: 18px;">🎯 Great Starting Tip</h3>
              <p style="color: #166534; margin: 0 0 10px 0; font-size: 16px;">
                <strong>Invite all the members of your music ministry</strong> - they can join your trial and start collaborating immediately!
              </p>
              <p style="color: #166534; margin: 0; font-size: 14px;">
                The more people you invite during your trial, the better you'll understand how powerful Church Music Scheduler can be for your team.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/dashboard" 
                 style="background: #660033; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-bottom: 10px; font-size: 16px;">
                Start Exploring Your Dashboard →
              </a>
            </div>
            
            <!-- What you can do -->
            <div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
              <h3 style="margin: 0 0 15px 0; color: #333;">What you can do right now:</h3>
              <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>Schedule events</strong> - Add your upcoming services and rehearsals</li>
                <li><strong>Invite musicians</strong> - Build your music ministry team</li>
                <li><strong>Share music files</strong> - Upload and organize your sheet music</li>
                <li><strong>Send messages</strong> - Communicate with your team instantly</li>
                <li><strong>Create groups</strong> - Organize your choir, instrumentalists, and more</li>
              </ul>
            </div>
            
            <!-- Support Section -->
            <div style="background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 3px solid #ef4444; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #dc2626;">Need Help?</h4>
              <p style="color: #991b1b; margin: 0; font-size: 14px;">
                If you have any questions or run into any issues, please don't hesitate to reach out to us at 
                <a href="mailto:support@churchmusicscheduler.com" style="color: #dc2626; font-weight: bold;">support@churchmusicscheduler.com</a>
              </p>
            </div>
            
            <p style="color: #666; font-size: 16px; text-align: center; margin-top: 30px;">
              Welcome to the Church Music Scheduler family! 🎵
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
Welcome to Church Music Scheduler!

Hello ${recipientName}!

Congratulations on signing up for Church Music Scheduler! We're excited to help ${churchName} streamline your music ministry.

YOUR FREE TRIAL IS ACTIVE!
✅ No credit card required
✅ ${trialDaysRemaining} days of full access  
✅ All features unlocked

GREAT STARTING TIP:
Invite all the members of your music ministry - they can join your trial and start collaborating immediately! The more people you invite during your trial, the better you'll understand how powerful Church Music Scheduler can be for your team.

WHAT YOU CAN DO RIGHT NOW:
• Schedule events - Add your upcoming services and rehearsals
• Invite musicians - Build your music ministry team
• Share music files - Upload and organize your sheet music
• Send messages - Communicate with your team instantly
• Create groups - Organize your choir, instrumentalists, and more

NEED HELP?
If you have any questions or run into any issues, please don't hesitate to reach out to us at support@churchmusicscheduler.com

Start exploring: ${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/dashboard

Welcome to the Church Music Scheduler family! 🎵

---
Sent by Church Music Scheduler
      `
    }

    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      console.error('Error sending welcome email:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to send welcome email:', error)
    throw error
  }
}

// Send payment confirmation email after subscription conversion
export async function sendPaymentConfirmationEmail(
  to: string,
  recipientName: string,
  churchName: string,
  planName: string,
  planPrice: number,
  planInterval: string,
  nextBillingDate: string
) {
  try {
    const fromAddress = 'Church Music Scheduler <support@churchmusicscheduler.com>'
    
    const emailData = {
      from: fromAddress,
      to,
      subject: 'Payment Confirmed - Welcome to Your Full Subscription!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <!-- Logo Section -->
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #22c55e;">
            ${getEmailLogoHtml()}
            <h1 style="color: #333; margin: 0; font-size: 28px;">✅ Payment Confirmed!</h1>
          </div>
          
          <div style="background: white; padding: 40px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Thank you, ${recipientName}!</h2>
            
            <p style="color: #666; line-height: 1.6; font-size: 16px;">
              Your payment has been successfully processed and ${churchName} now has full access to Church Music Scheduler. Thank you for choosing us to support your music ministry!
            </p>

            <!-- Subscription Details Box -->
            <div style="margin: 30px 0; padding: 25px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
              <h3 style="margin: 0 0 15px 0; color: #15803d; font-size: 20px;">📋 Your Subscription Details</h3>
              <div style="background: white; padding: 15px; border-radius: 6px;">
                <p style="margin: 5px 0; color: #374151; font-size: 16px;"><strong>Plan:</strong> ${planName}</p>
                <p style="margin: 5px 0; color: #374151; font-size: 16px;"><strong>Price:</strong> $${planPrice}/${planInterval}</p>
                <p style="margin: 5px 0; color: #374151; font-size: 16px;"><strong>Next billing date:</strong> ${nextBillingDate}</p>
              </div>
            </div>
            
            <!-- Manage Billing -->
            <div style="margin: 30px 0; padding: 20px; background: #FDF2F8; border-radius: 8px; border-left: 4px solid #660033;">
              <h3 style="margin: 0 0 15px 0; color: #660033; font-size: 18px;">💳 Manage Your Billing</h3>
              <p style="color: #660033; margin: 0 0 15px 0; font-size: 14px;">
                You can view invoices, update payment methods, or change plans anytime through your billing portal.
              </p>
              <div style="text-align: center;">
                <a href="${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/billing" 
                   style="background: #660033; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">
                  Manage Billing →
                </a>
              </div>
            </div>
            
            <!-- What's Next -->
            <div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
              <h3 style="margin: 0 0 15px 0; color: #333;">What's next:</h3>
              <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>Continue building your team</strong> - Invite more musicians to join</li>
                <li><strong>Explore advanced features</strong> - Set up automation and template</li>
                <li><strong>Schedule upcoming events</strong> - Plan your services and rehearsals</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/dashboard" 
                 style="background: #660033; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-bottom: 10px; font-size: 16px;">
                Continue to Dashboard →
              </a>
            </div>
            
            <!-- Support Section -->
            <div style="background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 3px solid #ef4444; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #dc2626;">Questions or Need Support?</h4>
              <p style="color: #991b1b; margin: 0; font-size: 14px;">
                We're here to help! Contact us anytime at 
                <a href="mailto:support@churchmusicscheduler.com" style="color: #dc2626; font-weight: bold;">support@churchmusicscheduler.com</a>
              </p>
            </div>
            
            <p style="color: #666; font-size: 16px; text-align: center; margin-top: 30px;">
              Thank you for being part of the Church Music Scheduler family! 🎵
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
Payment Confirmed!

Thank you, ${recipientName}!

Your payment has been successfully processed and ${churchName} now has full access to Church Music Scheduler. Thank you for choosing us to support your music ministry!

YOUR SUBSCRIPTION DETAILS:
Plan: ${planName}
Price: $${planPrice}/${planInterval}
Next billing date: ${nextBillingDate}

MANAGE YOUR BILLING:
You can view invoices, update payment methods, or change plans anytime through your billing portal.
Visit: ${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/billing

WHAT'S NEXT:
• Continue building your team - Invite more musicians to join
• Explore advanced features - Set up automation and template
• Schedule upcoming events - Plan your services and rehearsals

QUESTIONS OR NEED SUPPORT?
We're here to help! Contact us anytime at support@churchmusicscheduler.com

Continue to dashboard: ${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/dashboard

Thank you for being part of the Church Music Scheduler family! 🎵

---
Sent by Church Music Scheduler
      `
    }

    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      console.error('Error sending payment confirmation email:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error)
    throw error
  }
}

// Send referral promotion email (24 hours after payment)
export async function sendReferralPromotionEmail(
  to: string,
  recipientName: string,
  churchName: string,
  referralCode: string
) {
  try {
    const fromAddress = 'Church Music Scheduler <support@churchmusicscheduler.com>'
    const referralUrl = `${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/auth/signup?ref=${referralCode}`
    
    const emailData = {
      from: fromAddress,
      to,
      subject: 'Earn Free Months - Refer Other Churches!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <!-- Logo Section -->
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #f59e0b;">
            ${getEmailLogoHtml()}
            <h1 style="color: #333; margin: 0; font-size: 28px;">💰 Earn Free Months!</h1>
          </div>
          
          <div style="background: white; padding: 40px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${recipientName}!</h2>
            
            <p style="color: #666; line-height: 1.6; font-size: 16px;">
              Now that ${churchName} is enjoying Church Music Scheduler, we'd love your help spreading the word to other churches in your community!
            </p>

            <!-- Referral Reward Box -->
            <div style="margin: 30px 0; padding: 25px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 20px;">🎁 Referral Rewards</h3>
              <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                <p style="margin: 5px 0; color: #374151; font-size: 16px;"><strong>✨ Get 1 month free</strong> for each church you refer</p>
                <p style="margin: 5px 0; color: #374151; font-size: 16px;"><strong>🎯 No limit</strong> on referrals or free months</p>
                <p style="margin: 5px 0; color: #374151; font-size: 16px;"><strong>💸 Instant credit</strong> applied to your account</p>
              </div>
              <div style="background: #fef9c3; padding: 12px; border-radius: 6px; border-left: 3px solid #eab308;">
                <p style="margin: 0; color: #854d0e; font-size: 14px;">
                  💡 <strong>Your referral code:</strong> <code style="background: #fbbf24; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 16px; color: white;">${referralCode}</code>
                </p>
              </div>
            </div>
            
            <!-- Who to Share With -->
            <div style="margin: 30px 0; padding: 20px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
              <h3 style="margin: 0 0 15px 0; color: #15803d; font-size: 18px;">🤝 Perfect for sharing with:</h3>
              <ul style="color: #166534; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>Pastor friends</strong> at neighboring churches</li>
                <li><strong>Music directors</strong> in your city</li>
                <li><strong>Worship leaders</strong> from conferences and events</li>
                <li><strong>Anyone</strong> who could benefit from better music ministry organization</li>
              </ul>
            </div>

            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/rewards" 
                 style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-bottom: 10px; font-size: 16px;">
                Track Your Referrals →
              </a>
            </div>
            
            <!-- How It Works -->
            <div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
              <h3 style="margin: 0 0 15px 0; color: #333;">How it works:</h3>
              <ol style="color: #666; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Share your referral code with other churches</li>
                <li>They sign up using your code and complete their trial</li>
                <li>When they become a paying customer, you get 1 month free!</li>
                <li>Your next billing is automatically reduced</li>
              </ol>
            </div>
            
            <!-- Support Section -->
            <div style="background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 3px solid #ef4444; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #dc2626;">Questions About Referrals?</h4>
              <p style="color: #991b1b; margin: 0; font-size: 14px;">
                We're happy to help explain how our referral program works! Contact us at 
                <a href="mailto:support@churchmusicscheduler.com" style="color: #dc2626; font-weight: bold;">support@churchmusicscheduler.com</a>
              </p>
            </div>
            
            <p style="color: #666; font-size: 16px; text-align: center; margin-top: 30px;">
              Thank you for helping us serve more churches! 🎵
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
Earn Free Months - Refer Other Churches!

Hi ${recipientName}!

Now that ${churchName} is enjoying Church Music Scheduler, we'd love your help spreading the word to other churches in your community!

REFERRAL REWARDS:
✨ Get 1 month free for each church you refer
🎯 No limit on referrals or free months  
💸 Instant credit applied to your account

Your referral code: ${referralCode}

PERFECT FOR SHARING WITH:
• Pastor friends at neighboring churches
• Music directors in your city
• Worship leaders from conferences and events
• Anyone who could benefit from better music ministry organization

HOW IT WORKS:
1. Share your referral code with other churches
2. They sign up using your code and complete their trial
3. When they become a paying customer, you get 1 month free!
4. Your next billing is automatically reduced

Track your referrals: ${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/rewards

QUESTIONS ABOUT REFERRALS?
We're happy to help explain how our referral program works! Contact us at support@churchmusicscheduler.com

Thank you for helping us serve more churches! 🎵

---
Sent by Church Music Scheduler
      `
    }

    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      console.error('Error sending referral promotion email:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to send referral promotion email:', error)
    throw error
  }
} 

// Helper function to generate logo HTML
export const getLogoHTML = () => {
  return LOGO_HTML;
};

export default resend; 