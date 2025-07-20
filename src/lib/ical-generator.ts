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
    `X-WR-CALNAME:${churchName} Music Ministry`,
    `X-WR-CALDESC:🔄 LIVE FEED: ${churchName} Music Ministry - Updates every 30 seconds`,
    `X-WR-TIMEZONE:${timezone}`,
    `X-WR-RELCALID:${churchName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-music-ministry-${Date.now()}`,
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

  const calendarFooter = 'END:VCALENDAR'

  const icalContent = icalEvents.map(event => formatICalEvent(event)).join('\r\n')

  return calendarHeader + icalContent + '\r\n' + calendarFooter
}

/**
 * Converts a database event to iCal format
 */
function convertEventToICal(event: EventWithDetails, timezone: string): ICalEvent {
  // Generate unique identifier
  const uid = `event-${event.id}@churchmusicpro.com`
  
  // Format event title with TENTATIVE prefix if needed
  let summary = event.name
  if (event.description?.toLowerCase().includes('tentative') || 
      event.name.toLowerCase().includes('tentative')) {
    summary = `TENTATIVE: ${event.name.replace(/^tentative:?\s*/i, '')}`
  }

  // Build description with assignments and music
  const description = buildEventDescription(event)

  // Calculate end time - default to 1 hour if not specified
  const endDate = event.endTime || new Date(event.startTime.getTime() + 60 * 60 * 1000)

  return {
    uid,
    summary: summary.substring(0, 255), // Limit title length
    description,
    location: event.location || '',
    startDate: event.startTime,
    endDate,
    lastModified: event.updatedAt,
    created: event.createdAt
  }
}

/**
 * Builds the event description with musician assignments and service parts
 */
function buildEventDescription(event: EventWithDetails): string {
  const lines: string[] = []

  // Add location prominently at the top
  if (event.location) {
    lines.push(`📍 LOCATION: ${event.location}`)
    lines.push('')
  }

  // Add event description if it exists
  if (event.description) {
    lines.push(event.description)
    lines.push('')
  }

  // Add musician assignments with better formatting
  const acceptedAssignments = event.assignments.filter(a => a.user && (a.status === 'ACCEPTED' || a.status === 'PENDING'))
  const pendingAssignments = event.assignments.filter(a => !a.user && a.status === 'PENDING')
  
  if (acceptedAssignments.length > 0 || pendingAssignments.length > 0) {
    lines.push('👥 MUSICIANS:')
    
    // Show assigned musicians
    acceptedAssignments.forEach(assignment => {
      if (assignment.user) {
        const role = assignment.roleName || 'Musician'
        const name = `${assignment.user.firstName} ${assignment.user.lastName}`
        lines.push(`✅ ${role}: ${name}`)
      }
    })
    
    // Show open positions
    pendingAssignments.forEach(assignment => {
      const role = assignment.roleName || 'Musician'
      lines.push(`🔍 ${role}: OPEN POSITION`)
    })
    
    lines.push('')
  }

  // Add service parts and music with better formatting
  const hymns = event.hymns.filter(h => h.title)
  if (hymns.length > 0) {
    lines.push('🎵 MUSIC:')
    
    // Group by service part
    const hymnsByPart = new Map<string, typeof hymns>()
    
    hymns.forEach(hymn => {
      const partName = hymn.servicePart?.name || 'General Music'
      if (!hymnsByPart.has(partName)) {
        hymnsByPart.set(partName, [])
      }
      hymnsByPart.get(partName)!.push(hymn)
    })

    // Sort service parts by order
    const sortedParts = Array.from(hymnsByPart.entries()).sort((a, b) => {
      const orderA = hymns.find(h => h.servicePart?.name === a[0])?.servicePart?.order || 999
      const orderB = hymns.find(h => h.servicePart?.name === b[0])?.servicePart?.order || 999
      return orderA - orderB
    })

    sortedParts.forEach(([partName, partHymns]) => {
      if (partHymns.length > 0) {
        lines.push(`  📋 ${partName}:`)
        partHymns.forEach(hymn => {
          let musicLine = `    🎶 ${hymn.title}`
          if (hymn.notes) {
            musicLine += ` (${hymn.notes})`
          }
          lines.push(musicLine)
        })
      }
    })
    lines.push('')
  } else {
    lines.push('🎵 MUSIC: To be determined')
    lines.push('')
  }

  // Add event type and timing information
  lines.push(`📅 Event Type: ${event.eventType.name}`)
  
  return lines.join('\n')
}

/**
 * Formats an iCal event object into the proper iCal format
 */
function formatICalEvent(event: ICalEvent): string {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `SUMMARY:${escapeICalText(event.summary)}`,
    `DESCRIPTION:${escapeICalText(event.description)}`,
    `LOCATION:${escapeICalText(event.location)}`,
    `DTSTART:${formatICalDate(event.startDate)}`,
    `DTEND:${formatICalDate(event.endDate)}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `LAST-MODIFIED:${formatICalDate(event.lastModified)}`,
    `CREATED:${formatICalDate(event.created)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    ''
  ]

  return lines.join('\r\n')
}

/**
 * Formats a date for iCal with timezone support
 */
function formatICalDate(date: Date, timezone?: string): string {
  // For now, format as local time without timezone conversion
  // TODO: Add proper timezone handling when timezone data is available
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
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