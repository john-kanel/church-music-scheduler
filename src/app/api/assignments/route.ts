import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/assignments - Create a new assignment (add role to event)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can create assignments
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { eventId, roleName, maxMusicians = 1, status = 'PENDING' } = await request.json()

    if (!eventId || !roleName) {
      return NextResponse.json({ error: 'Event ID and role name are required' }, { status: 400 })
    }

    // Verify the event exists and belongs to the church
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        churchId: session.user.churchId
      }
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Create the new assignment
    const newAssignment = await prisma.eventAssignment.create({
      data: {
        eventId,
        roleName,
        maxMusicians,
        status
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        event: {
          select: {
            id: true,
            name: true,
            startTime: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Role added successfully',
      assignment: newAssignment
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating assignment:', error)
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    )
  }
} 