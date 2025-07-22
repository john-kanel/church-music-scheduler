import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, PRICE_IDS, PlanType } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is available (for local development)
    if (!stripe) {
      return NextResponse.json({
        error: 'Stripe not configured for local development',
        message: 'Please use production environment for billing or configure Stripe keys'
      }, { status: 503 })
    }

    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow directors and pastors to manage billing
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Only church leadership can manage billing' }, { status: 403 })
    }

    const { planType } = await req.json()
    
    if (!planType || !(planType in PRICE_IDS)) {
      return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 })
    }

    const priceId = PRICE_IDS[planType as PlanType]

    // Get church information
    const church = await prisma.church.findUnique({
      where: { id: session.user.churchId },
      select: {
        id: true,
        name: true,
        email: true,
        stripeCustomerId: true
      }
    })

    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    let customerId = church.stripeCustomerId

    // Create or find Stripe customer for the CHURCH (not individual user)
    if (!customerId) {
      // Check if customer already exists by church email
      const existingCustomers = await stripe.customers.list({
        email: church.email || session.user.email,
        limit: 1
      })

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id
        // Update church with existing customer ID
        await prisma.church.update({
          where: { id: church.id },
          data: { stripeCustomerId: customerId }
        })
      } else {
        // Create new customer for the church
        const customer = await stripe.customers.create({
          email: church.email || session.user.email,
          name: church.name,
          metadata: {
            churchId: church.id,
            churchName: church.name
          }
        })
        customerId = customer.id

        // Update church with new customer ID
        await prisma.church.update({
          where: { id: church.id },
          data: { stripeCustomerId: customerId }
        })
      }
    }

    // Create Stripe checkout session using CHURCH customer
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId, // Use church's customer ID
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/billing?canceled=true`,
      metadata: {
        churchId: church.id,
        planType: planType,
        initiatedBy: session.user.id
      },
      subscription_data: {
        metadata: {
          churchId: church.id,
          planType: planType,
          initiatedBy: session.user.id
        },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    )
  }
} 