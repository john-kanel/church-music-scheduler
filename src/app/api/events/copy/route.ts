import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceEventId, targetEventId, parts } = await request.json()

    if (!sourceEventId || !targetEventId || !parts || !Array.isArray(parts)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify both events exist and user has access
    const [sourceEvent, targetEvent] = await Promise.all([
      prisma.event.findUnique({
        where: { id: sourceEventId },
        include: {
          hymns: true,
          documents: true,
          assignments: true
        }
      }),
      prisma.event.findUnique({
        where: { id: targetEventId },
        select: { id: true, churchId: true }
      })
    ])

    if (!sourceEvent || !targetEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify user has access to target event's church
    const userChurchAccess = await prisma.user.findFirst({
      where: {
        id: session.user.id,
        churchId: targetEvent.churchId
      }
    })

    if (!userChurchAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const copyResults = {
      serviceParts: 0,
      groups: 0,
      musicians: 0
    }

    // Copy service parts (hymns)
    if (parts.includes('serviceParts') && sourceEvent.hymns?.length > 0) {
      for (const hymn of sourceEvent.hymns) {
        try {
          await prisma.eventHymn.create({
            data: {
              eventId: targetEventId,
              title: hymn.title,
              notes: hymn.notes || null,
              servicePartId: hymn.servicePartId
            }
          })
          copyResults.serviceParts++
        } catch (error) {
          console.error('Error copying hymn:', error)
        }
      }
    }

    // Copy assignments (groups and musicians)
    if (parts.includes('groups') || parts.includes('musicians')) {
      const assignments = sourceEvent.assignments || []
      
      for (const assignment of assignments) {
        const shouldCopyGroup = parts.includes('groups') && assignment.groupId
        const shouldCopyMusician = parts.includes('musicians') && assignment.userId
        
        if (!shouldCopyGroup && !shouldCopyMusician) continue

        try {
          // Check if assignment already exists
          const existing = await prisma.eventAssignment.findFirst({
            where: {
              eventId: targetEventId,
              roleName: assignment.roleName,
              ...(assignment.groupId && { groupId: assignment.groupId }),
              ...(assignment.userId && { userId: assignment.userId })
            }
          })

          if (!existing) {
            await prisma.eventAssignment.create({
              data: {
                eventId: targetEventId,
                roleName: assignment.roleName,
                groupId: assignment.groupId,
                userId: assignment.userId,
                maxMusicians: assignment.maxMusicians,
                status: 'PENDING'
              }
            })
            
            if (assignment.groupId) copyResults.groups++
            if (assignment.userId) copyResults.musicians++
          }
        } catch (error) {
          console.error('Error copying assignment:', error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Event parts copied successfully',
      copyResults
    })

  } catch (error) {
    console.error('Error copying event parts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 