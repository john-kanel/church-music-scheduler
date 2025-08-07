import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GoogleCalendarService, convertToGoogleCalendarEvent } from '@/lib/google-calendar'

/**
 * Sync events to Google Calendar
 * POST /api/google-calendar/sync
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get sync options from request body
    const { eventIds, syncAll = false } = await request.json()

    // Get user's Google Calendar integration
    const integration = await prisma.googleCalendarIntegration.findUnique({
      where: { userId: session.user.id }
    })

    if (!integration || !integration.isActive) {
      return NextResponse.json(
        { error: 'Google Calendar integration not found or inactive' },
        { status: 404 }
      )
    }

    // Initialize Google Calendar service
    const googleCalendar = new GoogleCalendarService()
    googleCalendar.setTokens({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      scope: integration.scope,
      token_type: integration.tokenType,
      expiry_date: integration.expiryDate?.getTime()
    })

    // Build query for events to sync
    let eventQuery: any = {
      churchId: session.user.churchId,
      startTime: {
        gte: new Date() // Only future events
      }
    }

    // If specific events requested
    if (!syncAll && eventIds && Array.isArray(eventIds)) {
      eventQuery.id = { in: eventIds }
    }

    // Get events to sync
    const events = await prisma.event.findMany({
      where: eventQuery,
      include: {
        eventType: true,
        assignments: {
          include: {
            user: true,
            group: true
          }
        },
        hymns: {
          include: {
            servicePart: true
          },
          orderBy: [
            { servicePart: { order: 'asc' } },
            { createdAt: 'asc' }
          ]
        },
        googleCalendarEvents: {
          where: {
            integrationId: integration.id
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      },
      take: syncAll ? 100 : 50 // Limit batch size
    })

    console.log(`🔄 Starting Google Calendar sync for ${events.length} events (user: ${session.user.id})`)

    // Get user's timezone for proper event time handling
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true }
    })
    const userTimezone = user?.timezone || 'America/Chicago'

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
      total: events.length
    }

    // Process each event
    for (const event of events) {
      try {
        const googleEvent = convertToGoogleCalendarEvent(event, userTimezone)
        const existingSync = event.googleCalendarEvents[0] // Should only be one per integration

        if (existingSync) {
          // Update existing event
          await googleCalendar.updateEvent(existingSync.googleEventId, googleEvent, integration.calendarId || 'primary')
          
          // Update sync record
          await prisma.googleCalendarEvent.update({
            where: { id: existingSync.id },
            data: { lastSyncedAt: new Date() }
          })
          
          results.updated++
          console.log(`📝 Updated Google Calendar event: ${event.name}`)
        } else {
          // Create new event
          const googleEventId = await googleCalendar.createEvent(googleEvent, integration.calendarId || 'primary')
          
          // Create sync record
          await prisma.googleCalendarEvent.create({
            data: {
              eventId: event.id,
              googleEventId,
              integrationId: integration.id,
              lastSyncedAt: new Date()
            }
          })
          
          results.created++
          console.log(`➕ Created Google Calendar event: ${event.name}`)
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        const errorMsg = `Failed to sync "${event.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
        results.errors.push(errorMsg)
        console.error('❌ Google Calendar sync error:', errorMsg)
      }
    }

    // Update integration last sync time
    await prisma.googleCalendarIntegration.update({
      where: { id: integration.id },
      data: { updatedAt: new Date() }
    })

    console.log('✅ Google Calendar sync completed:', results)

    return NextResponse.json({
      success: true,
      message: `Sync completed: ${results.created} created, ${results.updated} updated`,
      results
    })

  } catch (error) {
    console.error('Error syncing to Google Calendar:', error)
    return NextResponse.json(
      { error: 'Failed to sync to Google Calendar' },
      { status: 500 }
    )
  }
}

/**
 * Get sync status and statistics
 * GET /api/google-calendar/sync
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's integration with sync stats
    const integration = await prisma.googleCalendarIntegration.findUnique({
      where: { userId: session.user.id },
      include: {
        syncedEvents: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                startTime: true
              }
            }
          },
          orderBy: {
            lastSyncedAt: 'desc'
          },
          take: 10 // Recent synced events
        },
        _count: {
          select: {
            syncedEvents: true
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Google Calendar integration not found' },
        { status: 404 }
      )
    }

    // Get total upcoming events
    const totalUpcomingEvents = await prisma.event.count({
      where: {
        churchId: session.user.churchId,
        startTime: {
          gte: new Date()
        }
      }
    })

    return NextResponse.json({
      isActive: integration.isActive,
      totalSyncedEvents: integration._count.syncedEvents,
      totalUpcomingEvents,
      lastSyncAt: integration.updatedAt,
      recentSyncedEvents: integration.syncedEvents.map(se => ({
        eventId: se.event.id,
        eventName: se.event.name,
        eventStartTime: se.event.startTime,
        lastSyncedAt: se.lastSyncedAt,
        googleEventId: se.googleEventId
      }))
    })

  } catch (error) {
    console.error('Error fetching sync status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}
