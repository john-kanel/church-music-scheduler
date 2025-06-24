import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

// GET /api/events/[eventId] - Get single event
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        churchId: session.user.churchId
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
            group: {
              select: {
                id: true,
                name: true
              }
            },
            customRole: true
          }
        },
        musicFiles: true
      }
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

// PUT /api/events/[eventId] - Update event
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can update events
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify event belongs to church
    const existingEvent = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        churchId: session.user.churchId
      }
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
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
      roles = [],
      isRecurring,
      recurrencePattern,
      recurrenceEnd,
      isPastEvent
    } = body

    // Validation
    if (!name || !location || !startDate || !startTime) {
      return NextResponse.json(
        { error: 'Name, location, start date, and start time are required' },
        { status: 400 }
      )
    }

    // Combine date and time - treat as local time to avoid timezone issues
    const [year, month, day] = startDate.split('-').map(Number)
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startDateTime = new Date(year, month - 1, day, startHour, startMinute)
    
    let endDateTime = null
    if (endTime) {
      const [endHour, endMinute] = endTime.split(':').map(Number)
      endDateTime = new Date(year, month - 1, day, endHour, endMinute)
    }

    // Update event in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the event
      const updatedEvent = await tx.event.update({
        where: { id: params.eventId },
        data: {
          name,
          description,
          location,
          startTime: startDateTime,
          endTime: endDateTime,
          isRecurring,
          recurrencePattern,
          recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
          ...(eventTypeId && { eventTypeId })
        }
      })

      // If roles provided, update assignments
      if (roles.length > 0) {
        // Remove existing unassigned roles
        await tx.eventAssignment.deleteMany({
          where: {
            eventId: params.eventId,
            userId: null,
            groupId: null
          }
        })

        // Create new role assignments
        await tx.eventAssignment.createMany({
          data: roles.map((role: any) => ({
            eventId: params.eventId,
            roleName: role.name,
            maxMusicians: role.maxCount || 1,
            status: 'PENDING'
          }))
        })
      }

      // If this event is now recurring, create recurring instances
      if (isRecurring && recurrencePattern) {
        // Remove any existing recurring events for this parent
        await tx.event.deleteMany({
          where: {
            parentEventId: params.eventId
          }
        })

        // Get existing role assignments to copy to recurring events
        const existingAssignments = await tx.eventAssignment.findMany({
          where: {
            eventId: params.eventId,
            userId: null,
            groupId: null
          }
        })

        // Generate recurring events
        const recurringEvents = generateRecurringEvents(
          updatedEvent,
          recurrencePattern,
          recurrenceEnd ? new Date(recurrenceEnd) : null,
          session.user.churchId
        )

        // Create recurring events
        for (const recurringEvent of recurringEvents) {
          const createdEvent = await tx.event.create({
            data: {
              ...recurringEvent,
              parentEventId: params.eventId
            }
          })

          // Copy existing role assignments to recurring events
          if (existingAssignments.length > 0) {
            await tx.eventAssignment.createMany({
              data: existingAssignments.map((assignment) => ({
                eventId: createdEvent.id,
                roleName: assignment.roleName,
                maxMusicians: assignment.maxMusicians,
                status: 'PENDING'
              }))
            })
          }
        }
      } else if (!isRecurring) {
        // If no longer recurring, remove any child events
        await tx.event.deleteMany({
          where: {
            parentEventId: params.eventId
          }
        })
      }

      return updatedEvent
    })

    // Fetch the complete updated event
    const completeEvent = await prisma.event.findUnique({
      where: { id: params.eventId },
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

    // Schedule automated notifications for updated event (skip for past events)
    if (!isPastEvent) {
      const { scheduleEventNotifications } = await import('@/lib/automation-helpers')
      await scheduleEventNotifications(params.eventId, session.user.churchId)
    }

    return NextResponse.json({ 
      message: 'Event updated successfully',
      event: completeEvent 
    })

  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

// DELETE /api/events/[eventId] - Delete event
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can delete events
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify event belongs to church
    const existingEvent = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        churchId: session.user.churchId
      }
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Delete event (cascade will handle assignments and files)
    await prisma.event.delete({
      where: { id: params.eventId }
    })

    return NextResponse.json({ 
      message: 'Event deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
} 