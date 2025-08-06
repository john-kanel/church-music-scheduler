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
    'PRODID:-//Church Music Pro//Church Music Scheduler v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', // Required for subscription feeds
    `X-WR-CALNAME:${cleanText(churchName)} Music Ministry`, // Calendar name in Google Calendar
    `X-WR-CALDESC:${cleanText(churchName)} Music Ministry - Live calendar subscription`, // Calendar description
    `X-WR-TIMEZONE:${timezone}`, // Default timezone for the calendar
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
    'PRODID:-//Church Music Pro//Church Music Scheduler v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${cleanText(churchName)} Music Ministry`,
    `X-WR-TIMEZONE:${timezone}`,
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
  // Generate unique identifier (required by Google)
  const uid = `event-${event.id}@churchmusicpro.com`
  
  // Calculate end time - default to 1 hour if not specified
  const endDate = event.endTime || new Date(event.startTime.getTime() + 60 * 60 * 1000)

  // Format timestamps - use unquoted TZID for event times (Google Calendar prefers this), UTC for metadata
  const dtstart = `TZID=${timezone}:${formatLocalDateTime(event.startTime)}`
  const dtend = `TZID=${timezone}:${formatLocalDateTime(endDate)}`
  const dtstamp = formatUTCDateTime(new Date()) // Metadata timestamps stay in UTC
  const created = formatUTCDateTime(event.createdAt)
  const lastModified = formatUTCDateTime(event.updatedAt)

  // Build clean event title
  let summary = cleanText(event.name)
  if ((event as any).status === 'CANCELLED') {
    summary = `CANCELLED: ${summary}`
  }

  // Build description with assignments and music
  const description = cleanText(buildEventDescription(event))
  const location = cleanText(event.location || '')

  // Return minimal event lines - only required fields
  const eventLines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`, // Required by Google
    `DTSTART;${dtstart}`, // Use TZID format for event times
    `DTEND;${dtend}`,     // Use TZID format for event times
    `SUMMARY:${summary}`,
    `CREATED:${created}`,
    `LAST-MODIFIED:${lastModified}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED', // Keep simple - Google prefers CONFIRMED
    'TRANSP:OPAQUE',
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
  // Include ALL hymns, even those without titles (empty service part placeholders)
  const allHymns = event.hymns
  if (allHymns.length > 0) {
    lines.push('MUSIC:')
    
    // Process hymns in the order they come from the database
    // (they're already ordered by servicePart.order ASC, createdAt ASC)
    const processedParts = new Set<string>()
    
    allHymns.forEach(hymn => {
      const partName = hymn.servicePart?.name || 'General Music'
      const songTitle = hymn.title || ''
      
      // Add service part line only once per part
      if (!processedParts.has(partName)) {
        processedParts.add(partName)
        lines.push(`${partName}:`)
      }
      
      // Add the song for this service part
      let musicLine = `- ${songTitle}`
      if (hymn.notes) {
        musicLine += ` (${hymn.notes})`
      }
      lines.push(musicLine)
    })
    lines.push('')
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
 * Cleans text for ICS format - minimal escaping for maximum compatibility
 */
function cleanText(text: string): string {
  if (!text) return ''
  
  return text
    .replace(/\\/g, '\\\\')   // Escape backslashes first
    .replace(/\r\n/g, '\\n')  // Handle CRLF
    .replace(/\r/g, '\\n')    // Handle CR
    .replace(/\n/g, '\\n')    // Handle LF
    .replace(/;/g, '\\;')     // Escape semicolons
    .replace(/,/g, '\\,')     // Escape commas
    .trim()                   // Remove whitespace
    .substring(0, 1000)       // Prevent extremely long fields
}

/**
 * Improved line folding for ICS - handles UTF-8 characters correctly
 * Ensures each line is no more than 75 bytes when encoded as UTF-8
 */
function foldLine(line: string): string {
  if (!line) return line

  const result: string[] = []
  let currentLine = ''
  let currentBytes = 0
  let chars = Array.from(line) // Split into Unicode characters

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    const charBytes = Buffer.from(char, 'utf8').length

    // If adding this character would exceed 75 bytes
    if (currentBytes + charBytes > 75) {
      result.push(currentLine)
      currentLine = ' ' + char // Start new line with continuation space
      currentBytes = 1 + charBytes // Count the space
    } else {
      currentLine += char
      currentBytes += charBytes
    }

    // Special handling for escape sequences
    if (char === '\\' && i < chars.length - 1) {
      const nextChar = chars[i + 1]
      // Keep escape sequence together
      currentLine += nextChar
      currentBytes += Buffer.from(nextChar, 'utf8').length
      i++ // Skip next character
    }
  }

  if (currentLine) {
    result.push(currentLine)
  }

  return result.join('\r\n')
}

/**
 * Generates VTIMEZONE definition for proper Google Calendar compatibility
 * This is essential for Google Calendar to understand timezone references
 */
function generateVTimezone(timezone: string): string[] {
  // For now, we'll support the most common US timezones
  // This could be expanded to support more timezones as needed
  
  if (timezone === 'America/Chicago') {
    return [
      'BEGIN:VTIMEZONE',
      'TZID:America/Chicago',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0600',
      'TZOFFSETTO:-0500',
      'TZNAME:CDT',
      'DTSTART:19700308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0600',
      'TZNAME:CST',
      'DTSTART:19701101T020000',
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
      'DTSTART:19700308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0500',
      'TZNAME:EST',
      'DTSTART:19701101T020000',
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
      'DTSTART:19700308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0800',
      'TZNAME:PST',
      'DTSTART:19701101T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ]
  } else {
    // Fallback: For unsupported timezones, use UTC
    console.warn(`Timezone ${timezone} not supported in VTIMEZONE generation, falling back to UTC`)
    return [
      'BEGIN:VTIMEZONE',
      'TZID:UTC',
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