'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, Users, AlertTriangle } from 'lucide-react'

interface EditScopeModalProps {
  isOpen: boolean
  onClose: () => void
  rootEvent: any
  onScopeSelected: (scope: 'future' | 'all') => void
}

export function EditScopeModal({ isOpen, onClose, rootEvent, onScopeSelected }: EditScopeModalProps) {
  const [loading, setLoading] = useState(false)
  const [eventCounts, setEventCounts] = useState<{ future: number; total: number; modified: number }>({
    future: 0,
    total: 0,
    modified: 0
  })

  useEffect(() => {
    if (isOpen && rootEvent) {
      fetchEventCounts()
    }
  }, [isOpen, rootEvent])

  const fetchEventCounts = async () => {
    if (!rootEvent) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/events/${rootEvent.id}/impact`)
      if (response.ok) {
        const data = await response.json()
        setEventCounts(data)
      }
    } catch (error) {
      console.error('Error fetching event counts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleScopeSelect = (scope: 'future' | 'all') => {
    onScopeSelected(scope)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{backgroundColor: '#E6F0FA'}}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Edit Recurring Event</h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose what you'd like to edit for "{rootEvent?.name}"
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Analyzing event series...</span>
            </div>
          ) : (
            <>
              {/* Future Events Card */}
              <div
                onClick={() => handleScopeSelect('future')}
                className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-900">
                        Edit Future Events
                      </h3>
                      <p className="text-sm text-gray-600">
                        Update upcoming events while preserving past ones
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{eventCounts.future}</div>
                    <div className="text-xs text-gray-500">events affected</div>
                  </div>
                </div>
                
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      From today forward
                    </div>
                    {eventCounts.modified > 0 && (
                      <div className="flex items-center text-amber-600">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {eventCounts.modified} modified events will be preserved
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Entire Series Card */}
              <div
                onClick={() => handleScopeSelect('all')}
                className="border-2 border-gray-200 rounded-xl p-6 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-900">
                        Edit Entire Series
                      </h3>
                      <p className="text-sm text-gray-600">
                        Update all events in this recurring series
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">{eventCounts.total}</div>
                    <div className="text-xs text-gray-500">total events</div>
                  </div>
                </div>
                
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-4 w-4 mr-1" />
                      Past, present, and future
                    </div>
                    {eventCounts.modified > 0 && (
                      <div className="flex items-center text-amber-600">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {eventCounts.modified} modified events will be preserved
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">About preserving modifications:</p>
                    <p>
                      Events that have been individually customized (different times, roles, or hymns) 
                      will keep their modifications and won't be updated by series edits.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
} 