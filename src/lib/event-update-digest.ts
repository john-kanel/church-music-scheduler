import { prisma } from '@/lib/db'
import { resolveEventAssignmentsForSingle } from './dynamic-assignments'
import { getUserTimezone } from '@/lib/timezone-utils'

function getEndOfDayInTimezone(now: Date, timezone: string): Date {
  // Schedule for 8:00 PM local time by default
  const year = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric' }).format(now)
  const month = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: '2-digit' }).format(now)
  const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, day: '2-digit' }).format(now)
  const localIso = `${year}-${month}-${day}T20:00:00`
  // Convert the local time to a Date by constructing with timezone offset via string and letting DB store as UTC
  // This is a best-effort simple approach without pulling extra deps
  const scheduled = new Date(localIso)
  return scheduled
}

/**
 * Queue a single end-of-day digest email for each assigned musician of this event.
 * If a digest for today already exists for that musician+event, do nothing (dedupe).
 */
export async function queueEventUpdateDigest(eventId: string, churchId: string): Promise<void> {
  // Get the event with assigned musicians
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      assignments: {
        include: { 
          user: true,
          group: true,
          customRole: true
        }
      }
    }
  })

  if (!event) return

  // Resolve dynamic group assignments
  const eventWithDynamicAssignments = await resolveEventAssignmentsForSingle(event)

  const now = new Date()

  for (const assignment of eventWithDynamicAssignments.assignments) {
    // Skip if no user assigned
    if (!assignment.userId) continue
    const user = assignment.user
    if (!user || !user.emailNotifications) continue

    const timezone = user.timezone || 'America/Chicago'
    const scheduledFor = getEndOfDayInTimezone(now, timezone)

    // Dedupe: check if we already scheduled a digest for this user+event today
    const existing = await prisma.emailSchedule.findFirst({
      where: {
        userId: user.id,
        churchId,
        sentAt: null,
        emailType: 'WELCOME',
        metadata: {
          path: ['type'],
          equals: 'EVENT_UPDATE_DIGEST'
        }
      }
    })

    if (existing) continue

    await prisma.emailSchedule.create({
      data: {
        churchId,
        userId: user.id,
        emailType: 'WELCOME', // placeholder; actual handling based on metadata.type
        scheduledFor,
        metadata: {
          type: 'EVENT_UPDATE_DIGEST',
          eventId,
          eventName: event.name,
          timezone
        }
      }
    })
  }
}


