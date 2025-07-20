import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
})

// Enhanced caching - 15 minutes for subscription status
const subscriptionCache = new Map<string, {
  data: any
  timestamp: number
  promise?: Promise<any>
}>()

// Cache duration: 15 minutes (subscription status changes infrequently)
const CACHE_DURATION = 15 * 60 * 1000

function getCachedSubscription(churchId: string) {
  const cached = subscriptionCache.get(churchId)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

function getCachedPromise(churchId: string) {
  const cached = subscriptionCache.get(churchId)
  return cached?.promise
}

function setCachedSubscription(churchId: string, data: any, promise?: Promise<any>) {
  subscriptionCache.set(churchId, {
    data,
    timestamp: Date.now(),
    promise
  })
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use churchId from session for faster lookup
    const churchId = session.user.churchId
    if (!churchId) {
      console.error('User has no churchId in session:', session.user.id)
      
      // Try to get churchId from database
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { churchId: true, email: true }
      })
      
      if (!user || !user.churchId) {
        console.error('User not found or has no church association:', session.user.id)
        return NextResponse.json({ 
          error: 'Church not found. Please contact support.' 
        }, { status: 404 })
      }
      
      // Use churchId from database
      const result = await fetchSubscriptionData(user.churchId)
      return NextResponse.json(result)
    }

    // Check cache first
    const cachedData = getCachedSubscription(churchId)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Check for in-flight request
    const cachedPromise = getCachedPromise(churchId)
    if (cachedPromise) {
      try {
        const result = await cachedPromise
        return NextResponse.json(result)
      } catch (error) {
        // If the cached promise failed, continue with new request
      }
    }

    // Create new request promise
    const requestPromise = fetchSubscriptionData(churchId)
    setCachedSubscription(churchId, null, requestPromise)

    const result = await requestPromise
    setCachedSubscription(churchId, result)
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
}

async function fetchSubscriptionData(churchId: string) {
  // Optimized church lookup - direct ID query
  const church = await prisma.church.findUnique({
    where: { id: churchId },
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      subscriptionEnds: true,
      stripeCustomerId: true,
      createdAt: true
    }
  })

  if (!church) {
    throw new Error('Church not found')
  }

  let subscriptionData = {
    status: church.subscriptionStatus,
    isTrialActive: false,
    trialDaysRemaining: 0,
    trialEndsAt: null as string | null,
    subscriptionEnds: church.subscriptionEnds?.toISOString() || null,
    stripePlan: null as string | null,
    stripeStatus: null as string | null
  }

  // Only fetch Stripe data if customer ID exists (optimization)
  if (church.stripeCustomerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: church.stripeCustomerId,
        status: 'all',
        limit: 1
      })

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0]
        
        subscriptionData.stripeStatus = subscription.status
        
        if (subscription.trial_end) {
          const trialEnd = new Date(subscription.trial_end * 1000)
          const now = new Date()
          const timeDiff = trialEnd.getTime() - now.getTime()
          const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
          
          subscriptionData.isTrialActive = daysRemaining > 0
          subscriptionData.trialDaysRemaining = Math.max(0, daysRemaining)
          subscriptionData.trialEndsAt = trialEnd.toISOString()
        }
        
        // Get plan information
        if (subscription.items.data.length > 0) {
          const item = subscription.items.data[0]
          subscriptionData.stripePlan = item.price.id
        }
      }
    } catch (error) {
      console.error('Error fetching Stripe subscription:', error)
      // Continue with database data if Stripe fails
    }
  }

  // If no Stripe data but subscription status is trial, calculate from database
  if (subscriptionData.status === 'trial' && church.subscriptionEnds && !subscriptionData.isTrialActive) {
    const now = new Date()
    const timeDiff = church.subscriptionEnds.getTime() - now.getTime()
    const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))

    subscriptionData.isTrialActive = daysRemaining > 0
    subscriptionData.trialDaysRemaining = Math.max(0, daysRemaining)
    subscriptionData.trialEndsAt = church.subscriptionEnds.toISOString()
  }

  return {
    church: {
      id: church.id,
      name: church.name
    },
    subscription: subscriptionData
  }
} 