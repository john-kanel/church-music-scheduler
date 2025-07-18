import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logActivity } from '@/lib/activity'
import { checkSubscriptionStatus, createSubscriptionErrorResponse } from '@/lib/subscription-check'
import { generateRecurringEvents, parseRecurrencePattern, extendRecurringEvents } from '@/lib/recurrence'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription status
    const subscriptionStatus = await checkSubscriptionStatus(session.user.churchId)
    if (!subscriptionStatus.isActive) {
      return createSubscriptionErrorResponse()
    }

    // Only directors and pastors can edit events
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id: rootEventId } = await params
    const requestData = await request.json()

    const {
      name,
      description = '',
      location,
      startDate,
      startTime,
      endTime = '',
      recurrencePattern = null,
      recurrenceEndDate = null,
      roles = [],
      hymns = [],
      selectedGroups = [],
      editScope = 'future', // 'future' or 'all'
      eventTypeColor = null // Added eventTypeColor
    } = requestData

    // Validation
    if (!name || !location || !startDate || !startTime) {
      return NextResponse.json(
        { error: 'Name, location, start date, and start time are required' },
        { status: 400 }
      )
    }

    if (!recurrencePattern) {
      return NextResponse.json(
        { error: 'Recurrence pattern is required for recurring events' },
        { status: 400 }
      )
    }

    // Verify this is a root recurring event that belongs to the user's church
    const rootEvent = await prisma.event.findFirst({
      where: {
        id: rootEventId,
        churchId: session.user.churchId,
        isRootEvent: true,
        isRecurring: true
      },
      include: {
        assignments: true,
        hymns: true,
        eventType: true
      }
    })

    if (!rootEvent) {
      return NextResponse.json({ error: 'Root recurring event not found' }, { status: 404 })
    }

    // Combine date and time
    const [year, month, day] = startDate.split('-').map(Number)
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startDateTime = new Date(year, month - 1, day, startHour, startMinute)
    
    let endDateTime = null
    if (endTime) {
      const [endHour, endMinute] = endTime.split(':').map(Number)
      endDateTime = new Date(year, month - 1, day, endHour, endMinute)
    }

    // Find or create event type based on color (similar to main events API)
    let finalEventTypeId = rootEvent.eventTypeId

    if (eventTypeColor) {
      // Try to find existing event type with this color
      let eventType = await prisma.eventType.findFirst({
        where: {
          churchId: session.user.churchId,
          color: eventTypeColor
        }
      })

      if (!eventType) {
        // Create new event type with the specified color
        eventType = await prisma.eventType.create({
          data: {
            name: 'General',
            color: eventTypeColor,
            churchId: session.user.churchId
          }
        })
      }
      finalEventTypeId = eventType.id
    }

    // Prepare assignments
    const assignmentsToCreate: any[] = []
    for (const role of roles) {
      if (role.assignedMusicians && role.assignedMusicians.length > 0) {
        for (const musicianId of role.assignedMusicians) {
          assignmentsToCreate.push({
            userId: musicianId,
            roleName: role.name,
            status: 'PENDING'
          })
        }
      } else {
        for (let i = 0; i < role.maxCount; i++) {
          assignmentsToCreate.push({
            roleName: role.name,
            maxMusicians: 1,
            status: 'PENDING'
          })
        }
      }
    }

    // Prepare hymns
    const hymnsToCreate = hymns.map((hymn: any) => ({
      title: hymn.title?.trim() || '',
      notes: hymn.notes?.trim() || null,
      servicePartId: hymn.servicePartId === 'custom' || !hymn.servicePartId ? null : hymn.servicePartId
    }))

    // Prepare group assignments
    const groupAssignmentsToCreate: any[] = []
    const individualAssignmentsFromGroups: any[] = []
    
    for (const groupId of selectedGroups) {
      const group = await prisma.group.findFirst({
        where: { id: groupId, churchId: session.user.churchId },
        include: { members: { include: { user: true } } }
      })
      
      if (group) {
        groupAssignmentsToCreate.push({
          groupId: group.id,
          status: 'PENDING'
        })
        
        for (const member of group.members) {
          individualAssignmentsFromGroups.push({
            userId: member.user.id,
            groupId: group.id,
            status: 'PENDING'
          })
        }
      }
    }

    const currentDate = new Date()
    let progress = ''
    let eventsUpdated = 0
    let eventsSkipped = 0
    const skippedEventDates: string[] = []

    // Update in transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update the root event
      const updatedRootEvent = await tx.event.update({
        where: { id: rootEventId },
        data: {
          name: name,
          description: description || null,
          location: location || null,
          startTime: startDateTime,
          endTime: endDateTime,
          recurrencePattern: JSON.stringify(recurrencePattern),
          recurrenceEnd: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
          assignedGroups: selectedGroups
        }
      })

      // Update root event assignments and hymns
      await tx.eventAssignment.deleteMany({ where: { eventId: rootEventId } })
      await tx.eventHymn.deleteMany({ where: { eventId: rootEventId } })

      const allAssignments = [
        ...assignmentsToCreate.map(a => ({ ...a, eventId: rootEventId })),
        ...groupAssignmentsToCreate.map(a => ({ ...a, eventId: rootEventId })),
        ...individualAssignmentsFromGroups.map(a => ({ ...a, eventId: rootEventId }))
      ]

      if (allAssignments.length > 0) {
        await tx.eventAssignment.createMany({ data: allAssignments })
      }

      if (hymnsToCreate.length > 0) {
        await tx.eventHymn.createMany({
          data: hymnsToCreate.map((h: any) => ({ ...h, eventId: rootEventId }))
        })
      }

      // Get existing generated events
      const existingEvents = await tx.event.findMany({
        where: {
          generatedFrom: rootEventId,
          churchId: session.user.churchId
        },
        orderBy: { startTime: 'asc' }
      })

      // Determine which events to update based on scope
      let eventsToUpdate: any[] = []
      if (editScope === 'future') {
        eventsToUpdate = existingEvents.filter((event: any) => 
          new Date(event.startTime) >= currentDate
        )
      } else {
        eventsToUpdate = existingEvents
      }

      // Delete future events that will be regenerated (if pattern changed)
      const pattern = parseRecurrencePattern(JSON.stringify(recurrencePattern))
      
      // Check if pattern actually changed by comparing to original
      const originalPattern = rootEvent.recurrencePattern ? 
        parseRecurrencePattern(rootEvent.recurrencePattern) : null
      
      const patternChanged = JSON.stringify(pattern) !== JSON.stringify(originalPattern)
      
      if (patternChanged && editScope === 'future') {
        // Delete future events so they can be regenerated with new pattern
        const futureEvents = existingEvents.filter((event: any) => 
          new Date(event.startTime) >= currentDate
        )
        
        for (const event of futureEvents) {
          await tx.eventAssignment.deleteMany({ where: { eventId: event.id } })
          await tx.eventHymn.deleteMany({ where: { eventId: event.id } })
          await tx.event.delete({ where: { id: event.id } })
        }
        
        // Generate new events
        const newEvents = await generateRecurringEvents(
          updatedRootEvent,
          pattern,
          tx,
          session.user.churchId
        )

        // Create assignments and hymns for new events
        for (const event of newEvents) {
          if (allAssignments.length > 0) {
            const eventAssignments = allAssignments.map(a => ({
              ...a,
              eventId: event.id
            }))
            await tx.eventAssignment.createMany({ data: eventAssignments })
          }

          if (hymnsToCreate.length > 0) {
            const eventHymns = hymnsToCreate.map((h: any) => ({
              ...h,
              eventId: event.id
            }))
            await tx.eventHymn.createMany({ data: eventHymns })
          }
        }
        
        eventsUpdated = newEvents.length
      } else {
        // Update existing events (preserve modifications)
        for (const event of eventsToUpdate) {
          if (event.isModified) {
            eventsSkipped++
            skippedEventDates.push(new Date(event.startTime).toLocaleDateString())
            continue
          }

          // Calculate new event time based on offset from original root event
          const originalOffset = new Date(event.startTime).getTime() - new Date(rootEvent.startTime).getTime()
          const newEventTime = new Date(startDateTime.getTime() + originalOffset)
          const newEventEndTime = endDateTime ? new Date(endDateTime.getTime() + originalOffset) : null

          // Update the event
          await tx.event.update({
            where: { id: event.id },
            data: {
              name: name,
              description: description || null,
              location: location || null,
              startTime: newEventTime,
              endTime: newEventEndTime
            }
          })

          // Update assignments and hymns
          await tx.eventAssignment.deleteMany({ where: { eventId: event.id } })
          await tx.eventHymn.deleteMany({ where: { eventId: event.id } })

          if (allAssignments.length > 0) {
            const eventAssignments = allAssignments.map(a => ({
              ...a,
              eventId: event.id
            }))
            await tx.eventAssignment.createMany({ data: eventAssignments })
          }

          if (hymnsToCreate.length > 0) {
            const eventHymns = hymnsToCreate.map((h: any) => ({
              ...h,
              eventId: event.id
            }))
            await tx.eventHymn.createMany({ data: eventHymns })
          }

          eventsUpdated++
        }
      }

      return updatedRootEvent
    }, {
      timeout: 60000, // 60 second timeout for large series
      maxWait: 15000  // 15 second max wait
    })

    // Prepare progress message
    progress = `Updated ${eventsUpdated} events`
    if (eventsSkipped > 0) {
      progress += `, skipped ${eventsSkipped} modified events (${skippedEventDates.join(', ')})`
    }

    // Log activity
    await logActivity({
      type: 'EVENT_CREATED', // Using existing enum value for event modifications
      description: `Updated recurring event series: ${name} (${editScope} scope)`,
      churchId: session.user.churchId,
      userId: session.user.id,
      metadata: {
        eventId: result.id,
        eventName: name,
        editScope: editScope,
        eventsUpdated: eventsUpdated,
        eventsSkipped: eventsSkipped,
        isUpdate: true
      }
    })

    return NextResponse.json({ 
      message: `Recurring event series updated successfully`,
      progress: progress,
      eventsUpdated: eventsUpdated,
      eventsSkipped: eventsSkipped,
      skippedEventDates: skippedEventDates
    }, { status: 200 })

  } catch (error) {
    console.error('Error updating recurring event series:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update recurring event series',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 