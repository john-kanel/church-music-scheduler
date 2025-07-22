import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST /api/public-signup - Handle public musician signup with PIN verification
export async function POST(request: NextRequest) {
  try {
    const { token, assignmentId, musicianId, pin } = await request.json()

    if (!token || !assignmentId || !musicianId || !pin) {
      return NextResponse.json({ 
        error: 'Missing required fields: token, assignmentId, musicianId, pin' 
      }, { status: 400 })
    }

    // Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
    }

    // Find and validate the public schedule link
    const publicLink = await prisma.publicScheduleLink.findUnique({
      where: { token },
      include: {
        church: {
          select: { id: true, name: true }
        }
      }
    })

    if (!publicLink) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    // Check if the link is still valid (within date range)
    const now = new Date()
    if (now < publicLink.startDate || now > publicLink.endDate) {
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
    }

    // Verify the musician exists and belongs to the church
    const musician = await prisma.user.findFirst({
      where: {
        id: musicianId,
        churchId: publicLink.churchId,
        role: 'MUSICIAN',
        isVerified: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        pin: true
      }
    })

    if (!musician) {
      return NextResponse.json({ error: 'Musician not found' }, { status: 404 })
    }

    // Verify the PIN
    if (musician.pin !== pin) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    // Verify the assignment exists and is available
    const assignment = await prisma.eventAssignment.findFirst({
      where: {
        id: assignmentId,
        userId: null, // Must be unassigned
        event: {
          churchId: publicLink.churchId,
          startTime: {
            gte: publicLink.startDate,
            lte: publicLink.endDate
          }
        }
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startTime: true
          }
        }
      }
    })

    if (!assignment) {
      return NextResponse.json({ 
        error: 'Assignment not found or no longer available' 
      }, { status: 404 })
    }

    // Check if the event is in the future
    const eventDate = new Date(assignment.event.startTime)
    if (eventDate <= now) {
      return NextResponse.json({ 
        error: 'Cannot sign up for past events' 
      }, { status: 400 })
    }

    // Assign the musician to the role
    const updatedAssignment = await prisma.eventAssignment.update({
      where: { id: assignmentId },
      data: {
        userId: musicianId,
        status: 'ACCEPTED' // Automatically accepted as specified
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
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

    // TODO: Send notification emails to directors/pastors about the new assignment
    // This would use the existing notification system

    return NextResponse.json({
      message: 'Successfully signed up for the event',
      assignment: {
        id: updatedAssignment.id,
        roleName: updatedAssignment.roleName,
        event: updatedAssignment.event,
        musician: updatedAssignment.user
      }
    })

  } catch (error) {
    console.error('Error processing public signup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 