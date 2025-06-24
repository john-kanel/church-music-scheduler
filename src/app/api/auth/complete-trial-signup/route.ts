import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/db'
import { UserRole } from '@/generated/prisma'
import { generateReferralCode, isValidReferralCode } from '@/lib/utils'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    
    console.log('Stripe session details:', {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      mode: session.mode,
      metadata: session.metadata
    })
    
    // For trial subscriptions, payment_status can be 'paid', 'no_payment_required', or 'unpaid'
    const validPaymentStatuses = ['paid', 'no_payment_required', 'unpaid']
    if (!session || !validPaymentStatuses.includes(session.payment_status as string)) {
      return NextResponse.json(
        { error: `Invalid session. Payment status: ${session?.payment_status}, Session status: ${session?.status}` },
        { status: 400 }
      )
    }

    // Parse the signup data from session metadata
    let signupData = null
    let signupDataString = null

    // Try to get signup data from subscription metadata first
    if (session.subscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        console.log('Subscription details:', {
          id: subscription.id,
          status: subscription.status,
          metadata: subscription.metadata
        })
        signupDataString = subscription.metadata?.signupData
      } catch (error) {
        console.log('Could not retrieve subscription:', error)
      }
    } else {
      console.log('No subscription ID found in session')
    }

    // If we have signup data from subscription, parse it
    if (signupDataString) {
      try {
        signupData = JSON.parse(signupDataString)
      } catch (e) {
        console.error('Error parsing signup data from subscription:', e)
      }
    }

    // If we don't have signup data yet, it might be because subscription is still being created
    // In this case, we can't proceed without the password
    if (!signupData) {
      console.log('No signup data found. Session details:', {
        hasSubscription: !!session.subscription,
        mode: session.mode,
        status: session.status,
        payment_status: session.payment_status
      })
      return NextResponse.json(
        { error: 'Signup data not available yet. Please wait a moment and try again.' },
        { status: 400 }
      )
    }

    const { name, email, password, churchName, role, referralCode } = signupData

    if (!name || !email || !password || !churchName || !role) {
      return NextResponse.json(
        { error: 'Missing required signup data' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    // Validate referral code if provided
    let referringChurch = null
    if (referralCode && referralCode.trim()) {
      const trimmedCode = referralCode.trim().toUpperCase()
      
      if (isValidReferralCode(trimmedCode)) {
        referringChurch = await prisma.church.findUnique({
          where: { referralCode: trimmedCode },
          select: { id: true, name: true }
        })
      }
    }

    // Hash the provided password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Split name into firstName and lastName
    const nameParts = name.trim().split(' ')
    const userFirstName = nameParts[0] || ''
    const userLastName = nameParts.slice(1).join(' ') || ''

    // Create church and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate unique referral code for new church
      const newReferralCode = await generateReferralCode()
      
      // Create the church first
      const church = await tx.church.create({
        data: {
          name: churchName.trim(),
          address: '',
          email: email,
          phone: '',
          referralCode: newReferralCode,
          referredBy: referringChurch?.id || null,
          subscriptionStatus: 'trialing',
          subscriptionEnds: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          stripeCustomerId: session.customer as string
        }
      })

      // Create the user with the church connection
      const user = await tx.user.create({
        data: {
          firstName: userFirstName,
          lastName: userLastName,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: role as UserRole,
          churchId: church.id,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          churchId: true,
        }
      })

      // Create default automation settings for new church
      if (role === 'DIRECTOR' || role === 'ASSOCIATE_DIRECTOR') {
        await tx.automationSettings.create({
          data: {
            churchId: church.id,
            pastorEmailEnabled: true,
            pastorMonthlyReportDay: 27,
            pastorDailyDigestEnabled: true,
            pastorDailyDigestTime: '08:00',
            musicianNotifications: {
              create: [
                {
                  hoursBeforeEvent: 168, // 1 week
                  isEnabled: true
                },
                {
                  hoursBeforeEvent: 24, // 24 hours
                  isEnabled: true
                }
              ]
            }
          }
        })
      }

      return { user, church }
    })

    return NextResponse.json(
      {
        message: 'Trial account created successfully',
        user: {
          id: result.user.id,
          name: `${result.user.firstName} ${result.user.lastName}`.trim(),
          email: result.user.email,
          role: result.user.role,
          church: result.church
        },
        needsPasswordReset: false
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Complete trial signup error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
} 