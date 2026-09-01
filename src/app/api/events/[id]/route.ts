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
  console.log('🔍 PUT request received for event:', params.id)
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can update events
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify event belongs to church and get current status
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
    
    // Detect if this is a drag-and-drop request (only has startTime/endTime ISO strings)
    const isDragAndDrop = body.startTime && body.startTime.includes('T') && 
                         Object.keys(body).length <= 3 && // startTime, endTime, maybe one more field
                         !body.name && !body.location
    
    // Detect if this is a status-only update (only has status field)
    const isStatusOnly = Object.keys(body).length === 1 && body.status
    
    // Handle drag-and-drop format (ISO strings) vs form format (separate date/time)
    let startDate, startTime, endTime, name, description, location, eventTypeId, status, roles, isRecurring, recurrencePattern, recurrenceEnd, isPastEvent
    
    if (isDragAndDrop) {
      console.log('🎯 Detected drag-and-drop request')
      // Drag-and-drop format: ISO strings - preserve existing event data
      const startDateTime = new Date(body.startTime)
      const endDateTime = body.endTime ? new Date(body.endTime) : null
      
      startDate = startDateTime.toISOString().split('T')[0] // "2025-07-24"
      startTime = startDateTime.toTimeString().slice(0, 5) // "10:00"
      endTime = endDateTime ? endDateTime.toTimeString().slice(0, 5) : body.endTime
      
      // Keep existing event data for other fields
      name = existingEvent.name
      description = existingEvent.description
      location = existingEvent.location
      eventTypeId = existingEvent.eventTypeId
      status = existingEvent.status
      roles = []
      isRecurring = existingEvent.isRecurring
      recurrencePattern = existingEvent.recurrencePattern
      recurrenceEnd = existingEvent.recurrenceEnd
      isPastEvent = false
    } else if (isStatusOnly) {
      console.log('🏷️ Detected status-only update request')
      // Status-only update: preserve all existing event data except status
      const startDateTime = new Date(existingEvent.startTime)
      const endDateTime = existingEvent.endTime ? new Date(existingEvent.endTime) : null
      
      startDate = startDateTime.toISOString().split('T')[0] // "2025-07-24"
      startTime = startDateTime.toTimeString().slice(0, 5) // "10:00"
      endTime = endDateTime ? endDateTime.toTimeString().slice(0, 5) : null
      
      // Keep existing event data for all fields except status
      name = existingEvent.name
      description = existingEvent.description
      location = existingEvent.location
      eventTypeId = existingEvent.eventTypeId
      status = body.status // Only change the status
      roles = []
      isRecurring = existingEvent.isRecurring
      recurrencePattern = existingEvent.recurrencePattern
      recurrenceEnd = existingEvent.recurrenceEnd
      isPastEvent = false
    } else {
      console.log('📝 Detected form update request')
      // Form format: separate fields
      startDate = body.startDate
      startTime = body.startTime
      endTime = body.endTime
      name = body.name
      description = body.description
      location = body.location
      eventTypeId = body.eventTypeId
      status = body.status
      roles = body.roles || []
      isRecurring = body.isRecurring
      recurrencePattern = body.recurrencePattern
      recurrenceEnd = body.recurrenceEnd
      isPastEvent = body.isPastEvent
    }

    console.log('📨 API processed request:', {
      isDragAndDrop,
      isStatusOnly,
      name,
      description,
      location,
      startDate,
      startTime,
      endTime,
      eventTypeId,
      status,
      isPastEvent
    })

    // Ensure roles is always an array
    const validRoles = Array.isArray(roles) ? roles : []

    // Validation - more lenient for drag and drop and status-only updates
    if (isDragAndDrop) {
      // For drag and drop, only validate time fields
      if (!startDate || !startTime) {
        return NextResponse.json(
          { error: 'Valid start date and time are required' },
          { status: 400 }
        )
      }
    } else if (isStatusOnly) {
      // For status-only updates, only validate status
      if (!status) {
        return NextResponse.json(
          { error: 'Status is required' },
          { status: 400 }
        )
      }
    } else {
      // For form updates, validate all required fields
      if (!name || !location || !startDate || !startTime) {
        return NextResponse.json(
          { error: 'Name, location, start date, and start time are required' },
          { status: 400 }
        )
      }
    }

    // Create dates using proper timezone handling
    let startDateTime, endDateTime = null
    
    if (isDragAndDrop) {
      // For drag and drop, we receive correct UTC timestamps - use them directly
      console.log('🕐 Drag and drop: using UTC timestamps directly')
      startDateTime = new Date(body.startTime)
      if (body.endTime) {
        endDateTime = new Date(body.endTime)
      }
    } else {
      // For form updates, apply timezone conversion
      console.log('🕐 Form update: applying timezone conversion')
      const { getUserTimezone, createEventDateTime } = await import('@/lib/timezone-utils')
      const userTimezone = await getUserTimezone(session.user.id)
      
      startDateTime = createEventDateTime(startDate, startTime, userTimezone)
      if (endTime) {
        endDateTime = createEventDateTime(startDate, endTime, userTimezone)
      }
    }



    // Use the provided eventTypeId if available, otherwise keep the existing one
    let finalEventTypeId = eventTypeId || existingEvent.eventTypeId

    // Split the update into smaller operations to avoid transaction timeout
    console.log('🔄 Starting event update in smaller operations:', { 
      eventId: params.id,
      name, 
      location, 
      startDateTime: startDateTime.toISOString(),
      validRoles: validRoles.length,
      finalEventTypeId 
    })
    
    // Step 1: Update the main event
    console.log('📝 Updating event in database...')
    const updateData = {
      name,
      description,
      location,
      startTime: startDateTime,
      endTime: endDateTime,
      isRecurring,
      recurrencePattern,
      recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
      ...(finalEventTypeId && { eventTypeId: finalEventTypeId }),
      ...(status && { status: status.toUpperCase() })
    }

    console.log('💾 About to update event with data:', {
      eventId: params.id,
      updateData: {
        name: updateData.name,
        location: updateData.location,
        startTime: updateData.startTime.toISOString(),
        endTime: updateData.endTime?.toISOString(),
        description: updateData.description,
        status: updateData.status // Added this
      },
      fullUpdateData: updateData // Added this to see everything
    })

    const updatedEvent = await prisma.event.update({
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

    // Step 2: Update role assignments (separate operation)
    if (validRoles.length > 0) {
      console.log('👥 Updating role assignments...')
      
      await prisma.$transaction(async (tx) => {
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
      }, { timeout: 10000 })
      
      console.log('✅ Role assignments updated')
    }

    // Step 3: Handle recurring events (separate operation)
    // Only regenerate recurring events if explicitly requested via forceRecurrenceUpdate flag
    // This prevents individual event edits from affecting the entire series
    const forceRecurrenceUpdate = body.forceRecurrenceUpdate === true
    
    if (isRecurring && recurrencePattern && forceRecurrenceUpdate) {
      console.log('🔄 Processing recurring event settings (forced update)...')
      
      await prisma.$transaction(async (tx) => {
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
      }, { timeout: 30000 })
      
      console.log('✅ Recurring events created')
    } else if (isRecurring && recurrencePattern) {
      console.log('🔄 Skipping recurring event regeneration - individual event edit')
    } else if (!isRecurring) {
      // If no longer recurring, remove any child events
      await prisma.event.deleteMany({
        where: {
          parentEventId: params.id
        }
      })
      
      console.log('✅ Removed recurring events (no longer recurring)')
    }

    // Step 4: Mark event for calendar update
    await markEventForCalendarUpdate(updatedEvent.id)

    console.log('✅ All operations completed successfully')

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

    // Check for event cancellation and send emails if needed
    if (status) {
      console.log('📧 Checking for event cancellation...')
      const { checkForEventCancellation } = await import('@/lib/event-cancellation')
      await checkForEventCancellation(params.id, existingEvent.status, status.toUpperCase())
      console.log('✅ Cancellation check completed')
    }

    // Queue an end-of-day digest for updates (skip for past events)
    if (!isPastEvent) {
      console.log('📧 Queueing daily digest for updates...')
      const { queueEventUpdateDigest } = await import('@/lib/event-update-digest')
      await queueEventUpdateDigest(params.id, session.user.churchId)
      console.log('✅ Digest queued')
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

// PATCH /api/events/[id] - Partial update event (for drag and drop)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    console.log('🔍 PATCH request received for event:', params.id)
    console.log('📥 Request URL:', request.url)
    
    const body = await request.clone().json()
    console.log('📋 PATCH request body:', body)
    
    // PATCH calls the same logic as PUT for simplicity
    const result = await PUT(request, context)
    console.log('✅ PATCH result status:', result.status)
    
    return result
  } catch (error) {
    console.error('❌ PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to process PATCH request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function getSeriesRootId(event: {
  id: string
  isRootEvent: boolean
  isRecurring: boolean
  parentEventId: string | null
  generatedFrom: string | null
}): string | null {
  if (event.isRootEvent || event.isRecurring) return event.id
  return event.generatedFrom || event.parentEventId || null
}

function seriesMemberWhere(rootId: string, churchId: string) {
  return {
    churchId,
    OR: [
      { id: rootId },
      { parentEventId: rootId },
      { generatedFrom: rootId }
    ]
  }
}

async function detachNonCascadingEventRefs(tx: Prisma.TransactionClient, eventIds: string[]) {
  if (eventIds.length === 0) return
  await tx.communication.updateMany({
    where: { eventId: { in: eventIds } },
    data: { eventId: null }
  })
  await tx.notificationLog.updateMany({
    where: { eventId: { in: eventIds } },
    data: { eventId: null }
  })
}

function withRecurrenceEnd(patternString: string | null, endDate: Date): string {
  let pattern: Record<string, unknown> = {}
  try {
    pattern = patternString ? JSON.parse(patternString) : {}
  } catch {
    pattern = { type: 'weekly' }
  }
  pattern.endDate = endDate.toISOString()
  return JSON.stringify(pattern)
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

    const { searchParams } = new URL(request.url)
    const deletionType = searchParams.get('type') || 'single' // 'single', 'all', 'future'
    const churchId = session.user.churchId

    const existingEvent = await prisma.event.findFirst({
      where: {
        id: params.id,
        churchId
      }
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const seriesRootId = getSeriesRootId(existingEvent)

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      switch (deletionType) {
        case 'single': {
          await detachNonCascadingEventRefs(tx, [params.id])
          await tx.event.delete({
            where: { id: params.id }
          })

          // Remember this date so backfill does not recreate a skipped occurrence
          if (seriesRootId && seriesRootId !== params.id) {
            const root = await tx.event.findUnique({ where: { id: seriesRootId } })
            if (root?.recurrencePattern) {
              let pattern: { excludedDates?: string[] } = {}
              try {
                pattern = JSON.parse(root.recurrencePattern)
              } catch {
                pattern = {}
              }
              const excludedDates = Array.isArray(pattern.excludedDates) ? pattern.excludedDates : []
              const iso = existingEvent.startTime.toISOString()
              if (!excludedDates.includes(iso)) {
                excludedDates.push(iso)
              }
              await tx.event.update({
                where: { id: seriesRootId },
                data: {
                  recurrencePattern: JSON.stringify({ ...pattern, excludedDates })
                }
              })
            }
          }
          break
        }

        case 'all': {
          const rootId = seriesRootId || params.id
          const members = await tx.event.findMany({
            where: seriesMemberWhere(rootId, churchId),
            select: { id: true }
          })
          const ids = Array.from(new Set([...members.map(e => e.id), params.id]))
          await detachNonCascadingEventRefs(tx, ids)
          await tx.event.deleteMany({
            where: { id: { in: ids } }
          })
          break
        }

        case 'future': {
          const cutoff = existingEvent.startTime
          const rootId = seriesRootId || params.id
          const members = await tx.event.findMany({
            where: {
              ...seriesMemberWhere(rootId, churchId),
              startTime: { gte: cutoff }
            },
            select: { id: true }
          })
          const ids = Array.from(new Set([...members.map(e => e.id), params.id]))
          await detachNonCascadingEventRefs(tx, ids)
          await tx.event.deleteMany({
            where: { id: { in: ids } }
          })

          // Stop the series so cron/backfill cannot recreate deleted future dates
          const rootStillThere = await tx.event.findUnique({ where: { id: rootId } })
          if (rootStillThere) {
            const seriesEnd = new Date(cutoff.getTime() - 1000)
            await tx.event.update({
              where: { id: rootId },
              data: {
                recurrenceEnd: seriesEnd,
                recurrencePattern: withRecurrenceEnd(rootStillThere.recurrencePattern, seriesEnd)
              }
            })
          }
          break
        }

        default:
          throw new Error('Invalid deletion type')
      }
    }, {
      timeout: 30000,
      maxWait: 10000
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