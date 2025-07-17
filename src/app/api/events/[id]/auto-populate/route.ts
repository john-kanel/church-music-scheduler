import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId } = await params

    // Verify the event exists and belongs to the user's church
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        churchId: session.user.churchId
      }
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Only directors and pastors can auto-populate events
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // This endpoint just validates the request and returns success
    // The actual PDF processing happens in the frontend modal
    return NextResponse.json({ 
      success: true,
      message: 'Auto-populate request initiated' 
    })

  } catch (error) {
    console.error('Error in auto-populate:', error)
    return NextResponse.json(
      { error: 'Failed to process auto-populate request' },
      { status: 500 }
    )
  }
} 