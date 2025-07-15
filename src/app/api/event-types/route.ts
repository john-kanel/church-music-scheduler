import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/event-types - Fetch all event types for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all event types for this church
    let eventTypes = await prisma.eventType.findMany({
      where: {
        churchId: session.user.churchId
      },
      orderBy: {
        name: 'asc'
      }
    })

    // If no event types exist, create a default "General" event type
    if (eventTypes.length === 0) {
      const defaultEventType = await prisma.eventType.create({
        data: {
          name: 'General',
          color: '#3B82F6',
          churchId: session.user.churchId
        }
      })
      eventTypes = [defaultEventType]
    }

    return NextResponse.json({ 
      eventTypes 
    })

  } catch (error) {
    console.error('Error fetching event types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event types' },
      { status: 500 }
    )
  }
}

// POST /api/event-types - Create or find event type with specific color
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can create event types
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { name, color } = body

    // Validation
    if (!name || !color) {
      return NextResponse.json(
        { error: 'Name and color are required' },
        { status: 400 }
      )
    }

    // Look for existing event type with the same name and color
    let eventType = await prisma.eventType.findFirst({
      where: {
        churchId: session.user.churchId,
        name,
        color
      }
    })

    // If not found, create new one
    if (!eventType) {
      eventType = await prisma.eventType.create({
        data: {
          name,
          color,
          churchId: session.user.churchId
        }
      })
    }

    return NextResponse.json({ 
      message: 'Event type ready',
      eventType 
    })

  } catch (error) {
    console.error('Error creating/finding event type:', error)
    return NextResponse.json(
      { error: 'Failed to create event type' },
      { status: 500 }
    )
  }
} 