'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Calendar, Download, ExternalLink } from 'lucide-react'

interface Church {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
}

interface CalendarData {
  church: Church
  feedUrl: string
  hasGoogleCalendar: boolean
  googleShareableUrl?: string
  googleSubscriptionUrl?: string
}

export default function PublicCalendarPage() {
  const params = useParams()
  const churchId = params.churchId as string
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!churchId) return

    async function fetchCalendarData() {
      try {
        const response = await fetch(`/api/public-calendar/${churchId}`)
        if (!response.ok) {
          throw new Error('Calendar not found')
        }
        const data = await response.json()
        setCalendarData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load calendar')
      } finally {
        setLoading(false)
      }
    }

    fetchCalendarData()
  }, [churchId])

  const handleSubscribe = (url: string) => {
    // Convert to webcal:// for better calendar app recognition
    const webcalUrl = url.replace(/^https?:\/\//, 'webcal://')
    window.open(webcalUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading calendar information...</p>
        </div>
      </div>
    )
  }

  if (error || !calendarData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Calendar Not Available</h1>
          <p className="text-gray-600 mb-4">
            {error || 'This music ministry calendar could not be found or is not publicly accessible.'}
          </p>
          <p className="text-sm text-gray-500">
            Contact your music director for access to the calendar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {calendarData.church.name} Music Ministry
              </h1>
              <p className="text-gray-600">Calendar Subscription</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📅 Subscribe to Our Music Ministry Calendar
          </h2>
          <p className="text-gray-600 mb-6">
            Stay up-to-date with all music ministry events, rehearsals, and services. 
            Choose your preferred method below to add this calendar to your device.
          </p>

          <div className="space-y-6">
            {/* Google Calendar Option */}
            {calendarData.hasGoogleCalendar && calendarData.googleShareableUrl && (
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-lg font-medium text-blue-900">Google Calendar (Recommended)</h3>
                    <p className="text-sm text-blue-700 mb-3">
                      View the calendar directly in your browser or Google Calendar app. No setup required!
                    </p>
                    <button
                      onClick={() => window.open(calendarData.googleShareableUrl, '_blank')}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Google Calendar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* iCal Subscription */}
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <div className="flex items-start">
                <Download className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-medium text-green-900">Calendar App Subscription</h3>
                  <p className="text-sm text-green-700 mb-3">
                    Subscribe in your calendar app (Apple Calendar, Outlook, etc.) for automatic updates.
                  </p>
                  <button
                    onClick={() => handleSubscribe(calendarData.feedUrl)}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 mr-3"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Subscribe to Calendar
                  </button>
                  
                  {/* Copy Link Button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(calendarData.feedUrl)
                      alert('📋 Calendar link copied to clipboard!')
                    }}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    📋 Copy Link
                  </button>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">📱 Setup Instructions</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">🍎 Apple Devices</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Click "Subscribe to Calendar" above</li>
                    <li>Choose "Calendar" when prompted</li>
                    <li>Confirm the subscription</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">💻 Outlook/Windows</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Copy the calendar link</li>
                    <li>In Outlook: File → Account Settings → Internet Calendars</li>
                    <li>Click "New" and paste the link</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>
            This calendar is automatically updated by {calendarData.church.name} music ministry.
            <br />
            Events include detailed information about music selections and musician assignments.
          </p>
        </div>
      </div>
    </div>
  )
}
