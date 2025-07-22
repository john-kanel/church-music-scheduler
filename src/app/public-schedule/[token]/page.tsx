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

interface MusicianSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMusician: (musicianId: string, musicianName: string) => void
  musicians: Array<{
    id: string
    firstName: string
    lastName: string
  }>
  roleName: string
  eventName: string
}

interface PinVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (pin: string) => void
  musicianName: string
  roleName: string
  eventName: string
}

function MusicianSelectionModal({ isOpen, onClose, onSelectMusician, musicians, roleName, eventName }: MusicianSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMusicianId, setSelectedMusicianId] = useState('')

  const filteredMusicians = musicians.filter(musician => 
    `${musician.firstName} ${musician.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectMusician = () => {
    const selectedMusician = musicians.find(m => m.id === selectedMusicianId)
    if (selectedMusician) {
      onSelectMusician(selectedMusician.id, `${selectedMusician.firstName} ${selectedMusician.lastName}`)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md border">
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Select Musician</h3>
        
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium text-gray-800 mb-1">Signing up for:</p>
          <p className="font-bold text-gray-900">{roleName}</p>
          <p className="text-sm font-medium text-gray-700">in {eventName}</p>
        </div>

        {/* Search Input */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Search for your name:
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type your name..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        {/* Musicians List */}
        <div className="mb-6 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
          {filteredMusicians.length > 0 ? (
            filteredMusicians.map((musician) => (
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
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              No musicians found matching "{searchTerm}"
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelectMusician}
            disabled={!selectedMusicianId}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
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
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md border">
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Verify PIN</h3>
        
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium text-gray-800 mb-2">Signing up as:</p>
          <p className="font-bold text-gray-900 text-lg">{musicianName}</p>
          <p className="text-sm font-medium text-gray-700">for {roleName} in {eventName}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Enter your 4-digit PIN:
          </label>
          <input
            type="text"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            className="w-full p-4 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={4}
            autoFocus
          />
          
          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pin.length !== 4 || isLoading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
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
  const [musicianSelectionModal, setMusicianSelectionModal] = useState<{
    isOpen: boolean
    assignmentId: string
    roleName: string
    eventName: string
  } | null>(null)
  
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
    // Show musician selection modal first
    setMusicianSelectionModal({
      isOpen: true,
      assignmentId,
      roleName,
      eventName
    })
  }
  
  const handleMusicianSelected = (musicianId: string, musicianName: string) => {
    if (!musicianSelectionModal) return
    
    // Close musician selection modal and open PIN verification modal
    setMusicianSelectionModal(null)
    setPinModal({
      isOpen: true,
      musicianId,
      musicianName,
      assignmentId: musicianSelectionModal.assignmentId,
      roleName: musicianSelectionModal.roleName,
      eventName: musicianSelectionModal.eventName
    })
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

      {/* Musician Selection Modal */}
      {musicianSelectionModal && data?.musicians && (
        <MusicianSelectionModal
          isOpen={musicianSelectionModal.isOpen}
          onClose={() => setMusicianSelectionModal(null)}
          onSelectMusician={handleMusicianSelected}
          musicians={data.musicians}
          roleName={musicianSelectionModal.roleName}
          eventName={musicianSelectionModal.eventName}
        />
      )}

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