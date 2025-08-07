import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Get public calendar information for a church
 * GET /api/public-calendar/[churchId]
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ churchId: string }> }
) {
  try {
    const { churchId } = await context.params

    // Get church information
    const church = await prisma.church.findUnique({
      where: { id: churchId },
      select: {
        id: true,
        name: true
      }
    })

    if (!church) {
      return NextResponse.json(
        { error: 'Church not found' },
        { status: 404 }
      )
    }

    // Get the iCal subscription for this church (if any active subscription exists)
    const subscription = await prisma.calendarSubscription.findFirst({
      where: { 
        user: { churchId: churchId },
        isActive: true
      },
      select: {
        feedUrl: true
      }
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active calendar subscription found for this church' },
        { status: 404 }
      )
    }

    // Check if there's a Google Calendar integration for this church
    const googleIntegration = await prisma.googleCalendarIntegration.findFirst({
      where: { 
        user: { churchId: churchId },
        isActive: true
      },
      select: {
        id: true
        // TODO: Add calendarId when Prisma client is updated
      }
    })

    // For now, we'll use placeholder URLs for Google Calendar
    // TODO: Re-enable when dedicated calendars are working
    const hasGoogleCalendar = !!googleIntegration
    let googleShareableUrl: string | undefined
    let googleSubscriptionUrl: string | undefined

    /*
    if (googleIntegration?.calendarId) {
      const googleCalendar = new GoogleCalendarService()
      googleShareableUrl = googleCalendar.getShareableCalendarUrl(googleIntegration.calendarId)
      googleSubscriptionUrl = googleCalendar.getCalendarSubscriptionUrl(googleIntegration.calendarId)
    }
    */

    return NextResponse.json({
      church,
      feedUrl: subscription.feedUrl,
      hasGoogleCalendar,
      googleShareableUrl,
      googleSubscriptionUrl
    })

  } catch (error) {
    console.error('Error fetching public calendar data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar information' },
      { status: 500 }
    )
  }
}
