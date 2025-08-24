import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
// Conditionally initialize Resend for local development
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is director or pastor
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user || (user.role !== 'DIRECTOR' && user.role !== 'ASSOCIATE_DIRECTOR' && user.role !== 'PASTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch ownership transfers for this church
    const transfers = await prisma.ownershipTransfer.findMany({
      where: { churchId: user.churchId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ transfers })
  } catch (error) {
    console.error('Error fetching ownership transfers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is director or pastor
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user || (user.role !== 'DIRECTOR' && user.role !== 'ASSOCIATE_DIRECTOR' && user.role !== 'PASTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, firstName, lastName, role, retireCurrentOwner } = body

    // Validate input
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    // Check if email is already a user in this church
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        churchId: user.churchId
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'This email is already associated with a user in your church' },
        { status: 400 }
      )
    }

    // Generate a secure temporary password
    const generateTempPassword = () => {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
      let password = ''
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return password
    }

    const tempPassword = generateTempPassword()
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(tempPassword, 12)

    // Create the user account directly
    const newUser = await prisma.user.create({
      data: {
        firstName: firstName?.trim() || '',
        lastName: lastName?.trim() || '',
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role,
        churchId: user.churchId,
        emailNotifications: true,
        smsNotifications: false,
        isVerified: true // Auto-verify since it's an admin invitation
      }
    })

    // If this is a retirement transfer, schedule the current owner for role change
    if (retireCurrentOwner) {
      // We'll handle this with a separate process later
      // For now, just log it
      console.log(`User ${user.id} will retire their role in 30 days after user ${newUser.id} accepts`)
    }

    // Send welcome email with login credentials
    const loginLink = `${process.env.NEXTAUTH_URL}/login`
    const churchName = user.church?.name || 'Church'
    const inviterName = `${user.firstName} ${user.lastName}`
    const userDisplayName = firstName || lastName ? `${firstName} ${lastName}`.trim() : email

    try {
      // Send email (if Resend is configured)
      if (resend) {
        await resend.emails.send({
          from: 'Church Music Pro <noreply@churchmusicpro.com>',
          to: email,
          subject: `Welcome to ${churchName} - Your Account is Ready`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #660033;">Welcome to ${churchName}!</h2>
            
            <p>Hello ${userDisplayName},</p>
            
            <p>${inviterName} has created your account on Church Music Pro as a <strong>${role.toLowerCase().replace('_', ' ')}</strong> for <strong>${churchName}</strong>.</p>
            
            <div style="background-color: #f0fdf4; border: 1px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #166534; margin: 0 0 16px 0;">🔑 Your Login Credentials</h3>
              <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
              <p style="color: #166534; font-size: 14px; margin-top: 12px;">⚠️ Please change this password after your first login for security.</p>
            </div>
            
            <p>As a ${role.toLowerCase().replace('_', ' ')}, you can:</p>
            <ul>
              <li>Manage events and schedules</li>
              <li>Invite and manage musicians</li>
              <li>Send communications to your team</li>
              <li>Access all church settings and data</li>
            </ul>
            
            ${retireCurrentOwner ? `
              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #92400e; margin: 0 0 8px 0;">Important: Ownership Transfer</h4>
                <p style="color: #92400e; margin: 0;">
                  ${inviterName} has transferred ownership to you and will retire their account in 30 days. You are now the primary administrator.
                </p>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginLink}" style="background-color: #660033; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Login to Your Account
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              After logging in, you can change your password in Profile Settings. If you have any questions, contact ${inviterName} directly.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
              Church Music Pro - Simplifying church music coordination
            </p>
          </div>
        `
        })
      } else {
        console.log('Email simulation (no RESEND_API_KEY):', { 
          to: email,
          tempPassword: tempPassword,
          subject: `Welcome to ${churchName} - Your Account is Ready` 
        })
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError)
      // Don't fail the request if email fails, just log it
    }

    return NextResponse.json({ 
      message: 'Director account created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        tempPassword: tempPassword // Include for debugging/logs
      }
    })
  } catch (error) {
    console.error('Error creating ownership transfer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is director or pastor
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user || (user.role !== 'DIRECTOR' && user.role !== 'ASSOCIATE_DIRECTOR' && user.role !== 'PASTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const transferId = searchParams.get('id')
    const email = searchParams.get('email')
    const deleteAll = searchParams.get('deleteAll') === 'true'

    // Handle bulk deletion by email
    if (deleteAll && email) {
      // Delete all non-completed transfers for this email in this church
      const deletedTransfers = await prisma.ownershipTransfer.deleteMany({
        where: {
          inviteeEmail: email,
          churchId: user.churchId,
          status: {
            not: 'COMPLETED' // Keep completed transfers for audit trail
          }
        }
      })

      return NextResponse.json({ 
        message: `Deleted ${deletedTransfers.count} transfer(s) for ${email}`,
        deletedCount: deletedTransfers.count
      })
    }

    if (!transferId) {
      return NextResponse.json({ error: 'Transfer ID is required' }, { status: 400 })
    }

    // Find the transfer and verify it belongs to this church
    const transfer = await prisma.ownershipTransfer.findFirst({
      where: {
        id: transferId,
        churchId: user.churchId
      }
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Allow deletion of PENDING, EXPIRED, and CANCELLED transfers
    // Don't allow deletion of ACCEPTED or COMPLETED transfers as they represent actual ownership changes
    if (transfer.status === 'ACCEPTED' || transfer.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot delete accepted or completed transfers' }, 
        { status: 400 }
      )
    }

    // Delete the transfer
    await prisma.ownershipTransfer.delete({
      where: { id: transferId }
    })

    return NextResponse.json({ message: 'Transfer deleted successfully' })
  } catch (error) {
    console.error('Error deleting ownership transfer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 