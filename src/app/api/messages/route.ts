import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendNotificationEmail } from '@/lib/resend'
import { logActivity } from '@/lib/activity'

// GET /api/messages - List communications for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // BROADCAST, INDIVIDUAL, ANNOUNCEMENT

    // Build filter
    const whereClause: any = {
      churchId: session.user.churchId
    }

    if (type) {
      whereClause.type = type
    }

    const messages = await prisma.communication.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        sentAt: 'desc'
      }
    })

    // Format the response
    const formattedMessages = messages.map((message: any) => ({
      id: message.id,
      subject: message.subject,
      content: message.message,
      type: message.type,
      sender: message.sender,
      recipientCount: message.recipients.length,
      recipients: message.recipients, // Array of user IDs
      sentAt: message.sentAt
    }))

    return NextResponse.json({ messages: formattedMessages })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

// POST /api/messages - Send new message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can send messages
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { subject, content, type, recipientIds } = body

    // Validation
    if (!subject || !content || !type) {
      return NextResponse.json(
        { error: 'Subject, content, and type are required' },
        { status: 400 }
      )
    }

    if (type === 'INDIVIDUAL' && (!recipientIds || recipientIds.length === 0)) {
      return NextResponse.json(
        { error: 'Recipients are required for individual messages' },
        { status: 400 }
      )
    }

    // Get recipients based on type
    let recipients: any[] = []
    
    if (type === 'BROADCAST') {
      // Send to all church members
      recipients = await prisma.user.findMany({
        where: {
          churchId: session.user.churchId,
          id: { not: session.user.id } // Don't send to self
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          emailNotifications: true
        }
      })
    } else if (type === 'INDIVIDUAL' && recipientIds) {
      // If specific recipients, validate they belong to the church
      recipients = await prisma.user.findMany({
        where: {
          id: { in: recipientIds },
          churchId: session.user.churchId
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          emailNotifications: true
        }
      })

      if (recipients.length !== recipientIds.length) {
        return NextResponse.json(
          { error: 'Some recipients do not belong to your church' },
          { status: 400 }
        )
      }
    }

    // Create the communication record
    const communication = await prisma.communication.create({
      data: {
        subject,
        message: content,
        type: 'EMAIL', // Map to the enum value
        churchId: session.user.churchId,
        sentBy: session.user.id,
        recipients: recipients.map((r: any) => r.id)
      }
    })

    // Send email notifications to recipients who have email notifications enabled
    const emailRecipients = recipients.filter(r => r.emailNotifications)
    
    if (emailRecipients.length > 0) {
      // Get church and sender info for email templates
      const church = await prisma.church.findUnique({
        where: { id: session.user.churchId },
        select: { name: true }
      })

      const sender = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true }
      })

      const churchName = church?.name || 'Church Music Ministry'
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Music Director'

      // Send emails
      for (const recipient of emailRecipients) {
        try {
          await sendNotificationEmail(
            recipient.email,
            `${recipient.firstName} ${recipient.lastName}`,
            subject,
            content,
            senderName,
            churchName
          )
        } catch (emailError) {
          console.error(`Failed to send email to ${recipient.email}:`, emailError)
          // Continue sending to other recipients even if one fails
        }
      }
    }

    // Create activity log
    await prisma.activity.create({
      data: {
        type: 'MESSAGE_SENT',
        description: `Sent message: ${subject}`,
        churchId: session.user.churchId,
        userId: session.user.id,
        metadata: {
          subject,
          recipientCount: recipients.length,
          messageType: type
        }
      }
    })

    return NextResponse.json({
      message: 'Message sent successfully',
      communication: communication,
      recipientCount: recipients.length,
      emailsSent: emailRecipients.length
    }, { status: 201 })

  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
} 