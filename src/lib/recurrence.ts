interface RecurrencePattern {
  type: 'weekly' | 'biweekly' | 'monthly' | 'custom'
  interval?: number // For custom intervals (e.g., every 2 weeks)
  weekdays?: number[] // 0-6 (Sunday-Saturday) for multiple days per week
  monthlyType?: 'date' | 'weekday' // For monthly: same date vs same weekday
  weekOfMonth?: number // For monthly weekday type (1st, 2nd, 3rd, 4th, last)
  endDate?: Date
  maxOccurrences?: number
}

export function parseRecurrencePattern(patternString: string): RecurrencePattern {
  try {
    return JSON.parse(patternString)
  } catch {
    // Handle legacy string patterns
    switch (patternString) {
      case 'weekly': return { type: 'weekly' }
      case 'biweekly': return { type: 'biweekly' }
      case 'monthly': return { type: 'monthly', monthlyType: 'date' }
      default: return { type: 'weekly' }
    }
  }
}

export function generateRecurringDates(
  startDate: Date,
  pattern: RecurrencePattern,
  maxMonths: number = 6 // Reduced from 2 years to 6 months for initial generation
): Date[] {
  const dates: Date[] = []
  let currentDate = new Date(startDate)
  
  // Default max end date if not specified (rolling 6-month window)
  const maxEndDate = new Date(startDate)
  maxEndDate.setMonth(maxEndDate.getMonth() + maxMonths)
  
  const finalEndDate = pattern.endDate && pattern.endDate < maxEndDate 
    ? pattern.endDate 
    : maxEndDate
  
  const maxOccurrences = pattern.maxOccurrences || Math.min(26, Math.ceil(maxMonths * 4.33)) // ~26 events max (6 months of weekly)
  
  while (currentDate <= finalEndDate && dates.length < maxOccurrences) {
    switch (pattern.type) {
      case 'weekly':
        if (pattern.weekdays && pattern.weekdays.length > 0) {
          // Multiple days per week
          for (const weekday of pattern.weekdays) {
            const eventDate = new Date(currentDate)
            const daysUntilWeekday = (weekday - currentDate.getDay() + 7) % 7
            eventDate.setDate(eventDate.getDate() + daysUntilWeekday)
            
            if (eventDate <= finalEndDate && dates.length < maxOccurrences) {
              dates.push(new Date(eventDate))
            }
          }
          currentDate.setDate(currentDate.getDate() + 7)
        } else {
          // Single day per week
          if (currentDate > startDate) { // Skip the first occurrence (that's the root event)
            dates.push(new Date(currentDate))
          }
          currentDate.setDate(currentDate.getDate() + 7)
        }
        break
        
      case 'biweekly':
        if (currentDate > startDate) {
          dates.push(new Date(currentDate))
        }
        currentDate.setDate(currentDate.getDate() + 14)
        break
        
      case 'monthly':
        if (pattern.monthlyType === 'weekday') {
          // Same weekday of month (e.g., 2nd Sunday)
          const weekOfMonth = pattern.weekOfMonth || Math.ceil(startDate.getDate() / 7)
          const weekday = startDate.getDay()
          
          currentDate.setMonth(currentDate.getMonth() + 1)
          currentDate.setDate(1)
          
          // Find the nth occurrence of the weekday in the month
          let occurrenceCount = 0
          for (let day = 1; day <= 31; day++) {
            currentDate.setDate(day)
            if (currentDate.getMonth() !== (currentDate.getMonth())) break // Invalid date
            
            if (currentDate.getDay() === weekday) {
              occurrenceCount++
              if (occurrenceCount === weekOfMonth) {
                if (currentDate > startDate) {
                  dates.push(new Date(currentDate))
                }
                break
              }
            }
          }
        } else {
          // Same date of month
          if (currentDate > startDate) {
            dates.push(new Date(currentDate))
          }
          currentDate.setMonth(currentDate.getMonth() + 1)
        }
        break
        
      case 'custom':
        const interval = pattern.interval || 1
        if (currentDate > startDate) {
          dates.push(new Date(currentDate))
        }
        currentDate.setDate(currentDate.getDate() + (7 * interval))
        break
        
      default:
        return dates
    }
    
    // Safety check to prevent infinite loops
    if (dates.length > 0 && dates[dates.length - 1].getTime() === currentDate.getTime()) {
      break
    }
  }
  
  return dates
}

export function formatRecurrencePattern(pattern: RecurrencePattern): string {
  switch (pattern.type) {
    case 'weekly':
      if (pattern.weekdays && pattern.weekdays.length > 1) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const days = pattern.weekdays.map(d => dayNames[d]).join(', ')
        return `Weekly on ${days}`
      }
      return 'Weekly'
      
    case 'biweekly':
      return 'Every 2 weeks'
      
    case 'monthly':
      if (pattern.monthlyType === 'weekday') {
        const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th']
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const weekOfMonth = pattern.weekOfMonth || 1
        return `Monthly on ${ordinals[weekOfMonth]} ${dayNames[0]}` // Simplified for now
      }
      return 'Monthly'
      
    case 'custom':
      const interval = pattern.interval || 1
      return `Every ${interval} week${interval > 1 ? 's' : ''}`
      
    default:
      return 'Custom'
  }
}

export async function generateRecurringEvents(
  rootEvent: any,
  pattern: RecurrencePattern,
  prisma: any,
  churchId: string
) {
  const recurringDates = generateRecurringDates(rootEvent.startTime, pattern)
  
  if (recurringDates.length === 0) {
    return []
  }
  
  const eventDuration = rootEvent.endTime 
    ? rootEvent.endTime.getTime() - rootEvent.startTime.getTime()
    : 0
    
  const eventsToCreate = recurringDates.map(date => {
    const endTime = eventDuration > 0 
      ? new Date(date.getTime() + eventDuration)
      : null
      
    return {
      name: rootEvent.name,
      description: rootEvent.description,
      location: rootEvent.location,
      officiant: rootEvent.officiant,
      startTime: date,
      endTime: endTime,
      isRecurring: false, // Generated events are not recurring themselves
      recurrencePattern: null,
      recurrenceEnd: null,
      parentEventId: rootEvent.id,
      isRootEvent: false,
      generatedFrom: rootEvent.id,
      assignedGroups: rootEvent.assignedGroups || [],
      churchId: churchId,
      eventTypeId: rootEvent.eventTypeId
    }
  })
  
  // Create events in smaller batches to improve performance
  const batchSize = 25 // Reduced from 50 to 25 for better performance
  const createdEvents = []
  
  for (let i = 0; i < eventsToCreate.length; i += batchSize) {
    const batch = eventsToCreate.slice(i, i + batchSize)
    const batchResult = await prisma.event.createManyAndReturn({ data: batch })
    createdEvents.push(...batchResult)
  }
  
  return createdEvents
}

export async function extendRecurringEvents(
  rootEventId: string,
  targetDate: Date,
  prisma: any
): Promise<any[]> {
  // Get the root event
  const rootEvent = await prisma.event.findUnique({
    where: { id: rootEventId, isRootEvent: true },
    include: {
      assignments: true,
      hymns: true
    }
  })
  
  if (!rootEvent || !rootEvent.recurrencePattern) {
    return []
  }
  
  // Find the latest generated event for this series
  const latestEvent = await prisma.event.findFirst({
    where: { generatedFrom: rootEventId },
    orderBy: { startTime: 'desc' }
  })
  
  if (!latestEvent) {
    return []
  }
  
  // Check if we need to generate more events
  const latestEventDate = new Date(latestEvent.startTime)
  if (latestEventDate >= targetDate) {
    return [] // Already have events up to the target date
  }
  
  // Generate additional events from the latest event date to target date + 3 months
  const pattern = parseRecurrencePattern(rootEvent.recurrencePattern)
  const extendToDate = new Date(targetDate)
  extendToDate.setMonth(extendToDate.getMonth() + 3) // Generate 3 months ahead
  
  if (pattern.endDate && pattern.endDate < extendToDate) {
    return [] // Series has already ended
  }
  
  // Temporarily adjust the pattern to generate from latest event date
  const tempPattern = { ...pattern, endDate: extendToDate }
  const newDates = generateRecurringDates(latestEventDate, tempPattern, 3)
  
  if (newDates.length === 0) {
    return []
  }
  
  const eventDuration = rootEvent.endTime 
    ? rootEvent.endTime.getTime() - rootEvent.startTime.getTime()
    : 0
    
  const eventsToCreate = newDates.map(date => ({
    name: rootEvent.name,
    description: rootEvent.description,
    location: rootEvent.location,
    startTime: date,
    endTime: eventDuration > 0 ? new Date(date.getTime() + eventDuration) : null,
    isRecurring: false,
    recurrencePattern: null,
    recurrenceEnd: null,
    parentEventId: rootEvent.id,
    isRootEvent: false,
    generatedFrom: rootEvent.id,
    assignedGroups: rootEvent.assignedGroups || [],
    churchId: rootEvent.churchId,
    eventTypeId: rootEvent.eventTypeId
  }))
  
  // Create the new events
  const createdEvents = await prisma.event.createManyAndReturn({ 
    data: eventsToCreate 
  })
  
  // Copy assignments and hymns to new events (in batches for performance)
  for (const event of createdEvents) {
    if (rootEvent.assignments.length > 0) {
      const assignmentsToCreate = rootEvent.assignments.map((a: any) => ({
        eventId: event.id,
        userId: a.userId,
        groupId: a.groupId,
        roleName: a.roleName,
        status: 'PENDING'
      }))
      await prisma.eventAssignment.createMany({ data: assignmentsToCreate })
    }
    
    if (rootEvent.hymns.length > 0) {
      const hymnsToCreate = rootEvent.hymns.map((h: any) => ({
        eventId: event.id,
        title: h.title,
        notes: h.notes,
        servicePartId: h.servicePartId
      }))
      await prisma.eventHymn.createMany({ data: hymnsToCreate })
    }
  }
  
  return createdEvents
} 