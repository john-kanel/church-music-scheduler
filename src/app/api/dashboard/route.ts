import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.parishId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    const parishId = session.user.parishId
    const userId = session.user.id

    if (userRole === 'DIRECTOR' || userRole === 'PASTOR') {
      // Director Dashboard Data
      const now = new Date()
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const upcomingEvents = await prisma.event.findMany({
        where: {
          parishId,
          startTime: {
            gte: now,
            lte: oneWeekFromNow
          }
        },
        include: {
          eventType: true,
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        },
        orderBy: {
          startTime: 'asc'
        },
        take: 5
      })

      const totalMusicians = await prisma.user.count({
        where: {
          parishId,
          role: 'MUSICIAN'
        }
      })

      const pendingInvitations = await prisma.invitation.count({
        where: {
          parishId,
          status: 'PENDING'
        }
      })

      return NextResponse.json({
        userRole,
        stats: {
          totalMusicians,
          upcomingEvents: upcomingEvents.length,
          pendingInvitations
        },
        upcomingEvents
      })

    } else {
      // Musician Dashboard Data
      const now = new Date()

      const upcomingAssignments = await prisma.eventAssignment.findMany({
        where: {
          userId,
          event: {
            startTime: {
              gte: now
            }
          }
        },
        include: {
          event: {
            include: {
              eventType: true
            }
          }
        },
        orderBy: {
          event: {
            startTime: 'asc'
          }
        },
        take: 10
      })

      const pendingCount = upcomingAssignments.filter(a => a.status === 'PENDING').length

      return NextResponse.json({
        userRole,
        stats: {
          upcomingAssignments: upcomingAssignments.length,
          pendingResponses: pendingCount
        },
        upcomingAssignments
      })
    }

  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
} 