import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET - Fetch all event types for the user's church
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's church ID
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { churchId: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch all event types for the church
    const eventTypes = await prisma.eventType.findMany({
      where: { churchId: user.churchId },
      select: {
        id: true,
        name: true,
        color: true,
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(eventTypes)

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