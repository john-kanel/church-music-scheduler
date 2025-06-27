'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, Calendar, Clock, MapPin, Users, AlertCircle, 
  Search, Filter, ChevronDown 
} from 'lucide-react'
import Link from 'next/link'
import { MusicianSignupModal } from '../../components/events/musician-signup-modal'

interface Event {
  id: string
  name: string
  description?: string
  location?: string
  startTime: string
  endTime?: string
  eventType: {
    id: string
    name: string
    color: string
  }
  assignments: Array<{
    id: string
    roleName: string
    user?: {
      id: string
      firstName: string
      lastName: string
      email: string
    }
  }>
}

export default function AvailableEventsPage() {
  const { data: session } = useSession()
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEventType, setSelectedEventType] = useState<string>('all')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [eventTypes, setEventTypes] = useState<Array<{id: string, name: string, color: string}>>([])

  // Fetch events
  useEffect(() => {
    if (session?.user?.churchId) {
      fetchEvents()
    }
  }, [session])

  // Filter events when search term or event type changes
  useEffect(() => {
    let filtered = events.filter(event => {
      // Only show events with open assignments
      const hasOpenAssignments = event.assignments.some(assignment => !assignment.user)
      if (!hasOpenAssignments) return false

      // Filter by search term
      const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchTerm.toLowerCase())

      // Filter by event type
      const matchesEventType = selectedEventType === 'all' || event.eventType.id === selectedEventType

      return matchesSearch && matchesEventType
    })

    // Sort by date
    filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    setFilteredEvents(filtered)
  }, [events, searchTerm, selectedEventType])

  const fetchEvents = async () => {
    try {
      // Fetch events for the next 3 months
      const startDate = new Date().toISOString()
      const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      
      const response = await fetch(`/api/events?startDate=${startDate}&endDate=${endDate}`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
        
        // Extract unique event types
        const types = data.events.reduce((acc: Array<{id: string, name: string, color: string}>, event: Event) => {
          if (!acc.find(t => t.id === event.eventType.id)) {
            acc.push(event.eventType)
          }
          return acc
        }, [])
        setEventTypes(types)
      } else {
        console.error('Failed to fetch events')
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event)
    setShowSignupModal(true)
  }

  const handleSignupSuccess = () => {
    fetchEvents() // Refresh events list
    setShowSignupModal(false)
    setSelectedEvent(null)
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
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

  const getVacantRoles = (assignments: Event['assignments']) => {
    return assignments.filter(assignment => !assignment.user).map(assignment => assignment.roleName)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view available events</h1>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link 
                href="/dashboard" 
                className="flex items-center text-gray-600 hover:text-gray-900 mr-6"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </Link>
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-orange-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Available Opportunities</h1>
                  <p className="text-gray-600">Events looking for musicians</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Event Type Filter */}
            <div className="relative">
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Event Types</option>
                {eventTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Available Events</h3>
            <p className="text-gray-600">
              {events.length === 0 
                ? "There are no upcoming events in the next 3 months."
                : "All upcoming events are fully staffed or don't match your search criteria."
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const vacantRoles = getVacantRoles(event.assignments)
              return (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer p-6"
                >
                  {/* Event Type Indicator */}
                  <div className="flex items-center mb-4">
                    <div
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: event.eventType.color }}
                    />
                    <span className="text-sm text-gray-600">{event.eventType.name}</span>
                  </div>

                  {/* Event Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{event.name}</h3>

                  {/* Date and Time */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span className="text-sm">{formatEventDate(event.startTime)}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                      <span className="text-sm">
                        {formatEventTime(event.startTime)}
                        {event.endTime && ` - ${formatEventTime(event.endTime)}`}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center text-gray-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span className="text-sm">{event.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Vacant Roles */}
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                    <div className="flex items-center mb-2">
                      <Users className="h-4 w-4 text-orange-600 mr-2" />
                      <span className="text-sm font-medium text-orange-800">
                        {vacantRoles.length} Position{vacantRoles.length !== 1 ? 's' : ''} Needed
                      </span>
                    </div>
                    <div className="text-sm text-orange-700">
                      {vacantRoles.join(', ')}
                    </div>
                  </div>

                  {/* Description Preview */}
                  {event.description && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Musician Signup Modal */}
      <MusicianSignupModal
        isOpen={showSignupModal}
        onClose={() => {
          setShowSignupModal(false)
          setSelectedEvent(null)
        }}
        event={selectedEvent}
        onSignupSuccess={handleSignupSuccess}
      />
    </div>
  )
} 