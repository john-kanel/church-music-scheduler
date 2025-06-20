import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logActivity } from '@/lib/activity'

// GET /api/events - List events for the parish
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.parishId) {
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
        parishId: session.user.parishId,
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
    
    if (!session?.user?.parishId) {
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

    // Find or create default event type
    let finalEventTypeId = eventTypeId
    if (!finalEventTypeId) {
      const defaultEventType = await prisma.eventType.findFirst({
        where: {
          parishId: session.user.parishId,
          name: 'General'
        }
      })

      if (!defaultEventType) {
        const newEventType = await prisma.eventType.create({
          data: {
            name: 'General',
            color: '#3B82F6',
            parishId: session.user.parishId
          }
        })
        finalEventTypeId = newEventType.id
      } else {
        finalEventTypeId = defaultEventType.id
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
          parishId: session.user.parishId,
          eventTypeId: finalEventTypeId
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
            // Create open role assignment (no specific musician assigned)
            await tx.eventAssignment.create({
              data: {
                eventId: event.id,
                roleName: role.name,
                maxMusicians: role.maxCount || 1,
                status: 'PENDING'
              }
            })
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
      parishId: session.user.parishId,
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