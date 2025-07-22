import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PUT /api/events/[id]/groups - Update group assignments for an event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can update group assignments
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { selectedGroups } = await request.json()
    const { id: eventId } = await params

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

    // Update group assignments in a transaction
    await prisma.$transaction(async (tx: any) => {
      // Remove existing group assignments for this event
      await tx.eventAssignment.deleteMany({
        where: {
          eventId: eventId,
          groupId: {
            not: null
          }
        }
      })

      // Add new group assignments
      if (selectedGroups && selectedGroups.length > 0) {
        // Get all groups with their members
        const groups = await tx.group.findMany({
          where: {
            id: { in: selectedGroups },
            churchId: session.user.churchId
          },
          include: {
            members: true
          }
        })

        // Create assignments for each group member
        for (const group of groups) {
          for (const member of group.members) {
            await tx.eventAssignment.create({
              data: {
                eventId: eventId,
                userId: member.userId, // Use member.userId instead of member.id
                groupId: group.id,
                roleName: 'Group Member',
                status: 'PENDING'
              }
            })
          }
        }
      }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Group assignments updated successfully'
    })

  } catch (error) {
    console.error('Error updating group assignments:', error)
    return NextResponse.json(
      { error: 'Failed to update group assignments' },
      { status: 500 }
    )
  }
} 