import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST - Update calendar feeds for modified events (called by cron)
export async function POST(request: NextRequest) {
  try {
    console.log('Starting LIVE calendar feed update job...')

    // Verify this is being called by a cron job (check for authorization header)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-cron-secret'
    
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find all events that need calendar updates
    const eventsNeedingUpdate = await prisma.event.findMany({
      where: {
        calendarNeedsUpdate: true
      },
      select: {
        id: true,
        churchId: true,
        name: true,
        startTime: true
      }
    })

    console.log(`Found ${eventsNeedingUpdate.length} events needing calendar updates`)

    if (eventsNeedingUpdate.length === 0) {
      return NextResponse.json({ 
        message: 'No events need calendar updates',
        processed: 0 
      })
    }

    // Get all churches that have events needing updates
    const churchIds = [...new Set(eventsNeedingUpdate.map(e => e.churchId))]
    
    // Mark all calendar subscriptions for these churches as needing updates
    const updateResult = await prisma.calendarSubscription.updateMany({
      where: {
        user: {
          churchId: {
            in: churchIds
          }
        },
        isActive: true
      },
      data: {
        needsUpdate: true,
        lastUpdated: new Date()
      }
    })

    console.log(`Marked ${updateResult.count} calendar subscriptions for update`)

    // Mark all events as calendar-updated
    const eventUpdateResult = await prisma.event.updateMany({
      where: {
        id: {
          in: eventsNeedingUpdate.map(e => e.id)
        }
      },
      data: {
        calendarNeedsUpdate: false
      }
    })

    console.log(`Marked ${eventUpdateResult.count} events as calendar-updated`)

    // Optional: Clean up old events that no longer need tracking
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30) // Events older than 30 days

    await prisma.event.updateMany({
      where: {
        startTime: {
          lt: cutoffDate
        },
        calendarNeedsUpdate: true
      },
      data: {
        calendarNeedsUpdate: false
      }
    })

    return NextResponse.json({
      message: 'Calendar feeds updated successfully',
      eventsProcessed: eventsNeedingUpdate.length,
      subscriptionsUpdated: updateResult.count,
      processedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error updating calendar feeds:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update calendar feeds',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET - Manual trigger for testing (remove in production)
export async function GET() {
  try {
    // Create a mock request with the correct auth header for testing
    const mockRequest = new Request('http://localhost/api/cron/update-calendar-feeds', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${process.env.CRON_SECRET || 'your-cron-secret'}`
      }
    })

    return await POST(mockRequest as NextRequest)
  } catch (error) {
    console.error('Error in manual calendar feed update:', error)
    return NextResponse.json(
      { error: 'Failed to trigger calendar feed update' },
      { status: 500 }
    )
  }
} 