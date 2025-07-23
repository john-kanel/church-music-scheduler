'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar, CalendarX, Clock, Plus, Edit2, Trash2, 
  Save, X, AlertCircle, Check 
} from 'lucide-react'

interface UnavailabilityPeriod {
  id: string
  startDate: string | null
  endDate: string | null
  dayOfWeek: number | null
  reason: string | null
  createdAt: string
}

interface AvailabilityCardProps {
  userId?: string
  isEditable?: boolean
}

export function AvailabilityCard({ userId, isEditable = true }: AvailabilityCardProps) {
  const [unavailabilities, setUnavailabilities] = useState<UnavailabilityPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // UI State
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    type: 'dateRange', // 'dateRange' or 'weeklyRecurring'
    startDate: '',
    endDate: '',
    dayOfWeek: 0,
    reason: ''
  })

  const dayNames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 
    'Thursday', 'Friday', 'Saturday'
  ]

  useEffect(() => {
    fetchUnavailabilities()
  }, [userId])

  const fetchUnavailabilities = async () => {
    try {
      setLoading(true)
      const url = userId ? `/api/musician-availability?userId=${userId}` : '/api/musician-availability'
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        
        // Debug logging
        console.log('📥 Frontend received unavailabilities:', data.unavailabilities)
        data.unavailabilities?.forEach((u: any, index: number) => {
          console.log(`Frontend unavailability ${index}:`, {
            startDate: u.startDate,
            endDate: u.endDate,
            reason: u.reason
          })
        })
        
        setUnavailabilities(data.unavailabilities || [])
      } else {
        setError('Failed to load availability settings')
      }
    } catch (error) {
      setError('Error loading availability settings')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      type: 'dateRange',
      startDate: '',
      endDate: '',
      dayOfWeek: 0,
      reason: ''
    })
  }

  const handleAdd = () => {
    resetForm()
    setIsAdding(true)
    setEditingId(null)
    setError('')
    setSuccess('')
  }

  const handleEdit = (unavailability: UnavailabilityPeriod) => {
    setFormData({
      type: unavailability.dayOfWeek !== null ? 'weeklyRecurring' : 'dateRange',
      startDate: unavailability.startDate ? unavailability.startDate.split('T')[0] : '',
      endDate: unavailability.endDate ? unavailability.endDate.split('T')[0] : '',
      dayOfWeek: unavailability.dayOfWeek ?? 0,
      reason: unavailability.reason || ''
    })
    setEditingId(unavailability.id)
    setIsAdding(false)
    setError('')
    setSuccess('')
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    resetForm()
    setError('')
    setSuccess('')
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')

      // Validation
      if (formData.type === 'dateRange') {
        if (!formData.startDate) {
          setError('Start date is required')
          return
        }
        if (formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
          setError('Start date cannot be after end date')
          return
        }
      }

      const payload = {
        ...(editingId && { id: editingId }),
        startDate: formData.type === 'dateRange' ? formData.startDate : null,
        endDate: formData.type === 'dateRange' ? (formData.endDate || formData.startDate) : null,
        dayOfWeek: formData.type === 'weeklyRecurring' ? formData.dayOfWeek : null,
        reason: formData.reason.trim() || null
      }

      const url = '/api/musician-availability'
      const method = editingId ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        setSuccess(editingId ? 'Unavailability updated successfully!' : 'Unavailability added successfully!')
        await fetchUnavailabilities()
        handleCancel()
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save unavailability')
      }
    } catch (error) {
      setError('Error saving unavailability')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this unavailability period?')) {
      return
    }

    try {
      setDeleting(id)
      const response = await fetch(`/api/musician-availability?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSuccess('Unavailability deleted successfully!')
        await fetchUnavailabilities()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete unavailability')
      }
    } catch (error) {
      setError('Error deleting unavailability')
    } finally {
      setDeleting(null)
    }
  }

  const formatDateRange = (startDate: string | null, endDate: string | null) => {
    if (!startDate) return ''
    
    // Debug logging
    console.log('🎨 formatDateRange received:', { startDate, endDate })
    
    // Create date in local timezone to avoid timezone offset issues
    const createLocalDate = (dateString: string) => {
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number)
      console.log('Creating local date from:', dateString, 'parsed as:', { year, month: month - 1, day })
      const date = new Date(year, month - 1, day) // month is 0-indexed
      console.log('Created date object:', date, 'ISO:', date.toISOString())
      return date
    }
    
    const start = createLocalDate(startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    
    if (!endDate || startDate === endDate) {
      return start
    }
    
    const end = createLocalDate(endDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    
    return `${start} - ${end}`
  }

  const isFormExpanded = isAdding || editingId !== null

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <CalendarX className="h-6 w-6 text-red-600 mr-3" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Availability Settings</h2>
            <p className="text-sm text-gray-600">Set dates when you're not available to serve</p>
          </div>
        </div>
        {isEditable && !isFormExpanded && (
          <button
            onClick={handleAdd}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title="Add Unavailable Period"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            {error}
          </p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-600 text-sm flex items-center">
            <Check className="h-4 w-4 mr-2" />
            {success}
          </p>
        </div>
      )}

      {/* Form Expansion */}
      {isFormExpanded && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-md font-medium text-gray-900 mb-4">
            {editingId ? 'Edit Unavailable Period' : 'Add Unavailable Period'}
          </h3>
          
          <div className="space-y-4">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type of Unavailability
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="dateRange">Specific Date Range</option>
                <option value="weeklyRecurring">Weekly Recurring (Every Week)</option>
              </select>
            </div>

            {/* Date Range Fields */}
            {formData.type === 'dateRange' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for single day</p>
                </div>
              </div>
            )}

            {/* Day of Week Field */}
            {formData.type === 'weeklyRecurring' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Day of Week
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {dayNames.map((day, index) => (
                    <option key={index} value={index}>{day}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">This will apply to every occurrence of this day</p>
              </div>
            )}

            {/* Reason Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (optional)
              </label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Family vacation, work conflict, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (formData.type === 'dateRange' && !formData.startDate)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {saving ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Unavailabilities List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : unavailabilities.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Unavailable Periods Set</h3>
            <p className="text-gray-600">
              {isEditable ? "You're available for all events. Click 'Add Unavailable Period' to set dates when you cannot serve." : "This musician is available for all events."}
            </p>
          </div>
        ) : (
          unavailabilities.map((unavailability) => (
            <div key={unavailability.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <CalendarX className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {unavailability.dayOfWeek !== null ? (
                      `Every ${dayNames[unavailability.dayOfWeek]}`
                    ) : (
                      formatDateRange(unavailability.startDate, unavailability.endDate)
                    )}
                  </div>
                  {unavailability.reason && (
                    <div className="text-sm text-gray-600">{unavailability.reason}</div>
                  )}
                  <div className="text-xs text-gray-500">
                    {unavailability.dayOfWeek !== null ? 'Weekly recurring' : 'Date range'}
                  </div>
                </div>
              </div>
              
              {isEditable && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(unavailability)}
                    disabled={isFormExpanded}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(unavailability.id)}
                    disabled={deleting === unavailability.id || isFormExpanded}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === unavailability.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info Note */}
      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          <Clock className="h-4 w-4 inline mr-1" />
          <strong>Note:</strong> These settings help the auto-assignment system avoid scheduling you for events when you're not available. Past dates are automatically removed.
        </p>
      </div>
    </div>
  )
} 