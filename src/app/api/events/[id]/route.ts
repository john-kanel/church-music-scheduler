import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { markEventForCalendarUpdate } from '@/lib/calendar-updates'



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

// GET /api/events/[id] - Get single event
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = await prisma.event.findFirst({
      where: {
        id: params.id,
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

// PUT /api/events/[id] - Update event
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
        id: params.id,
        churchId: session.user.churchId
      },
              include: {
          eventType: true
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

    console.log('📨 API received request body:', {
      name,
      description,
      location,
      startDate,
      startTime,
      endTime,
      eventTypeId,
      isPastEvent,
      originalEvent: {
        name: existingEvent.name,
        location: existingEvent.location,
        startTime: existingEvent.startTime.toISOString()
      }
    })

    // Ensure roles is always an array
    const validRoles = Array.isArray(roles) ? roles : []

    // Validation
    if (!name || !location || !startDate || !startTime) {
      return NextResponse.json(
        { error: 'Name, location, start date, and start time are required' },
        { status: 400 }
      )
    }

    // Create dates using ISO string format (consistent with event creation logic)
    const [year, month, day] = startDate.split('-').map(Number)
    const [startHour, startMinute] = startTime.split(':').map(Number)
    
    const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}:00`
    const startDateTime = new Date(dateString)
    
    let endDateTime = null
    if (endTime) {
      const [endHour, endMinute] = endTime.split(':').map(Number)
      const endDateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00`
      endDateTime = new Date(endDateString)
    }

    console.log('📅 Date/time construction:', {
      input: { startDate, startTime, endTime },
      localTime: { 
        inputTime: `${startTime} local`, 
        constructedTime: `${startHour}:${startMinute.toString().padStart(2, '0')} local` 
      },
      constructed: {
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime?.toISOString()
      },
      originalDateTime: existingEvent.startTime.toISOString(),
      timesMatch: startDateTime.getTime() === existingEvent.startTime.getTime(),
      note: 'Using local time without timezone conversion (consistent with event creation)'
    })

    // Use the provided eventTypeId if available, otherwise keep the existing one
    let finalEventTypeId = eventTypeId || existingEvent.eventTypeId

    // Update event in transaction
    console.log('🔄 Starting event update transaction:', { 
      eventId: params.id,
      name, 
      location, 
      startDateTime: startDateTime.toISOString(),
      validRoles: validRoles.length,
      finalEventTypeId 
    })
    
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      console.log('📝 Updating event in database...')
      
      // Update the event
      const updateData = {
        name,
        description,
        location,
        startTime: startDateTime,
        endTime: endDateTime,
        isRecurring,
        recurrencePattern,
        recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
        ...(finalEventTypeId && { eventTypeId: finalEventTypeId })
      }

      console.log('💾 About to update event with data:', {
        eventId: params.id,
        updateData: {
          name: updateData.name,
          location: updateData.location,
          startTime: updateData.startTime.toISOString(),
          endTime: updateData.endTime?.toISOString(),
          description: updateData.description
        }
      })

      const updatedEvent = await tx.event.update({
        where: { id: params.id },
        data: updateData
      })
      
      console.log('✅ Event updated in database:', { 
        eventId: updatedEvent.id,
        updatedName: updatedEvent.name,
        updatedLocation: updatedEvent.location,
        updatedStartTime: updatedEvent.startTime.toISOString(),
        updatedEndTime: updatedEvent.endTime?.toISOString()
      })

      // Mark event for calendar update
      await markEventForCalendarUpdate(updatedEvent.id)

      // If roles provided, update assignments
      if (validRoles.length > 0) {
        console.log('👥 Updating role assignments...')
        
        // Remove existing unassigned roles
        await tx.eventAssignment.deleteMany({
          where: {
            eventId: params.id,
            userId: null,
            groupId: null
          }
        })

        // Create new role assignments
        await tx.eventAssignment.createMany({
          data: validRoles.map((role: any) => ({
            eventId: params.id,
            roleName: role.name,
            maxMusicians: role.maxCount || 1,
            status: 'PENDING'
          }))
        })
        
        console.log('✅ Role assignments updated')
      }

      // If this event is now recurring, create recurring instances
      if (isRecurring && recurrencePattern) {
        console.log('🔄 Processing recurring event settings...')
        
        // Remove any existing recurring events for this parent
        await tx.event.deleteMany({
          where: {
            parentEventId: params.id
          }
        })

        // Get existing role assignments to copy to recurring events
        const existingAssignments = await tx.eventAssignment.findMany({
          where: {
            eventId: params.id,
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
              parentEventId: params.id
            }
          })

          // Copy existing role assignments to recurring events
          if (existingAssignments.length > 0) {
            await tx.eventAssignment.createMany({
              data: existingAssignments.map((assignment: any) => ({
                eventId: createdEvent.id,
                roleName: assignment.roleName,
                maxMusicians: assignment.maxMusicians,
                status: 'PENDING'
              }))
            })
          }
        }
        
        console.log('✅ Recurring events created')
      } else if (!isRecurring) {
        // If no longer recurring, remove any child events
        await tx.event.deleteMany({
          where: {
            parentEventId: params.id
          }
        })
        
        console.log('✅ Removed recurring events (no longer recurring)')
      }

      return updatedEvent
    })

    console.log('✅ Transaction completed successfully')

    // Fetch the complete updated event
    console.log('📄 Fetching complete event data...')
    const completeEvent = await prisma.event.findUnique({
      where: { id: params.id },
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

    console.log('✅ Complete event data fetched:', {
      eventId: completeEvent?.id,
      name: completeEvent?.name,
      location: completeEvent?.location,
      startTime: completeEvent?.startTime.toISOString(),
      endTime: completeEvent?.endTime?.toISOString()
    })

    // Schedule automated notifications for updated event (skip for past events)
    if (!isPastEvent) {
      console.log('📧 Scheduling notifications...')
      const { scheduleEventNotifications } = await import('@/lib/automation-helpers')
      await scheduleEventNotifications(params.id, session.user.churchId)
      console.log('✅ Notifications scheduled')
    }

    console.log('🎉 Event update completed successfully:', { 
      eventId: params.id,
      eventName: completeEvent?.name 
    })

    return NextResponse.json({ 
      message: 'Event updated successfully',
      event: completeEvent 
    })

  } catch (error) {
    console.error('Error updating event:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      eventId: params.id
    })
    return NextResponse.json(
      { 
        error: 'Failed to update event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/events/[id] - Delete event
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

    // Get deletion type from query parameters
    const { searchParams } = new URL(request.url)
    const deletionType = searchParams.get('type') || 'single' // 'single', 'all', 'future'

    // Verify event belongs to church and get recurring information
    const existingEvent = await prisma.event.findFirst({
      where: {
        id: params.id,
        churchId: session.user.churchId
      }
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Handle different deletion types
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      switch (deletionType) {
        case 'single':
          // Delete only this event
          await tx.event.delete({
            where: { id: params.id }
          })
          break

        case 'all':
          // Delete all events in the recurring series
          if (existingEvent.parentEventId) {
            // This is a child event, delete parent and all children
            await tx.event.deleteMany({
              where: {
                OR: [
                  { id: existingEvent.parentEventId },
                  { parentEventId: existingEvent.parentEventId }
                ]
              }
            })
          } else {
            // This is the parent event, delete it and all children
            await tx.event.deleteMany({
              where: {
                OR: [
                  { id: params.id },
                  { parentEventId: params.id }
                ]
              }
            })
          }
          break

        case 'future':
          // Delete this event and all future events in the series
          if (existingEvent.parentEventId) {
            // This is a child event, delete this and all future events
            await tx.event.deleteMany({
              where: {
                OR: [
                  { id: params.id },
                  {
                    parentEventId: existingEvent.parentEventId,
                    startTime: { gte: existingEvent.startTime }
                  }
                ]
              }
            })
          } else {
            // This is the parent event, delete it and all children
            await tx.event.deleteMany({
              where: {
                OR: [
                  { id: params.id },
                  { parentEventId: params.id }
                ]
              }
            })
          }
          break

        default:
          throw new Error('Invalid deletion type')
      }
    })

    const deletionMessage = 
      deletionType === 'single' ? 'Event deleted successfully' :
      deletionType === 'all' ? 'All recurring events deleted successfully' :
      'Future recurring events deleted successfully'

    return NextResponse.json({ 
      message: deletionMessage 
    })

  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
} 