import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const songTitle = searchParams.get('title') || 'Amazing Grace'
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    // Get the target event details
    const targetEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: { 
        id: true,
        name: true,
        startTime: true,
        churchId: true
      }
    })

    if (!targetEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (targetEvent.churchId !== session.user.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const referenceDate = new Date(targetEvent.startTime)
    
    // Calculate 60-day window around the reference date (±60 days)
    const windowStart = new Date(referenceDate)
    windowStart.setDate(windowStart.getDate() - 60)
    const windowEnd = new Date(referenceDate)
    windowEnd.setDate(windowEnd.getDate() + 60)

    // Get all events in the range for debugging
    const eventsInRange = await prisma.event.findMany({
      where: {
        churchId: session.user.churchId,
        startTime: {
          gte: windowStart,
          lte: windowEnd
        }
      },
      select: {
        id: true,
        name: true,
        startTime: true,
        hymns: {
          select: {
            id: true,
            title: true,
            servicePart: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    })

    // Find all hymns with the search title
    const words = songTitle.toLowerCase().split(' ').filter(word => word.length > 2)
    const searchConditions = words.map(word => ({
      title: {
        contains: word,
        mode: 'insensitive' as const
      }
    }))

    const matchingHymns = await prisma.eventHymn.findMany({
      where: {
        event: {
          churchId: session.user.churchId,
          startTime: {
            gte: windowStart,
            lte: windowEnd
          }
        },
        OR: searchConditions
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startTime: true
          }
        },
        servicePart: {
          select: {
            name: true
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
      targetEvent: {
        id: targetEvent.id,
        name: targetEvent.name,
        date: targetEvent.startTime
      },
      searchTitle: songTitle,
      searchWords: words,
      dateRange: {
        start: windowStart,
        end: windowEnd,
        totalDays: Math.ceil((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24))
      },
      eventsInRange: eventsInRange.length,
      eventsWithHymns: eventsInRange.filter(e => e.hymns.length > 0).length,
      totalHymnsInRange: eventsInRange.reduce((sum, e) => sum + e.hymns.length, 0),
      matchingHymns: matchingHymns.length,
      results: matchingHymns.map(h => ({
        title: h.title,
        eventName: h.event.name,
        eventDate: h.event.startTime,
        servicePart: h.servicePart?.name,
        isTargetEvent: h.event.id === eventId
      }))
    })
  } catch (error) {
    console.error('Error in song history test:', error)
    return NextResponse.json(
      { error: 'Failed to test song history' },
      { status: 500 }
    )
  }
}
