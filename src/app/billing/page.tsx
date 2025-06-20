'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, CreditCard, Check, Zap, Star, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function BillingPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [currentPlan, setCurrentPlan] = useState('free') // free, monthly, annual

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly Plan',
      price: 35,
      interval: 'month',
      description: 'Full access, billed monthly',
      features: [
        'Unlimited musicians',
        'Unlimited events',
        'Email & SMS messaging',
        'Advanced scheduling',
        'Detailed reporting & analytics',
        'Priority support',
        'Music file sharing',
        'Calendar integration',
        'Custom roles & permissions'
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
      description: 'Best value - save $220 per year!',
      features: [
        'Unlimited musicians',
        'Unlimited events',
        'Email & SMS messaging',
        'Advanced scheduling',
        'Detailed reporting & analytics',
        'Priority support',
        'Music file sharing',
        'Calendar integration',
        'Custom roles & permissions',
        '💰 Save $220 per year',
        '✨ 2 months free'
      ],
      popular: true,
      stripePriceId: 'price_1RbkgaDKZUjfTbRbrVKLe5Hq',
      savings: 220,
      savingsPercent: 52 // (420-200)/420 * 100
    }
  ]

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
                    ? 'Full access - 23 days remaining' 
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
                  <p className="text-sm text-blue-700 font-medium">
                    You're in your 30-day free trial with full access to all features!
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    Choose a plan below to continue after your trial expires.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pricing Plans */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Select the perfect plan for your church. Upgrade or downgrade at any time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-xl shadow-sm border p-6 ${
                  plan.popular ? 'border-blue-500 ring-2 ring-blue-200' : ''
                } ${
                  currentPlan === plan.id ? 'ring-2 ring-green-200 border-green-500' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center">
                      <Star className="h-4 w-4 mr-1" />
                      Most Popular
                    </span>
                  </div>
                )}

                {currentPlan === plan.id && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    {plan.originalPrice && (
                      <div className="text-lg text-gray-500 line-through mb-1">
                        ${plan.originalPrice}/{plan.interval}
                      </div>
                    )}
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-500">/{plan.interval}</span>
                      {plan.savingsPercent && (
                        <span className="bg-green-100 text-green-800 text-sm font-medium px-2 py-1 rounded-full">
                          Save {plan.savingsPercent}%
                        </span>
                      )}
                    </div>
                    {plan.savings && (
                      <div className="text-green-600 font-medium text-sm mt-1">
                        Save ${plan.savings} per year
                      </div>
                    )}
                  </div>
                  <p className="text-gray-600">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {currentPlan === plan.id ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loading}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                      plan.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {loading ? 'Processing...' : 
                     currentPlan === 'free' ? 'Start Subscription' : 
                     'Switch Plan'}
                  </button>
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