import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateICalFeed } from '@/lib/ical-generator'
import { generateSimpleICalFeed } from '@/lib/ical-generator-simple'

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

    // Use the user's configured timezone
    const timezone = user.timezone || 'America/Chicago' // Fallback to default if not set

    // Build event query based on filter type
    // Include events from 30 days ago to avoid disappearing events
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    let eventQuery: any = {
      churchId: user.churchId,
      startTime: {
        gte: thirtyDaysAgo, // Include events from last 30 days + all future events
      },
      // Only include confirmed and cancelled events, exclude tentative
      status: {
        in: ['CONFIRMED', 'CANCELLED']
      }
    }

    // REMOVED: Apply filters based on subscription preferences
    // Calendar feeds should show ALL events regardless of filter settings
    // Filters were causing random events to not appear
    
    // No additional filters - show all confirmed/cancelled events

    // Fetch events with all related data
    const events = await prisma.event.findMany({
      where: eventQuery,
      include: {
        eventType: true,
        assignments: {
          include: {
            user: true,
            group: {
              include: {
                members: true
              }
            }
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
        documents: {
          select: {
            id: true,
            originalFilename: true
          },
          orderBy: { uploadedAt: 'asc' }
        }
      },
      orderBy: {
        startTime: 'asc'
      },
      take: 1000 // Limit to prevent huge feeds
    })

    // Use the full iCal generator for proper timezone support (Apple Calendar, etc.)
    console.log('🔧 CALENDAR DEBUG: Generating iCal feed with proper timezone support')
    console.log(`🔧 Events count: ${events.length}`)
    console.log(`🔧 Church: ${church.name}`)
    console.log(`🔧 Timezone: ${timezone}`)
    console.log(`🔧 First event:`, events[0] ? {
      id: events[0].id,
      name: events[0].name,
      startTime: events[0].startTime,
      endTime: events[0].endTime,
      assignmentCount: events[0].assignments?.length || 0,
      hymnCount: events[0].hymns?.length || 0
    } : 'No events')
    
    // Precompute a documents URL for each event to include in ICS description if documents exist
    const baseUrl = process.env.NEXTAUTH_URL || 'https://churchmusicpro.com'
    const eventsWithDocLinks = events.map((ev: any) => ({
      ...ev,
      documentsUrl: ev.documents && ev.documents.length > 0
        ? `${baseUrl}/api/calendar-feed/${subscription.subscriptionToken}/events/${ev.id}/documents`
        : undefined
    }))

    const icalContent = generateICalFeed(eventsWithDocLinks as any, church.name, timezone)
    
    // Log the generated content for debugging
    console.log('🔧 CALENDAR DEBUG: Generated iCal content:')
    console.log('🔧 Content length:', icalContent.length, 'bytes')
    console.log('🔧 First 500 characters:')
    console.log(icalContent.substring(0, 500))
    console.log('🔧 Last 200 characters:')
    console.log(icalContent.substring(icalContent.length - 200))
    
    // Validate the content
    const lines = icalContent.split('\r\n')
    const longLines = lines.filter(line => Buffer.from(line, 'utf8').length > 75)
    if (longLines.length > 0) {
      console.log('🔧 WARNING: Found lines exceeding 75 bytes:', longLines.length)
      longLines.slice(0, 3).forEach((line, i) => {
        console.log(`🔧 Long line ${i + 1}: ${Buffer.from(line, 'utf8').length} bytes - ${line.substring(0, 50)}...`)
      })
    } else {
      console.log('🔧 ✅ All lines are within 75 bytes')
    }
    
    console.log('🔧 CALENDAR DEBUG: Feed generation complete')

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

    // Return live iCal feed with Google Calendar optimized headers
    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        // Essential headers for Google Calendar compatibility
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${church.name.replace(/[^a-zA-Z0-9]/g, '_')}_music_ministry.ics"`,
        
        // Reasonable caching for live feeds - Google Calendar friendly
        'Cache-Control': 'public, max-age=300', // 5 minutes - reasonable for live updates
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${subscription.id}-${Math.floor(Date.now() / 300000)}"`, // Stable ETag for 5 min intervals
        
        // CORS headers for cross-origin access
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        
        // Single, reasonable refresh interval that all calendar apps understand
        'X-Published-TTL': 'PT15M', // 15 minutes - Google Calendar standard
        
        // Security headers
        'X-Content-Type-Options': 'nosniff',
      }
    })

  } catch (error) {
    console.error('Error generating calendar feed:', error)
    return new NextResponse('Error generating calendar feed', { status: 500 })
  }
} 