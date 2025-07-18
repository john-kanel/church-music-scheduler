import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/assignments/my-assignments - Get all assignments for the current musician
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only musicians can access their own assignments
    if (session.user.role !== 'MUSICIAN') {
      return NextResponse.json({ error: 'Only musicians can access assignments' }, { status: 403 })
    }

    // Fetch all assignments for this musician
    const assignments = await prisma.eventAssignment.findMany({
      where: {
        userId: session.user.id,
        event: {
          churchId: session.user.churchId
        }
      },
      include: {
        event: {
          include: {
            eventType: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        }
      },
      orderBy: {
        event: {
          startTime: 'desc'
        }
      }
    })

    return NextResponse.json({
      assignments: assignments.map((assignment: any) => ({
        id: assignment.id,
        roleName: assignment.roleName,
        status: assignment.status,
        assignedAt: assignment.assignedAt.toISOString(),
        respondedAt: assignment.respondedAt?.toISOString(),
        event: {
          id: assignment.event.id,
          name: assignment.event.name,
          description: assignment.event.description,
          location: assignment.event.location,
          startTime: assignment.event.startTime.toISOString(),
          endTime: assignment.event.endTime?.toISOString(),
          eventType: assignment.event.eventType
        }
      }))
    })

  } catch (error) {
    console.error('Error fetching assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
} 