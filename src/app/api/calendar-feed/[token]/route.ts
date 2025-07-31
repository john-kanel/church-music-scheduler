import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateICalFeed } from '@/lib/ical-generator'

// GET - Serve calendar feed as .ics file
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params
    const tokenParam = params.token
    
    // Extract token from filename (remove .ics extension if present)
    const subscriptionToken = tokenParam.replace(/\.ics$/, '')

    // Find subscription by token
    const subscription = await prisma.calendarSubscription.findUnique({
      where: { subscriptionToken },
      include: {
        user: {
          include: {
            church: true
          }
        }
      }
    })

    if (!subscription || !subscription.isActive) {
      return new NextResponse('Calendar subscription not found', { status: 404 })
    }

    const { user } = subscription
    const church = user.church

    // Get church timezone for proper date formatting
    const timezone = 'America/Chicago' // Default timezone - can be made configurable later

    // Build event query based on filter type
    let eventQuery: any = {
      churchId: user.churchId,
      startTime: {
        gte: new Date(), // Only future events
      },
      // Include all events except tentative ones
      status: {
        not: 'TENTATIVE'
      }
    }

    // Apply filters based on subscription preferences
    switch (subscription.filterType) {
      case 'GROUPS':
        if (subscription.groupIds.length > 0) {
          eventQuery.assignments = {
            some: {
              groupId: {
                in: subscription.groupIds
              }
            }
          }
        } else {
          // No groups selected, return empty calendar
          eventQuery.id = 'impossible-id'
        }
        break

      case 'EVENT_TYPES':
        if (subscription.eventTypeIds.length > 0) {
          eventQuery.eventTypeId = {
            in: subscription.eventTypeIds
          }
        } else {
          // No event types selected, return empty calendar
          eventQuery.id = 'impossible-id'
        }
        break

      case 'ALL':
      default:
        // No additional filters for ALL
        break
    }

    // Fetch events with all related data
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
        }
      },
      orderBy: {
        startTime: 'asc'
      },
      take: 1000 // Limit to prevent huge feeds
    })

    // Generate iCal content with current timestamp for live updates
    const icalContent = generateICalFeed(events, church.name, timezone)

    // LIVE SYNC: Mark all events as no longer needing updates (since we're serving fresh data)
    if (events.length > 0) {
      const eventIds = events.map(e => e.id)
      await prisma.event.updateMany({
        where: { id: { in: eventIds } },
        data: { calendarNeedsUpdate: false }
      })
      console.log(`🔄 LIVE SYNC: Updated ${eventIds.length} events in calendar feed`)
    }

    // Mark subscription as updated
    await prisma.calendarSubscription.update({
      where: { id: subscription.id },
      data: { 
        needsUpdate: false,
        lastUpdated: new Date()
      }
    })

    // Return live iCal feed with proper headers for subscription recognition
    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        // Use inline disposition for subscription feeds
        'Content-Disposition': `inline; filename="${church.name.replace(/[^a-zA-Z0-9]/g, '_')}_music_ministry.ics"`,
        
        // LIVE SYNC: Aggressive no-cache headers + unique ETag for immediate updates
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"live-${subscription.id}-${Date.now()}-${Math.random()}"`,
        
        // Calendar subscription headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        
        // AGGRESSIVE live refresh hints for calendar apps
        'Refresh': '10', // 10 seconds for aggressive live sync
        'X-Published-TTL': 'PT10S',
        'X-WR-REFRESH-INTERVAL': 'PT10S',
        'X-MS-WR-REFRESH-INTERVAL': 'PT10S',
        
        // Additional cache busting headers
        'Vary': 'Accept-Encoding, User-Agent',
        'X-Live-Feed': 'true',
        'X-Update-Time': new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error('Error generating calendar feed:', error)
    return new NextResponse('Error generating calendar feed', { status: 500 })
  }
} 