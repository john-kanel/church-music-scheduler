'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Users, Music, Download, FileText, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { formatEventTimeForDisplay, formatEventTimeCompact } from '@/lib/timezone-utils'

interface PublicScheduleData {
  church: {
    name: string
  }
  timeRange: {
    startDate: string
    endDate: string
  }
  name?: string | null
  filter?: {
    filterType: 'ALL' | 'GROUPS' | 'EVENT_TYPES' | 'OPEN_POSITIONS'
    groupIds: string[]
    eventTypeIds: string[]
  }
  events: Array<{
    id: string
    name: string
    description?: string
    startTime: string
    location: string
    eventType: {
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
      }
      group?: {
        id: string
        name: string
      }
    }>
    hymns: Array<{
      id: string
      title: string
      notes?: string
      servicePart?: {
        name: string
      }
    }>
    documents: Array<{
      id: string
      originalFilename: string
      url: string
    }>
  }>
  musicians: Array<{
    id: string
    firstName: string
    lastName: string
  }>
}

export default function PublicSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const [data, setData] = useState<PublicScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [token, setToken] = useState<string | null>(null)
  const [expandedSignup, setExpandedSignup] = useState<string | null>(null)
  const [selectedMusicianId, setSelectedMusicianId] = useState('')
  const [pinValue, setPinValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params
      setToken(resolvedParams.token)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (token) {
      fetchPublicSchedule()
    }
  }, [token])

  const fetchPublicSchedule = async () => {
    if (!token) return

    try {
      setLoading(true)
      const response = await fetch(`/api/public-schedule/${token}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch schedule')
      }

      const scheduleData = await response.json()
      setData(scheduleData)
      setError(null)
    } catch (error) {
      console.error('Error fetching public schedule:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch schedule')
    } finally {
      setLoading(false)
    }
  }

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(eventId)) {
        newExpanded.delete(eventId)
      } else {
        newExpanded.add(eventId)
      }
      return newExpanded
    })
  }

  const handleSignUp = (assignmentId: string, roleName: string, eventName: string) => {
    // Toggle the inline signup expansion
    if (expandedSignup === assignmentId) {
      setExpandedSignup(null)
    } else {
      setExpandedSignup(assignmentId)
      setSelectedMusicianId('')
      setPinValue('')
      setSearchTerm('')
    }
  }
  
  const handleSubmitSignup = async (assignmentId: string) => {
    if (!selectedMusicianId || pinValue.length !== 4 || !token) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/public-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          assignmentId: assignmentId,
          musicianId: selectedMusicianId,
          pin: pinValue
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sign up')
      }

      // Refresh the schedule to show the update
      await fetchPublicSchedule()
      setExpandedSignup(null)
      setSelectedMusicianId('')
      setPinValue('')
      setSearchTerm('')
    } catch (error) {
      console.error('Signup failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to sign up')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter musicians based on search term
  const filteredMusicians = data?.musicians.filter(musician => 
    `${musician.firstName} ${musician.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Failed to load schedule'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Events JSON-LD for SEO */}
      {data && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: `${data.church.name} Music Ministry Events`,
              itemListElement: data.events.map((ev, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                item: {
                  '@type': 'Event',
                  name: ev.name,
                  description: ev.description || 'Music ministry event',
                  startDate: new Date(ev.startTime).toISOString(),
                  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                  eventStatus: 'https://schema.org/EventScheduled',
                  location: {
                    '@type': 'Place',
                    name: ev.location || data.church.name,
                    address: ev.location || data.church.name,
                  },
                  organizer: {
                    '@type': 'Organization',
                    name: data.church.name,
                  },
                },
              })),
            }),
          }}
        />
      )}
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🎵 {data.church.name} - Music Ministry Schedule{data.name ? ` (${data.name})` : ''}
          </h1>
          <p className="text-gray-600">
            {new Date(data.timeRange.startDate).toLocaleDateString()} - {new Date(data.timeRange.endDate).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Events List */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {data.events.map((event) => {
            const isExpanded = expandedEvents.has(event.id)
            const availableRoles = event.assignments.filter(a => !a.user)
            
            return (
              <div key={event.id} className="bg-white rounded-lg shadow-sm border">
                {/* Event Card Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleEventExpansion(event.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: event.eventType.color }}
                        ></div>
                        <h3 className="text-lg font-semibold text-gray-900">{event.name}</h3>
                        {availableRoles.length > 0 && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-lg">
                            {availableRoles.length} opening{availableRoles.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(event.startTime).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatEventTimeCompact(event.startTime)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {event.location}
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Event Details */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    {/* Description */}
                    {event.description && (
                      <div className="mb-4">
                        <p className="text-gray-700">{event.description}</p>
                      </div>
                    )}

                    {/* Musicians Needed */}
                    {event.assignments.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Musicians
                        </h4>
                        <div className="space-y-2">
                          {event.assignments.map((assignment) => (
                            <div key={assignment.id}>
                              <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                                <div>
                                  <span className="font-medium text-gray-900">{assignment.roleName}</span>
                                  {assignment.user && (
                                    <span className="ml-2 text-green-600 flex items-center gap-1">
                                      <Check className="w-4 h-4" />
                                      {assignment.user.firstName} {assignment.user.lastName}
                                    </span>
                                  )}
                                </div>
                                
                                {!assignment.user && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSignUp(assignment.id, assignment.roleName, event.name)
                                    }}
                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                  >
                                    Sign Up
                                  </button>
                                )}
                              </div>
                              
                              {/* Inline Signup Expansion */}
                              {!assignment.user && expandedSignup === assignment.id && (
                                <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                                        Select Your Name:
                                      </label>
                                      <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Type your name to search..."
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                                      />
                                      {filteredMusicians.length > 0 ? (
                                        <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                                          {filteredMusicians.map((musician) => (
                                            <button
                                              key={musician.id}
                                              onClick={() => setSelectedMusicianId(musician.id)}
                                              className={`w-full text-left p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                                                selectedMusicianId === musician.id ? 'bg-blue-50 border-blue-200' : ''
                                              }`}
                                            >
                                              <span className="font-medium text-gray-900">
                                                {musician.firstName} {musician.lastName}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      ) : searchTerm ? (
                                        <div className="p-4 text-center text-gray-500 border border-gray-200 rounded-lg">
                                          No musicians found matching "{searchTerm}"
                                        </div>
                                      ) : null}
                                    </div>

                                    {selectedMusicianId && (
                                      <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                                          Enter Your 4-Digit PIN:
                                        </label>
                                        <input
                                          type="text"
                                          value={pinValue}
                                          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                          placeholder="0000"
                                          className="w-full p-3 border border-gray-300 rounded-lg text-center text-xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                          maxLength={4}
                                        />
                                      </div>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                      <button
                                        onClick={() => setExpandedSignup(null)}
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleSubmitSignup(assignment.id)}
                                        disabled={!selectedMusicianId || pinValue.length !== 4 || isSubmitting}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                                      >
                                        {isSubmitting ? 'Signing Up...' : 'Sign Up'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Groups */}
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Groups
                      </h4>
                      <div className="bg-white p-3 rounded-lg">
                        {(() => {
                          const assignedGroups = event.assignments
                            .filter(assignment => assignment.group)
                            .map(assignment => assignment.group)
                            .filter((group, index, self) => 
                              group && self.findIndex(g => g?.id === group.id) === index
                            ) // Remove duplicates
                          
                          if (assignedGroups.length > 0) {
                            return assignedGroups.map((group, index) => (
                              <div key={group!.id} className="text-gray-900">
                                {index + 1}. {group!.name}
                              </div>
                            ))
                          } else {
                            return (
                              <div className="text-gray-500 italic">
                                No groups assigned
                              </div>
                            )
                          }
                        })()}
                      </div>
                    </div>

                    {/* Music/Hymns */}
                    {event.hymns.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <Music className="w-4 h-4" />
                          Music for this Service
                        </h4>
                        <div className="bg-white p-3 rounded-lg">
                          {event.hymns.map((hymn, index) => (
                            <div key={hymn.id} className="mb-2 last:mb-0">
                              <span className="text-sm text-gray-700">
                                {index + 1}. {hymn.servicePart?.name || 'Other'}:
                              </span>
                              <span className="ml-2 font-medium text-gray-900">{hymn.title}</span>
                              {hymn.notes && (
                                <span className="ml-2 text-gray-600 text-sm">({hymn.notes})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Music Files/Documents */}
                    {event.documents && event.documents.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Music Files
                        </h4>
                        <div className="bg-white p-3 rounded-lg">
                          {event.documents.map((doc, index) => (
                            <div key={doc.id} className="mb-2 last:mb-0">
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm"
                              >
                                <Download className="w-4 h-4" />
                                {doc.originalFilename}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {data.events.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No events scheduled for this time period.</p>
          </div>
        )}
      </div>
    </div>
  )
} 