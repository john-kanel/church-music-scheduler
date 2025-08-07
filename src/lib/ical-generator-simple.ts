import { Event, EventAssignment, EventHymn, User, Group, EventType, ServicePart } from '@prisma/client'

// Extended types for the data we need
type EventWithDetails = Event & {
  eventType: EventType
  assignments: (EventAssignment & {
    user: User | null
    group: Group | null
  })[]
  hymns: (EventHymn & {
    servicePart: ServicePart | null
  })[]
}

/**
 * ULTRA-SIMPLE Google Calendar Compatible iCal Generator
 * Based on analysis of Google's own calendar feeds - mimics their exact approach
 * This is a stripped-down version that follows Google's minimal pattern
 */
export function generateSimpleICalFeed(events: EventWithDetails[], churchName: string, timezone: string = 'America/Chicago'): string {
  console.log('🔧 SIMPLE GENERATOR: Starting with', events.length, 'events')
  
  // Ultra-minimal header - copy Google's exact approach
  const calendarLines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Church Music Pro//Church Music Scheduler 1.0//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${cleanText(churchName)} Music Ministry`,
    'X-WR-TIMEZONE:UTC', // Use UTC like Google does
    `X-WR-CALDESC:${cleanText(churchName)} Music Ministry Calendar`,
  ]

  // Convert all events to Google-style minimal format
  events.forEach((event, index) => {
    console.log(`🔧 SIMPLE GENERATOR: Processing event ${index + 1}/${events.length}:`, event.name)
    const eventLines = convertEventToGoogleStyle(event, timezone)
    console.log(`🔧 SIMPLE GENERATOR: Generated ${eventLines.length} lines for event`)
    calendarLines.push(...eventLines)
  })

  // Calendar footer
  calendarLines.push('END:VCALENDAR')

  // Join with CRLF line endings and fold long lines
  console.log(`🔧 SIMPLE GENERATOR: Final calendar has ${calendarLines.length} lines`)
  const result = calendarLines.map(line => foldLongLine(line)).join('\r\n') + '\r\n'
  console.log(`🔧 SIMPLE GENERATOR: Final size: ${result.length} bytes`)
  return result
}

/**
 * Converts a database event to Google-style minimal ICS format
 * Uses the EXACT patterns we observed in Google's working calendar
 */
function convertEventToGoogleStyle(event: EventWithDetails, timezone: string): string[] {
  // Generate unique identifier - keep it simple like Google
  const uid = `${event.id}_${event.updatedAt.getTime()}@churchmusicpro.com`
  
  // Calculate end time - default to 1 hour if not specified
  const endDate = event.endTime || new Date(event.startTime.getTime() + 60 * 60 * 1000)

  // Use LOCAL DATE-TIME format like Google (no timezone complexity)
  // Convert to user's local time but format as if it's UTC
  const dtstart = formatSimpleDateTime(event.startTime, timezone)
  const dtend = formatSimpleDateTime(endDate, timezone)
  const dtstamp = formatUTCDateTime(new Date())
  const created = formatUTCDateTime(event.createdAt)
  const lastModified = formatUTCDateTime(event.updatedAt)

  // Build clean summary
  let summary = cleanText(event.name)
  if ((event as any).status === 'CANCELLED') {
    summary = `CANCELLED: ${summary}`
  }

  // Build simple description
  const description = cleanText(buildSimpleDescription(event))
  const location = cleanText(event.location || '')

  // Return minimal event lines - copy Google's exact pattern
  const eventLines = [
    'BEGIN:VEVENT',
    `DTSTART:${dtstart}`, // Simple format like Google
    `DTEND:${dtend}`,
    `DTSTAMP:${dtstamp}`,
    `UID:${uid}`,
    'CLASS:PUBLIC', // Like Google
    `CREATED:${created}`,
    `LAST-MODIFIED:${lastModified}`,
    'SEQUENCE:0', // Keep it simple
    'STATUS:CONFIRMED',
    `SUMMARY:${summary}`,
  ]

  // Add optional fields only if they have content (like Google)
  if (description && description.trim()) {
    eventLines.push(`DESCRIPTION:${description}`)
  }
  
  if (location && location.trim()) {
    eventLines.push(`LOCATION:${location}`)
  }

  eventLines.push('END:VEVENT')
  
  return eventLines
}

/**
 * Format date-time in Google's style: YYYYMMDDTHHMMSSZ
 * Convert timezone to UTC for maximum compatibility
 */
function formatSimpleDateTime(date: Date, timezone: string): string {
  // For simplicity, convert to UTC like Google does
  // This avoids all timezone complexity
  const utcDate = new Date(date.getTime())
  
  const year = utcDate.getUTCFullYear()
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utcDate.getUTCDate()).padStart(2, '0')
  const hours = String(utcDate.getUTCHours()).padStart(2, '0')
  const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(utcDate.getUTCSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Formats a date in UTC format for metadata fields
 */
function formatUTCDateTime(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Build ultra-simple description like Google
 */
function buildSimpleDescription(event: EventWithDetails): string {
  const lines: string[] = []

  // Add basic event info
  if (event.description) {
    lines.push(event.description)
    lines.push('')
  }

  // Add musicians (simplified)
  const acceptedAssignments = event.assignments.filter(a => a.user && a.status === 'ACCEPTED')
  if (acceptedAssignments.length > 0) {
    lines.push('Musicians:')
    acceptedAssignments.forEach(assignment => {
      if (assignment.user) {
        const role = assignment.roleName || 'Musician'
        const name = `${assignment.user.firstName} ${assignment.user.lastName}`
        lines.push(`${role}: ${name}`)
      }
    })
    lines.push('')
  }

  // Add music (very simplified)
  const hymns = event.hymns.filter(h => h.title && h.title.trim())
  if (hymns.length > 0) {
    lines.push('Music:')
    hymns.forEach(hymn => {
      lines.push(`- ${hymn.title}`)
    })
    lines.push('')
  }

  return lines.join('\\n') // Use \\n like Google
}

/**
 * Ultra-simple text cleaning - minimal like Google
 * Includes line folding to keep under 75 bytes
 */
function cleanText(text: string): string {
  if (!text) return ''
  
  const cleaned = text
    .replace(/\\/g, '\\\\')   // Escape backslashes
    .replace(/;/g, '\\;')     // Escape semicolons
    .replace(/,/g, '\\,')     // Escape commas
    .replace(/\r\n/g, ' ')    // Replace line breaks with space
    .replace(/\r/g, ' ')      
    .replace(/\n/g, ' ')      
    .replace(/\s+/g, ' ')     // Collapse spaces
    .trim()
    .substring(0, 200)        // Keep it very short for line length
    
  return cleaned
}

/**
 * Fold long lines to meet 75-byte RFC requirement
 */
function foldLongLine(line: string): string {
  if (Buffer.from(line, 'utf8').length <= 75) {
    return line
  }
  
  // Simple folding: if line is too long, try to break at a good spot
  const parts = []
  let current = ''
  
  for (const char of line) {
    if (Buffer.from(current + char, 'utf8').length > 75) {
      parts.push(current)
      current = ' ' + char // Continuation with space
    } else {
      current += char
    }
  }
  
  if (current) {
    parts.push(current)
  }
  
  return parts.join('\r\n')
}
