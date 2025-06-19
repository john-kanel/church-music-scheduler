import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/events/[eventId] - Get single event
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.parishId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        parishId: session.user.parishId
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
    
    if (!session?.user?.parishId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can update events
    if (!['DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify event belongs to parish
    const existingEvent = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        parishId: session.user.parishId
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
    
    if (!session?.user?.parishId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can delete events
    if (!['DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify event belongs to parish
    const existingEvent = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        parishId: session.user.parishId
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