import { fromZonedTime, toZonedTime, format } from 'date-fns-tz'

/**
 * Converts user input (date + time in their timezone) to UTC for database storage
 * @param dateStr - Date string like "2025-07-24" 
 * @param timeStr - Time string like "10:00"
 * @param timezone - User's timezone like "America/Chicago"
 * @returns UTC Date object for database storage
 */
export function createEventDateTime(dateStr: string, timeStr: string, timezone: string): Date {
  // Create ISO string in user's timezone
  const isoString = `${dateStr}T${timeStr}:00`
  
  // Parse as if it's in the user's timezone, then convert to UTC
  const zonedTime = new Date(isoString)
  const utcTime = fromZonedTime(zonedTime, timezone)
  
  console.log('🕐 Timezone conversion:', {
    input: `${dateStr} ${timeStr} in ${timezone}`,
    zonedTime: isoString,
    utcTime: utcTime.toISOString(),
    verification: format(utcTime, 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: timezone })
  })
  
  return utcTime
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
 * @returns Properly formatted ICS datetime string
 */
export function formatICSDateTime(utcDate: Date, timezone: string): string {
  // Convert to user's timezone first
  const zonedDate = toZonedTime(utcDate, timezone)
  
  // Format as YYYYMMDDTHHMMSS (local time, not UTC)
  const year = zonedDate.getFullYear()
  const month = String(zonedDate.getMonth() + 1).padStart(2, '0')
  const day = String(zonedDate.getDate()).padStart(2, '0')
  const hours = String(zonedDate.getHours()).padStart(2, '0')
  const minutes = String(zonedDate.getMinutes()).padStart(2, '0')
  const seconds = String(zonedDate.getSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
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