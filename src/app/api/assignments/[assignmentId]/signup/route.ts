import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { scheduleEventNotifications } from '@/lib/automation-helpers'

// POST /api/assignments/[assignmentId]/signup - Musician signs up for an assignment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only musicians can sign up for assignments
    if (session.user.role !== 'MUSICIAN') {
      return NextResponse.json({ error: 'Only musicians can sign up for assignments' }, { status: 403 })
    }

    const { assignmentId } = await params

    // Verify the assignment exists, belongs to the church, and is available
    const assignment = await prisma.eventAssignment.findFirst({
      where: {
        id: assignmentId,
        event: {
          churchId: session.user.churchId,
          // EXCLUDE TENTATIVE AND CANCELLED EVENTS - Musicians cannot sign up for tentative or cancelled events
          NOT: {
            status: {
              in: ['TENTATIVE', 'CANCELLED']
            }
          }
        },
        userId: null, // Must be unassigned
        status: 'PENDING' // Must be available
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startTime: true,
            churchId: true
          }
        }
      }
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not available or not found' }, { status: 404 })
    }

    // Check if the event is in the future
    const eventDate = new Date(assignment.event.startTime)
    const now = new Date()
    if (eventDate <= now) {
      return NextResponse.json({ error: 'Cannot sign up for past events' }, { status: 400 })
    }

    // Check if the musician is already assigned to this event in any role
    const existingAssignment = await prisma.eventAssignment.findFirst({
      where: {
        eventId: assignment.event.id,
        userId: session.user.id
      }
    })

    if (existingAssignment) {
      return NextResponse.json({ error: 'You are already assigned to this event' }, { status: 400 })
    }

    // Update the assignment to assign the musician
    const updatedAssignment = await prisma.eventAssignment.update({
      where: { id: assignmentId },
      data: {
        userId: session.user.id,
        status: 'ACCEPTED' // Auto-accept when musician signs up
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

    // Log the activity
    await logActivity({
      type: 'MUSICIAN_SIGNED_UP',
      description: `${session.user.name} signed up for ${assignment.event.name} as ${assignment.roleName}`,
      churchId: session.user.churchId,
      metadata: {
        eventId: assignment.event.id,
        eventName: assignment.event.name,
        assignmentId: assignment.id,
        roleName: assignment.roleName,
        musicianId: session.user.id,
        musicianName: session.user.name
      }
    })

    // Schedule automated notifications for this musician
    await scheduleEventNotifications(assignment.event.id, session.user.churchId)
    
    return NextResponse.json({
      message: 'Successfully signed up for assignment',
      assignment: updatedAssignment
    })

  } catch (error) {
    console.error('Error signing up for assignment:', error)
    return NextResponse.json(
      { error: 'Failed to sign up for assignment' },
      { status: 500 }
    )
  }
} 