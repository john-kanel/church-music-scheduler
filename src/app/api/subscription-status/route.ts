import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get church data with subscription info
    const church = await prisma.church.findFirst({
      where: {
        users: {
          some: {
            id: session.user.id
          }
        }
      },
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
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
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

    // If church has a Stripe customer ID, get fresh data from Stripe
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
          subscriptionData.stripePlan = subscription.items.data[0]?.price.id || null

          // Check if it's a trial subscription
          if (subscription.trial_end && subscription.status === 'trialing') {
            const trialEndDate = new Date(subscription.trial_end * 1000)
            const now = new Date()
            const timeDiff = trialEndDate.getTime() - now.getTime()
            const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))

            subscriptionData.isTrialActive = daysRemaining > 0
            subscriptionData.trialDaysRemaining = Math.max(0, daysRemaining)
            subscriptionData.trialEndsAt = trialEndDate.toISOString()
            subscriptionData.status = 'trial'

            // Update database with accurate trial end date from Stripe
            if (Math.abs(church.subscriptionEnds?.getTime() || 0 - trialEndDate.getTime()) > 60000) { // More than 1 minute difference
              await prisma.church.update({
                where: { id: church.id },
                data: {
                  subscriptionEnds: trialEndDate,
                  subscriptionStatus: 'trial'
                }
              })
            }
          } else if (subscription.status === 'active') {
            subscriptionData.status = 'active'
            subscriptionData.isTrialActive = false
            subscriptionData.trialDaysRemaining = 0
          }
        }
      } catch (stripeError) {
        console.error('Error fetching Stripe subscription:', stripeError)
        // Fall back to database data if Stripe fails
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

    return NextResponse.json({
      church: {
        id: church.id,
        name: church.name
      },
      subscription: subscriptionData
    })

  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
} 