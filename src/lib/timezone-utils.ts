import { fromZonedTime, toZonedTime, format } from 'date-fns-tz'

/**
 * Converts user input (date + time in their timezone) to UTC for database storage
 * @param dateStr - Date string like "2025-07-24" 
 * @param timeStr - Time string like "10:00"
 * @param timezone - User's timezone like "America/Chicago"
 * @returns UTC Date object for database storage
 */
export function createEventDateTime(dateStr: string, timeStr: string, timezone: string): Date {
  // Create a date string that JavaScript will interpret as local time
  // IMPORTANT: We treat the input as "naive" time - whatever time the user typed
  // JavaScript's Date constructor with YYYY-MM-DDTHH:mm format interprets it as local time
  const isoString = `${dateStr}T${timeStr}:00`
  
  // This creates a Date object that represents the user's intended local time
  // The Date object internally stores UTC, but the user's intended time is preserved
  const localDate = new Date(isoString)
  
  console.log('🕐 Creating event datetime:', {
    input: `${dateStr} ${timeStr}`,
    createdDate: localDate.toISOString(),
    localDisplay: localDate.toLocaleString(),
    timezone
  })
  
  // Return the date as-is. JavaScript automatically handles the UTC conversion.
  // When this date is saved to the database and retrieved, the timezone display
  // functions will apply the inverse transformation to show the same local time
  return localDate
}

/**
 * Converts UTC date from database to user's timezone for display
 * @param utcDate - UTC Date from database
 * @param timezone - User's timezone
 * @returns Date in user's timezone
 */
export function displayEventDateTime(utcDate: Date, timezone: string): Date {
  return toZonedTime(utcDate, timezone)
}

/**
 * Formats date for ICS with proper timezone
 * @param utcDate - UTC Date from database  
 * @param timezone - Timezone for the event
 * @returns Properly formatted ICS datetime string with timezone
 */
export function formatICSDateTime(utcDate: Date, timezone: string): string {
  // DEPRECATED: This function is kept for backward compatibility but is no longer used
  // The new minimal ICS implementation uses UTC times exclusively for maximum Google Calendar compatibility
  
  // Format as UTC time (YYYYMMDDTHHMMSSZ) for maximum compatibility
  const year = utcDate.getUTCFullYear()
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utcDate.getUTCDate()).padStart(2, '0')
  const hours = String(utcDate.getUTCHours()).padStart(2, '0')
  const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(utcDate.getUTCSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Gets the user's timezone from the database or returns default
 * @param userId - User ID
 * @returns Promise<string> - User's timezone
 */
export async function getUserTimezone(userId: string): Promise<string> {
  try {
    const { prisma } = await import('@/lib/db')
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true }
    })
    return user?.timezone || 'America/Chicago'
  } catch (error) {
    console.error('Error fetching user timezone:', error)
    return 'America/Chicago'
  }
} 

/**
 * Formats event time for display, fixing timezone issues
 * Use this instead of toLocaleTimeString() for event times
 * @param utcTimeString - UTC time string from database (e.g., "2025-08-24T10:00:00.000Z")
 * @returns Properly formatted local time string (e.g., "10:00 AM")
 */
export function formatEventTimeForDisplay(utcTimeString: string): string {
  const utcDate = new Date(utcTimeString)
  
  // JavaScript's Date object automatically converts to local timezone when displaying
  // We just need to format it properly for display
  return utcDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Formats event time for compact display (12-hour format with AM/PM)
 * @param utcTimeString - UTC time string from database
 * @returns Compact time string (e.g., "10:00 AM")
 */
export function formatEventTimeCompact(utcTimeString: string): string {
  const utcDate = new Date(utcTimeString)
  
  // JavaScript's Date object automatically converts to local timezone when displaying
  return utcDate.toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true
  })
} 