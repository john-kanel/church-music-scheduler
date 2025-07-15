import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: rootEventId } = await params

    // Verify this is a root recurring event that belongs to the user's church
    const rootEvent = await prisma.event.findFirst({
      where: {
        id: rootEventId,
        churchId: session.user.churchId,
        isRootEvent: true,
        isRecurring: true
      }
    })

    if (!rootEvent) {
      return NextResponse.json({ error: 'Root recurring event not found' }, { status: 404 })
    }

    const currentDate = new Date()

    // Get all events in this series (generated from this root event)
    const allSeriesEvents = await prisma.event.findMany({
      where: {
        generatedFrom: rootEventId,
        churchId: session.user.churchId
      },
      select: {
        id: true,
        startTime: true,
        isModified: true
      }
    })

    // Calculate counts
    const totalEvents = allSeriesEvents.length + 1 // +1 for the root event itself
    const futureEvents = allSeriesEvents.filter(event => 
      new Date(event.startTime) >= currentDate
    ).length + (new Date(rootEvent.startTime) >= currentDate ? 1 : 0) // Include root if it's in the future
    
    const modifiedEvents = allSeriesEvents.filter(event => event.isModified).length

    return NextResponse.json({
      future: futureEvents,
      total: totalEvents,
      modified: modifiedEvents
    })

  } catch (error) {
    console.error('Error fetching event impact:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event impact' },
      { status: 500 }
    )
  }
} 