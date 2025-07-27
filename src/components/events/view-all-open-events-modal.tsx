'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, MapPin, Users, Music, UserPlus, Search, Filter, ChevronDown, Check, Loader2, Zap, AlertCircle, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { formatEventTimeForDisplay } from '@/lib/timezone-utils'

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

interface AssignmentProposal {
  assignmentId: string
  eventId: string
  eventName: string
  eventStartTime: string
  roleName: string
  musicianId: string | null
  musicianName: string | null
  musicianEmail: string | null
  reason?: string
}

interface ViewAllOpenEventsModalProps {
  isOpen: boolean
  onClose: () => void
  events: OpenEvent[]
  onEventClick: (event: OpenEvent) => void
}

export function ViewAllOpenEventsModal({ 
  isOpen, 
  onClose, 
  events, 
  onEventClick 
}: ViewAllOpenEventsModalProps) {
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [showPreview, setShowPreview] = useState(false)
  const [assignments, setAssignments] = useState<AssignmentProposal[]>([])
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedEvents(new Set())
      setShowPreview(false)
      setAssignments([])
      setError('')
      setSuccess('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays <= 7) return `${diffDays} days`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: diffDays > 365 ? 'numeric' : undefined
    })
  }

  const handleEventToggle = (eventId: string) => {
    const newSelected = new Set(selectedEvents)
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId)
    } else {
      newSelected.add(eventId)
    }
    setSelectedEvents(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedEvents.size === events.length) {
      setSelectedEvents(new Set())
    } else {
      setSelectedEvents(new Set(events.map(e => e.id)))
    }
  }

  const handleAutoAssign = async () => {
    if (selectedEvents.size === 0) return

    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/events/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventIds: Array.from(selectedEvents),
          preview: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate assignment preview')
      }

      const data = await response.json()
      setAssignments(data.proposals || [])
      setShowPreview(true)
    } catch (err) {
      console.error('Error generating assignments:', err)
      setError('Failed to generate assignment preview')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmAssignments = async () => {
    try {
      setConfirming(true)
      setError('')
      
      const response = await fetch('/api/events/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventIds: Array.from(selectedEvents),
          preview: false
        })
      })

      if (!response.ok) {
        throw new Error('Failed to confirm assignments')
      }

      const data = await response.json()
      setSuccess(`Successfully assigned ${data.successfulAssignments?.length || 0} musicians!`)
      setShowPreview(false)
      setSelectedEvents(new Set())
      
      // Close modal after a delay
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      console.error('Error confirming assignments:', err)
      setError('Failed to confirm assignments')
    } finally {
      setConfirming(false)
    }
  }

  const handleBackToSelection = () => {
    setShowPreview(false)
    setAssignments([])
  }

  const selectedEventsData = events.filter(e => selectedEvents.has(e.id))
  const successfulAssignments = assignments.filter(a => a.musicianId)
  const failedAssignments = assignments.filter(a => !a.musicianId)

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{backgroundColor: '#E6F0FA'}}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {showPreview ? 'Assignment Preview' : 'All Open Events'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {showPreview 
                ? `Review proposed assignments for ${selectedEvents.size} event(s)`
                : `${events.length} events with unfilled positions`
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {!showPreview ? (
            // Event Selection View
            <div className="h-full flex flex-col">
              {/* Selection Controls */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                    >
                      <div className={`w-4 h-4 rounded border mr-2 flex items-center justify-center ${
                        selectedEvents.size === events.length 
                          ? 'bg-blue-600 border-blue-600' 
                          : selectedEvents.size > 0
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedEvents.size === events.length ? (
                          <Check className="h-3 w-3 text-white" />
                        ) : selectedEvents.size > 0 ? (
                          <div className="w-2 h-2 bg-white rounded-sm" />
                        ) : null}
                      </div>
                      {selectedEvents.size === events.length ? 'Deselect All' : 'Select All'}
                    </button>
                    
                    {selectedEvents.size > 0 && (
                      <span className="text-sm text-gray-500">
                        {selectedEvents.size} event{selectedEvents.size > 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>

                  {selectedEvents.size > 0 && (
                    <button
                      onClick={handleAutoAssign}
                      disabled={loading}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Auto Assign Selected
                    </button>
                  )}
                </div>
              </div>

              {/* Events List */}
              <div className="flex-1 overflow-y-auto p-4 max-h-[60vh]">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        selectedEvents.has(event.id)
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={{ borderLeftColor: event.eventType.color, borderLeftWidth: '4px' }}
                    >
                      <div className="flex items-start">
                        {/* Checkbox */}
                        <button
                          onClick={() => handleEventToggle(event.id)}
                          className="mt-1 mr-4"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            selectedEvents.has(event.id) 
                              ? 'bg-blue-600 border-blue-600' 
                              : 'border-gray-300 hover:border-gray-400'
                          }`}>
                            {selectedEvents.has(event.id) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </button>

                        {/* Event Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center min-w-0 flex-1">
                              <div
                                className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                                style={{ backgroundColor: event.eventType.color }}
                              />
                              <h3 className="font-medium text-gray-900 truncate">
                                {event.name}
                              </h3>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onEventClick(event)
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="View event details"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-2">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>{formatEventDate(event.startTime)} at {formatEventTimeForDisplay(event.startTime)}</span>
                            {event.location && (
                              <>
                                <span className="mx-2">•</span>
                                <span>{event.location}</span>
                              </>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-sm text-orange-600">
                              <Users className="h-4 w-4 mr-1" />
                              <span>
                                {event.filledPositions} of {event.totalPositions} positions filled
                              </span>
                            </div>
                            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                              {event.openPositions} open
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Assignment Preview View
            <div className="h-full flex flex-col">
              {/* Preview Summary */}
              <div className="p-4 border-b bg-gray-50">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{assignments.length}</div>
                    <div className="text-sm text-gray-600">Total Assignments</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{successfulAssignments.length}</div>
                    <div className="text-sm text-gray-600">Successful</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{failedAssignments.length}</div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                </div>
              </div>

              {/* Assignment Details */}
              <div className="flex-1 overflow-y-auto p-4">
                {success && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm text-green-700">{success}</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  </div>
                )}

                {/* Group assignments by event */}
                {selectedEventsData.map((event) => {
                  const eventAssignments = assignments.filter(a => a.eventId === event.id)
                  if (eventAssignments.length === 0) return null

                  return (
                    <div key={event.id} className="mb-6 last:mb-0">
                      <div className="flex items-center mb-3">
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: event.eventType.color }}
                        />
                        <h3 className="font-medium text-gray-900">{event.name}</h3>
                        <span className="ml-2 text-sm text-gray-500">
                          {formatEventDate(event.startTime)} at {formatEventTimeForDisplay(event.startTime)}
                        </span>
                      </div>
                      
                      <div className="space-y-2 ml-5">
                        {eventAssignments.map((assignment, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center">
                              <div className={`w-4 h-4 rounded-full mr-3 flex items-center justify-center ${
                                assignment.musicianId ? 'bg-green-100' : 'bg-red-100'
                              }`}>
                                {assignment.musicianId ? (
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-600" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-sm text-gray-900">
                                  {assignment.roleName}
                                </div>
                                {assignment.musicianId ? (
                                  <div className="text-xs text-gray-600">
                                    → {assignment.musicianName}
                                  </div>
                                ) : (
                                  <div className="text-xs text-red-600">
                                    {assignment.reason || 'No qualified musicians available'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Preview Actions */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleBackToSelection}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back to Selection
                  </button>
                  
                  {successfulAssignments.length > 0 && (
                    <button
                      onClick={handleConfirmAssignments}
                      disabled={confirming}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {confirming ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Confirm {successfulAssignments.length} Assignment{successfulAssignments.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 