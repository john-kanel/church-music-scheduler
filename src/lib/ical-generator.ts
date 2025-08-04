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
    'PRODID:-//Church Music Pro//Live Music Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Required headers for subscription recognition
    wrapICalLine(`X-WR-CALNAME:${churchName} Music Ministry`),
    wrapICalLine(`X-WR-CALDESC:🔄 LIVE FEED: ${churchName} Music Ministry - Updates every 30 seconds`),
    `X-WR-TIMEZONE:${timezone}`,
    wrapICalLine(`X-WR-RELCALID:${churchName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-music-ministry-${Date.now()}`),
    // AGGRESSIVE live sync for immediate updates
    'X-PUBLISHED-TTL:PT10S', // Refresh every 10 seconds 
    'REFRESH-INTERVAL;VALUE=DURATION:PT10S', // Alternative refresh directive
    'X-WR-REFRESH-INTERVAL:PT10S', // Apple Calendar specific
    'X-MS-WR-REFRESH-INTERVAL:PT10S', // Microsoft specific
    // Multiple fallback refresh intervals
    'X-WR-REFRESH-INTERVAL:PT30S', // 30 second fallback
    'X-WR-REFRESH-INTERVAL:PT1M', // 1 minute fallback
    // Calendar appearance with live indicator
    'X-APPLE-CALENDAR-COLOR:#8B5CF6', // Purple for music ministry
    'X-OUTLOOK-COLOR:#8B5CF6',
    'X-WR-CALTYPE:SUBSCRIPTION', // Explicitly mark as subscription
    'X-MICROSOFT-CDO-BUSYSTATUS:FREE', // Mark events as free time
    `X-WR-UPDATE-TIMESTAMP:${Date.now()}`, // Force refresh with timestamp
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
    'PRODID:-//Church Music Pro//Single Event 1.0//EN',
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
  
  // Generate timezone rules based on the specific timezone
  if (timezone === 'America/Chicago') {
    return [
      'BEGIN:VTIMEZONE',
      `TZID:${tzid}`,
      'BEGIN:STANDARD',
      'DTSTART:20071104T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'TZNAME:CST',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0600',
      'END:STANDARD',
      'BEGIN:DAYLIGHT', 
      'DTSTART:20070311T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'TZNAME:CDT',
      'TZOFFSETFROM:-0600',
      'TZOFFSETTO:-0500',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      ''
    ].join('\r\n')
  } else {
    // Generic timezone block for other timezones
    return [
      'BEGIN:VTIMEZONE',
      `TZID:${tzid}`,
      'BEGIN:STANDARD',
      'DTSTART:20071104T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'TZNAME:STD',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0600',
      'END:STANDARD',
      'BEGIN:DAYLIGHT', 
      'DTSTART:20070311T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'TZNAME:DST',
      'TZOFFSETFROM:-0600',
      'TZOFFSETTO:-0500',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      ''
    ].join('\r\n')
  }
}

/**
 * Formats an iCal event object into the proper iCal format
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
    `STATUS:${event.status}`,
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
 * Escapes text for iCal format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/**
 * Wraps long lines to 75 characters as per iCal specification
 */
function wrapICalLine(line: string): string {
  if (line.length <= 75) {
    return line
  }

  const wrapped: string[] = []
  let remaining = line
  
  while (remaining.length > 75) {
    wrapped.push(remaining.substring(0, 75))
    remaining = ' ' + remaining.substring(75) // Continuation lines start with space
  }
  
  if (remaining.length > 0) {
    wrapped.push(remaining)
  }
  
  return wrapped.join('\r\n')
} 