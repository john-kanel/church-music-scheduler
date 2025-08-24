import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logActivity } from '@/lib/activity'
import { checkSubscriptionStatus, createSubscriptionErrorResponse } from '@/lib/subscription-check'
import { generateRecurringEvents, parseRecurrencePattern, extendRecurringEvents, generateRecurringDates } from '@/lib/recurrence'

// Helper function to update service part structure while preserving individual hymn titles
async function updateEventServicePartStructure(
  tx: any,
  eventId: string,
  newServiceParts: any[],
  rootEventId: string
) {
  // Get current hymns for this event
  const currentHymns = await tx.eventHymn.findMany({
    where: { eventId },
    select: {
      id: true,
      title: true,
      notes: true,
      servicePartId: true
    }
  })

  // Create a map of existing hymns by servicePartId for quick lookup
  const existingHymnsByServicePart = new Map()
  currentHymns.forEach((hymn: any) => {
    if (hymn.servicePartId) {
      existingHymnsByServicePart.set(hymn.servicePartId, hymn)
    }
  })

  // Delete all current hymns
  await tx.eventHymn.deleteMany({ where: { eventId } })

  // Create new hymns, preserving titles where service parts already existed
  const hymnsToCreate = newServiceParts.map((newServicePart: any) => {
    const existingHymn = existingHymnsByServicePart.get(newServicePart.servicePartId)
    
    return {
      eventId,
      title: existingHymn ? existingHymn.title : (newServicePart.title || ''),
      notes: existingHymn ? existingHymn.notes : (newServicePart.notes || null),
      servicePartId: newServicePart.servicePartId
    }
  })

  if (hymnsToCreate.length > 0) {
    await tx.eventHymn.createMany({ data: hymnsToCreate })
  }
}

// DELETE /api/events/[id]/series - Delete entire recurring series
export async function DELETE(
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

    // Only directors and pastors can delete events
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id: rootEventId } = await params

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
        hymns: true
      }
    })

    if (!rootEvent) {
      return NextResponse.json({ error: 'Root recurring event not found' }, { status: 404 })
    }

    // Delete the entire series (root event and all generated events)
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find all generated events from this root
      const generatedEvents = await tx.event.findMany({
        where: {
          generatedFrom: rootEventId,
          churchId: session.user.churchId
        }
      })

      // Delete assignments and hymns for all generated events
      for (const event of generatedEvents) {
        await tx.eventAssignment.deleteMany({ where: { eventId: event.id } })
        await tx.eventHymn.deleteMany({ where: { eventId: event.id } })
      }

      // Delete all generated events
      await tx.event.deleteMany({
        where: {
          generatedFrom: rootEventId,
          churchId: session.user.churchId
        }
      })

      // Delete assignments and hymns for root event
      await tx.eventAssignment.deleteMany({ where: { eventId: rootEventId } })
      await tx.eventHymn.deleteMany({ where: { eventId: rootEventId } })

      // Delete the root event
      await tx.event.delete({
        where: { id: rootEventId }
      })
    }, {
      timeout: 30000, // 30 second timeout
      maxWait: 10000  // 10 second max wait
    })

    // Log activity
    await logActivity({
      type: 'EVENT_CREATED', // Using existing enum value for event modifications
      description: `Deleted recurring event series: ${rootEvent.name}`,
      churchId: session.user.churchId,
      userId: session.user.id,
      metadata: {
        eventId: rootEvent.id,
        eventName: rootEvent.name,
        isRecurringSeries: true,
        isDelete: true
      }
    })

    return NextResponse.json({ 
      message: 'Recurring event series deleted successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('Error deleting recurring event series:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete recurring event series',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



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
    const url = new URL(request.url)
    const dryRun = url.searchParams.get('dryRun') === 'true'
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
      roles,
      hymns, 
      selectedGroups = [],
      editScope = 'future', // 'future' or 'all'
      eventTypeColor = null // Added eventTypeColor
    } = requestData
    
    // Use empty arrays as fallback, but preserve undefined for smart detection
    const rolesArray = roles || []
    const hymnsArray = hymns || []

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

    // Get user's timezone and create proper datetime (consistent with main events API)
    const { getUserTimezone, createEventDateTime } = await import('@/lib/timezone-utils')
    const userTimezone = await getUserTimezone(session.user.id)

    // Create dates using proper timezone handling
    const startDateTime = createEventDateTime(startDate, startTime, userTimezone)
    
    let endDateTime = null
    if (endTime) {
      endDateTime = createEventDateTime(startDate, endTime, userTimezone)
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
    for (const role of rolesArray) {
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
    const hymnsToCreate = hymnsArray.map((hymn: any) => ({
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

    // Update in transaction (with safety checks and optional dry-run)
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const currentDate = new Date() // Current date for scope filtering
      
      // Update the root event
      const updatedRootEvent = await tx.event.update({
        where: { id: rootEventId },
        data: {
          name: name,
          description: description || null,
          location: location || null,
          startTime: startDateTime,
          endTime: endDateTime,
          eventTypeId: finalEventTypeId, // Apply the color/event type
          recurrencePattern: JSON.stringify(recurrencePattern),
          recurrenceEnd: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
          assignedGroups: selectedGroups
        }
      })

      // Smart assignment handling: only update if roles/hymns were explicitly provided in request
      // roles/hymns === undefined means "don't change", empty array means "clear everything"  
      const hasRoleChanges = roles !== undefined
      const hasHymnChanges = hymns !== undefined
      
      // Prepare assignments for later use (even if not applying to root)
      const allAssignments = [
        ...assignmentsToCreate.map(a => ({ ...a, eventId: rootEventId })),
        ...groupAssignmentsToCreate.map(a => ({ ...a, eventId: rootEventId })),
        ...individualAssignmentsFromGroups.map(a => ({ ...a, eventId: rootEventId }))
      ]
      
      console.log('🎭 Assignment update analysis:', {
        hasRoleChanges,
        hasHymnChanges,
        rolesInRequest: roles !== undefined,
        hymnsInRequest: hymns !== undefined,
        rolesLength: rolesArray.length,
        hymnsLength: hymnsArray.length,
        preservingExistingData: !hasRoleChanges || !hasHymnChanges
      })

      if (hasRoleChanges) {
        // Only update assignments if roles were explicitly provided
        await tx.eventAssignment.deleteMany({ where: { eventId: rootEventId } })

        if (allAssignments.length > 0) {
          await tx.eventAssignment.createMany({ data: allAssignments })
        }
        console.log('✅ Updated assignments for root event')
      } else {
        console.log('⏩ Preserving existing assignments for root event')
      }

      if (hasHymnChanges) {
        // Only update hymns if hymns were explicitly provided
        await tx.eventHymn.deleteMany({ where: { eventId: rootEventId } })
        
        if (hymnsToCreate.length > 0) {
          await tx.eventHymn.createMany({
            data: hymnsToCreate.map((h: any) => ({ ...h, eventId: rootEventId }))
          })
        }
        console.log('✅ Updated hymns for root event')
      } else {
        console.log('⏩ Preserving existing hymns for root event')
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

      // Analyze recurrence change and prepare safe regeneration
      const pattern = parseRecurrencePattern(JSON.stringify(recurrencePattern))
      
      // Check if pattern actually changed by comparing to original
      const originalPattern = rootEvent.recurrencePattern ? 
        parseRecurrencePattern(rootEvent.recurrencePattern) : null
      
      // More reliable pattern comparison than JSON.stringify
      const patternChanged = originalPattern ? (
        pattern.type !== originalPattern.type ||
        pattern.interval !== originalPattern.interval ||
        JSON.stringify(pattern.weekdays?.sort()) !== JSON.stringify(originalPattern.weekdays?.sort()) ||
        pattern.monthlyType !== originalPattern.monthlyType ||
        pattern.weekOfMonth !== originalPattern.weekOfMonth ||
        pattern.maxOccurrences !== originalPattern.maxOccurrences
      ) : true

      console.log('🔍 Recurring series edit analysis:', {
        editScope,
        patternChanged,
        newPattern: pattern,
        originalPattern,
        eventsToUpdate: eventsToUpdate.length,
        rootEventId
      })
      
      if (patternChanged && editScope === 'future') {
        // SAFETY: compute future dates first; if none, abort (no deletes)
        const candidateDates = generateRecurringDates(updatedRootEvent.startTime, pattern)
          .filter((d: Date) => d >= currentDate)

        // Build existing future set (by ISO day+time) for diffing and dry-run
        const futureEvents = existingEvents.filter((e: any) => new Date(e.startTime) >= currentDate)
        const existingSet = new Set<string>(futureEvents.map((e: any) => new Date(e.startTime).toISOString()))
        const toCreateDates = candidateDates.filter((d: Date) => !existingSet.has(d.toISOString()))

        if (dryRun) {
          // In dry-run, report would-create/would-delete but do not change anything
          // Only consider deletes that are safe and exact-date replacements
          const newDateSet = new Set<string>(candidateDates.map(d => d.toISOString()))
          let safeDeletes = 0
          for (const ev of futureEvents) {
            const evIso = new Date(ev.startTime).toISOString()
            if (!newDateSet.has(evIso)) continue
            // We will only delete if not modified and no hymns/documents
            const hymnsCount = await tx.eventHymn.count({ where: { eventId: ev.id } })
            const docsCount = await tx.eventDocument.count({ where: { eventId: ev.id } }).catch(() => 0)
            if (!ev.isModified && hymnsCount === 0 && docsCount === 0) {
              safeDeletes++
            }
          }
          throw new Prisma.PrismaClientKnownRequestError(`DRY_RUN: wouldCreate=${toCreateDates.length}; wouldDelete=${safeDeletes}`, {
            code: 'P2000',
            clientVersion: 'NA'
          } as any)
        }

        if (candidateDates.length === 0) {
          throw new Error('New recurrence pattern yields no future dates; refusing to delete')
        }

        // Create new events first (additive)
        const newEvents = await generateRecurringEvents(
          updatedRootEvent,
          pattern,
          tx,
          session.user.churchId
        )

        // Attach assignments/hymns to newly created events (optional)
        for (const event of newEvents) {
          if (hasRoleChanges && allAssignments.length > 0) {
            const eventAssignments = allAssignments.map(a => ({ ...a, eventId: event.id }))
            await tx.eventAssignment.createMany({ data: eventAssignments })
          }
          if (hasHymnChanges && hymnsToCreate.length > 0) {
            await tx.eventHymn.createMany({
              data: hymnsToCreate.map((h: any) => ({ ...h, eventId: event.id }))
            })
          }
        }

        // Now prune only exact-date duplicates that are safe to remove
        const newSet = new Set<string>(newEvents.map((e: any) => new Date(e.startTime).toISOString()))
        let safeRemoved = 0
        for (const ev of futureEvents) {
          const evIso = new Date(ev.startTime).toISOString()
          if (!newSet.has(evIso)) continue
          const hymnsCount = await tx.eventHymn.count({ where: { eventId: ev.id } })
          const docsCount = await tx.eventDocument.count({ where: { eventId: ev.id } }).catch(() => 0)
          if (ev.isModified || hymnsCount > 0 || docsCount > 0) continue
          await tx.eventAssignment.deleteMany({ where: { eventId: ev.id } })
          await tx.eventHymn.deleteMany({ where: { eventId: ev.id } })
          await tx.event.delete({ where: { id: ev.id } })
          safeRemoved++
        }

        eventsUpdated = newEvents.length
        console.log('✅ Safe regeneration summary:', { created: newEvents.length, removed: safeRemoved })
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
              endTime: newEventEndTime,
              eventTypeId: finalEventTypeId // Apply the color/event type
            }
          })

          // Smart assignment handling for individual events
          if (hasRoleChanges) {
            await tx.eventAssignment.deleteMany({ where: { eventId: event.id } })
            
            if (allAssignments.length > 0) {
              const eventAssignments = allAssignments.map(a => ({
                ...a,
                eventId: event.id
              }))
              await tx.eventAssignment.createMany({ data: eventAssignments })
            }
          }

          // Smart service part handling: update structure but preserve individual hymn titles
          if (hasHymnChanges) {
            await updateEventServicePartStructure(
              tx, 
              event.id, 
              hymnsToCreate, 
              rootEventId
            )
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