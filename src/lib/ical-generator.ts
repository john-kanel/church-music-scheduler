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

interface ICalEvent {
  uid: string
  summary: string
  description: string
  location: string
  startDate: Date
  endDate: Date
  lastModified: Date
  created: Date
  status: 'CONFIRMED' | 'CANCELLED'
}

/**
 * Generates a minimal, bulletproof iCal feed for maximum Google Calendar compatibility
 * Follows strict RFC 5545 and Google Calendar requirements
 */
export function generateICalFeed(events: EventWithDetails[], churchName: string, timezone: string = 'America/Chicago'): string {
  // Convert all events to minimal ICS format
  const icalEvents = events.map(event => convertEventToMinimalICal(event, timezone))
  
  // Google Calendar optimized header with required metadata
  const calendarLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Church Music Scheduler//Church Music Pro v2.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', // Required for subscription feeds
    `X-WR-CALNAME:${cleanText(churchName)} Music Ministry`, // Calendar name in Google Calendar
    `X-WR-CALDESC:${cleanText(churchName)} Music Ministry - Live calendar subscription`, // Calendar description
    `X-WR-TIMEZONE:${timezone}`, // Default timezone for the calendar
    'X-PUBLISHED-TTL:PT1H', // Google Calendar refresh interval
  ]

  // Add VTIMEZONE definition for proper Google Calendar compatibility
  calendarLines.push(...generateVTimezone(timezone))

  // Add all events
  icalEvents.forEach(event => {
    calendarLines.push(...event)
  })

  // Calendar footer
  calendarLines.push('END:VCALENDAR')

  // Join with proper CRLF line endings and ensure proper line folding
  return calendarLines.map(line => foldLine(line)).join('\r\n') + '\r\n'
}

/**
 * Generates an iCal file for a single event (for email attachments)
 */
export function generateSingleEventICalFile(event: EventWithDetails, churchName: string, timezone: string = 'America/Chicago'): string {
  // Use the minimal conversion for this single event
  const eventLines = convertEventToMinimalICal(event, timezone)
  
  // Google Calendar optimized structure with VTIMEZONE
  const calendarLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Church Music Scheduler//Church Music Pro v2.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${cleanText(churchName)} Music Ministry`,
    `X-WR-TIMEZONE:${timezone}`,
    'X-PUBLISHED-TTL:PT1H',
    ...generateVTimezone(timezone),
    ...eventLines,
    'END:VCALENDAR'
  ]

  // Join with proper line folding and CRLF endings
  return calendarLines.map(line => foldLine(line)).join('\r\n') + '\r\n'
}

/**
 * Converts a database event to minimal ICS format for maximum Google Calendar compatibility
 * Returns array of ICS lines for the event
 */
function convertEventToMinimalICal(event: EventWithDetails, timezone: string): string[] {
  // Generate unique identifier (required by Google) - MUST be globally unique
  const uid = `event-${event.id}-${event.updatedAt.getTime()}@churchmusicpro.com`
  
  // Calculate end time - default to 1 hour if not specified
  const endDate = event.endTime || new Date(event.startTime.getTime() + 60 * 60 * 1000)

  // Format timestamps - use proper TZID format for Google Calendar compatibility
  // Note: Some validators suggest quoting TZID, but Google Calendar actually prefers unquoted
  const dtstart = `TZID=${timezone}:${formatLocalDateTime(event.startTime)}`
  const dtend = `TZID=${timezone}:${formatLocalDateTime(endDate)}`
  const dtstamp = formatUTCDateTime(new Date()) // Required creation timestamp in UTC
  const created = formatUTCDateTime(event.createdAt)
  const lastModified = formatUTCDateTime(event.updatedAt)

  // Calculate sequence number based on event modifications (critical for Google Calendar sync)
  // This ensures Google Calendar recognizes event updates
  const sequence = calculateSequenceNumber(event)

  // Build clean event title - ensure single line format
  let summary = cleanTextSingleLine(event.name)
  if ((event as any).status === 'CANCELLED') {
    summary = `CANCELLED: ${summary}`
  }

  // Build description with assignments and music - ensure proper line folding
  const description = cleanTextMultiLine(buildEventDescription(event))
  const location = cleanTextSingleLine(event.location || '')

  // Return event lines with all required fields for Google Calendar compatibility
  const eventLines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`, // Required by RFC 5545 and Google Calendar
    `DTSTART;${dtstart}`, // Event start time with timezone
    `DTEND;${dtend}`,     // Event end time with timezone  
    `SUMMARY:${summary}`,
    `CREATED:${created}`,
    `LAST-MODIFIED:${lastModified}`,
    `SEQUENCE:${sequence}`, // Critical for Google Calendar update tracking
    'STATUS:CONFIRMED', // Google Calendar prefers CONFIRMED over other statuses
    'TRANSP:OPAQUE',    // Show as busy time
  ]

  // Add optional fields only if they have content
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
 * Builds the event description with musician assignments and service parts
 */
function buildEventDescription(event: EventWithDetails): string {
  const lines: string[] = []

  // Add location prominently at the top  
  if (event.location) {
    lines.push(`Location: ${event.location}`)
    lines.push('')
  }

  // Add event description if it exists
  if (event.description) {
    lines.push(event.description)
    lines.push('')
  }

  // Add musician assignments with cleaner formatting
  const acceptedAssignments = event.assignments.filter(a => a.user && (a.status === 'ACCEPTED' || a.status === 'PENDING'))
  const pendingAssignments = event.assignments.filter(a => !a.user && a.status === 'PENDING')
  
  if (acceptedAssignments.length > 0 || pendingAssignments.length > 0) {
    lines.push('MUSICIANS:')
    
    // Show assigned musicians
    acceptedAssignments.forEach(assignment => {
      if (assignment.user) {
        const role = assignment.roleName || 'Musician'
        const name = `${assignment.user.firstName} ${assignment.user.lastName}`
        lines.push(`${role}: ${name}`)
      }
    })
    
    // Show open positions (simplified format)
    pendingAssignments.forEach(assignment => {
      const role = assignment.roleName || 'Musician'
      lines.push(`${role}: (Open)`)
    })
    
    lines.push('')
  }

  // Add group information - always show Group line
  const eventGroups = event.assignments.filter(a => a.group).map(a => a.group)
  const uniqueGroups = Array.from(new Set(eventGroups.map(g => g?.id))).map(id => 
    eventGroups.find(g => g?.id === id)
  ).filter(Boolean)
  
  lines.push('Group:')
  if (uniqueGroups.length > 0) {
    uniqueGroups.forEach(group => {
      if (group) {
        lines.push(`${group.name}`)
      }
    })
  } else {
    lines.push('(None assigned)')
  }
  lines.push('')

  // Add service parts and music with simplified formatting
  // Skip empty or placeholder hymn titles (e.g., "New Song")
  const allHymns = event.hymns
  if (allHymns.length > 0) {
    const isRealTitle = (t?: string) => !!t && t.trim().length > 0 && t.trim().toLowerCase() !== 'new song'

    // Group real hymns by service part, only keeping those with real titles
    const grouped = new Map<string, { title: string; notes?: string }[]>()
    for (const hymn of allHymns) {
      if (!isRealTitle(hymn.title)) continue
      const partName = hymn.servicePart?.name || 'General Music'
      if (!grouped.has(partName)) grouped.set(partName, [])
      grouped.get(partName)!.push({ title: hymn.title!, notes: hymn.notes || undefined })
    }

    if (grouped.size > 0) {
      lines.push('MUSIC:')
      grouped.forEach((hymns, partName) => {
        lines.push(`${partName}:`)
        hymns.forEach(h => {
          let musicLine = `- ${h.title}`
          if (h.notes) musicLine += ` (${h.notes})`
          lines.push(musicLine)
        })
      })
      lines.push('')
    }
  }

  // Add event type
  lines.push(`Event Type: ${event.eventType.name}`)
  
  return lines.join('\n')
}

// REMOVED: Complex timezone handling - using UTC times for maximum Google Calendar compatibility

// REMOVED: Old complex formatting functions - using minimal approach for Google Calendar compatibility

/**
 * Formats a date in UTC format (YYYYMMDDTHHMMSSZ) for metadata fields
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
 * Formats a date in local format (YYYYMMDDTHHMMSS) for event times
 * This preserves the time as shown in the calendar UI
 */
function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}

/**
 * Calculates the sequence number for an event based on its update history
 * This is critical for Google Calendar to recognize event updates
 */
function calculateSequenceNumber(event: EventWithDetails): number {
  // For now, use a simple hash of the updatedAt timestamp
  // This ensures the sequence changes whenever the event is modified
  // In production, you might want to store the actual sequence in the database
  const updateTime = event.updatedAt.getTime()
  return Math.floor(updateTime / 1000) % 999999 // Keep it reasonably sized
}

/**
 * Cleans text for single-line ICS fields (SUMMARY, LOCATION)
 * Google Calendar is very strict about line breaks in these fields
 */
function cleanTextSingleLine(text: string): string {
  if (!text) return ''
  
  return text
    .replace(/\\/g, '\\\\')   // Escape backslashes first
    .replace(/\r\n/g, ' ')    // Replace CRLF with space
    .replace(/\r/g, ' ')      // Replace CR with space  
    .replace(/\n/g, ' ')      // Replace LF with space
    .replace(/\t/g, ' ')      // Replace tabs with space
    .replace(/;/g, '\\;')     // Escape semicolons
    .replace(/,/g, '\\,')     // Escape commas
    .replace(/\s+/g, ' ')     // Collapse multiple spaces
    .trim()                   // Remove leading/trailing whitespace
    .substring(0, 500)        // Limit length for compatibility
}

/**
 * Cleans text for multi-line ICS fields (DESCRIPTION)
 * Uses proper line folding instead of embedded newlines
 */
function cleanTextMultiLine(text: string): string {
  if (!text) return ''
  
  return text
    .replace(/\\/g, '\\\\')   // Escape backslashes first
    .replace(/\r\n/g, '\\n')  // Properly escape CRLF
    .replace(/\r/g, '\\n')    // Properly escape CR
    .replace(/\n/g, '\\n')    // Properly escape LF
    .replace(/;/g, '\\;')     // Escape semicolons
    .replace(/,/g, '\\,')     // Escape commas
    .trim()                   // Remove whitespace
    .substring(0, 2000)       // Prevent extremely long fields
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use cleanTextSingleLine or cleanTextMultiLine instead
 */
function cleanText(text: string): string {
  return cleanTextSingleLine(text)
}

/**
 * RFC 5545 compliant line folding for maximum Google Calendar compatibility
 * Ensures each line is no more than 75 bytes (octets) when encoded as UTF-8
 * This is critical for Google Calendar to properly parse the ICS feed
 */
function foldLine(line: string): string {
  if (!line) return line

  // For very short lines, no folding needed
  const lineBytes = Buffer.from(line, 'utf8').length
  if (lineBytes <= 75) {
    return line
  }

  // Google Calendar friendly: more conservative folding at word boundaries
  const result: string[] = []
  let remaining = line
  
  while (remaining.length > 0) {
    // Find the maximum safe chunk size (conservative approach)
    let chunkSize = 73 // Leave room for CRLF and continuation space
    let chunk = remaining.substring(0, chunkSize)
    
    // Make sure we don't exceed 75 bytes in UTF-8
    while (Buffer.from(chunk, 'utf8').length > 73 && chunk.length > 1) {
      chunkSize--
      chunk = remaining.substring(0, chunkSize)
    }
    
    // For continuation lines, try to break at word boundaries
    if (result.length > 0 && chunk.length < remaining.length) {
      // Look for good break points
      const spaceIndex = chunk.lastIndexOf(' ')
      const commaIndex = chunk.lastIndexOf(',')
      const semicolonIndex = chunk.lastIndexOf(';')
      
      const bestBreak = Math.max(spaceIndex, commaIndex, semicolonIndex)
      if (bestBreak > chunkSize * 0.6) { // Only use if reasonably close to end
        chunkSize = bestBreak + 1
        chunk = remaining.substring(0, chunkSize).trim()
      }
    }
    
    // Add chunk to result
    if (result.length === 0) {
      result.push(chunk)
    } else {
      result.push(' ' + chunk) // Continuation line starts with space
    }
    
    remaining = remaining.substring(chunkSize)
  }

  return result.join('\r\n')
}

/**
 * Generates VTIMEZONE definition for proper Google Calendar compatibility
 * This is essential for Google Calendar to understand timezone references
 * Covers the most common timezones used by churches in North America
 */
function generateVTimezone(timezone: string): string[] {
  // Support major US timezones with proper DST rules for Google Calendar
  // Using current DST rules (2007+) that Google Calendar expects
  
  if (timezone === 'America/Chicago') {
    return [
      'BEGIN:VTIMEZONE',
      'TZID:America/Chicago',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0600',
      'TZOFFSETTO:-0500',
      'TZNAME:CDT',
      'DTSTART:20070311T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0600',
      'TZNAME:CST',
      'DTSTART:20071104T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]
  } else if (timezone === 'America/New_York') {
    return [
      'BEGIN:VTIMEZONE',
      'TZID:America/New_York',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0400',
      'TZNAME:EDT',
      'DTSTART:20070311T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0500',
      'TZNAME:EST',
      'DTSTART:20071104T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]
  } else if (timezone === 'America/Los_Angeles') {
    return [
      'BEGIN:VTIMEZONE',
      'TZID:America/Los_Angeles',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0800',
      'TZOFFSETTO:-0700',
      'TZNAME:PDT',
      'DTSTART:20070311T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0800',
      'TZNAME:PST',
      'DTSTART:20071104T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]
  } else if (timezone === 'America/Denver') {
    return [
      'BEGIN:VTIMEZONE',
      'TZID:America/Denver',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0600',
      'TZNAME:MDT',
      'DTSTART:20070311T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0600',
      'TZOFFSETTO:-0700',
      'TZNAME:MST',
      'DTSTART:20071104T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]
  } else if (timezone === 'America/Phoenix') {
    // Arizona doesn't observe DST
    return [
      'BEGIN:VTIMEZONE',
      'TZID:America/Phoenix',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0700',
      'TZNAME:MST',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]
  } else if (timezone === 'Pacific/Honolulu') {
    // Hawaii doesn't observe DST
    return [
      'BEGIN:VTIMEZONE',
      'TZID:Pacific/Honolulu',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-1000',
      'TZOFFSETTO:-1000',
      'TZNAME:HST',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]
  } else if (timezone === 'America/Anchorage') {
    return [
      'BEGIN:VTIMEZONE',
      'TZID:America/Anchorage',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0900',
      'TZOFFSETTO:-0800',
      'TZNAME:AKDT',
      'DTSTART:20070311T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0800',
      'TZOFFSETTO:-0900',
      'TZNAME:AKST',
      'DTSTART:20071104T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]
  } else {
    // Fallback: For unsupported timezones, use the original timezone name but with UTC rules
    // This prevents Google Calendar from rejecting the feed entirely
    console.warn(`Timezone ${timezone} not fully supported in VTIMEZONE generation, using UTC rules`)
    return [
      'BEGIN:VTIMEZONE',
      `TZID:${timezone}`,
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0000',
      'TZOFFSETTO:+0000',
      'TZNAME:UTC',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]
  }
} 