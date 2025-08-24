import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logActivity } from '@/lib/activity'
import { checkSubscriptionStatus, createSubscriptionErrorResponse } from '@/lib/subscription-check'
import { generateRecurringEvents, parseRecurrencePattern, extendRecurringEvents } from '@/lib/recurrence'


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const rootOnly = searchParams.get('rootOnly') === 'true'

    if (rootOnly) {
      // Fetch only root recurring events for sidebar
      const rootEvents = await prisma.event.findMany({
        where: {
          churchId: session.user.churchId,
          isRootEvent: true,
          isRecurring: true
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
              group: true
            }
          },
          hymns: {
            include: {
              servicePart: true
            },
            orderBy: { createdAt: 'asc' } // Ensure hymns are in correct order
          }
        },
        orderBy: { startTime: 'asc' }
      })

      return NextResponse.json({ events: rootEvents })
    }

    // TEMPORARILY DISABLED: Auto-extension of recurring events
    // This was causing issues - will re-enable after investigation
    // if (!rootOnly) {
    //   const targetDate = new Date()
    //   targetDate.setMonth(targetDate.getMonth() + 6)
    //   
    //   const rootEvents = await prisma.event.findMany({
    //     where: {
    //       churchId: session.user.churchId,
    //       isRootEvent: true,
    //       isRecurring: true
    //     },
    //     select: { id: true }
    //   })
    //   
    //   for (const rootEvent of rootEvents) {
    //     try {
    //       await extendRecurringEvents(rootEvent.id, targetDate, prisma)
    //     } catch (error) {
    //       console.error(`Error extending recurring events for ${rootEvent.id}:`, error)
    //     }
    //   }
    // }

    // Regular event fetching with month/year filtering
    let whereClause: any = {
      churchId: session.user.churchId
    }

    // Add date filtering if provided
    if (month && year) {
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0)
      endOfMonth.setHours(23, 59, 59, 999)

      whereClause.startTime = {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }

    // Handle date range filtering (for available events page)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    if (startDate || endDate) {
      whereClause.startTime = {}
      if (startDate) {
        whereClause.startTime.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.startTime.lte = new Date(endDate)
      }
    }

    // EXCLUDE TENTATIVE AND CANCELLED EVENTS FOR MUSICIANS
    // Musicians should not see tentative or cancelled events in calendar or available events
    if (session.user.role === 'MUSICIAN') {
      whereClause.NOT = {
        status: {
          in: ['TENTATIVE', 'CANCELLED']
        }
      }
    }

    const events = await prisma.event.findMany({
      where: whereClause,
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
            group: true
          }
        },
        hymns: {
          include: {
            servicePart: { select: { id: true, name: true, order: true } }
          },
          orderBy: [
            { servicePart: { order: 'asc' } },
            { createdAt: 'asc' }
          ]
        },
        musicFiles: true
      },
      orderBy: { startTime: 'asc' }
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error fetching events:', error)
    
    // Check if it's a database connection error
    if (error instanceof Error && error.message.includes("Can't reach database server")) {
      return NextResponse.json(
        { 
          error: 'Database temporarily unavailable. Please try again in a moment.',
          code: 'DATABASE_CONNECTION_ERROR'
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// POST /api/events - Create a new event (one-off or root recurring)
export async function POST(request: NextRequest) {
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

    // Only directors and pastors can create events
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const requestData = await request.json()

    const {
      name,
      description = '',
      location,
      startDate,
      startTime,
      endTime = '',
      eventTypeId = null,
      status = 'CONFIRMED',
      isRecurring = false,
      recurrencePattern = null,
      recurrenceEndDate = null,
      roles = [],
      hymns = [],
      selectedGroups = [],
      eventTypeColor = null // Added eventTypeColor
    } = requestData

    // Validation
    if (!name || !location || !startDate || !startTime) {
      return NextResponse.json(
        { error: 'Name, location, start date, and start time are required' },
        { status: 400 }
      )
    }

    if (isRecurring && !recurrencePattern) {
      return NextResponse.json(
        { error: 'Recurrence pattern is required for recurring events' },
        { status: 400 }
      )
    }

    // Get user's timezone and create proper datetime
    const { getUserTimezone, createEventDateTime } = await import('@/lib/timezone-utils')
    const userTimezone = await getUserTimezone(session.user.id)

    // Create dates using proper timezone handling
    const startDateTime = createEventDateTime(startDate, startTime, userTimezone)
    
    let endDateTime = null
    if (endTime) {
      endDateTime = createEventDateTime(startDate, endTime, userTimezone)
    }



    // Find or create event type based on color
    let finalEventTypeId = eventTypeId
    
    if (!isRecurring) {
      // For one-off events, ALWAYS use blue color and "General" type
      let generalEventType = await prisma.eventType.findFirst({
        where: {
          churchId: session.user.churchId,
          color: '#3B82F6', // Force blue for one-off events
          name: 'General'
        }
      })

      if (!generalEventType) {
        generalEventType = await prisma.eventType.create({
          data: {
            name: 'General',
            color: '#3B82F6',
            churchId: session.user.churchId
          }
        })
      }
      finalEventTypeId = generalEventType.id
    } else if (!finalEventTypeId && eventTypeColor) {
      // For recurring events, use the specified color
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
    } else if (!finalEventTypeId) {
      // Fallback: find or create default event type
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

    // Prepare group assignments for auto-assignment
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

    // Create the event (and recurring events if specified)
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the main event (root event for recurring series)
      const event = await tx.event.create({
        data: {
          name: name,
          description: description || null,
          location: location || null,
          startTime: startDateTime,
          endTime: endDateTime,
          eventTypeId: finalEventTypeId,
          churchId: session.user.churchId,
          status: status.toUpperCase(),
          isRecurring: isRecurring,
          recurrencePattern: isRecurring ? JSON.stringify(recurrencePattern) : null,
          recurrenceEnd: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate) : null,
          isRootEvent: isRecurring,
          assignedGroups: selectedGroups
        }
      })

      // Create assignments for the main event
      const allAssignments = [
        ...assignmentsToCreate.map(a => ({ ...a, eventId: event.id })),
        ...groupAssignmentsToCreate.map(a => ({ ...a, eventId: event.id })),
        ...individualAssignmentsFromGroups.map(a => ({ ...a, eventId: event.id }))
      ]

      if (allAssignments.length > 0) {
        await tx.eventAssignment.createMany({ data: allAssignments })
      }

      // Create hymns for the main event with deterministic createdAt to preserve order
      if (hymnsToCreate.length > 0) {
        const baseTime = new Date()
        await tx.eventHymn.createMany({
          data: hymnsToCreate.map((h: any, index: number) => ({
            ...h,
            eventId: event.id,
            createdAt: new Date(baseTime.getTime() + index * 1000)
          }))
        })
      }

      // Generate recurring events if this is a recurring event
      if (isRecurring && recurrencePattern) {
        const pattern = parseRecurrencePattern(JSON.stringify(recurrencePattern))
        if (recurrenceEndDate) {
          pattern.endDate = new Date(recurrenceEndDate)
        }
        
        const recurringEvents = await generateRecurringEvents(
          event,
          pattern,
          tx,
          session.user.churchId
        )

        // Create assignments and service part structure for each recurring event
        for (const recurringEvent of recurringEvents) {
          // Copy assignments to recurring events
          if (allAssignments.length > 0) {
            const recurringAssignments = allAssignments.map(a => ({
              ...a,
              eventId: recurringEvent.id
            }))
            await tx.eventAssignment.createMany({ data: recurringAssignments })
          }

          // Apply default service part structure to new recurring events
          // This creates the service part placeholders, but each event can have its own hymn selections
          if (hymnsToCreate.length > 0) {
            const recurringHymns = hymnsToCreate.map((h: any) => ({
              ...h,
              eventId: recurringEvent.id
            }))
            await tx.eventHymn.createMany({ data: recurringHymns })
          }
        }
      }

      return event
    }, {
      timeout: 60000, // 60 second timeout for large recurring series
      maxWait: 15000  // 15 second max wait
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
      description: `Created ${isRecurring ? 'recurring' : ''} event: ${name}`,
      churchId: session.user.churchId,
      userId: session.user.id,
      metadata: {
        eventId: result.id,
        eventName: name,
        eventDate: startDateTime.toISOString(),
        isRecurring: isRecurring,
        isRootEvent: isRecurring
      }
    })

    // Schedule automated notifications for this new event
    const { scheduleEventNotifications } = await import('@/lib/automation-helpers')
    await scheduleEventNotifications(result.id, session.user.churchId)

    return NextResponse.json({ 
      message: `${isRecurring ? 'Recurring' : ''} event created successfully`,
      event: completeEvent 
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 