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
    // Simple admin check - in production you'd want proper admin authentication
    const adminPassword = request.nextUrl.searchParams.get('admin_password')
    if (adminPassword !== process.env.ADMIN_DEBUG_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get churches with trial status
    const churches = await prisma.church.findMany({
      where: {
        subscriptionStatus: {
          in: ['trial', 'trialing']
        }
      },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionEnds: true,
        stripeCustomerId: true,
        createdAt: true,
        users: {
          take: 1,
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const debugData = []

    for (const church of churches) {
      const churchData = {
        churchId: church.id,
        churchName: church.name,
        primaryUser: church.users[0] ? `${church.users[0].firstName} ${church.users[0].lastName} (${church.users[0].email})` : 'No users',
        database: {
          status: church.subscriptionStatus,
          subscriptionEnds: church.subscriptionEnds?.toISOString() || null,
          daysRemaining: church.subscriptionEnds ? Math.ceil((church.subscriptionEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
        },
                 stripe: {
           customerId: church.stripeCustomerId,
           status: null as string | null,
           trialEnd: null as string | null,
           currentPeriodEnd: null as string | null,
           daysRemaining: null as number | null
         },
        discrepancy: false
      }

      // Fetch Stripe data if customer ID exists
      if (church.stripeCustomerId) {
        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: church.stripeCustomerId,
            status: 'all',
            limit: 1
          })

          if (subscriptions.data.length > 0) {
            const subscription = subscriptions.data[0]
            
            churchData.stripe.status = subscription.status
            
            if (subscription.trial_end) {
              churchData.stripe.trialEnd = new Date(subscription.trial_end * 1000).toISOString()
              churchData.stripe.daysRemaining = Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
            }
            
            if ((subscription as any).current_period_end) {
              churchData.stripe.currentPeriodEnd = new Date((subscription as any).current_period_end * 1000).toISOString()
            }

            // Check for discrepancies
            const dbDays = churchData.database.daysRemaining || 0
            const stripeDays = churchData.stripe.daysRemaining || 0
            if (Math.abs(dbDays - stripeDays) > 1) { // More than 1 day difference
              churchData.discrepancy = true
            }
          }
        } catch (error) {
          console.error(`Error fetching Stripe data for church ${church.id}:`, error)
          churchData.stripe.status = 'ERROR'
        }
      }

      debugData.push(churchData)
    }

    return NextResponse.json({
      totalTrialChurches: churches.length,
      churches: debugData,
      discrepancies: debugData.filter(c => c.discrepancy).length
    })

  } catch (error) {
    console.error('Error in debug subscriptions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch debug data' },
      { status: 500 }
    )
  }
} 