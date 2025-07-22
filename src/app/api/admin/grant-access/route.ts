import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is available (for local development)
    if (!stripe) {
      return NextResponse.json({
        error: 'Stripe not configured for local development',
        message: 'Please use production environment for granting access'
      }, { status: 503 })
    }

    const { churchId, months } = await request.json()

    if (!churchId || !months || months <= 0) {
      return NextResponse.json(
        { error: 'Church ID and valid months required' },
        { status: 400 }
      )
    }

    // Get church details
    const church = await prisma.church.findUnique({
      where: { id: churchId },
      select: {
        id: true,
        name: true,
        email: true,
        stripeCustomerId: true,
        subscriptionStatus: true,
        subscriptionEnds: true
      }
    })

    if (!church) {
      return NextResponse.json(
        { error: 'Church not found' },
        { status: 404 }
      )
    }

    let stripeCustomerId = church.stripeCustomerId

    // Create Stripe customer if doesn't exist, but first check if one already exists by email
    if (!stripeCustomerId && church.email) {
      console.log(`Checking for existing Stripe customer for church: ${church.name}`)
      
      // Search for existing customer by email to prevent duplicates
      const existingCustomers = await stripe.customers.list({
        email: church.email,
        limit: 1
      })

      if (existingCustomers.data.length > 0) {
        // Found existing customer, use it
        stripeCustomerId = existingCustomers.data[0].id
        console.log(`Found existing Stripe customer ${stripeCustomerId} for church: ${church.name}`)
        
        // Update church with the existing Stripe customer ID
        await prisma.church.update({
          where: { id: churchId },
          data: { stripeCustomerId: stripeCustomerId }
        })
      } else {
        // No existing customer found, create new one
        console.log(`Creating new Stripe customer for church: ${church.name}`)
        const customer = await stripe.customers.create({
          email: church.email,
          name: church.name,
          metadata: {
            churchId: church.id,
            grantedAccess: 'true'
          }
        })
        stripeCustomerId = customer.id

        // Update church with Stripe customer ID
        await prisma.church.update({
          where: { id: churchId },
          data: { stripeCustomerId: customer.id }
        })
      }
    } else if (!stripeCustomerId) {
      // No email available, create customer without email
      console.log(`Creating Stripe customer (no email) for church: ${church.name}`)
      const customer = await stripe.customers.create({
        name: church.name,
        metadata: {
          churchId: church.id,
          grantedAccess: 'true'
        }
      })
      stripeCustomerId = customer.id

      // Update church with Stripe customer ID
      await prisma.church.update({
        where: { id: churchId },
        data: { stripeCustomerId: customer.id }
      })
    }

    // Calculate the new subscription end date
    const currentDate = new Date()
    const currentEnd = church.subscriptionEnds || currentDate
    const subscriptionEnds = new Date(Math.max(currentEnd.getTime(), currentDate.getTime()))
    subscriptionEnds.setMonth(subscriptionEnds.getMonth() + months)

    // Create a "free" subscription in Stripe for tracking purposes
    // This helps maintain consistency between Stripe and your database
    try {
      // First create a product for the free access
      const product = await stripe.products.create({
        name: `${months} Month${months > 1 ? 's' : ''} Free Access - ${church.name}`,
        description: `Administrative grant of ${months} month${months > 1 ? 's' : ''} free access`,
        metadata: {
          churchId: church.id,
          grantType: 'admin_gift'
        }
      })

      // Create a price for the product (free)
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: 0, // Free
        recurring: {
          interval: 'month',
          interval_count: months
        },
        product: product.id,
        metadata: {
          churchId: church.id,
          grantType: 'admin_gift'
        }
      })

      // Calculate trial end date with Stripe's 730-day maximum limit
      const maxTrialDays = 730 // Stripe's maximum
      const requestedDays = months * 30
      const actualTrialDays = Math.min(requestedDays, maxTrialDays)
      const trialEndDate = new Date(Date.now() + (actualTrialDays * 24 * 60 * 60 * 1000))

      console.log(`Creating Stripe subscription with ${actualTrialDays} day trial (requested: ${requestedDays} days)`)

      // Create the subscription
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: price.id }],
        trial_end: Math.floor(trialEndDate.getTime() / 1000), // Convert to Unix timestamp
        metadata: {
          churchId: church.id,
          grantType: 'admin_gift',
          grantedMonths: months.toString(),
          actualTrialDays: actualTrialDays.toString(),
          grantedAt: new Date().toISOString()
        }
      })

      console.log(`Created Stripe subscription ${subscription.id} for church ${church.name}`)

      // Update the church in database
      const updatedChurch = await prisma.church.update({
        where: { id: churchId },
        data: {
          subscriptionStatus: 'active',
          subscriptionEnds: subscriptionEnds,
          stripeCustomerId: stripeCustomerId,
          updatedAt: new Date()
        },
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          subscriptionEnds: true,
          stripeCustomerId: true
        }
      })

      const responseMessage = actualTrialDays < requestedDays 
        ? `Successfully granted ${months} months of free access (Stripe trial limited to ${Math.floor(actualTrialDays/30)} months due to 730-day maximum)`
        : `Successfully granted ${months} months of free access`

      return NextResponse.json({
        message: responseMessage,
        church: updatedChurch,
        stripe: {
          customerId: stripeCustomerId,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          trialDays: actualTrialDays,
          trialLimited: actualTrialDays < requestedDays
        }
      })

    } catch (stripeError: any) {
      console.error('Stripe subscription creation failed:', stripeError)
      
      // If Stripe fails, still update the database but log the issue
      const updatedChurch = await prisma.church.update({
        where: { id: churchId },
        data: {
          subscriptionStatus: 'active',
          subscriptionEnds: subscriptionEnds,
          stripeCustomerId: stripeCustomerId,
          updatedAt: new Date()
        },
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          subscriptionEnds: true,
          stripeCustomerId: true
        }
      })

      return NextResponse.json({
        message: `Granted ${months} months of free access (database updated, Stripe sync failed)`,
        church: updatedChurch,
        warning: 'Stripe synchronization failed - subscription created in database only',
        stripeError: stripeError.message
      })
    }

  } catch (error) {
    console.error('Grant access error:', error)
    return NextResponse.json(
      { error: 'Failed to grant access' },
      { status: 500 }
    )
  }
} 