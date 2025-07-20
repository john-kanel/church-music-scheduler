import { prisma } from './db'

/**
 * Marks an event as needing a calendar update (LIVE SYNC)
 */
export async function markEventForCalendarUpdate(eventId: string): Promise<void> {
  try {
    await prisma.event.update({
      where: { id: eventId },
      data: { calendarNeedsUpdate: true }
    })
    console.log(`🔄 LIVE SYNC: Marked event ${eventId} for immediate calendar update`)
  } catch (error) {
    console.error(`❌ Failed to mark event ${eventId} for calendar update:`, error)
  }
}

/**
 * Marks multiple events as needing calendar updates
 */
export async function markEventsForCalendarUpdate(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return

  try {
    await prisma.event.updateMany({
      where: { id: { in: eventIds } },
      data: { calendarNeedsUpdate: true }
    })
    console.log(`Marked ${eventIds.length} events for calendar update`)
  } catch (error) {
    console.error(`Failed to mark events for calendar update:`, error)
  }
}

/**
 * Marks all events in a church as needing calendar updates
 * Useful when global settings change
 */
export async function markChurchEventsForCalendarUpdate(churchId: string): Promise<void> {
  try {
    const result = await prisma.event.updateMany({
      where: { 
        churchId,
        startTime: {
          gte: new Date() // Only future events
        }
      },
      data: { calendarNeedsUpdate: true }
    })
    console.log(`Marked ${result.count} events for calendar update in church ${churchId}`)
  } catch (error) {
    console.error(`Failed to mark church events for calendar update:`, error)
  }
}

/**
 * Marks all recurring events in a series as needing calendar updates
 */
export async function markRecurringSeriesForCalendarUpdate(rootEventId: string): Promise<void> {
  try {
    const result = await prisma.event.updateMany({
      where: { 
        OR: [
          { id: rootEventId },
          { parentEventId: rootEventId },
          { generatedFrom: rootEventId }
        ]
      },
      data: { calendarNeedsUpdate: true }
    })
    console.log(`Marked ${result.count} events in recurring series for calendar update`)
  } catch (error) {
    console.error(`Failed to mark recurring series for calendar update:`, error)
  }
}

/**
 * Helper to wrap database operations that should trigger calendar updates
 */
export async function withCalendarUpdate<T>(
  eventId: string,
  operation: () => Promise<T>
): Promise<T> {
  const result = await operation()
  await markEventForCalendarUpdate(eventId)
  return result
}

/**
 * Helper to wrap database operations that affect multiple events
 */
export async function withCalendarUpdates<T>(
  eventIds: string[],
  operation: () => Promise<T>
): Promise<T> {
  const result = await operation()
  await markEventsForCalendarUpdate(eventIds)
  return result
} 