import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extendRecurringEvents } from '@/lib/recurrence'
import { resolveEventAssignments } from '@/lib/dynamic-assignments'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's church info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user?.church) {
      return NextResponse.json({ error: 'No church found' }, { status: 404 })
    }

    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url)
    const offset = parseInt(searchParams.get('offset') || '0')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Fetch service parts in the order they're configured
    const serviceParts = await prisma.servicePart.findMany({
      where: { churchId: user.church.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true,
        isRequired: true
      }
    })

    // Note: auto-extension moved to maintenance/backfill endpoint (called by cron)

    // Fetch upcoming events with pagination (include events from today)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const events = await prisma.event.findMany({
      where: {
        churchId: user.church.id,
        startTime: {
          gte: startOfToday
        }
      },
      orderBy: { startTime: 'asc' },
      skip: offset,
      take: limit,
      include: {
        eventType: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        hymns: {
          select: {
            id: true,
            title: true,
            servicePartId: true,
            notes: true,
            servicePart: {
              select: { id: true, name: true, order: true }
            }
          },
          // Order hymns by creation time to preserve user's intended order
          orderBy: { createdAt: 'asc' }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            group: {
              select: {
                id: true,
                name: true
              }
            },
            customRole: true
          }
        }
      }
    })

    // Fetch root recurring events to ensure all recurring series appear in filters
    // This includes recurring series that may only have past events
    const rootRecurringEvents = await prisma.event.findMany({
      where: {
        churchId: user.church.id,
        isRootEvent: true,
        isRecurring: true
      },
      include: {
        eventType: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        hymns: {
          select: {
            id: true,
            title: true,
            servicePartId: true,
            notes: true,
            servicePart: {
              select: { id: true, name: true, order: true }
            }
          },
          orderBy: [
            { servicePart: { order: 'asc' } },
            { createdAt: 'asc' }
          ]
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            group: {
              select: {
                id: true,
                name: true
              }
            },
            customRole: true
          }
        }
      }
    })

    // Get total count for pagination
    const totalEvents = await prisma.event.count({
      where: {
        churchId: user.church.id,
        startTime: {
          gte: startOfToday
        }
      }
    })

    // Resolve dynamic group assignments for all events
    const eventsWithDynamicAssignments = await resolveEventAssignments(events)
    
    // Transform the data for the frontend
    // Only include future events in the main events list
    // Root events are merged separately for filter options only
    const mainEvents = eventsWithDynamicAssignments.map((event: any) => ({
      id: event.id,
      name: event.name,
      description: event.description,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime?.toISOString(),
      location: event.location || '',
      status: (event.status || 'CONFIRMED').toLowerCase(),
      eventType: event.eventType,
      hymns: event.hymns,
      assignments: event.assignments,
      isRootEvent: event.isRootEvent || false
    }))

    // Create combined list for filter building (includes root events for complete filter options)
    const eventIds = new Set(events.map(e => e.id))
    const uniqueRootEvents = rootRecurringEvents.filter(rootEvent => !eventIds.has(rootEvent.id))
    const allEventsForFilters = [...events, ...uniqueRootEvents].map((event: any) => ({
      id: event.id,
      name: event.name,
      eventType: event.eventType,
      isRootEvent: event.isRootEvent || false
    }))

    const plannerData = {
      serviceParts,
      events: mainEvents, // Only future events for display
      allEventsForFilters, // Future + root events for filter building
      pagination: {
        offset,
        limit,
        total: totalEvents,
        hasMore: offset + limit < totalEvents
      }
    }

    return NextResponse.json(plannerData)

  } catch (error) {
    console.error('Error fetching planner data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch planner data' },
      { status: 500 }
    )
  }
} 