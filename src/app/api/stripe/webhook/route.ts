import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('⚠️  Webhook signature verification failed.', err.message)
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }

    console.log(`🔔 Received webhook: ${event.type}`)

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.created':
      case 'customer.updated':
        await handleCustomerChange(event.data.object as Stripe.Customer)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string
    const churchId = subscription.metadata?.churchId

    if (!churchId) {
      console.warn('No churchId in subscription metadata:', subscription.id)
      return
    }

    // Calculate subscription end date
    let subscriptionEnds: Date | null = null
    if ((subscription as any).current_period_end) {
      subscriptionEnds = new Date((subscription as any).current_period_end * 1000)
    } else if ((subscription as any).trial_end) {
      subscriptionEnds = new Date((subscription as any).trial_end * 1000)
    }

    // Map Stripe status to our status
    let status = 'inactive'
    switch (subscription.status) {
      case 'active':
      case 'trialing':
        status = 'active'
        break
      case 'past_due':
        status = 'past_due'
        break
      case 'canceled':
      case 'unpaid':
        status = 'canceled'
        break
      case 'incomplete':
      case 'incomplete_expired':
        status = 'inactive'
        break
    }

    console.log(`Updating church ${churchId}: status=${status}, ends=${subscriptionEnds}`)

    await prisma.church.update({
      where: { id: churchId },
      data: {
        subscriptionStatus: status,
        subscriptionEnds: subscriptionEnds,
        stripeCustomerId: customerId,
        updatedAt: new Date()
      }
    })

    console.log(`✅ Updated church ${churchId} subscription status`)
  } catch (error) {
    console.error('Error handling subscription change:', error)
  }
}

async function handleCustomerChange(customer: Stripe.Customer) {
  try {
    const churchId = customer.metadata?.churchId

    if (!churchId) {
      console.warn('No churchId in customer metadata:', customer.id)
      return
    }

    await prisma.church.update({
      where: { id: churchId },
      data: {
        stripeCustomerId: customer.id,
        updatedAt: new Date()
      }
    })

    console.log(`✅ Updated church ${churchId} customer info`)
  } catch (error) {
    console.error('Error handling customer change:', error)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string
    
    // Find church by Stripe customer ID
    const church = await prisma.church.findFirst({
      where: { stripeCustomerId: customerId }
    })

    if (!church) {
      console.warn('No church found for customer:', customerId)
      return
    }

    console.log(`✅ Payment succeeded for church ${church.id}, invoice ${invoice.id}`)
  } catch (error) {
    console.error('Error handling payment succeeded:', error)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string
    
    // Find church by Stripe customer ID
    const church = await prisma.church.findFirst({
      where: { stripeCustomerId: customerId }
    })

    if (!church) {
      console.warn('No church found for customer:', customerId)
      return
    }

    console.log(`⚠️ Payment failed for church ${church.id}, invoice ${invoice.id}`)
  } catch (error) {
    console.error('Error handling payment failed:', error)
  }
} 