'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, ExternalLink } from 'lucide-react'

interface CalendarSubscription {
  id: string
  filterType: 'ALL' | 'GROUPS' | 'EVENT_TYPES'
  groupIds: string[]
  eventTypeIds: string[]
  isActive: boolean
  feedUrl: string | null
  subscriptionToken: string
}

export default function CalendarSubscribePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subscription, setSubscription] = useState<CalendarSubscription | null>(null)
  const [showCopyToast, setShowCopyToast] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin?callbackUrl=/calendar-subscribe')
      return
    }
  }, [session, status, router])

  // Load initial data
  useEffect(() => {
    if (!session) return
    
    console.log('Loading calendar subscription data for user:', {
      userId: session.user?.id,
      email: session.user?.email,
      churchId: (session.user as any)?.churchId
    })
    
    const loadData = async () => {
      try {
        const subscriptionRes = await fetch('/api/calendar-subscription')

        if (subscriptionRes.ok) {
          const subData = await subscriptionRes.json()
          if (subData) {
            setSubscription(subData)
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [session])

  const handleSave = async () => {
    if (!session) return
    
    setSaving(true)
    try {
      console.log('Creating calendar subscription for all events...')

      const response = await fetch('/api/calendar-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterType: 'ALL',
          groupIds: [],
          eventTypeIds: [],
        }),
      })

      console.log('Response status:', response.status, response.statusText)

      if (response.ok) {
        const newSubscription = await response.json()
        setSubscription(newSubscription)
        
        // Auto-open the calendar feed URL with webcal:// protocol
        if (newSubscription?.feedUrl) {
          try {
            // Ensure we use webcal:// protocol for subscription recognition
            let webcalUrl = newSubscription.feedUrl
            
            // Convert HTTP/HTTPS to webcal://
            if (webcalUrl.startsWith('http://') || webcalUrl.startsWith('https://')) {
              webcalUrl = webcalUrl.replace(/^https?:\/\//, 'webcal://')
            } else if (!webcalUrl.startsWith('webcal://')) {
              // If it doesn't start with a protocol, assume it needs webcal://
              webcalUrl = `webcal://${webcalUrl}`
            }
            
            console.log('Opening calendar subscription:', webcalUrl)
            
            // Try to open the calendar app
            const opened = window.open(webcalUrl, '_blank')
            
            if (opened) {
              alert('🎉 Calendar subscription opened! Your calendar app should prompt you to create a new "[Church Name] Music Ministry" calendar.')
            } else {
              // Fallback if popup was blocked
              alert('Calendar subscription created! Please manually open this URL in your calendar app:\n\n' + webcalUrl)
            }
          } catch (openError) {
            console.error('Error opening calendar URL:', openError)
            alert('Calendar subscription saved! Please manually add this URL to your calendar app:\n\n' + newSubscription.feedUrl)
          }
        } else {
          console.error('No feedUrl in response:', newSubscription)
          alert('Calendar subscription saved, but no feed URL was generated. Please try refreshing the page.')
        }
      } else {
        // Handle non-OK responses more safely
        let errorMessage = 'Failed to save subscription'
        try {
          const errorText = await response.text()
          try {
            const errorData = JSON.parse(errorText)
            errorMessage = errorData.error || errorMessage
          } catch {
            // If not valid JSON, use the text response or status
            errorMessage = errorText || response.statusText || `Server error (${response.status})`
          }
        } catch {
          // If can't read response at all, use status info
          errorMessage = response.statusText || `Server error (${response.status})`
        }
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error saving subscription:', error)
      let message = 'Unknown error occurred'
      
      try {
        if (error instanceof Error) {
          message = error.message
        } else if (typeof error === 'string') {
          message = error
        } else if (error && typeof error === 'object') {
          message = JSON.stringify(error)
        }
              } catch (stringifyError) {
          console.error('Error processing error message:', stringifyError)
          message = 'Failed to process error details'
        }
      
      // Provide specific guidance for authentication errors
      if (message.includes('session is no longer valid') || message.includes('Unauthorized')) {
        alert(`Authentication Error: ${message}\n\n` +
              `Please sign out and sign in again to continue.`)
      } else if (message.includes('Church not found') || message.includes('User not found')) {
        alert(`Account Error: ${message}\n\n` +
              `This may indicate a setup issue. Please contact support if the problem persists.`)
      } else {
        alert(`Error saving subscription: ${message}\n\nPlease try again.`)
      }
    } finally {
      setSaving(false)
    }
  }

  const copyFeedUrl = async () => {
    if (subscription?.feedUrl) {
      try {
        // Convert to webcal:// URL for better compatibility
        const webcalUrl = subscription.feedUrl.startsWith('webcal://')
          ? subscription.feedUrl
          : subscription.feedUrl.replace(/^https?:\/\//, 'webcal://')
        
        await navigator.clipboard.writeText(webcalUrl)
        setShowCopyToast(true)
        setTimeout(() => setShowCopyToast(false), 2000) // Hide after 2 seconds
      } catch (error) {
        console.error('Error copying to clipboard:', error)
        alert('Failed to copy URL. Please try again.')
      }
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading calendar subscription...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-6">
            <Link 
              href="/calendar"
              className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Calendar
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900">Subscribe to Live Calendar Feed</h1>
          <p className="mt-2 text-gray-600">
            Choose your filter preferences and automatically open your calendar app to subscribe to a live feed.
            Changes sync immediately and appear automatically in your calendar as "[Church Name] Music Ministry".
          </p>
        </div>

        {/* Current Subscription Status */}
        {subscription && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Live calendar feed is active
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Filter: {subscription.filterType.replace('_', ' ').toLowerCase()}</p>
                                      {subscription.feedUrl && (
                      <div className="mt-1 flex items-center gap-4">
                        <button
                          onClick={() => {
                            if (subscription.feedUrl) {
                              const webcalUrl = subscription.feedUrl.startsWith('webcal://') 
                                ? subscription.feedUrl 
                                : subscription.feedUrl.replace(/^https?:\/\//, 'webcal://')
                              window.open(webcalUrl, '_blank')
                            }
                          }}
                          className="inline-flex items-center text-green-600 hover:text-green-800 underline"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open calendar subscription
                        </button>
                        <button
                          onClick={copyFeedUrl}
                          className="inline-flex items-center text-green-600 hover:text-green-800"
                          title="Copy subscription URL"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          <span className="ml-1">Copy URL</span>
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('This will generate a new subscription URL. You will need to update your Google Calendar subscription with the new URL. Continue?')) {
                              setSaving(true)
                              try {
                                const response = await fetch('/api/calendar-subscription', { method: 'PATCH' })
                                if (response.ok) {
                                  const newSubscription = await response.json()
                                  setSubscription(newSubscription)
                                  alert('New subscription URL generated! Please unsubscribe from the old calendar in Google Calendar and subscribe to the new URL.')
                                } else {
                                  alert('Failed to regenerate URL')
                                }
                              } catch (error) {
                                console.error('Error regenerating URL:', error)
                                alert('Failed to regenerate URL')
                              } finally {
                                setSaving(false)
                              }
                            }
                          }}
                          className="inline-flex items-center text-orange-600 hover:text-orange-800"
                          title="Generate new URL to fix Google Calendar cache issues"
                          disabled={saving}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span className="ml-1">Regenerate URL</span>
                        </button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Information */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Complete Church Calendar</h2>
            <p className="mt-1 text-sm text-gray-500">
              Your subscription will include all church events and music ministry activities
            </p>
          </div>

          <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">What's Included:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• All worship services and special events</li>
                <li>• Choir practices and rehearsals</li>
                <li>• Music ministry meetings and activities</li>
                <li>• Your personal assignments and responsibilities</li>
              </ul>
            </div>
          </div>

          {/* Save Button */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Your calendar app will prompt you to create the live music ministry calendar
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Open in Calendar App'}
              </button>
            </div>
          </div>
        </div>

        {/* Manual URL Options */}
        {subscription?.feedUrl && (
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Manual Calendar Subscription</h3>
            <p className="text-sm text-gray-600 mb-4">
              If the automatic method doesn't work, you can manually add these URLs to your calendar app:
            </p>
            
            <div className="space-y-4">
              {/* Webcal URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webcal URL (Recommended for most calendar apps):
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={subscription.feedUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(subscription.feedUrl || '')
                      setShowCopyToast(true)
                      setTimeout(() => setShowCopyToast(false), 2000)
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* HTTPS URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTTPS URL (Alternative for some Google Calendar users):
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={subscription.feedUrl?.replace('webcal://', 'https://') || ''}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      const httpsUrl = subscription.feedUrl?.replace('webcal://', 'https://') || ''
                      navigator.clipboard.writeText(httpsUrl)
                      setShowCopyToast(true)
                      setTimeout(() => setShowCopyToast(false), 2000)
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              <strong>Google Calendar:</strong> Settings → Add calendar → From URL → paste either URL above<br/>
              <strong>Apple Calendar:</strong> File → New Calendar Subscription → paste webcal:// URL<br/>
              <strong>Outlook:</strong> Add calendar → Subscribe from web → paste either URL
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-4">How the Live Feed Works</h3>
          <div className="space-y-3 text-sm text-blue-800">
            <div>
              <strong>1. Calendar Creation:</strong> Clicking "Open in Calendar App" prompts your calendar app to create a new calendar called "[Church Name] Music Ministry"
            </div>
            <div>
              <strong>2. Live Updates:</strong> Changes sync immediately - new events, assignments, and updates appear in real-time in your calendar
            </div>
            <div>
              <strong>3. No Maintenance:</strong> Future changes appear automatically - you never need to re-add the calendar or visit this page again
            </div>
          </div>
          <p className="mt-4 text-xs text-blue-600">
            The calendar will show a subscription icon (📡) indicating it's a live feed that updates automatically.
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {showCopyToast && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Calendar URL copied to clipboard!
        </div>
      )}
    </div>
  )
} 