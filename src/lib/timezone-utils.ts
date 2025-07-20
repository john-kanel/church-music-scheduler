/**
 * Timezone utilities for handling date/time conversions with user timezone preferences
 */

/**
 * Creates a Date object from date/time components in the user's timezone
 * This ensures the date is created as the user intended, regardless of server timezone
 */
export function createDateInUserTimezone(
  year: number,
  month: number, // 1-based month
  day: number,
  hour: number,
  minute: number,
  userTimezone: string = 'America/Chicago'
): Date {
  // Create the date string in the user's timezone
  const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`
  
  // Parse the date as if it's in the user's timezone
  // This prevents timezone conversion issues
  return new Date(dateString + getTimezoneOffset(userTimezone))
}

/**
 * Gets the timezone offset string for a given timezone
 */
function getTimezoneOffset(timezone: string): string {
  const now = new Date()
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000))
  const targetTime = new Date(utc.toLocaleString("en-US", {timeZone: timezone}))
  const offset = (utc.getTime() - targetTime.getTime()) / (1000 * 60)
  
  const hours = Math.floor(Math.abs(offset) / 60)
  const minutes = Math.abs(offset) % 60
  const sign = offset <= 0 ? '+' : '-'
  
  return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Creates a Date object preserving the exact user input time regardless of server timezone
 * Uses UTC to avoid any timezone interpretation issues
 */
export function createDatePreservingUserTime(
  year: number,
  month: number, // 1-based month  
  day: number,
  hour: number,
  minute: number
): Date {
  // Use UTC methods to avoid any timezone interpretation issues
  // This preserves the exact time the user entered regardless of server timezone
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
}

/**
 * Formats a date for display in the user's timezone
 */
export function formatDateInUserTimezone(
  date: Date,
  userTimezone: string = 'America/Chicago',
  options: Intl.DateTimeFormatOptions = {}
): string {
  return date.toLocaleString('en-US', {
    timeZone: userTimezone,
    ...options
  })
}

/**
 * Extracts date and time components from a Date object for form editing
 */
export function extractDateTimeComponents(date: Date): {
  startDate: string
  startTime: string
} {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return {
    startDate: `${year}-${month}-${day}`,
    startTime: `${hours}:${minutes}`
  }
} 