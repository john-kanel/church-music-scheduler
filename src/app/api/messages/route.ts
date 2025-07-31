import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendNotificationEmail } from '@/lib/resend'
import { sendSMS, isSMSAvailable } from '@/lib/textmagic'
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
      sentAt: message.sentAt,
      scheduledFor: message.scheduledFor,
      isScheduled: message.isScheduled,
      status: message.sentAt ? 'sent' : (message.isScheduled ? 'scheduled' : 'draft')
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
    const { subject, content, type, recipientIds, scheduledFor, sendMethod = 'email' } = body

    // Validation
    if (!subject || !content || !type) {
      return NextResponse.json(
        { error: 'Subject, content, and type are required' },
        { status: 400 }
      )
    }

    // Validate scheduled date if provided
    const isScheduled = scheduledFor && new Date(scheduledFor) > new Date()
    if (scheduledFor && !isScheduled) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
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
          phone: true,
          emailNotifications: true,
          smsNotifications: true
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
          phone: true,
          emailNotifications: true,
          smsNotifications: true
        }
      })

      if (recipients.length !== recipientIds.length) {
        return NextResponse.json(
          { error: 'Some recipients do not belong to your church' },
          { status: 400 }
        )
      }
    }

    // Determine communication type based on send method
    let communicationType: string
    switch (sendMethod) {
      case 'sms':
        communicationType = 'SMS'
        break
      case 'both':
        communicationType = 'EMAIL' // Primary type, will handle both in logic
        break
      default:
        communicationType = 'EMAIL'
    }

    // Create the communication record
    const communication = await prisma.communication.create({
      data: {
        subject,
        message: content,
        type: communicationType as any, // Map to the enum value
        churchId: session.user.churchId,
        sentBy: session.user.id,
        recipients: recipients.map((r: any) => r.id),
        isScheduled: isScheduled,
        scheduledFor: isScheduled ? new Date(scheduledFor) : undefined,
        sentAt: isScheduled ? undefined : new Date()
      }
    })

    // Track successful sends
    let emailsSent = 0
    let smsSent = 0
    
    // Send notifications immediately only if not scheduled
    if (!isScheduled) {
      // Get church and sender info for templates
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

      // Send emails if method is 'email' or 'both'
      if (sendMethod === 'email' || sendMethod === 'both') {
        const emailRecipients = recipients.filter((r: any) => r.emailNotifications)
        
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
            emailsSent++
          } catch (emailError) {
            console.error(`Failed to send email to ${recipient.email}:`, emailError)
          }
        }
      }

      // Send SMS if method is 'sms' or 'both'
      if ((sendMethod === 'sms' || sendMethod === 'both') && isSMSAvailable()) {
        const smsRecipients = recipients.filter((r: any) => 
          r.smsNotifications && r.phone && r.phone.trim() !== ''
        )
        
        // Check if SMS-only mode has no valid recipients
        if (sendMethod === 'sms' && smsRecipients.length === 0) {
          // Analyze why no SMS recipients
          const hasPhone = recipients.filter((r: any) => r.phone && r.phone.trim() !== '')
          const hasSMSEnabled = recipients.filter((r: any) => r.smsNotifications)
          
          let errorMessage = 'Cannot send SMS: '
          if (hasPhone.length === 0) {
            errorMessage += 'No recipients have phone numbers.'
          } else if (hasSMSEnabled.length === 0) {
            errorMessage += 'No recipients have SMS notifications enabled.'
          } else {
            errorMessage += 'No recipients have both phone numbers and SMS notifications enabled.'
          }
          
          return NextResponse.json(
            { error: errorMessage },
            { status: 400 }
          )
        }
        
        // Create SMS message (shorter version for SMS)
        const smsMessage = sendMethod === 'sms' ? 
          content : 
          `${subject}\n\n${content.length > 100 ? content.substring(0, 97) + '...' : content}\n\n- ${senderName}, ${churchName}`

        for (const recipient of smsRecipients) {
          try {
            const result = await sendSMS(
              recipient.phone,
              smsMessage
            )
            
            if (result.success) {
              smsSent++
              console.log(`✅ SMS sent to ${recipient.phone}`)
            } else {
              console.error(`❌ Failed to send SMS to ${recipient.phone}:`, result.error)
            }
          } catch (smsError) {
            console.error(`Failed to send SMS to ${recipient.phone}:`, smsError)
          }
        }
        
        // Add warning for 'both' mode if some recipients can't receive SMS
        if (sendMethod === 'both' && smsRecipients.length < recipients.length) {
          const missingSMS = recipients.length - smsRecipients.length
          console.warn(`⚠️  ${missingSMS} recipients cannot receive SMS (missing phone or SMS disabled)`)
        }
      } else if (sendMethod === 'sms' || sendMethod === 'both') {
        console.warn('SMS sending requested but TextMagic is not configured')
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
          messageType: type,
          sendMethod: sendMethod,
          emailsSent: emailsSent,
          smsSent: smsSent
        }
      }
    })

    return NextResponse.json({
      message: isScheduled ? 'Message scheduled successfully' : 'Message sent successfully',
      communication: communication,
      recipientCount: recipients.length,
      emailsSent: emailsSent,
      smsSent: smsSent,
      sendMethod: sendMethod,
      smsAvailable: isSMSAvailable()
    }, { status: 201 })

  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
} 