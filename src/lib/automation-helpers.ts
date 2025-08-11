import { prisma } from './db'
import { sendMusicianEventNotification } from './automation-emails'

/**
 * Schedules automated notifications for a specific event based on church automation settings
 */
export async function scheduleEventNotifications(eventId: string, churchId: string, skipPastEventCheck: boolean = false) {
  try {
    // Get automation settings for the church
    const automationSettings = await prisma.automationSettings.findUnique({
      where: { churchId },
      include: {
        musicianNotifications: {
          where: { isEnabled: true },
          orderBy: { hoursBeforeEvent: 'desc' }
        }
      }
    })

    if (!automationSettings || automationSettings.musicianNotifications.length === 0) {
      return
    }

    // Get the event with assignments
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        assignments: {
          where: {
            userId: { not: null },
            user: {
              emailNotifications: true
            }
          },
          include: {
            user: true
          }
        }
      }
    })

    if (!event || event.assignments.length === 0) {
      return
    }

    // Skip notifications for past events unless explicitly requested
    if (!skipPastEventCheck) {
      const now = new Date()
      const eventDateTime = new Date(event.startTime)
      
      if (eventDateTime < now) {
        console.log(`Skipping notifications for past event: ${event.name} (${eventDateTime.toISOString()})`)
        return
      }
    }

    const now = new Date()
    const eventDateTime = new Date(event.startTime)
    const hoursUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    // For each notification setting, check if we should send immediately or later
    for (const notificationSetting of automationSettings.musicianNotifications) {
      // Only send notifications that make sense given the actual time until the event
      // Don't send a "7-day" reminder for an event that's only 1 day away
      if (notificationSetting.hoursBeforeEvent > hoursUntilEvent) {
        console.log(`Skipping ${notificationSetting.hoursBeforeEvent}-hour reminder for event "${event.name}" - only ${Math.round(hoursUntilEvent)} hours until event`)
        continue
      }

      const notificationTime = new Date(event.startTime.getTime() - notificationSetting.hoursBeforeEvent * 60 * 60 * 1000)

      // If notification time is in the past or very soon (within 30 minutes), send immediately
      if (notificationTime <= new Date(now.getTime() + 30 * 60 * 1000)) {
        // Attach a public token for emails when available covering the event date
        let publicToken: string | null = null
        try {
          const link = await prisma.publicScheduleLink.findFirst({
            where: {
              churchId,
              startDate: { lte: event.startTime },
              endDate: { gte: event.startTime }
            }
          })
          publicToken = link?.token || null
        } catch (_) {
          publicToken = null
        }
        const eventWithToken = publicToken ? { ...event, publicToken } : event
        await sendImmediateNotifications(eventWithToken, notificationSetting.hoursBeforeEvent, churchId)
      }
      // Otherwise, the cron job will handle it later
    }

  } catch (error) {
    console.error('Error scheduling event notifications:', error)
  }
}

/**
 * Sends immediate notifications for an event
 */
async function sendImmediateNotifications(event: any, hoursBeforeEvent: number, churchId: string) {
  try {
    // Check if we already sent this notification
    const existingLog = await prisma.notificationLog.findFirst({
      where: {
        eventId: event.id,
        type: 'MUSICIAN_EVENT_REMINDER',
        metadata: {
          path: ['hoursBeforeEvent'],
          equals: hoursBeforeEvent
        }
      }
    })

    if (existingLog) return

    // Send notifications to all assigned musicians
    for (const assignment of event.assignments) {
      try {
        await sendMusicianEventNotification(
          assignment.user.email,
          assignment.user.firstName,
          event,
          hoursBeforeEvent
        )

        // Log the notification
        await prisma.notificationLog.create({
          data: {
            type: 'MUSICIAN_EVENT_REMINDER',
            churchId,
            eventId: event.id,
            recipientEmail: assignment.user.email,
            recipientName: `${assignment.user.firstName} ${assignment.user.lastName}`,
            subject: `Reminder: ${event.name}`,
            metadata: {
              hoursBeforeEvent,
              eventName: event.name
            }
          }
        })

        // Log activity
        await prisma.activity.create({
          data: {
            type: 'AUTOMATED_NOTIFICATION_SENT',
            description: `Automated reminder sent to ${assignment.user.firstName} for "${event.name}"`,
            churchId,
            metadata: {
              eventId: event.id,
              userId: assignment.user.id,
              hoursBeforeEvent,
              eventName: event.name,
              eventDate: event.startTime
            }
          }
        })

      } catch (error) {
        console.error(`Error sending immediate notification to ${assignment.user.email}:`, error)
      }
    }

  } catch (error) {
    console.error('Error sending immediate notifications:', error)
  }
}

/**
 * Logs an activity for automation settings updates
 */
export async function logAutomationActivity(
  description: string,
  churchId: string,
  userId?: string,
  metadata?: any
) {
  try {
    await prisma.activity.create({
      data: {
        type: 'AUTOMATION_SETTINGS_UPDATED',
        description,
        churchId,
        userId,
        metadata
      }
    })
  } catch (error) {
    console.error('Error logging automation activity:', error)
  }
} 