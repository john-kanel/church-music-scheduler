'use client'

import { useState } from 'react'
import { 
  X, Calendar, Clock, MapPin, Users, Check, AlertTriangle, XCircle,
  UserPlus, Music
} from 'lucide-react'

interface MusicianSignupModalProps {
  isOpen: boolean
  onClose: () => void
  event: any
  onSignupSuccess: () => void
}

interface Assignment {
  id: string
  roleName: string
  status: string
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export function MusicianSignupModal({ 
  isOpen, 
  onClose, 
  event, 
  onSignupSuccess 
}: MusicianSignupModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!isOpen || !event) return null

  const eventDate = new Date(event.startTime)
  const eventEndDate = event.endTime ? new Date(event.endTime) : null
  
    // Apply timezone fix to show correct local time
  const timezoneOffsetMinutes = eventDate.getTimezoneOffset()
  const localEventDate = new Date(eventDate.getTime() + (timezoneOffsetMinutes * 60000))
  const localEventEndDate = eventEndDate ? new Date(eventEndDate.getTime() + (timezoneOffsetMinutes * 60000)) : null

  const timeString = localEventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  const endTimeString = localEventEndDate ? localEventEndDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) : null

  const dateString = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Filter for available assignments (no user assigned)
  const availableAssignments = event.assignments?.filter((assignment: Assignment) => !assignment.user) || []

  const handleSignup = async (assignmentId: string) => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/assignments/${assignmentId}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Successfully signed up for this role!')
        setTimeout(() => {
          onSignupSuccess()
          onClose()
        }, 1500)
      } else {
        setError(data.error || 'Failed to sign up for assignment')
      }
    } catch (error) {
      setError('An error occurred while signing up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <div
              className="w-4 h-4 rounded-full mr-3"
              style={{ backgroundColor: event.eventType.color }}
            />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{event.name}</h2>
              <p className="text-sm text-gray-600">{event.eventType.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm flex items-center">
                <XCircle className="h-4 w-4 mr-2" />
                {error}
              </p>
            </div>
          )}

          {success && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
              <p className="text-success-600 text-sm flex items-center">
                <Check className="h-4 w-4 mr-2" />
                {success}
              </p>
            </div>
          )}

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date & Time */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Date & Time</h3>
              <div className="space-y-2">
                <div className="flex items-center text-gray-700">
                  <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                  <span>{dateString}</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <Clock className="h-4 w-4 mr-2 text-blue-600" />
                  <span>{timeString}{endTimeString ? ` - ${endTimeString}` : ''}</span>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Location</h3>
              <div className="flex items-center text-gray-700">
                <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                <span>{event.location || 'No location specified'}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Description</h3>
              <p className="text-gray-700">{event.description}</p>
            </div>
          )}

          {/* Available Roles */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-600" />
              Available Roles ({availableAssignments.length})
            </h3>
            
            {availableAssignments.length > 0 ? (
              <div className="space-y-3">
                {availableAssignments.map((assignment: Assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <Music className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{assignment.roleName}</div>
                        <div className="text-sm text-gray-500">Open position</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSignup(assignment.id)}
                      disabled={loading}
                      className="flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      Sign Up
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Available Roles</h3>
                <p className="text-gray-600">
                  All roles for this event have been filled.
                </p>
              </div>
            )}
          </div>

          {/* Assigned Musicians */}
          {event.assignments?.some((assignment: Assignment) => assignment.user) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Assigned Musicians</h3>
              <div className="space-y-2">
                {event.assignments
                  .filter((assignment: Assignment) => assignment.user)
                  .map((assignment: Assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <Users className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{assignment.roleName}</div>
                          <div className="text-sm text-gray-600">
                            {assignment.user?.firstName} {assignment.user?.lastName}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-green-600 font-medium">Assigned</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 