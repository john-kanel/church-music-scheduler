import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logActivity } from '@/lib/activity'

// Helper function to generate recurring events
function generateRecurringEvents(
  baseEvent: any,
  recurrencePattern: string,
  recurrenceEnd: Date | null,
  churchId: string
) {
  const events: any[] = []
  const startDate = new Date(baseEvent.startTime)
  const endDate = baseEvent.endTime ? new Date(baseEvent.endTime) : null
  
  // Default to 6 months if no end date specified
  const finalEndDate = recurrenceEnd || new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000)
  
  let currentDate = new Date(startDate)
  
  // Skip the first occurrence (that's the original event)
  switch (recurrencePattern) {
    case 'weekly':
      currentDate.setDate(currentDate.getDate() + 7)
      break
    case 'biweekly':
      currentDate.setDate(currentDate.getDate() + 14)
      break
    case 'monthly':
      currentDate.setMonth(currentDate.getMonth() + 1)
      break
    case 'quarterly':
      currentDate.setMonth(currentDate.getMonth() + 3)
      break
    default:
      return events // Unknown pattern
  }
  
  // Generate recurring events
  while (currentDate <= finalEndDate && events.length < 52) { // Max 52 occurrences
    const eventStartTime = new Date(currentDate)
    const eventEndTime = endDate ? new Date(currentDate.getTime() + (endDate.getTime() - startDate.getTime())) : null
    
    events.push({
      name: baseEvent.name,
      description: baseEvent.description,
      location: baseEvent.location,
      startTime: eventStartTime,
      endTime: eventEndTime,
      isRecurring: false, // Child events are not recurring themselves
      recurrencePattern: null,
      recurrenceEnd: null,
      churchId: churchId,
      eventTypeId: baseEvent.eventTypeId,
      templateId: baseEvent.templateId
    })
    
    // Increment for next occurrence
    switch (recurrencePattern) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7)
        break
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14)
        break
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1)
        break
      case 'quarterly':
        currentDate.setMonth(currentDate.getMonth() + 3)
        break
    }
  }
  
  return events
}

// GET /api/events - List events for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    // Build date filter
    const dateFilter: any = {}
    
    if (monthParam && yearParam) {
      // If month and year are provided, filter by that month
      const targetDate = new Date(parseInt(yearParam), parseInt(monthParam) - 1, 1)
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59)
      dateFilter.gte = startOfMonth
      dateFilter.lte = endOfMonth
    } else {
      // Otherwise use startDate/endDate if provided
      if (startDate) {
        dateFilter.gte = new Date(startDate)
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate)
      }
    }

    const events = await prisma.event.findMany({
      where: {
        churchId: session.user.churchId,
        ...(Object.keys(dateFilter).length > 0 && { startTime: dateFilter })
      },
      include: {
        eventType: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            group: true,
            customRole: true
          }
        },
        musicFiles: true,
        _count: {
          select: {
            assignments: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// POST /api/events - Create a new event
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can create events
    if (!['DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      location,
      startDate,
      startTime,
      endTime,
      eventTypeId,
      templateId,
      templateColor,
      roles = [],
      hymns = [],
      isRecurring = false,
      recurrencePattern,
      recurrenceEnd
    } = body

    // Validation
    if (!name || !location || !startDate || !startTime) {
      return NextResponse.json(
        { error: 'Name, location, start date, and start time are required' },
        { status: 400 }
      )
    }

    // Combine date and time
    const startDateTime = new Date(`${startDate}T${startTime}`)
    const endDateTime = endTime ? new Date(`${startDate}T${endTime}`) : null

    // Find or create event type
    let finalEventTypeId = eventTypeId
    
    if (!finalEventTypeId) {
      // If we have a template with color, create/find event type with that color
      if (templateId && templateColor) {
        // Look for existing event type with the template name and color
        let templateEventType = await prisma.eventType.findFirst({
          where: {
            churchId: session.user.churchId,
            name: name,
            color: templateColor
          }
        })

        if (!templateEventType) {
          templateEventType = await prisma.eventType.create({
            data: {
              name: name,
              color: templateColor,
              churchId: session.user.churchId
            }
          })
        }
        finalEventTypeId = templateEventType.id
      } else {
        // Default event type
        const defaultEventType = await prisma.eventType.findFirst({
          where: {
            churchId: session.user.churchId,
            name: 'General'
          }
        })

        if (!defaultEventType) {
          const newEventType = await prisma.eventType.create({
            data: {
              name: 'General',
              color: '#3B82F6',
              churchId: session.user.churchId
            }
          })
          finalEventTypeId = newEventType.id
        } else {
          finalEventTypeId = defaultEventType.id
        }
      }
    }

    // Create event in transaction with assignments
    const result = await prisma.$transaction(async (tx) => {
      // Create the event
      const event = await tx.event.create({
        data: {
          name,
          description,
          location,
          startTime: startDateTime,
          endTime: endDateTime,
          isRecurring,
          recurrencePattern,
          recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
          churchId: session.user.churchId,
          eventTypeId: finalEventTypeId,
          templateId: templateId || null
        }
      })

      // Create role assignments if provided
      if (roles.length > 0) {
        for (const role of roles) {
          if (role.assignedMusicians && role.assignedMusicians.length > 0) {
            // Create individual assignments for each assigned musician
            await tx.eventAssignment.createMany({
              data: role.assignedMusicians.map((musicianId: string) => ({
                eventId: event.id,
                userId: musicianId,
                roleName: role.name,
                status: 'PENDING'
              }))
            })
          } else {
            // Create multiple open role assignments based on maxCount
            const maxCount = role.maxCount || 1
            const assignmentsToCreate = []
            
            for (let i = 0; i < maxCount; i++) {
              assignmentsToCreate.push({
                eventId: event.id,
                roleName: role.name,
                maxMusicians: 1, // Each assignment is for 1 musician
                status: 'PENDING' as const
              })
            }
            
            await tx.eventAssignment.createMany({
              data: assignmentsToCreate
            })
          }
        }
      }

      // If this is a recurring event, create recurring instances
      if (isRecurring && recurrencePattern) {
        // Generate recurring events
        const recurringEvents = generateRecurringEvents(
          event,
          recurrencePattern,
          recurrenceEnd ? new Date(recurrenceEnd) : null,
          session.user.churchId
        )

        // Create recurring events
        for (const recurringEvent of recurringEvents) {
          const createdEvent = await tx.event.create({
            data: {
              ...recurringEvent,
              parentEventId: event.id
            }
          })

          // Copy role assignments to recurring events
          if (roles.length > 0) {
            for (const role of roles) {
              if (role.assignedMusicians && role.assignedMusicians.length > 0) {
                await tx.eventAssignment.createMany({
                  data: role.assignedMusicians.map((musicianId: string) => ({
                    eventId: createdEvent.id,
                    userId: musicianId,
                    roleName: role.name,
                    status: 'PENDING'
                  }))
                })
              } else {
                const maxCount = role.maxCount || 1
                const assignmentsToCreate = []
                
                for (let i = 0; i < maxCount; i++) {
                  assignmentsToCreate.push({
                    eventId: createdEvent.id,
                    roleName: role.name,
                    maxMusicians: 1,
                    status: 'PENDING' as const
                  })
                }
                
                await tx.eventAssignment.createMany({
                  data: assignmentsToCreate
                })
              }
            }
          }
        }
      }

      return event
    })

    // Fetch the complete event with relations
    const completeEvent = await prisma.event.findUnique({
      where: { id: result.id },
      include: {
        eventType: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            customRole: true
          }
        },
        musicFiles: true
      }
    })

    // Log activity
    await logActivity({
      type: 'EVENT_CREATED',
      description: `Created event: ${name}`,
      churchId: session.user.churchId,
      userId: session.user.id,
      metadata: {
        eventId: result.id,
        eventName: name,
        eventDate: startDateTime.toISOString()
      }
    })

    return NextResponse.json({ 
      message: 'Event created successfully',
      event: completeEvent 
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
} 