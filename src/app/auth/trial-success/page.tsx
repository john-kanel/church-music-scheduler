'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'

function TrialSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!sessionId) {
      setStatus('error')
      setError('No session ID found')
      return
    }

    completeAccountCreation(sessionId)
  }, [searchParams])

  const completeAccountCreation = async (sessionId: string, attempt = 1) => {
    try {
      const response = await fetch('/api/auth/complete-trial-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      })

      const result = await response.json()

      if (response.ok) {
        setStatus('success')
        // Redirect to sign in after a short delay
        setTimeout(() => {
          router.push('/auth/signin?message=Trial started! Please sign in to continue.')
        }, 3000)
      } else {
        // If the error is about signup data not being available and we haven't retried too many times
        if (result.error?.includes('Signup data not available yet') && attempt < 4) {
          setRetryCount(attempt)
          // Wait a bit longer each time before retrying
          setTimeout(() => {
            completeAccountCreation(sessionId, attempt + 1)
          }, attempt * 2000) // 2s, 4s, 6s delays
        } else {
          setStatus('error')
          setError(result.error || 'Failed to complete account creation')
        }
      }
    } catch (err) {
      setStatus('error')
      setError('Network error. Please try again.')
    }
  }

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Loader2 className="h-16 w-16 text-brand-600 mx-auto mb-6 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Setting up your account...
            </h1>
            <p className="text-gray-600">
              We're completing your church registration. This will just take a moment.
              {retryCount > 0 && (
                <span className="block mt-2 text-sm text-blue-600">
                  Retry attempt {retryCount} of 3...
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="h-8 w-8 bg-red-500 rounded-full"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => completeAccountCreation(searchParams.get('session_id') || '')}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry Account Setup
              </button>
              <button
                onClick={() => router.push('/auth/signup')}
                className="w-full bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <CheckCircle className="h-16 w-16 text-success-600 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to Church Music Pro!
          </h1>
          <p className="text-gray-600 mb-6">
            Your 30-day free trial has started successfully. You'll be redirected to sign in shortly.
          </p>
          <div className="bg-success-50 border border-success-200 rounded-lg p-4 mb-6">
            <p className="text-success-800 text-sm">
              ✓ Account created<br/>
              ✓ 30-day trial activated<br/>
              ✓ No payment required until {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                      <Loader2 className="h-16 w-16 text-brand-600 mx-auto mb-6 animate-spin" />
          <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
        </div>
      </div>
    </div>
  )
}

export default function TrialSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TrialSuccessContent />
    </Suspense>
  )
} 