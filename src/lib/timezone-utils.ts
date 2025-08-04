import { fromZonedTime, toZonedTime, format } from 'date-fns-tz'

/**
 * Converts user input (date + time in their timezone) to UTC for database storage
 * @param dateStr - Date string like "2025-07-24" 
 * @param timeStr - Time string like "10:00"
 * @param timezone - User's timezone like "America/Chicago"
 * @returns UTC Date object for database storage
 */
export function createEventDateTime(dateStr: string, timeStr: string, timezone: string): Date {
  // Create a simple local date/time and apply the same timezone correction
  // that we use for display to maintain consistency
  const isoString = `${dateStr}T${timeStr}:00`
  const localDate = new Date(isoString)
  
  // Apply the same timezone offset correction as formatEventTimeForDisplay
  // This ensures consistency between creation and display
  const timezoneOffsetMinutes = localDate.getTimezoneOffset()
  const correctedDate = new Date(localDate.getTime() - (timezoneOffsetMinutes * 60000))
  
     console.log('🕐 Simplified timezone conversion:', {
     input: `${dateStr} ${timeStr}`,
     localDate: localDate.toISOString(),
     timezoneOffsetMinutes,
     correctedDate: correctedDate.toISOString()
   })
  
  return correctedDate
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
  // For ICS generation, we need to preserve the existing working behavior
  // but fix the format for Google Calendar compatibility
  const timezoneOffsetMinutes = utcDate.getTimezoneOffset()
  const localDate = new Date(utcDate.getTime() + (timezoneOffsetMinutes * 60000))
  
  // Format as YYYYMMDDTHHMMSS with TZID for Google Calendar compatibility
  const year = localDate.getFullYear()
  const month = String(localDate.getMonth() + 1).padStart(2, '0')
  const day = String(localDate.getDate()).padStart(2, '0')
  const hours = String(localDate.getHours()).padStart(2, '0')
  const minutes = String(localDate.getMinutes()).padStart(2, '0')
  const seconds = String(localDate.getSeconds()).padStart(2, '0')
  
  // Use TZID format for better Google Calendar compatibility - this was the missing piece
  const tzidName = timezone.replace(/\//g, '\\/') // Escape forward slashes  
  return `TZID=${tzidName}:${year}${month}${day}T${hours}${minutes}${seconds}`
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
  // Apply timezone fix: adjust for timezone offset to show intended local time
  const timezoneOffsetMinutes = utcDate.getTimezoneOffset()
  const localDate = new Date(utcDate.getTime() + (timezoneOffsetMinutes * 60000))
  
  return localDate.toLocaleTimeString('en-US', {
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
  const timezoneOffsetMinutes = utcDate.getTimezoneOffset()
  const localDate = new Date(utcDate.getTime() + (timezoneOffsetMinutes * 60000))
  
  return localDate.toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true
  })
} 