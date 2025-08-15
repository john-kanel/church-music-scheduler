import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/resend'
import { getEmailLogoHtml } from '@/components/emails/email-logo'

// GET /api/cron/process-cancellation-notifications - Process pending cancellation notifications
export async function GET(request: NextRequest) {
  try {
    // This endpoint can be called by a cron job to process pending notifications
    // Find notifications that are older than 5 minutes and haven't been sent
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    
    const pendingNotifications = await prisma.cancellationNotification.findMany({
      where: {
        sentAt: null,
        createdAt: {
          lte: fiveMinutesAgo
        }
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startTime: true,
            location: true,
            description: true,
            churchId: true
          }
        }
      }
    })

    if (pendingNotifications.length === 0) {
      return NextResponse.json({ 
        message: 'No pending notifications to process',
        processed: 0 
      })
    }

    // Group notifications by batch key
    const batchGroups = pendingNotifications.reduce((groups: Record<string, any[]>, notification: any) => {
      if (!groups[notification.batchKey]) {
        groups[notification.batchKey] = []
      }
      groups[notification.batchKey].push(notification)
      return groups
    }, {})

    let totalProcessed = 0

    // Process each batch
    for (const [batchKey, notifications] of Object.entries(batchGroups)) {
      try {
        await processBatch(notifications as any[])
        totalProcessed += (notifications as any[]).length
      } catch (error) {
        console.error(`Error processing batch ${batchKey}:`, error)
        // Continue with other batches even if one fails
      }
    }

    return NextResponse.json({ 
      message: `Processed ${totalProcessed} cancellation notifications in ${Object.keys(batchGroups).length} batches`,
      processed: totalProcessed,
      batches: Object.keys(batchGroups).length
    })

  } catch (error) {
    console.error('Error processing cancellation notifications:', error)
    return NextResponse.json(
      { error: 'Failed to process cancellation notifications' },
      { status: 500 }
    )
  }
}

async function processBatch(notifications: any[]) {
  if (notifications.length === 0) return

  const event = notifications[0].event
  const churchId = event.churchId

  // Get recipient list (all musicians + directors + associate directors, no pastors)
  const recipients = await prisma.user.findMany({
    where: {
      churchId: churchId,
      role: {
        in: ['MUSICIAN', 'DIRECTOR', 'ASSOCIATE_DIRECTOR']
      },
      // Removed isVerified requirement to send notifications to unverified musicians
      emailNotifications: true // Respect email preferences
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  })

  if (recipients.length === 0) {
    // Mark as sent even if no recipients
    await prisma.cancellationNotification.updateMany({
      where: {
        id: {
          in: notifications.map(n => n.id)
        }
      },
      data: {
        sentAt: new Date()
      }
    })
    return
  }

  // Determine urgency (is event within 2 hours?)
  const hoursUntilEvent = (new Date(event.startTime).getTime() - new Date().getTime()) / (1000 * 60 * 60)
  const isUrgent = hoursUntilEvent <= 2

  // Create email content
  const roles = notifications
    .map((n: any) => n.roleName)
    .filter(Boolean)
    .filter((role: string, index: number, arr: string[]) => arr.indexOf(role) === index) // Remove duplicates

  const emailContent = createCancellationEmailContent({
    event,
    roles,
    isUrgent,
    cancellationCount: notifications.length
  })

  // Send email to all recipients
  const emailPromises = recipients.map(recipient => 
    resend.emails.send({
      from: 'Church Music Pro <notifications@churchmusicpro.com>',
      to: recipient.email,
      subject: isUrgent ? 
        `🚨 URGENT: Position Available - ${event.name}` : 
        `Position Available - ${event.name}`,
      html: emailContent.replace('{{RECIPIENT_NAME}}', `${recipient.firstName} ${recipient.lastName}`)
    })
  )

  await Promise.all(emailPromises)

  // Mark notifications as sent
  await prisma.cancellationNotification.updateMany({
    where: {
      id: {
        in: notifications.map(n => n.id)
      }
    },
    data: {
      sentAt: new Date()
    }
  })

  console.log(`Sent ${notifications.length} cancellation notifications for event ${event.name} to ${recipients.length} recipients`)
}

// Create email content for cancellation notifications
function createCancellationEmailContent({
  event,
  roles,
  isUrgent,
  cancellationCount
}: {
  event: any
  roles: string[]
  isUrgent: boolean
  cancellationCount: number
}) {
  const eventDate = new Date(event.startTime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  const eventTime = new Date(event.startTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  let positionText = ''
  if (roles.length === 1) {
    positionText = `The ${roles[0].toLowerCase()} position`
  } else if (roles.length === 2) {
    positionText = `The ${roles[0].toLowerCase()} and ${roles[1].toLowerCase()} positions`
  } else if (roles.length > 2) {
    positionText = `Multiple positions (${roles.join(', ')})`
  } else {
    positionText = cancellationCount > 1 ? 'Multiple positions' : 'A position'
  }

  const urgencyBanner = isUrgent ? `
    <div style="background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h2 style="color: #dc2626; margin: 0 0 8px 0; font-size: 18px;">🚨 URGENT - Event Starting Soon</h2>
      <p style="color: #7f1d1d; margin: 0; font-weight: 600;">This event starts in less than 2 hours!</p>
    </div>
  ` : ''

  const signupLink = `${process.env.NEXTAUTH_URL}/events?highlight=${event.id}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Position Available - ${event.name}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${urgencyBanner}
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        ${getEmailLogoHtml()}
        <h1 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px;">Position Now Available</h1>
        <p style="color: #4b5563; margin: 0 0 16px 0; font-size: 16px;">
          Hello {{RECIPIENT_NAME}},
        </p>
        <p style="color: #4b5563; margin: 0; font-size: 16px;">
          ${positionText} ${cancellationCount > 1 ? 'are' : 'is'} now available for the following event:
        </p>
      </div>

      <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">${event.name}</h2>
        <div style="margin-bottom: 12px;">
          <strong style="color: #374151;">Date:</strong> <span style="color: #6b7280;">${eventDate}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="color: #374151;">Time:</strong> <span style="color: #6b7280;">${eventTime}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="color: #374151;">Location:</strong> <span style="color: #6b7280;">${event.location}</span>
        </div>
        ${roles.length > 0 ? `
          <div style="margin-bottom: 12px;">
            <strong style="color: #374151;">Available Position${roles.length > 1 ? 's' : ''}:</strong> 
            <span style="color: #6b7280;">${roles.join(', ')}</span>
          </div>
        ` : ''}
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${signupLink}" style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; transition: background-color 0.2s;">
          View Event & Sign Up
        </a>
      </div>

      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #6b7280; margin: 0; font-size: 14px; text-align: center;">
          If you're able to help with this event, please click the link above to sign up. 
          ${isUrgent ? 'Your quick response would be greatly appreciated!' : 'Thank you for your service!'}
        </p>
      </div>

      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 12px;">
          You received this because you're a member of the music ministry. 
          If you no longer wish to receive these notifications, you can update your preferences in your account settings.
        </p>
      </div>
    </body>
    </html>
  `
} 