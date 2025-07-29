'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, GiftIcon } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    churchName: '',
    role: 'DIRECTOR' as 'DIRECTOR' | 'PASTOR',
    referralCode: '',
    smsOptIn: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)

  // Handle hydration and pre-fill form data from URL parameters
  useEffect(() => {
    setIsHydrated(true)
    
    const refCode = searchParams.get('ref')
    const email = searchParams.get('email')
    const church = searchParams.get('church')
    
    if (refCode || email || church) {
      setFormData(prev => ({
        ...prev,
        ...(refCode && { referralCode: refCode.toUpperCase() }),
        ...(email && { email: email }),
        ...(church && { churchName: church })
      }))
    }
  }, [searchParams])

  // Don't render form until hydrated to prevent mismatch
  if (!isHydrated) {
    return <LoadingFallback />
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.phone.trim()) {
      setError('Phone number is required')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setLoading(true)

    try {
      // Create Stripe trial checkout session
      const response = await fetch('/api/stripe/trial-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          churchName: formData.churchName,
          role: formData.role,
          referralCode: formData.referralCode || undefined,
          smsOptIn: formData.smsOptIn
        }),
      })

      const result = await response.json()

      if (response.ok && result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url
      } else {
        setError(result.error || 'Failed to start trial checkout')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Start Your 30-Day Free Trial
          </h1>
          <div className="mt-4 bg-success-50 border border-success-200 rounded-lg p-3">
            <p className="text-success-800 text-sm font-medium">
              ✓ 30 days completely free<br/>
              ✓ No credit card required now<br/>
              ✓ Cancel anytime during trial
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Your Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
              placeholder="your.email@church.org"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              Your Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
            >
              <option value="DIRECTOR">Music Director</option>
              <option value="PASTOR">Pastor/Priest</option>
            </select>
          </div>

          {/* Parish Information */}
          <div>
            <label htmlFor="churchName" className="block text-sm font-medium text-gray-700 mb-2">
              Church Name
            </label>
            <input
              type="text"
              id="churchName"
              name="churchName"
              value={formData.churchName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
              placeholder="First Baptist Church"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
              placeholder="Choose a secure password"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
              placeholder="Confirm your password"
            />
          </div>

          {/* Referral Code */}
          <div>
            <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center">
                <GiftIcon className="h-4 w-4 mr-1 text-success-600" />
                Referral Code (Optional)
              </div>
            </label>
            <input
              type="text"
              id="referralCode"
              name="referralCode"
              value={formData.referralCode}
              onChange={(e) => setFormData(prev => ({ ...prev, referralCode: e.target.value.toUpperCase() }))}
              maxLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-transparent text-gray-900"
              placeholder="Enter 8-character code"
            />
            <p className="text-xs text-gray-500 mt-1">
              🎁 Have a referral code? Enter it here to get an extra 30 days free trial!
            </p>
          </div>

          {/* SMS Opt-In */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id="smsOptIn"
                name="smsOptIn"
                checked={formData.smsOptIn}
                onChange={(e) => setFormData(prev => ({ ...prev, smsOptIn: e.target.checked }))}
                className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="smsOptIn" className="font-medium text-gray-700">
                Receive text message notifications
              </label>
              <p className="text-gray-500">
                Get important updates and reminders via SMS. You can opt out anytime.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            {loading ? 'Redirecting to checkout...' : 'Continue to Free Trial Setup'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign in here
            </Link>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">
              <strong>What happens next:</strong>
            </p>
            <div className="space-y-1 text-left">
              <p>• Setup your trial account (no payment required)</p>
              <p>• Enjoy 30 days of full access</p>
              <p>• Add payment details only when you're ready to continue</p>
              <p>• Only $35/month after trial ends</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Start Your Free Trial
          </h1>
          <p className="text-gray-600">
            Loading signup form...
          </p>
        </div>
        <div className="animate-pulse space-y-6">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <Logo />
            </Link>
            <Link href="/" className="flex items-center text-gray-600 hover:text-brand-600 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <Suspense fallback={<LoadingFallback />}>
        <SignUpForm />
      </Suspense>
    </div>
  )
} 