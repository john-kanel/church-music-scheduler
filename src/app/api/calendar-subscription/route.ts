import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET - Fetch user's current calendar subscription
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await prisma.calendarSubscription.findUnique({
      where: { userId: session.user.id },
    })

    if (!subscription) {
      return NextResponse.json(null)
    }

    // Generate webcal:// feed URL for subscription recognition
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const webcalUrl = `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar-feed/${subscription.subscriptionToken}.ics`
    const feedUrl = subscription.feedUrl || webcalUrl

    // Update feed URL if it was missing
    if (!subscription.feedUrl) {
      await prisma.calendarSubscription.update({
        where: { id: subscription.id },
        data: { feedUrl }
      })
    }

    return NextResponse.json({
      ...subscription,
      feedUrl
    })

  } catch (error) {
    console.error('Error fetching calendar subscription:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

// POST - Create or update calendar subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user exists in database before proceeding
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, churchId: true, email: true }
    })

    if (!user) {
      console.error('User not found in database:', session.user.id)
      console.error('This suggests the database may have been reset or the session is stale.')
      return NextResponse.json({ 
        error: 'Your session is no longer valid. Please sign out and sign in again.' 
      }, { status: 401 })
    }

    console.log('Calendar subscription request for user:', {
      userId: user.id,
      churchId: user.churchId,
      email: user.email
    })

    const body = await request.json()
    const { filterType, groupIds, eventTypeIds } = body

    // Validate filter type
    if (!['ALL', 'GROUPS', 'EVENT_TYPES'].includes(filterType)) {
      return NextResponse.json(
        { error: 'Invalid filter type' },
        { status: 400 }
      )
    }

    // Validate that required IDs are provided for specific filter types
    if (filterType === 'GROUPS' && (!groupIds || groupIds.length === 0)) {
      return NextResponse.json(
        { error: 'Group IDs required for groups filter' },
        { status: 400 }
      )
    }

    if (filterType === 'EVENT_TYPES' && (!eventTypeIds || eventTypeIds.length === 0)) {
      return NextResponse.json(
        { error: 'Event type IDs required for event types filter' },
        { status: 400 }
      )
    }

    // Check if user already has a subscription
    const existingSubscription = await prisma.calendarSubscription.findUnique({
      where: { userId: session.user.id },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    if (existingSubscription) {
      // Update existing subscription with webcal:// URL
      const webcalFeedUrl = `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar-feed/${existingSubscription.subscriptionToken}.ics`
      const updated = await prisma.calendarSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          filterType,
          groupIds: filterType === 'GROUPS' ? groupIds : [],
          eventTypeIds: filterType === 'EVENT_TYPES' ? eventTypeIds : [],
          needsUpdate: true,
          lastUpdated: new Date(),
          feedUrl: webcalFeedUrl
        },
      })

      return NextResponse.json(updated)
    } else {
      // Create new subscription
      const newSubscription = await prisma.calendarSubscription.create({
        data: {
          userId: session.user.id,
          filterType,
          groupIds: filterType === 'GROUPS' ? groupIds : [],
          eventTypeIds: filterType === 'EVENT_TYPES' ? eventTypeIds : [],
          needsUpdate: true,
        },
      })

      // Update with webcal:// feed URL (now that we have the token)
      const webcalFeedUrl = `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar-feed/${newSubscription.subscriptionToken}.ics`
      const updatedSubscription = await prisma.calendarSubscription.update({
        where: { id: newSubscription.id },
        data: { feedUrl: webcalFeedUrl }
      })

      return NextResponse.json(updatedSubscription)
    }

  } catch (error) {
    console.error('Error saving calendar subscription:', error)
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    )
  }
}

// DELETE - Remove calendar subscription
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.calendarSubscription.delete({
      where: { userId: session.user.id },
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting calendar subscription:', error)
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    )
  }
} 