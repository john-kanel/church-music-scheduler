'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, CreditCard, Zap, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface SubscriptionData {
  status: string
  isTrialActive: boolean
  trialDaysRemaining: number
  trialEndsAt: string | null
  subscriptionEnds: string | null
  stripePlan: string | null
  stripeStatus: string | null
}

export default function BillingPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [currentPlan, setCurrentPlan] = useState('free') // free, monthly, annual
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly Plan',
      price: 35,
      interval: 'month',
      description: 'Complete church music scheduling solution',
      subtext: 'Get started with full access today!',
      badge: 'One month free trial included!',
      features: [
        'One month free trial',
        'Unlimited musicians',
        'Unlimited events',
        'Email & SMS messaging',
        'Music file sharing',
        'Priority support'
      ],
      popular: false,
      stripePriceId: 'price_1RbkRKDKZUjfTbRbPIstDXUV'
    },
    {
      id: 'annual',
      name: 'Annual Plan',
      price: 200,
      interval: 'year',
      originalPrice: 420, // 35 * 12 = 420
      description: 'Everything included - 2 months free!',
      badge: 'Save $220 per year!',
      topBadge: 'Best Value - Save 52%',
      features: [
        'Two month free trial',
        'Unlimited musicians',
        'Unlimited events',
        'Email & SMS messaging',
        'Music file sharing',
        'Priority support'
      ],
      popular: true,
      stripePriceId: 'price_1RbkgaDKZUjfTbRbrVKLe5Hq',
      savings: 220,
      savingsPercent: 52 // (420-200)/420 * 100
    }
  ]

  // Fetch real subscription data
  useEffect(() => {
    if (session?.user?.id) {
      fetchSubscriptionData()
    }
  }, [session?.user?.id])

  const fetchSubscriptionData = async () => {
    try {
      setSubscriptionLoading(true)
      const response = await fetch('/api/subscription-status')
      
      if (response.ok) {
        const data = await response.json()
        setSubscriptionData(data.subscription)
        
        // Update current plan based on subscription data
        if (data.subscription.status === 'trial') {
          setCurrentPlan('free')
        } else if (data.subscription.stripePlan === 'price_1RbkRKDKZUjfTbRbPIstDXUV') {
          setCurrentPlan('monthly')
        } else if (data.subscription.stripePlan === 'price_1RbkgaDKZUjfTbRbrVKLe5Hq') {
          setCurrentPlan('annual')
        }
      } else {
        console.error('Failed to fetch subscription data')
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error)
    } finally {
      setSubscriptionLoading(false)
    }
  }

  const handleUpgrade = async (planId: string) => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planType: planId }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Failed to create checkout session')
      }
      
    } catch (error) {
      console.error('Error upgrading plan:', error)
      alert('Error starting checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = async () => {
    setLoading(true)
    
    try {
      // For now, we'll need to implement customer ID lookup
      // This would come from your database where you store Stripe customer IDs
      const customerId = 'cus_example' // Replace with actual customer ID lookup
      
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerId }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Failed to create portal session')
      }
      
    } catch (error) {
      console.error('Error opening customer portal:', error)
      alert('Error opening billing portal. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to manage billing</h1>
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  // Only allow church leadership to access billing
  if (session.user.role === 'MUSICIAN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
            <p className="text-gray-600 mb-6">
              Only church leadership (Directors and Pastors) can access billing and subscription management.
            </p>
            <div className="space-y-3">
              <Link 
                href="/dashboard" 
                className="w-full inline-flex justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Return to Dashboard
              </Link>
              <p className="text-sm text-gray-500">
                Need billing access? Contact your church director.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link 
                href="/settings" 
                className="flex items-center text-gray-600 hover:text-gray-900 mr-6"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Settings
              </Link>
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
                  <p className="text-sm text-gray-600">Manage your subscription and billing details</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Plan Status */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Current Plan</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {currentPlan === 'free' ? 'Free Trial' : plans.find(p => p.id === currentPlan)?.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {currentPlan === 'free' 
                    ? (subscriptionLoading 
                        ? 'Loading trial info...' 
                        : subscriptionData?.isTrialActive 
                          ? `Full access - ${subscriptionData.trialDaysRemaining} day${subscriptionData.trialDaysRemaining !== 1 ? 's' : ''} remaining`
                          : 'Trial expired'
                      )
                    : `$${plans.find(p => p.id === currentPlan)?.price}/${plans.find(p => p.id === currentPlan)?.interval}`}
                </p>
              </div>
            </div>
            {currentPlan !== 'free' && (
              <button
                onClick={handleManageBilling}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Manage Billing'}
              </button>
            )}
          </div>
          
          {currentPlan === 'free' && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                <div>
                  {subscriptionLoading ? (
                    <p className="text-sm text-blue-700 font-medium">
                      Loading trial information...
                    </p>
                  ) : subscriptionData?.isTrialActive ? (
                    <>
                      <p className="text-sm text-blue-700 font-medium">
                        You're in your 30-day free trial with full access to all features!
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        {subscriptionData.trialDaysRemaining} day{subscriptionData.trialDaysRemaining !== 1 ? 's' : ''} remaining
                        {subscriptionData.trialEndsAt && ` - trial ends ${new Date(subscriptionData.trialEndsAt).toLocaleDateString()}`}
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        Choose a plan below to continue after your trial expires.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-red-700 font-medium">
                        Your free trial has expired.
                      </p>
                      <p className="text-sm text-red-600 mt-1">
                        Please choose a plan below to continue using all features.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pricing Plans */}
        <div className="mb-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Simple, Affordable Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Choose monthly or save big with annual billing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto md:grid-rows-1 pt-4">
            {plans.map((plan) => (
              <div key={plan.id}>
                {plan.id === 'monthly' ? (
                  /* Monthly Plan */
                  <div className={`bg-white rounded-2xl shadow-xl p-8 flex flex-col h-full ${
                    currentPlan === plan.id ? 'ring-2 ring-success-200 border-success-500' : ''
                  }`}>
                    {currentPlan === plan.id && (
                      <div className="absolute -top-3 right-4 z-10">
                        <span className="bg-success-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Current Plan
                        </span>
                      </div>
                    )}
                    <div className="text-center flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                      <div className="mb-4">
                        <span className="text-4xl font-bold text-brand-600">${plan.price}</span>
                        <span className="text-gray-600">/{plan.interval}</span>
                      </div>
                      <p className="text-gray-600 mb-4">
                        {plan.description}
                      </p>
                      <div className="bg-brand-50 text-brand-700 text-sm font-medium px-3 py-1 rounded-full inline-block mb-4">
                        {plan.badge}
                      </div>
                      <p className="text-gray-600 mb-6">
                        {plan.subtext}
                      </p>

                      <div className="space-y-3 mb-8 min-h-[144px] flex flex-col justify-between">
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-center">
                            <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                            <span className="text-gray-700">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto">
                        {currentPlan === plan.id ? (
                          <button
                            disabled
                            className="w-full bg-gray-100 text-gray-500 py-3 px-6 rounded-lg font-medium cursor-not-allowed"
                          >
                            Current Plan
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={loading}
                            className="w-full bg-brand-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                          >
                            {loading ? 'Processing...' : 'Start 30-Day Free Trial'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Annual Plan */
                  <div className={`bg-white rounded-2xl shadow-xl p-8 border-2 border-success-500 relative flex flex-col h-full overflow-visible pt-12 md:pt-10 ${
                    currentPlan === plan.id ? 'ring-2 ring-success-200' : ''
                  }`}>
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                      <span className="bg-success-500 text-white px-4 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                        {plan.topBadge}
                      </span>
                    </div>
                    {currentPlan === plan.id && (
                      <div className="absolute -top-3 right-4 z-10">
                        <span className="bg-success-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Current Plan
                        </span>
                      </div>
                    )}
                    <div className="text-center flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                      <div className="mb-2">
                        <div className="text-lg text-gray-500 line-through">${plan.originalPrice}/{plan.interval}</div>
                        <div className="mb-2">
                          <span className="text-4xl font-bold text-success-600">${plan.price}</span>
                          <span className="text-gray-600">/{plan.interval}</span>
                        </div>
                      </div>
                      <div className="bg-success-50 text-success-700 text-sm font-medium px-3 py-1 rounded-full inline-block mb-4">
                        {plan.badge}
                      </div>
                      <p className="text-gray-600 mb-6">
                        {plan.description}
                      </p>

                      <div className="space-y-3 mb-8 min-h-[144px] flex flex-col justify-between">
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-center">
                            <div className="w-2 h-2 bg-success-500 rounded-full mr-3"></div>
                            <span className="text-gray-700">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto -mb-1">
                        {currentPlan === plan.id ? (
                          <button
                            disabled
                            className="w-full bg-gray-100 text-gray-500 font-medium py-3 px-6 rounded-lg cursor-not-allowed"
                          >
                            Current Plan
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={loading}
                            className="w-full bg-success-600 text-white font-medium py-3 px-6 rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50"
                          >
                            {loading ? 'Processing...' : 'Start 30-Day Free Trial'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Billing Information */}
        {currentPlan !== 'free' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Billing Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Payment Method</h3>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <CreditCard className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">•••• •••• •••• 4242</p>
                    <p className="text-xs text-gray-500">Expires 12/25</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Next Payment</h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">${plans.find(p => p.id === currentPlan)?.price}</p>
                  <p className="text-xs text-gray-500">Due on {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <h3 className="font-medium text-gray-900 mb-4">Billing History</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Monthly Subscription</p>
                    <p className="text-xs text-gray-500">December 2024</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">${plans.find(p => p.id === currentPlan)?.price}</p>
                    <p className="text-xs text-gray-500">Paid</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 