import { NextRequest, NextResponse } from 'next/server'
import { stripe, PRICE_IDS } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { 
      email, 
      name, 
      password,
      churchName, 
      role, 
      referralCode,
      smsOptIn 
    } = await req.json()
    
    if (!email || !name || !password || !churchName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if Stripe is available (for local development)
    if (!stripe) {
      return NextResponse.json({ 
        error: 'Stripe not configured for local development',
        message: 'Please use production environment for signup or configure Stripe keys'
      }, { status: 503 })
    }

    // Determine trial period based on referral code
    const trialDays = referralCode && referralCode.trim() ? 60 : 30 // 60 days if referred, 30 days standard
    
    // Check if a customer already exists for this church email to prevent duplicates
    let customerId = null
    
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1
    })

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else {
      // Create customer for the CHURCH (will be updated with church name after signup)
      const customer = await stripe.customers.create({
        email: email,
        name: churchName, // Use church name, not individual name
        metadata: {
          isTrialSignup: 'true',
          churchName: churchName,
          role: role,
          referralCode: referralCode || ''
        }
      })
      customerId = customer.id
    }

    // Create the trial checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      payment_method_collection: 'if_required', // Don't require payment method during trial
      customer: customerId, // Use church customer, not individual email
      line_items: [
        {
          price: PRICE_IDS.monthly, // Default to monthly plan
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          signupData: JSON.stringify({
            name,
            email,
            password,
            churchName,
            role,
            referralCode: referralCode || null,
            smsOptIn: smsOptIn || false
          })
        },
      },
      success_url: `${process.env.NEXTAUTH_URL}/auth/trial-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/auth/signup?canceled=true`,
      metadata: {
        isTrialSignup: 'true',
        name,
        churchName,
        role,
        referralCode: referralCode || '',
        // Note: We don't store password in metadata for security
      },
      custom_text: {
        submit: {
          message: 'Start your 30-day free trial now!'
        }
      },
      allow_promotion_codes: true, // Allow promo codes
      billing_address_collection: 'auto' // Only collect if needed
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Error creating trial checkout session:', error)
    return NextResponse.json(
      { error: 'Error creating trial checkout session' },
      { status: 500 }
    )
  }
} 