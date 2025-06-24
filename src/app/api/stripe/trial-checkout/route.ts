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
      referralCode 
    } = await req.json()
    
    if (!email || !name || !password || !churchName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create the trial checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      payment_method_collection: 'if_required', // Don't require payment method during trial
      line_items: [
        {
          price: PRICE_IDS.monthly, // Default to monthly plan
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 30, // 30-day trial
        metadata: {
          signupData: JSON.stringify({
            name,
            email,
            password,
            churchName,
            role,
            referralCode: referralCode || null
          })
        },
      },
      success_url: `${process.env.NEXTAUTH_URL}/auth/trial-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/auth/signup?canceled=true`,
      customer_email: email,
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