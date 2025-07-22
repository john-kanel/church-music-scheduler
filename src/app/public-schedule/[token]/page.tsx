'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Users, Music, ChevronDown, ChevronUp, Check } from 'lucide-react'

interface Event {
  id: string
  name: string
  startTime: string
  endTime: string
  location: string
  description?: string
  eventType: {
    id: string
    name: string
    color: string
  }
  assignments: Array<{
    id: string
    roleName: string
    status: string
    user?: {
      id: string
      firstName: string
      lastName: string
    }
  }>
  hymns: Array<{
    id: string
    title: string
    notes?: string
    servicePart?: {
      id: string
      name: string
    }
  }>
}

interface PublicScheduleData {
  church: {
    name: string
  }
  events: Event[]
  musicians: Array<{
    id: string
    firstName: string
    lastName: string
  }>
  timeRange: {
    startDate: string
    endDate: string
  }
}

interface PinVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (pin: string) => void
  musicianName: string
  roleName: string
  eventName: string
}

function PinVerificationModal({ isOpen, onClose, onVerify, musicianName, roleName, eventName }: PinVerificationModalProps) {
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length !== 4) return
    
    setIsLoading(true)
    try {
      await onVerify(pin)
      setPin('')
      onClose()
    } catch (error) {
      console.error('PIN verification failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Verify PIN</h3>
        
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Signing up as:</p>
          <p className="font-medium">{musicianName}</p>
          <p className="text-sm text-gray-600">for {roleName} in {eventName}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter your 4-digit PIN:
          </label>
          <input
            type="text"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            className="w-full p-3 border border-gray-300 rounded-lg text-center text-xl font-mono"
            maxLength={4}
            autoFocus
          />
          
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pin.length !== 4 || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Verifying...' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PublicSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const [data, setData] = useState<PublicScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [token, setToken] = useState<string | null>(null)
  const [pinModal, setPinModal] = useState<{
    isOpen: boolean
    musicianId: string
    musicianName: string
    assignmentId: string
    roleName: string
    eventName: string
  } | null>(null)

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
      const response = await fetch(`/api/public-schedule/${token}`)
      if (!response.ok) {
        throw new Error('Failed to fetch schedule')
      }
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching public schedule:', error)
      setError('Failed to load schedule. The link may be invalid or expired.')
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
    // Show musician selection dropdown - for now just show first available musician
    if (data?.musicians && data.musicians.length > 0) {
      const firstMusician = data.musicians[0]
      setPinModal({
        isOpen: true,
        musicianId: firstMusician.id,
        musicianName: `${firstMusician.firstName} ${firstMusician.lastName}`,
        assignmentId,
        roleName,
        eventName
      })
    }
  }

  const handlePinVerification = async (pin: string) => {
    if (!pinModal) return

    try {
      const response = await fetch(`/api/public-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          assignmentId: pinModal.assignmentId,
          musicianId: pinModal.musicianId,
          pin
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sign up')
      }

      // Refresh the schedule to show the update
      await fetchPublicSchedule()
      setPinModal(null)
    } catch (error) {
      console.error('Signup failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to sign up')
    }
  }

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
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🎵 {data.church.name} - Music Ministry Schedule
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
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
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
                          {new Date(event.startTime).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
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
                            <div key={assignment.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                              <div>
                                <span className="font-medium">{assignment.roleName}</span>
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
                          ))}
                        </div>
                      </div>
                    )}

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
                              <span className="text-sm text-gray-500">
                                {index + 1}. {hymn.servicePart?.name || 'Other'}:
                              </span>
                              <span className="ml-2 font-medium">{hymn.title}</span>
                              {hymn.notes && (
                                <span className="ml-2 text-gray-600 text-sm">({hymn.notes})</span>
                              )}
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

      {/* PIN Verification Modal */}
      {pinModal && (
        <PinVerificationModal
          isOpen={pinModal.isOpen}
          onClose={() => setPinModal(null)}
          onVerify={handlePinVerification}
          musicianName={pinModal.musicianName}
          roleName={pinModal.roleName}
          eventName={pinModal.eventName}
        />
      )}
    </div>
  )
} 