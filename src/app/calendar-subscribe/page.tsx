'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, ExternalLink } from 'lucide-react'

interface Group {
  id: string
  name: string
}

interface EventType {
  id: string
  name: string
  color: string
}

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
  const [groups, setGroups] = useState<Group[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [subscription, setSubscription] = useState<CalendarSubscription | null>(null)
  const [filterType, setFilterType] = useState<'ALL' | 'GROUPS' | 'EVENT_TYPES'>('ALL')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([])

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
        const [groupsRes, eventTypesRes, subscriptionRes] = await Promise.all([
          fetch('/api/groups'),
          fetch('/api/event-types'),
          fetch('/api/calendar-subscription')
        ])

        if (groupsRes.ok) {
          const groupsData = await groupsRes.json()
          setGroups(groupsData)
        }

        if (eventTypesRes.ok) {
          const eventTypesData = await eventTypesRes.json()
          setEventTypes(eventTypesData)
        }

        if (subscriptionRes.ok) {
          const subData = await subscriptionRes.json()
          if (subData) {
            setSubscription(subData)
            setFilterType(subData.filterType)
            setSelectedGroups(subData.groupIds)
            setSelectedEventTypes(subData.eventTypeIds)
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
      console.log('Creating calendar subscription...', {
        filterType,
        groupIds: filterType === 'GROUPS' ? selectedGroups : [],
        eventTypeIds: filterType === 'EVENT_TYPES' ? selectedEventTypes : [],
      })

      const response = await fetch('/api/calendar-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filterType,
          groupIds: filterType === 'GROUPS' ? selectedGroups : [],
          eventTypeIds: filterType === 'EVENT_TYPES' ? selectedEventTypes : [],
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

  const copyFeedUrl = () => {
    if (subscription?.feedUrl) {
      navigator.clipboard.writeText(subscription.feedUrl)
      alert('Calendar feed URL copied to clipboard!')
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
                      <button
                        onClick={() => {
                          if (subscription.feedUrl) {
                            const webcalUrl = subscription.feedUrl.startsWith('webcal://') 
                              ? subscription.feedUrl 
                              : subscription.feedUrl.replace(/^https?:\/\//, 'webcal://')
                            window.open(webcalUrl, '_blank')
                          }
                        }}
                        className="mt-1 inline-flex items-center text-green-600 hover:text-green-800 underline"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open calendar subscription
                      </button>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Options */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Choose Your Calendar Filter</h2>
            <p className="mt-1 text-sm text-gray-500">
              Select which events you want to see in your calendar feed
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* All Events Option */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="filter-all"
                  name="filter-type"
                  type="radio"
                  checked={filterType === 'ALL'}
                  onChange={() => setFilterType('ALL')}
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="filter-all" className="text-sm font-medium text-gray-700">
                  All Church Events
                </label>
                <p className="text-sm text-gray-500">
                  See every event in your church calendar, including events you're not assigned to
                </p>
              </div>
            </div>

            {/* Specific Groups Option */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="filter-groups"
                  name="filter-type"
                  type="radio"
                  checked={filterType === 'GROUPS'}
                  onChange={() => setFilterType('GROUPS')}
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                />
              </div>
              <div className="ml-3 flex-1">
                <label htmlFor="filter-groups" className="text-sm font-medium text-gray-700">
                  Specific Groups
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  See events where specific groups are assigned
                </p>
                
                {filterType === 'GROUPS' && (
                  <div className="space-y-2 bg-gray-50 rounded-md p-3">
                    {groups.length > 0 ? (
                      groups.map((group) => (
                        <label key={group.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(group.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroups([...selectedGroups, group.id])
                              } else {
                                setSelectedGroups(selectedGroups.filter(id => id !== group.id))
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{group.name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No groups available</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Specific Event Types Option */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="filter-event-types"
                  name="filter-type"
                  type="radio"
                  checked={filterType === 'EVENT_TYPES'}
                  onChange={() => setFilterType('EVENT_TYPES')}
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                />
              </div>
              <div className="ml-3 flex-1">
                <label htmlFor="filter-event-types" className="text-sm font-medium text-gray-700">
                  Specific Event Types
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  See only specific types of events (e.g., Sunday Service, Choir Practice)
                </p>
                
                {filterType === 'EVENT_TYPES' && (
                  <div className="space-y-2 bg-gray-50 rounded-md p-3">
                    {eventTypes.length > 0 ? (
                      eventTypes.map((eventType) => (
                        <label key={eventType.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedEventTypes.includes(eventType.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEventTypes([...selectedEventTypes, eventType.id])
                              } else {
                                setSelectedEventTypes(selectedEventTypes.filter(id => id !== eventType.id))
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 flex items-center">
                            <span
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: eventType.color }}
                            ></span>
                            {eventType.name}
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No event types available</p>
                    )}
                  </div>
                )}
              </div>
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
    </div>
  )
} 