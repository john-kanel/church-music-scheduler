'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setIsSubmitted(true)
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 pt-8">
        <div className="max-w-md w-full space-y-6 px-4">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Logo size="xl" />
            </div>
            <h2 className="mt-4 text-3xl font-bold text-gray-900">
              Check Your Email
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent password reset instructions to your email address
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Email Sent Successfully
              </h3>
              
              <p className="text-gray-600 mb-6">
                If an account with <strong>{email}</strong> exists, you'll receive a password reset link shortly.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Next Steps:</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• Check your email inbox (and spam folder)</li>
                  <li>• Click the reset link within 30 minutes</li>
                  <li>• Create a new secure password</li>
                </ul>
              </div>

              <div className="space-y-3">
                <Link
                  href="/auth/signin"
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                >
                  Back to Sign In
                </Link>
                
                <button
                  onClick={() => {
                    setIsSubmitted(false)
                    setEmail('')
                  }}
                  className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                >
                  Send Another Email
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 pt-8">
      <div className="max-w-md w-full space-y-6 px-4">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="xl" />
          </div>
          <h2 className="mt-4 text-3xl font-bold text-gray-900">
            Forgot Your Password?
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
                  placeholder="Enter your email address"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/signin"
              className="inline-flex items-center text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 