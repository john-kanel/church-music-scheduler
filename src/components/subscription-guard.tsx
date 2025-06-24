'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, Clock, CreditCard } from 'lucide-react'
import Link from 'next/link'

interface SubscriptionStatus {
  isActive: boolean
  isExpired: boolean
  subscriptionEnds: Date | null
  subscriptionStatus: string
}

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.churchId) {
      checkSubscription()
    } else {
      setLoading(false)
    }
  }, [session])

  const checkSubscription = async () => {
    try {
      const response = await fetch('/api/subscription-status')
      if (response.ok) {
        const data = await response.json()
        setSubscriptionStatus(data)
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  // Don't show anything while loading or if no session
  if (loading || !session) {
    return <>{children}</>
  }

  // If subscription is expired, show warning
  if (subscriptionStatus?.isExpired) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900">Subscription Required</h3>
                  <p className="text-red-700">Your trial has expired. Please update your billing to continue.</p>
                </div>
              </div>
              <Link 
                href="/billing"
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Update Billing
              </Link>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Suspended</h2>
            <p className="text-gray-600 mb-4">
              Your account access has been suspended due to an expired subscription.
            </p>
            <Link 
              href="/billing"
              className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Subscribe to Continue
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function SubscriptionWarning() {
  const { data: session } = useSession()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    if (session?.user?.churchId) {
      checkSubscription()
    }
  }, [session])

  const checkSubscription = async () => {
    try {
      const response = await fetch('/api/subscription-status')
      if (response.ok) {
        const data = await response.json()
        setSubscriptionStatus(data)
        
        // Calculate days left if in trial
        if (data.subscriptionEnds && data.subscriptionStatus === 'trialing') {
          const endDate = new Date(data.subscriptionEnds)
          const now = new Date()
          const diffTime = endDate.getTime() - now.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          setDaysLeft(Math.max(0, diffDays))
        }
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
    }
  }

  // Show warning if trial is ending soon (within 7 days)
  if (subscriptionStatus?.subscriptionStatus === 'trialing' && daysLeft !== null && daysLeft <= 7) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-yellow-800">
                {daysLeft === 0 
                  ? 'Your trial expires today!' 
                  : `Your trial expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
                }
              </span>
            </div>
            <Link 
              href="/billing"
              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 transition-colors"
            >
              Subscribe Now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return null
} 