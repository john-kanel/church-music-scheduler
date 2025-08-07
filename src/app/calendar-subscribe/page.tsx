'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, ExternalLink, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface CalendarSubscription {
  id: string
  filterType: 'ALL' | 'GROUPS' | 'EVENT_TYPES'
  groupIds: string[]
  eventTypeIds: string[]
  isActive: boolean
  feedUrl: string | null
  subscriptionToken: string
}

function CalendarSubscribePageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const churchParam = searchParams.get('church')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subscription, setSubscription] = useState<CalendarSubscription | null>(null)
  const [showCopyToast, setShowCopyToast] = useState(false)
  const [isPublicMode, setIsPublicMode] = useState(false)
  const [publicCalendarData, setPublicCalendarData] = useState<{
    church: { id: string; name: string }
    feedUrl: string
    hasGoogleCalendar: boolean
    googleShareableUrl?: string
    googleSubscriptionUrl?: string
  } | null>(null)
  
  // Google Calendar integration state
  const [googleCalendar, setGoogleCalendar] = useState<{
    connected: boolean
    isActive?: boolean
    userEmail?: string
    connectedAt?: string
    syncedEventsCount?: number
    shareableUrl?: string
    subscriptionUrl?: string
    calendarId?: string
  } | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Determine if we're in public mode (church parameter provided but no session)
  useEffect(() => {
    if (status === 'loading') return
    
    if (churchParam && !session) {
      // Public mode - load church calendar data
      setIsPublicMode(true)
      loadPublicCalendarData(churchParam)
    } else if (!session && !churchParam) {
      // No session and no church parameter - redirect to login
      router.push('/auth/signin?callbackUrl=/calendar-subscribe')
      return
    } else if (session) {
      // Authenticated mode - load user's data
      setIsPublicMode(false)
    }
  }, [session, status, router, churchParam])

  const loadPublicCalendarData = async (churchId: string) => {
    try {
      const response = await fetch(`/api/public-calendar/${churchId}`)
      if (response.ok) {
        const data = await response.json()
        setPublicCalendarData(data)
      } else {
        console.error('Failed to load public calendar data')
      }
    } catch (error) {
      console.error('Error loading public calendar data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle URL parameters for success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const error = urlParams.get('error')
    
    if (success) {
      alert(`✅ ${success}`)
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (error) {
      alert(`❌ ${error}`)
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

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
        // Load both calendar subscription and Google Calendar status
        const [subscriptionRes, googleRes] = await Promise.all([
          fetch('/api/calendar-subscription'),
          fetch('/api/google-calendar')
        ])

        if (subscriptionRes.ok) {
          const subData = await subscriptionRes.json()
          if (subData) {
            setSubscription(subData)
          }
        }

        if (googleRes.ok) {
          const googleData = await googleRes.json()
          setGoogleCalendar(googleData)
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

  // Google Calendar functions
  const handleGoogleConnect = async () => {
    setGoogleLoading(true)
    try {
      const response = await fetch('/api/auth/google')
      if (response.ok) {
        const { authUrl } = await response.json()
        // Open Google OAuth in current tab
        window.location.href = authUrl
      } else {
        alert('Failed to start Google Calendar connection')
      }
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error)
      alert('Failed to connect to Google Calendar')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGoogleDisconnect = async () => {
    if (!confirm('This will disconnect your Google Calendar and stop syncing events. Continue?')) {
      return
    }
    
    setGoogleLoading(true)
    try {
      const response = await fetch('/api/google-calendar', { method: 'DELETE' })
      if (response.ok) {
        setGoogleCalendar({ connected: false })
        alert('Google Calendar disconnected successfully')
      } else {
        alert('Failed to disconnect Google Calendar')
      }
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error)
      alert('Failed to disconnect Google Calendar')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGoogleSync = async () => {
    setGoogleLoading(true)
    try {
      const response = await fetch('/api/google-calendar/sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncAll: true })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('🔍 SYNC DEBUG RESULT:', result)
        
        let message = `Sync completed: ${result.results.created} events created, ${result.results.updated} events updated`
        if (result.debug) {
          message += `\n\nDEBUG INFO:\n- Events found: ${result.debug.eventsFound}\n- Church ID: ${result.debug.churchId}\n- Sync All: ${result.debug.syncAll}\n- Integration ID: ${result.debug.integrationId}`
        }
        alert(message)
        
        // Reload Google Calendar status
        const googleRes = await fetch('/api/google-calendar')
        if (googleRes.ok) {
          const googleData = await googleRes.json()
          setGoogleCalendar(googleData)
        }
      } else {
        const errorData = await response.json()
        console.error('❌ SYNC ERROR:', errorData)
        alert('Failed to sync events to Google Calendar: ' + (errorData.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error syncing to Google Calendar:', error)
      alert('Failed to sync to Google Calendar')
    } finally {
      setGoogleLoading(false)
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

  // Public mode - show calendar subscription interface
  if (isPublicMode && publicCalendarData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {publicCalendarData.church.name} Music Ministry
            </h1>
            <p className="text-xl text-gray-600 mb-4">Calendar Subscription</p>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Subscribe to our music ministry calendar to stay up-to-date with all events, rehearsals, and services. 
              Choose your preferred method below to add this calendar to your device.
            </p>
          </div>

          <div className="space-y-6">
            {/* Google Calendar Option */}
            {publicCalendarData.hasGoogleCalendar && publicCalendarData.googleShareableUrl && (
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-start">
                  <svg className="h-8 w-8 text-blue-600 flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <div className="ml-4 flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Google Calendar (Recommended)</h3>
                    <p className="text-gray-600 mb-4">
                      View the calendar directly in your browser or Google Calendar app. No setup required!
                    </p>
                    <button
                      onClick={() => window.open(publicCalendarData.googleShareableUrl, '_blank')}
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <ExternalLink className="h-5 w-5 mr-2" />
                      Open Google Calendar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* iCal Subscription */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-start">
                <Calendar className="h-8 w-8 text-green-600 flex-shrink-0 mt-1" />
                <div className="ml-4 flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Calendar App Subscription</h3>
                  <p className="text-gray-600 mb-4">
                    Subscribe in your calendar app (Apple Calendar, Outlook, etc.) for automatic updates.
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        const webcalUrl = publicCalendarData.feedUrl.replace(/^https?:\/\//, 'webcal://')
                        window.open(webcalUrl, '_blank')
                      }}
                      className="inline-flex items-center px-6 py-3 bg-green-600 text-white text-lg font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <Calendar className="h-5 w-5 mr-2" />
                      Subscribe to Calendar
                    </button>
                    
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(publicCalendarData.feedUrl)
                        alert('📋 Calendar link copied to clipboard!')
                      }}
                      className="inline-flex items-center px-6 py-3 bg-gray-600 text-white text-lg font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      📋 Copy Link
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Setup Instructions */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">📱 Setup Instructions</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">🍎 Apple Devices (iPhone, iPad, Mac)</h4>
                  <ol className="list-decimal list-inside space-y-2 text-gray-600">
                    <li>Click "Subscribe to Calendar" above</li>
                    <li>Choose "Calendar" when prompted</li>
                    <li>Confirm the subscription in your Calendar app</li>
                    <li>The calendar will appear as "{publicCalendarData.church.name} Music Ministry"</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">💻 Outlook/Windows</h4>
                  <ol className="list-decimal list-inside space-y-2 text-gray-600">
                    <li>Copy the calendar link using the "Copy Link" button</li>
                    <li>In Outlook: File → Account Settings → Internet Calendars</li>
                    <li>Click "New" and paste the copied link</li>
                    <li>Give it a name and click "Add"</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-gray-500">
            <p>
              This calendar is automatically updated by {publicCalendarData.church.name} music ministry.
              <br />
              Events include detailed information about music selections and musician assignments.
            </p>
          </div>
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

        {/* Google Calendar Integration */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
              </svg>
              Google Calendar Integration
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Connect your Google Calendar for automatic event syncing (Recommended)
            </p>
          </div>

          <div className="p-6">
            {googleCalendar?.connected ? (
              <div className="space-y-4">
                {/* Connected Status */}
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-green-900">
                        Connected to Google Calendar
                      </p>
                      {googleCalendar?.userEmail && (
                        <p className="text-xs text-green-700">
                          {googleCalendar.userEmail}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {googleCalendar?.syncedEventsCount !== undefined && (
                      <p className="text-xs text-green-700">
                        {googleCalendar.syncedEventsCount} events synced
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleGoogleSync}
                    disabled={googleLoading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 inline-flex items-center"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${googleLoading ? 'animate-spin' : ''}`} />
                    {googleLoading ? 'Syncing...' : 'Sync Events Now'}
                  </button>
                  
                  <button
                    onClick={handleGoogleConnect}
                    disabled={googleLoading}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 inline-flex items-center"
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    {googleLoading ? 'Connecting...' : 'Connect Another Account'}
                  </button>
                  
                  <button
                    onClick={handleGoogleDisconnect}
                    disabled={googleLoading}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                </div>

                {/* Public Calendar Page for Sharing */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-900 mb-3">📤 Share Calendar Page with Team Members</h4>
                  <p className="text-sm text-green-800 mb-3">
                    Send this link to musicians and team members. They'll see a beautiful page with all subscription options (Google Calendar, Apple Calendar, etc.) - no account needed:
                  </p>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={`${window.location.origin}/calendar-subscribe?church=${(session?.user as any)?.churchId}`}
                      readOnly
                      className="flex-1 text-xs px-3 py-2 border border-green-300 rounded bg-white text-gray-700"
                    />
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/calendar-subscribe?church=${(session?.user as any)?.churchId}`
                        navigator.clipboard.writeText(url)
                        alert('📋 Calendar page link copied to clipboard!')
                      }}
                      className="px-3 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/calendar-subscribe?church=${(session?.user as any)?.churchId}`
                        window.open(url, '_blank')
                      }}
                      className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Preview
                    </button>
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-green-700">
                    <div>
                      💡 <strong>What they'll see:</strong> A beautiful page showing your church name with buttons for Google Calendar, Apple Calendar, Outlook, and step-by-step setup instructions for all devices.
                    </div>
                    <div className="bg-green-100 border border-green-300 rounded px-3 py-2">
                      <strong>📋 Perfect for:</strong> Email signatures, church bulletins, group texts, social media posts - anywhere you need to share your calendar!
                    </div>
                  </div>
                </div>

                {/* Sharing Links - Temporarily disabled */}
                {false && googleCalendar?.shareableUrl && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-green-900 mb-3">📤 Share Calendar with Others</h4>
                    <p className="text-sm text-green-800 mb-3">
                      Send these links to musicians and team members so they can access the calendar:
                    </p>
                    
                    <div className="space-y-3">
                      {/* Google Calendar View Link */}
                      <div>
                        <label className="block text-xs font-medium text-green-800 mb-1">
                          🌐 View in Google Calendar (Works in any browser)
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={googleCalendar?.shareableUrl || ''}
                            readOnly
                            className="flex-1 text-xs px-3 py-2 border border-green-300 rounded bg-white text-gray-700"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(googleCalendar?.shareableUrl || '')
                              alert('📋 Link copied to clipboard!')
                            }}
                            className="px-3 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => window.open(googleCalendar?.shareableUrl || '', '_blank')}
                            className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            Open
                          </button>
                        </div>
                      </div>

                      {/* Subscription Link */}
                      {googleCalendar?.subscriptionUrl && (
                        <div>
                          <label className="block text-xs font-medium text-green-800 mb-1">
                            📅 Subscribe in Calendar Apps (Apple Calendar, Outlook, etc.)
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={googleCalendar?.subscriptionUrl || ''}
                              readOnly
                              className="flex-1 text-xs px-3 py-2 border border-green-300 rounded bg-white text-gray-700"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(googleCalendar?.subscriptionUrl || '')
                                alert('📋 Subscription link copied to clipboard!')
                              }}
                              className="px-3 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-xs text-green-700">
                      💡 <strong>Tip:</strong> Anyone with these links can view the calendar - no Google account needed for the web view!
                    </div>
                  </div>
                )}

                {/* Benefits */}
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Benefits of Google Calendar Integration:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Events appear instantly in your Google Calendar</li>
                    <li>• Changes sync automatically - no need to re-subscribe</li>
                    <li>• Works on all devices connected to your Google account</li>
                    <li>• No calendar subscription or caching issues</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Not Connected Status */}
                <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-yellow-900">
                        Google Calendar Not Connected
                      </p>
                      <p className="text-xs text-yellow-700">
                        Connect for the best calendar experience
                      </p>
                    </div>
                  </div>
                </div>

                {/* Connect Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleGoogleConnect}
                    disabled={googleLoading}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 inline-flex items-center text-lg"
                  >
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    {googleLoading ? 'Connecting...' : 'Connect Google Calendar'}
                  </button>
                </div>

                {/* Benefits */}
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-900 mb-2">Why Connect Google Calendar?</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• <strong>Instant Updates:</strong> Events appear immediately, no waiting for sync</li>
                    <li>• <strong>No Subscription Issues:</strong> Bypasses all calendar feed problems</li>
                    <li>• <strong>Works Everywhere:</strong> Phone, computer, web - all automatically synced</li>
                    <li>• <strong>Set & Forget:</strong> Once connected, everything works automatically</li>
                  </ul>
                </div>
              </div>
            )}
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

export default function CalendarSubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading calendar subscription...</p>
        </div>
      </div>
    }>
      <CalendarSubscribePageContent />
    </Suspense>
  )
} 