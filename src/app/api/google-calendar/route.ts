import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get user's Google Calendar integration status
 * GET /api/google-calendar
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Google Calendar integration
    const integration = await prisma.googleCalendarIntegration.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        isActive: true,
        userEmail: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            syncedEvents: true
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json({ 
        connected: false,
        message: 'Google Calendar not connected'
      })
    }

    return NextResponse.json({
      connected: true,
      isActive: integration.isActive,
      userEmail: integration.userEmail,
      connectedAt: integration.createdAt,
      lastUpdated: integration.updatedAt,
      syncedEventsCount: integration._count.syncedEvents
    })

  } catch (error) {
    console.error('Error fetching Google Calendar status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Google Calendar status' },
      { status: 500 }
    )
  }
}

/**
 * Disconnect Google Calendar integration
 * DELETE /api/google-calendar
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find and delete the integration
    const integration = await prisma.googleCalendarIntegration.findUnique({
      where: { userId: session.user.id }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Google Calendar integration not found' },
        { status: 404 }
      )
    }

    // Delete the integration (this will cascade delete synced events)
    await prisma.googleCalendarIntegration.delete({
      where: { userId: session.user.id }
    })

    console.log('🗑️ Google Calendar integration deleted for user:', session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Google Calendar disconnected successfully'
    })

  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Google Calendar' },
      { status: 500 }
    )
  }
}

/**
 * Toggle Google Calendar integration active status
 * PATCH /api/google-calendar
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { isActive } = await request.json()

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { isActive: boolean }' },
        { status: 400 }
      )
    }

    // Update the integration status
    const integration = await prisma.googleCalendarIntegration.update({
      where: { userId: session.user.id },
      data: { 
        isActive,
        updatedAt: new Date()
      },
      select: {
        id: true,
        isActive: true,
        userEmail: true,
        updatedAt: true
      }
    })

    console.log(`📱 Google Calendar integration ${isActive ? 'activated' : 'deactivated'} for user:`, session.user.id)

    return NextResponse.json({
      success: true,
      isActive: integration.isActive,
      message: `Google Calendar sync ${isActive ? 'enabled' : 'disabled'}`
    })

  } catch (error) {
    console.error('Error updating Google Calendar status:', error)
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Google Calendar integration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update Google Calendar status' },
      { status: 500 }
    )
  }
}
