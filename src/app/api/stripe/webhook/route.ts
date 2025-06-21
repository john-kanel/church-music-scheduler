import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { ReferralSuccessNotification } from '@/components/emails/referral-success-notification'
import { render } from '@react-email/render'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
const resend = new Resend(process.env.RESEND_API_KEY)

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

    // Process referral rewards if this is their first successful payment
    await processReferralRewards(church.id, invoice)
  } catch (error) {
    console.error('Error handling payment succeeded:', error)
  }
}

async function processReferralRewards(churchId: string, invoice: Stripe.Invoice) {
  try {
    // Find pending referrals where this church was the referred church
    const pendingReferrals = await prisma.referral.findMany({
      where: {
        referredChurchId: churchId,
        status: 'PENDING',
        rewardProcessed: false
      },
      include: {
        referringChurch: true,
        referredChurch: true
      }
    })

    if (pendingReferrals.length === 0) {
      return
    }

    console.log(`Processing ${pendingReferrals.length} referral rewards for church ${churchId}`)

    for (const referral of pendingReferrals) {
      await prisma.$transaction(async (tx) => {
        // Mark referral as completed
        await tx.referral.update({
          where: { id: referral.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            rewardProcessed: true
          }
        })

        // Calculate reward amount (one month's subscription)
        const monthlyPrice = calculateMonthlyPrice(invoice)
        
        // Award reward to referring church
        const updatedReferringChurch = await tx.church.update({
          where: { id: referral.referringChurchId },
          data: {
            referralRewardsEarned: {
              increment: 1
            },
            referralRewardsSaved: {
              increment: monthlyPrice
            }
          }
        })

        // Apply referral credit via Stripe (skip next payment for mid-month changes)
        await applyReferralCreditToStripe(referral.referringChurch.stripeCustomerId, monthlyPrice)

        // Send notification email to referrer
        await sendReferrerNotificationEmail(
          referral.referringChurch,
          updatedReferringChurch,
          referral.referredPersonName,
          referral.referredChurch?.name || 'Unknown Church',
          monthlyPrice
        )

        console.log(`✅ Processed referral reward: ${referral.referringChurch.name} earned 1 month (${monthlyPrice}) for referring ${referral.referredChurch?.name}`)
      })
    }
  } catch (error) {
    console.error('Error processing referral rewards:', error)
  }
}

function calculateMonthlyPrice(invoice: Stripe.Invoice): number {
  // Extract the price from the invoice
  // For simplicity, we'll use a default monthly price
  // You can enhance this to calculate based on actual subscription amounts
  const totalAmount = invoice.amount_paid / 100 // Convert from cents to dollars
  
  // If it's an annual subscription, divide by 12
  if (totalAmount > 100) { // Assume annual if over $100
    return Math.round((totalAmount / 12) * 100) / 100
  }
  
  return totalAmount
}

async function applyReferralCreditToStripe(stripeCustomerId: string | null, creditAmount: number) {
  if (!stripeCustomerId) {
    console.warn('No Stripe customer ID for referral credit application')
    return
  }

  try {
    // Get the customer's active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1
    })

    if (subscriptions.data.length === 0) {
      console.warn('No active subscription found for customer:', stripeCustomerId)
      // Fall back to credit balance if no active subscription
      await stripe.customers.createBalanceTransaction(stripeCustomerId, {
        amount: Math.round(creditAmount * 100),
        currency: 'usd',
        description: 'Referral reward credit'
      })
      console.log(`Applied $${creditAmount} referral credit to customer ${stripeCustomerId}`)
      return
    }

    const subscription = subscriptions.data[0]
    
    // Check if this is mid-month by looking at the current period
    const now = new Date()
    const currentPeriodStart = new Date((subscription as any).current_period_start * 1000)
    const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000)
    const periodLength = currentPeriodEnd.getTime() - currentPeriodStart.getTime()
    const timeElapsed = now.getTime() - currentPeriodStart.getTime()
    const percentageElapsed = timeElapsed / periodLength

    // If we're more than 10% into the billing period, skip the next payment instead of applying credit
    if (percentageElapsed > 0.1) {
      console.log(`Mid-period reward detected (${Math.round(percentageElapsed * 100)}% elapsed). Skipping next payment instead of applying credit.`)
      
      // Calculate new period end (skip one billing cycle)
      const nextPeriodEnd = new Date(currentPeriodEnd)
      if (subscription.items.data[0]?.price?.recurring?.interval === 'year') {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1)
      } else {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1)
      }

      // Update the subscription to extend the trial period to skip the next payment
      await stripe.subscriptions.update(subscription.id, {
        trial_end: Math.floor(nextPeriodEnd.getTime() / 1000),
        proration_behavior: 'none'
      })

      console.log(`Extended subscription trial to ${nextPeriodEnd.toISOString()} to skip next payment for customer ${stripeCustomerId}`)
    } else {
      // Early in billing period, apply credit balance
      await stripe.customers.createBalanceTransaction(stripeCustomerId, {
        amount: Math.round(creditAmount * 100),
        currency: 'usd',
        description: 'Referral reward credit'
      })

      console.log(`Applied $${creditAmount} referral credit to customer ${stripeCustomerId}`)
    }
  } catch (error) {
    console.error('Error applying Stripe credit:', error)
    // Don't throw - we still want to record the reward in our database
  }
}

async function sendReferrerNotificationEmail(
  referringChurch: any,
  updatedChurchData: any,
  referredPersonName: string,
  referredChurchName: string,
  monthlyReward: number
) {
  try {
    // Get the primary contact for the referring church (director or first user)
    const referringUser = await prisma.user.findFirst({
      where: { 
        churchId: referringChurch.id,
        role: { in: ['DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'] }
      },
      orderBy: { createdAt: 'asc' }
    })

    if (!referringUser) {
      console.warn('No contact found for referring church:', referringChurch.id)
      return
    }

    const referrerName = `${referringUser.firstName} ${referringUser.lastName}`.trim()

    // Generate email HTML
    const emailHtml = await render(
      ReferralSuccessNotification({
        referrerName,
        referrerChurchName: referringChurch.name,
        referredPersonName,
        referredChurchName,
        monthlyReward,
        totalRewardsEarned: updatedChurchData.referralRewardsEarned,
        totalMoneySaved: updatedChurchData.referralRewardsSaved.toNumber()
      })
    )

    // Send email
    await resend.emails.send({
      from: 'Church Music Scheduler <noreply@churchmusicscheduler.com>',
      to: referringUser.email,
      subject: `🎉 Your referral was successful! You earned a free month!`,
      html: emailHtml
    })

    console.log(`✅ Sent referrer notification email to ${referringUser.email}`)
  } catch (error) {
    console.error('Error sending referrer notification email:', error)
    // Don't throw - we still want the referral processing to succeed
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