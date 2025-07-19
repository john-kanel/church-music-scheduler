'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  Calendar, Clock, Users,
  AlertCircle, ExternalLink 
} from 'lucide-react'

interface OpenEvent {
  id: string
  name: string
  startTime: string
  endTime?: string
  location: string
  eventType: {
    id: string
    name: string
    color: string
  }
  assignments: {
    id: string
    roleName: string
    status: string
    maxMusicians?: number
  }[]
  openPositions: number
  totalPositions: number
  filledPositions: number
}

interface OpenEventsCardProps {
  onEventClick: (event: OpenEvent) => void
  onViewAllClick: (events: OpenEvent[]) => void
}

export function OpenEventsCard({ onEventClick, onViewAllClick }: OpenEventsCardProps) {
  const { data: session } = useSession()
  const [openEvents, setOpenEvents] = useState<OpenEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && session?.user?.churchId) {
      fetchOpenEvents()
    }
  }, [session, mounted])

  const fetchOpenEvents = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Default to 60 days for a good balance
      const response = await fetch(`/api/events/open?days=60&limit=50`)
      if (!response.ok) {
        throw new Error('Failed to fetch open events')
      }
      
      const data = await response.json()
      setOpenEvents(data.openEvents || [])
    } catch (err) {
      console.error('Error fetching open events:', err)
      setError('Failed to load open events')
    } finally {
      setLoading(false)
    }
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays <= 7) return `${diffDays} days`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Show top 3 urgent events (closest by date)
  const urgentEvents = openEvents.slice(0, 3)

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return null
  }

  // Only show for directors and pastors
  if (!session?.user || session.user.role === 'MUSICIAN') {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border max-h-[450px] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center mb-3">
          <AlertCircle className="h-5 w-5 text-orange-600 mr-2" />
          <h2 className="text-lg font-bold text-gray-900">Open Events</h2>
        </div>
        
        <p className="text-sm text-gray-600">
          Events with unfilled positions requiring attention
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-lg p-4">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 mx-auto text-red-400 mb-2" />
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchOpenEvents}
              className="text-xs text-blue-600 hover:text-blue-700 mt-2"
            >
              Try again
            </button>
          </div>
        ) : urgentEvents.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No open events</p>
            <p className="text-xs text-gray-400 mt-1">
              All positions are filled for the next 60 days
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {urgentEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onEventClick(event)}
                className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
                style={{ borderLeftColor: event.eventType.color, borderLeftWidth: '4px' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center mb-2">
                      <div
                        className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: event.eventType.color }}
                      />
                      <h3 className="font-medium text-gray-900 text-sm truncate flex-1 min-w-0">
                        {event.name}
                      </h3>
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-600 mb-2">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{formatEventDate(event.startTime)} at {formatEventTime(event.startTime)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-orange-600">
                        <Users className="h-3 w-3 mr-1" />
                        <span>
                          {event.filledPositions} of {event.totalPositions} positions filled
                        </span>
                      </div>
                      <ExternalLink className="h-3 w-3 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View All Button - Always show when there are events */}
      {!loading && !error && openEvents.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={() => onViewAllClick(openEvents)}
            className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
          >
            View All {openEvents.length} Open Events
          </button>
        </div>
      )}
    </div>
  )
} 