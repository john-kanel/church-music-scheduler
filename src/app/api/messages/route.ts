import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendMessageEmail } from '@/lib/resend'
import { logActivity } from '@/lib/activity'

// GET /api/messages - List communications for the parish
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.parishId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const communications = await prisma.communication.findMany({
      where: {
        parishId: session.user.parishId
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        event: {
          select: {
            id: true,
            name: true,
            startTime: true
          }
        }
      },
      orderBy: {
        sentAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const totalCount = await prisma.communication.count({
      where: {
        parishId: session.user.parishId
      }
    })

    return NextResponse.json({ 
      communications,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error('Error fetching communications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch communications' },
      { status: 500 }
    )
  }
}

// POST /api/messages - Send new message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.parishId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can send messages
    if (!['DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      subject,
      message,
      type, // EMAIL, SMS, BOTH
      recipients, // Array of user IDs or "all"
      eventId
    } = body

    // Validation
    if (!subject || !message || !type) {
      return NextResponse.json(
        { error: 'Subject, message, and type are required' },
        { status: 400 }
      )
    }

    if (!recipients || (!Array.isArray(recipients) && recipients !== 'all')) {
      return NextResponse.json(
        { error: 'Recipients must be an array of user IDs or "all"' },
        { status: 400 }
      )
    }

    // If specific recipients, validate they belong to the parish
    let finalRecipients = recipients
    if (Array.isArray(recipients)) {
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: recipients },
          parishId: session.user.parishId
        },
        select: { id: true }
      })

      if (validUsers.length !== recipients.length) {
        return NextResponse.json(
          { error: 'Some recipients do not belong to your parish' },
          { status: 400 }
        )
      }
      finalRecipients = validUsers.map(u => u.id)
    }

    // Create communication record
    const communication = await prisma.communication.create({
      data: {
        subject,
        message,
        type,
        recipients: finalRecipients === 'all' ? ['all'] : finalRecipients,
        parishId: session.user.parishId,
        sentBy: session.user.id,
        ...(eventId && { eventId })
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        event: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Get actual recipient details for sending
    let recipientDetails: any[] = []
    if (finalRecipients === 'all') {
      recipientDetails = await prisma.user.findMany({
        where: {
          parishId: session.user.parishId,
          role: 'MUSICIAN'
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          emailNotifications: true,
          smsNotifications: true
        }
      })
    } else {
      recipientDetails = await prisma.user.findMany({
        where: {
          id: { in: finalRecipients },
          parishId: session.user.parishId
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          emailNotifications: true,
          smsNotifications: true
        }
      })
    }

    // Send actual emails/SMS
    // Filter recipients based on their notification preferences
    const emailRecipients = recipientDetails.filter(r => 
      r.emailNotifications && (type === 'EMAIL' || type === 'BOTH')
    )
    const smsRecipients = recipientDetails.filter(r => 
      r.smsNotifications && r.phone && (type === 'SMS' || type === 'BOTH')
    )

    // Get parish and sender info for email templates
    const parish = await prisma.parish.findUnique({
      where: { id: session.user.parishId },
      select: { name: true }
    })

    const sender = communication.sender
    const senderName = `${sender.firstName} ${sender.lastName}`
    const parishName = parish?.name || 'Church Music Ministry'

    // Send emails
    let emailsSent = 0
    let emailsFailed = 0
    
    for (const recipient of emailRecipients) {
      try {
        await sendMessageEmail(
          recipient.email,
          `${recipient.firstName} ${recipient.lastName}`,
          subject,
          message,
          senderName,
          parishName
        )
        emailsSent++
      } catch (emailError) {
        console.error(`Failed to send email to ${recipient.email}:`, emailError)
        emailsFailed++
      }
    }

    // TODO: Implement SMS sending with Twilio
    // For now, just count SMS recipients
    const smsSent = 0 // Will be implemented with Twilio

    console.log(`Sent ${emailsSent} emails, ${emailsFailed} failed`)
    console.log(`Would send SMS to ${smsRecipients.length} recipients`)

    // Log activity
    const recipientCount = recipientDetails.length
    const recipientText = finalRecipients === 'all' ? 'all musicians' : 
      recipientCount === 1 ? '1 musician' : `${recipientCount} musicians`
    
    await logActivity({
      type: 'MESSAGE_SENT',
      description: `Sent message "${subject}" to ${recipientText}`,
      parishId: session.user.parishId,
      userId: session.user.id,
      metadata: {
        subject,
        recipientCount,
        messageType: type,
        communicationId: communication.id
      }
    })

    return NextResponse.json({
      message: 'Communication sent successfully',
      communication,
      stats: {
        totalRecipients: recipientDetails.length,
        emailsSent: emailsSent,
        emailsFailed: emailsFailed,
        smsSent: smsSent,
        smsQueued: smsRecipients.length
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
} 