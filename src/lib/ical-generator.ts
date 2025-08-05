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
 * Generates an iCal feed for the given events
 */
export function generateICalFeed(events: EventWithDetails[], churchName: string, timezone: string = 'America/Chicago'): string {
  const icalEvents = events.map(event => convertEventToICal(event, timezone))
  
  const calendarHeader = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Church Music Pro//Church Music Scheduler v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Calendar identification headers
    wrapICalLine(`X-WR-CALNAME:${churchName} Music Ministry`),
    wrapICalLine(`X-WR-CALDESC:🔄 LIVE FEED: ${churchName} Music Ministry - Updates automatically`),
    `X-WR-TIMEZONE:${timezone}`,
    wrapICalLine(`X-WR-RELCALID:${churchName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-music-ministry`),
    // Refresh settings - single authoritative setting for better compatibility
    'X-PUBLISHED-TTL:PT30S', // Refresh every 30 seconds for live updates
    'X-WR-REFRESH-INTERVAL:PT30S', // Single refresh interval to avoid parser confusion
    // Calendar appearance
    'X-APPLE-CALENDAR-COLOR:#8B5CF6', // Purple for music ministry
    'X-OUTLOOK-COLOR:#8B5CF6',
    'X-WR-CALTYPE:SUBSCRIPTION', // Explicitly mark as subscription
    'X-MICROSOFT-CDO-BUSYSTATUS:FREE', // Mark events as free time
    ''
  ].join('\r\n')

  // Add VTIMEZONE block for Google Calendar compatibility
  const timezoneBlock = generateVTimezone(timezone)
  
  const calendarFooter = 'END:VCALENDAR'

  const icalContent = icalEvents.map(event => formatICalEvent(event, timezone)).join('\r\n')

  return calendarHeader + timezoneBlock + icalContent + '\r\n' + calendarFooter
}

/**
 * Generates an iCal file for a single event (for email attachments)
 */
export function generateSingleEventICalFile(event: EventWithDetails, churchName: string, timezone: string = 'America/Chicago'): string {
  const icalEvent = convertEventToICal(event, timezone)
  
  const calendarHeader = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Church Music Pro//Church Music Scheduler v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    wrapICalLine(`X-WR-CALNAME:${event.name} - ${churchName}`),
    wrapICalLine(`X-WR-CALDESC:Event: ${event.name}`),
    `X-WR-TIMEZONE:${timezone}`,
    'X-APPLE-CALENDAR-COLOR:#8B5CF6',
    'X-OUTLOOK-COLOR:#8B5CF6',
    ''
  ].join('\r\n')

  // Add VTIMEZONE block for Google Calendar compatibility
  const timezoneBlock = generateVTimezone(timezone)

  const calendarFooter = 'END:VCALENDAR'

  const icalContent = formatICalEvent(icalEvent, timezone)

  return calendarHeader + timezoneBlock + icalContent + '\r\n' + calendarFooter
}

/**
 * Converts a database event to iCal format
 */
function convertEventToICal(event: EventWithDetails, timezone: string): ICalEvent {
  // Generate unique identifier
  const uid = `event-${event.id}@churchmusicpro.com`
  
  // Format event title - prefix cancelled events with CANCELLED
  let summary = event.name
  if ((event as any).status === 'CANCELLED') {
    summary = `CANCELLED: ${event.name}`
  }

  // Build description with assignments and music
  const description = buildEventDescription(event)

  // Calculate end time - default to 1 hour if not specified
  const endDate = event.endTime || new Date(event.startTime.getTime() + 60 * 60 * 1000)

  // Convert status to ICS format (only CONFIRMED or CANCELLED allowed in ICS)
  const icalStatus = (event as any).status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'

  return {
    uid,
    summary: summary.substring(0, 255), // Limit title length
    description,
    location: event.location || '',
    startDate: event.startTime,
    endDate,
    lastModified: event.updatedAt,
    created: event.createdAt,
    status: icalStatus
  }
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

/**
 * Generates VTIMEZONE block for proper timezone support
 */
function generateVTimezone(timezone: string): string {
  // Use the exact timezone name to match what events use
  const tzid = timezone
  
  // Generate proper timezone rules based on the specific timezone
  // These are Google Calendar compatible VTIMEZONE definitions
  if (timezone === 'America/Chicago') {
    return [
      'BEGIN:VTIMEZONE',
      `TZID:${tzid}`,
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
      'END:VTIMEZONE',
      ''
    ].join('\r\n')
  } else if (timezone === 'America/New_York') {
    return [
      'BEGIN:VTIMEZONE',
      `TZID:${tzid}`,
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
      'END:VTIMEZONE',
      ''
    ].join('\r\n')
  } else if (timezone === 'America/Los_Angeles') {
    return [
      'BEGIN:VTIMEZONE',
      `TZID:${tzid}`,
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
      'END:VTIMEZONE',
      ''
    ].join('\r\n')
  } else if (timezone === 'Europe/London') {
    return [
      'BEGIN:VTIMEZONE',
      `TZID:${tzid}`,
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:+0000',
      'TZOFFSETTO:+0100',
      'TZNAME:BST',
      'DTSTART:19700329T010000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0000',
      'TZNAME:GMT',
      'DTSTART:19701025T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'END:STANDARD',
      'END:VTIMEZONE',
      ''
    ].join('\r\n')
  } else if (timezone === 'UTC') {
    return [
      'BEGIN:VTIMEZONE',
      `TZID:${tzid}`,
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0000',
      'TZOFFSETTO:+0000',
      'TZNAME:UTC',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE',
      ''
    ].join('\r\n')
  } else {
    // For unknown timezones, provide a basic definition
    // This prevents ICS parsing errors but may need manual adjustment
    console.warn(`Unknown timezone ${timezone}, using generic UTC definition. Please add proper timezone rules for better compatibility.`)
    return [
      'BEGIN:VTIMEZONE',
      `TZID:${tzid}`,
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0000',
      'TZOFFSETTO:+0000',
      'TZNAME:UTC',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE',
      ''
    ].join('\r\n')
  }
}

/**
 * Formats an iCal event object into the proper iCal format
 * Optimized for maximum Google Calendar compatibility
 */
function formatICalEvent(event: ICalEvent, timezone: string = 'America/Chicago'): string {
  const lines = [
    'BEGIN:VEVENT',
    wrapICalLine(`UID:${event.uid}`),
    wrapICalLine(`SUMMARY:${escapeICalText(event.summary)}`),
    wrapICalLine(`DESCRIPTION:${escapeICalText(event.description)}`),
    wrapICalLine(`LOCATION:${escapeICalText(event.location)}`),
    wrapICalLine(`DTSTART;${formatICalDate(event.startDate, timezone)}`),
    wrapICalLine(`DTEND;${formatICalDate(event.endDate, timezone)}`),
    wrapICalLine(`DTSTAMP:${formatICalDate(new Date(), 'UTC')}`),
    wrapICalLine(`LAST-MODIFIED:${formatICalDate(event.lastModified, 'UTC')}`),
    wrapICalLine(`CREATED:${formatICalDate(event.created, 'UTC')}`),
    'SEQUENCE:0',
    `STATUS:${event.status}`,  // Use actual event status (CONFIRMED/CANCELLED)
    'TRANSP:OPAQUE',
    'END:VEVENT',
    ''
  ]

  return lines.join('\r\n')
}

/**
 * Formats a date for iCal with proper timezone support
 */
function formatICalDate(date: Date, timezone: string = 'America/Chicago'): string {
  if (timezone === 'UTC') {
    // For UTC dates (DTSTAMP, CREATED, LAST-MODIFIED), use Z suffix
    const utc = new Date(date.getTime())
    const year = utc.getUTCFullYear()
    const month = String(utc.getUTCMonth() + 1).padStart(2, '0')
    const day = String(utc.getUTCDate()).padStart(2, '0')
    const hours = String(utc.getUTCHours()).padStart(2, '0')
    const minutes = String(utc.getUTCMinutes()).padStart(2, '0')
    const seconds = String(utc.getUTCSeconds()).padStart(2, '0')
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
  } else {
    // For event dates, use TZID format
    const { formatICSDateTime } = require('@/lib/timezone-utils')
    return formatICSDateTime(date, timezone)
  }
}

/**
 * Escapes text for iCal format with proper RFC 5545 and Google Calendar compatibility
 * Handles all special characters that need escaping in iCalendar text fields
 */
function escapeICalText(text: string): string {
  if (!text) return ''
  
  return text
    .replace(/\\/g, '\\\\')   // Escape backslashes first (MUST be first)
    .replace(/\r\n/g, '\\n')  // Handle CRLF sequences
    .replace(/\r/g, '\\n')    // Handle lone CR as newline
    .replace(/\n/g, '\\n')    // Escape newlines
    .replace(/;/g, '\\;')     // Escape semicolons
    .replace(/,/g, '\\,')     // Escape commas (for parameter values)
    .replace(/"/g, '\\"')     // Escape quotes (though not strictly required by RFC 5545)
    .trim()                   // Remove leading/trailing whitespace
}

/**
 * Wraps long lines to 75 octets as per RFC 5545 specification
 * This is critical for Google Calendar compatibility
 * Handles UTF-8 byte boundaries correctly
 */
function wrapICalLine(line: string): string {
  if (!line) return ''
  
  // Convert to bytes to check actual octet length (RFC 5545 requirement)
  const lineBytes = Buffer.from(line, 'utf8')
  if (lineBytes.length <= 75) {
    return line
  }

  const wrapped: string[] = []
  let remaining = line
  
  while (remaining.length > 0) {
    let breakPoint = 75
    let currentSlice = remaining
    
    // Find the maximum number of characters that fit within 75 bytes
    while (Buffer.from(currentSlice.substring(0, breakPoint), 'utf8').length > 75 && breakPoint > 1) {
      breakPoint--
    }
    
    // Avoid breaking in the middle of escape sequences
    if (breakPoint > 1 && remaining.charAt(breakPoint - 1) === '\\') {
      breakPoint--
    }
    
    // Avoid breaking in the middle of multi-byte UTF-8 sequences
    const slice = remaining.substring(0, breakPoint)
    const sliceBytes = Buffer.from(slice, 'utf8')
    
    if (sliceBytes.length <= 75) {
      wrapped.push(slice)
      remaining = remaining.substring(breakPoint)
      
      // Add continuation space for subsequent lines (RFC 5545 requirement)
      if (remaining.length > 0) {
        remaining = ' ' + remaining
      }
    } else {
      // Fallback: reduce break point further
      breakPoint = Math.max(1, breakPoint - 1)
      wrapped.push(remaining.substring(0, breakPoint))
      remaining = ' ' + remaining.substring(breakPoint)
    }
  }
  
  return wrapped.join('\r\n')
} 