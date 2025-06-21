import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Test Stripe connection
    const account = await stripe.accounts.retrieve()
    
    // Get a sample church for testing
    const sampleChurch = await prisma.church.findFirst({
      select: {
        id: true,
        name: true,
        email: true,
        stripeCustomerId: true,
        subscriptionStatus: true,
        subscriptionEnds: true
      }
    })

    // Test creating a customer (without actually saving)
    const testCustomerData = {
      email: 'test@example.com',
      name: 'Test Church',
      metadata: {
        churchId: 'test-church-id',
        testMode: 'true'
      }
    }

    return NextResponse.json({
      status: 'success',
      stripe: {
        connected: true,
        accountId: account.id,
        country: account.country,
        currency: account.default_currency
      },
      database: {
        connected: true,
        sampleChurch: sampleChurch
      },
      testData: {
        customerData: testCustomerData,
        note: 'This is test data - no actual Stripe resources were created'
      }
    })

  } catch (error: any) {
    console.error('Stripe test error:', error)
    return NextResponse.json({
      status: 'error',
      error: error.message,
      details: 'Check your STRIPE_SECRET_KEY environment variable'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, churchId } = await request.json()

    if (action === 'test-customer-creation' && churchId) {
      // Get church details
      const church = await prisma.church.findUnique({
        where: { id: churchId },
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

      if (church.stripeCustomerId) {
        // Test retrieving existing customer
        const customer = await stripe.customers.retrieve(church.stripeCustomerId)
        
        return NextResponse.json({
          status: 'success',
          action: 'retrieved_existing_customer',
          customer: {
            id: customer.id,
            email: (customer as any).email,
            name: (customer as any).name,
            created: (customer as any).created
          }
        })
      } else {
        return NextResponse.json({
          status: 'info',
          message: 'Church has no Stripe customer ID - would create new customer in production'
        })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Stripe test POST error:', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
} 