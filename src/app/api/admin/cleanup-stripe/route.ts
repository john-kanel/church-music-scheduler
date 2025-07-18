import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

// Admin password check
const ADMIN_PASSWORD = process.env.ADMIN_DEBUG_PASSWORD || 'admin123'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all churches with their Stripe customer info
    const churches = await prisma.church.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        stripeCustomerId: true,
        subscriptionStatus: true,
        users: {
          where: {
            role: { in: ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'] }
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    })

    // Get all Stripe customers
    const allCustomers = await stripe.customers.list({ limit: 100 })

    // Analyze the situation
    const analysis = {
      totalChurches: churches.length,
      churchesWithStripeId: churches.filter((c: any) => c.stripeCustomerId).length,
      churchesWithoutStripeId: churches.filter((c: any) => !c.stripeCustomerId).length,
      totalStripeCustomers: allCustomers.data.length,
      
      // Find potential issues
      issues: {
        duplicateCustomers: [] as any[],
        orphanedCustomers: [] as any[],
        churchesNeedingCustomers: [] as any[]
      }
    }

    // Find churches that need Stripe customers
    churches.filter((c: any) => !c.stripeCustomerId).forEach((church: any) => {
      analysis.issues.churchesNeedingCustomers.push({
        churchId: church.id,
        churchName: church.name,
        churchEmail: church.email,
        leaders: church.users
      })
    })

    // Find potential duplicate customers (same email or similar names)
    const customersByEmail = new Map()
    const customersByName = new Map()

    allCustomers.data.forEach((customer: any) => {
      const email = (customer as any).email
      const name = (customer as any).name

      if (email) {
        if (!customersByEmail.has(email)) {
          customersByEmail.set(email, [])
        }
        customersByEmail.get(email).push(customer)
      }

      if (name) {
        if (!customersByName.has(name)) {
          customersByName.set(name, [])
        }
        customersByName.get(name).push(customer)
      }
    })

    // Find duplicates
    customersByEmail.forEach((customers, email) => {
      if (customers.length > 1) {
        analysis.issues.duplicateCustomers.push({
          type: 'email',
          email,
          customers: customers.map((c: any) => ({
            id: c.id,
            name: c.name,
            created: new Date(c.created * 1000).toISOString(),
            metadata: c.metadata
          }))
        })
      }
    })

    // Find orphaned customers (not linked to any church)
    const linkedCustomerIds = new Set(churches.map((c: any) => c.stripeCustomerId).filter(Boolean))
    
    allCustomers.data.forEach((customer: any) => {
      if (!linkedCustomerIds.has(customer.id)) {
        analysis.issues.orphanedCustomers.push({
          id: customer.id,
          email: (customer as any).email,
          name: (customer as any).name,
          created: new Date((customer as any).created * 1000).toISOString(),
          metadata: (customer as any).metadata
        })
      }
    })

    return NextResponse.json({
      success: true,
      analysis,
      recommendations: {
        duplicateCustomers: analysis.issues.duplicateCustomers.length > 0 
          ? 'You have duplicate customers. Consider consolidating them.'
          : 'No duplicate customers found.',
        orphanedCustomers: analysis.issues.orphanedCustomers.length > 0
          ? 'You have Stripe customers not linked to any church. These might be individual users who should be consolidated.'
          : 'No orphaned customers found.',
        missingCustomers: analysis.issues.churchesNeedingCustomers.length > 0
          ? 'Some churches don\'t have Stripe customers. They will be created when they first try to subscribe.'
          : 'All churches that need Stripe customers have them.'
      }
    })

  } catch (error) {
    console.error('Stripe cleanup analysis error:', error)
    return NextResponse.json({ 
      error: 'Failed to analyze Stripe customers' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { password, action, customerId } = await request.json()

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (action === 'delete-customer') {
      if (!customerId) {
        return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
      }

      // Get customer details first
      const customer = await stripe.customers.retrieve(customerId)
      
      // Check if customer has active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active'
      })

      if (subscriptions.data.length > 0) {
        return NextResponse.json({ 
          error: 'Cannot delete customer with active subscriptions' 
        }, { status: 400 })
      }

      // Delete the customer
      await stripe.customers.del(customerId)

      return NextResponse.json({
        success: true,
        message: `Deleted customer ${customerId}`,
        deletedCustomer: {
          id: customerId,
          email: (customer as any).email,
          name: (customer as any).name
        }
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Stripe cleanup action error:', error)
    return NextResponse.json({ 
      error: 'Failed to perform cleanup action' 
    }, { status: 500 })
  }
} 