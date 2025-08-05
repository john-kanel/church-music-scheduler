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
  
  // Minimal calendar header - only required fields for Google Calendar compatibility
  const calendarLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Church Music Pro//Church Music Scheduler v1.0//EN',
    'CALSCALE:GREGORIAN', // Required by Google Calendar
  ]

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
  
  // Minimal calendar structure
  const calendarLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Church Music Pro//Church Music Scheduler v1.0//EN',
    'CALSCALE:GREGORIAN',
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

  // Format timestamps - use TZID for event times, UTC for metadata
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
 * Simple line folding for ICS - keeps lines under 75 characters
 */
function foldLine(line: string): string {
  if (!line || line.length <= 75) {
    return line
  }
  
  const result: string[] = []
  let remaining = line
  
  while (remaining.length > 75) {
    // Find a safe break point (avoid breaking escape sequences)
    let breakPoint = 75
    if (remaining.charAt(74) === '\\') {
      breakPoint = 74
    }
    
    result.push(remaining.substring(0, breakPoint))
    remaining = ' ' + remaining.substring(breakPoint) // Continuation with space
  }
  
  if (remaining.length > 0) {
    result.push(remaining)
  }
  
  return result.join('\r\n')
} 