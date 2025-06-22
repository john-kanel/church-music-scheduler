import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PUT /api/assignments/[assignmentId] - Accept or decline assignment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { assignmentId } = await params
    const { musicianId } = await request.json()

    // Only directors and pastors can assign/unassign musicians
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify the assignment exists and belongs to the church
    const assignment = await prisma.eventAssignment.findFirst({
      where: {
        id: assignmentId,
        event: {
          churchId: session.user.churchId
        }
      },
      include: {
        event: true
      }
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // If musicianId is null, we're unassigning the musician
    if (musicianId === null) {
      const updatedAssignment = await prisma.eventAssignment.update({
        where: { id: assignmentId },
        data: {
          userId: null,
          status: 'PENDING'
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
        message: 'Musician unassigned successfully',
        assignment: updatedAssignment
      })
    }

    // If we have a musicianId, verify the musician exists and belongs to the church
    const musician = await prisma.user.findFirst({
      where: {
        id: musicianId,
        churchId: session.user.churchId,
        role: 'MUSICIAN',
        isVerified: true
      }
    })

    if (!musician) {
      return NextResponse.json({ error: 'Musician not found' }, { status: 404 })
    }

    // Update the assignment
    const updatedAssignment = await prisma.eventAssignment.update({
      where: { id: assignmentId },
      data: {
        userId: musicianId,
        status: 'PENDING' // Set to pending until musician confirms
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

    // TODO: Send notification email to the assigned musician
    
    return NextResponse.json({
      message: 'Musician assigned successfully',
      assignment: updatedAssignment
    })

  } catch (error) {
    console.error('Error assigning musician:', error)
    return NextResponse.json(
      { error: 'Failed to assign musician' },
      { status: 500 }
    )
  }
} 