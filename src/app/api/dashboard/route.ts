import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkSubscriptionStatus, createSubscriptionErrorResponse } from '@/lib/subscription-check'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription status
    const subscriptionStatus = await checkSubscriptionStatus(session.user.churchId)
    if (!subscriptionStatus.isActive) {
      return createSubscriptionErrorResponse()
    }

    const userRole = session.user.role
    const churchId = session.user.churchId
    const userId = session.user.id

    // Get month and year from query params for calendar events
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')
    
    const targetDate = monthParam && yearParam 
      ? new Date(parseInt(yearParam), parseInt(monthParam) - 1, 1)
      : new Date()

    // Calculate date ranges once
    const now = new Date()
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59)

    if (userRole === 'DIRECTOR' || userRole === 'ASSOCIATE_DIRECTOR' || userRole === 'PASTOR') {
      // Director Dashboard Data - Combine all queries using Promise.all
      const [
        upcomingEvents,
        totalMusicians,
        pendingInvitations,
        monthEvents
      ] = await Promise.all([
        // Upcoming events (next 7 days)
        prisma.event.findMany({
          where: {
            churchId,
            startTime: {
              gte: now,
              lte: oneWeekFromNow
            }
          },
          include: {
            eventType: {
              select: {
                id: true,
                name: true,
                color: true
              }
            },
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
        }),
        
        // Total musicians count
        prisma.user.count({
          where: {
            churchId,
            role: 'MUSICIAN'
          }
        }),
        
        // Pending invitations count
        prisma.invitation.count({
          where: {
            churchId,
            status: 'PENDING'
          }
        }),
        
        // Month events for calendar
        prisma.event.findMany({
          where: {
            churchId,
            startTime: {
              gte: startOfMonth,
              lte: endOfMonth
            }
          },
          include: {
            eventType: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        })
      ])

      return NextResponse.json({
        userRole,
        stats: {
          totalMusicians,
          upcomingEvents: upcomingEvents.length,
          pendingInvitations
        },
        upcomingEvents,
        events: monthEvents
      })

    } else {
      // Musician Dashboard Data - Combine all queries using Promise.all
      const [
        upcomingAssignments,
        thisMonthAssignments,
        monthEvents,
        musicDirector
      ] = await Promise.all([
        // Upcoming assignments
        prisma.eventAssignment.findMany({
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
              startTime: 'asc'
            }
          },
          take: 10
        }),
        
        // This month's assignments count
        prisma.eventAssignment.count({
          where: {
            userId,
            event: {
              startTime: {
                gte: startOfMonth,
                lte: endOfMonth
              }
            }
          }
        }),
        
        // Month events for calendar
        prisma.event.findMany({
          where: {
            churchId,
            startTime: {
              gte: startOfMonth,
              lte: endOfMonth
            }
          },
          include: {
            eventType: {
              select: {
                id: true,
                name: true,
                color: true
              }
            },
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
          }
        }),
        
        // Music director contact info
        prisma.user.findFirst({
          where: {
            churchId,
            role: 'DIRECTOR'
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        })
      ])

      // Calculate stats from the data we already have
      const pendingCount = upcomingAssignments.filter((a: any) => a.status === 'PENDING').length
      const acceptedCount = upcomingAssignments.filter((a: any) => a.status === 'ACCEPTED').length

      return NextResponse.json({
        userRole,
        stats: {
          upcomingAssignments: upcomingAssignments.length,
          pendingResponses: pendingCount,
          acceptedAssignments: acceptedCount,
          thisMonthAssignments
        },
        upcomingAssignments,
        events: monthEvents,
        musicDirector
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