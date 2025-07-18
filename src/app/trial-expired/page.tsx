'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, CreditCard, Check, Star, Clock } from 'lucide-react'
import Link from 'next/link'

export default function TrialExpiredPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)

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

  const handleSubscribe = async (planId: string) => {
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
      console.error('Error starting subscription:', error)
      alert('Error starting checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to continue</h1>
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
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Trial Expired</h1>
            </div>
            <p className="text-gray-600">Your 30-day free trial has ended. Subscribe to continue using Church Music Pro.</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Trial Expired Notice */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
          <div className="flex items-start">
            <Clock className="h-6 w-6 text-red-600 mr-3 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-red-900 mb-2">Your Free Trial Has Ended</h2>
              <p className="text-red-700 mb-4">
                You had full access to all Church Music Pro features during your 30-day trial. 
                To continue managing your music ministry, please choose a subscription plan below.
              </p>
              <div className="bg-white border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">What you accomplished during your trial:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Full access to unlimited musicians and events</li>
                  <li>• Complete music scheduling and communication tools</li>
                  <li>• All advanced features at no cost</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Continue Your Music Ministry</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Choose a plan to resume full access to your church music scheduling platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-xl shadow-lg border-2 p-8 ${
                plan.popular ? 'border-blue-500 ring-4 ring-blue-100' : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center">
                    <Star className="h-4 w-4 mr-1" />
                    Recommended
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{plan.name}</h3>
                <div className="mb-4">
                  {plan.originalPrice && (
                    <div className="text-xl text-gray-500 line-through mb-2">
                      ${plan.originalPrice}/{plan.interval}
                    </div>
                  )}
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-5xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-500 text-lg">/{plan.interval}</span>
                    {plan.savingsPercent && (
                      <span className="bg-success-100 text-success-800 text-sm font-medium px-3 py-1 rounded-full">
                        Save {plan.savingsPercent}%
                      </span>
                    )}
                  </div>
                  {plan.savings && (
                    <div className="text-success-600 font-medium mt-2">
                      Save ${plan.savings} per year
                    </div>
                  )}
                </div>
                <p className="text-gray-600 text-lg">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <Check className="h-5 w-5 text-success-500 mr-3 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-colors disabled:opacity-50 ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                    : 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {loading ? 'Processing...' : 'Subscribe Now'}
              </button>
            </div>
          ))}
        </div>

        {/* Support Section */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
            <p className="text-gray-600 mb-4">
              If you have questions about pricing or need assistance, we're here to help.
            </p>
            <div className="flex justify-center space-x-4">
              <a href="mailto:support@churchmusicpro.com" className="text-blue-600 hover:text-blue-700">
                Email Support
              </a>
              <span className="text-gray-300">|</span>
              <Link href="/contact" className="text-blue-600 hover:text-blue-700">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 