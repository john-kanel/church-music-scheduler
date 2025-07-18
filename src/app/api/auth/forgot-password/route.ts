import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/resend'
import { getEmailLogoHtml } from '@/components/emails/email-logo'
import crypto from 'crypto'

// Rate limiting map (in production, use Redis or similar)
const resetAttempts = new Map<string, { count: number; lastAttempt: number }>()

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()

    // Rate limiting - max 3 attempts per hour per email
    const now = Date.now()
    const resetData = resetAttempts.get(normalizedEmail)
    
    if (resetData) {
      // Reset count if more than 1 hour has passed
      if (now - resetData.lastAttempt > 60 * 60 * 1000) {
        resetAttempts.delete(normalizedEmail)
      } else if (resetData.count >= 3) {
        return NextResponse.json(
          { error: 'Too many reset attempts. Please try again in an hour.' },
          { status: 429 }
        )
      }
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { church: true }
    })

    // Always return success message for security (don't reveal if email exists)
    const successMessage = 'If an account with that email exists, we\'ve sent a password reset link.'

    if (!user) {
      return NextResponse.json({ message: successMessage })
    }

    // Update rate limiting
    const currentAttempts = resetAttempts.get(normalizedEmail)
    resetAttempts.set(normalizedEmail, {
      count: currentAttempts ? currentAttempts.count + 1 : 1,
      lastAttempt: now
    })

    // Generate secure reset token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    // Store reset token in database
    await prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt
      }
    })

    // Send reset email
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`
    
    try {
      await resend.emails.send({
        from: 'Church Music Pro <noreply@churchmusicpro.com>',
        to: normalizedEmail,
        subject: 'Reset Your Password - Church Music Pro',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${getEmailLogoHtml()}
            
            <div style="background: white; padding: 40px 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
              
              <p style="color: #666; line-height: 1.6; font-size: 16px;">
                Hello ${user.firstName},
              </p>
              
              <p style="color: #666; line-height: 1.6; font-size: 16px;">
                We received a request to reset your password for your Church Music Pro account at <strong>${user.church.name}</strong>.
              </p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #660033;">
                <p style="color: #666; margin: 0; font-size: 14px;">
                  <strong>⏰ This link will expire in 30 minutes</strong> for your security.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #660033; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Reset Your Password
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6;">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6;">
                If the button above doesn't work, copy and paste this link into your browser:
                <br>
                <a href="${resetUrl}" style="color: #660033; word-break: break-all;">${resetUrl}</a>
              </p>
              
              <div style="background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 3px solid #ef4444; margin: 20px 0;">
                <p style="color: #dc2626; margin: 0; font-size: 14px;">
                  <strong>Security Notice:</strong> If you continue to receive password reset emails that you didn't request, please contact support immediately.
                </p>
              </div>
              
              <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  Sent by Church Music Pro
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
Password Reset Request

Hello ${user.firstName},

We received a request to reset your password for your Church Music Pro account at ${user.church.name}.

Reset your password by clicking this link: ${resetUrl}

This link will expire in 30 minutes for your security.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

If you have any questions, please contact support.

---
Sent by Church Music Pro
        `
      })
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError)
      return NextResponse.json(
        { error: 'Failed to send reset email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: successMessage })

  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 