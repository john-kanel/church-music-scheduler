import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PUT /api/assignments/[assignmentId] - Accept or decline assignment
export async function PUT(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body // 'accept' or 'decline'

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "accept" or "decline"' },
        { status: 400 }
      )
    }

    // Find the assignment and verify it belongs to the user
    const assignment = await prisma.eventAssignment.findFirst({
      where: {
        id: params.assignmentId,
        userId: session.user.id
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startTime: true,
            location: true
          }
        }
      }
    })

    if (!assignment) {
      return NextResponse.json({ 
        error: 'Assignment not found or not assigned to you' 
      }, { status: 404 })
    }

    // Update assignment status
    const updatedAssignment = await prisma.eventAssignment.update({
      where: { id: params.assignmentId },
      data: {
        status: action === 'accept' ? 'ACCEPTED' : 'DECLINED',
        respondedAt: new Date()
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startTime: true,
            location: true
          }
        }
      }
    })

    return NextResponse.json({
      message: `Assignment ${action}ed successfully`,
      assignment: updatedAssignment
    })

  } catch (error) {
    console.error('Error updating assignment:', error)
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    )
  }
} 