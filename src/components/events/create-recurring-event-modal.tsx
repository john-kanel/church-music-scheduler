'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { X, Plus, Calendar, Users, Clock, ChevronDown, Trash2, Music2, GripVertical } from 'lucide-react'

interface CreateRecurringEventModalProps {
  isOpen: boolean
  onClose: () => void
  onEventCreated?: () => void
  editingEvent?: any // Root recurring event to edit
  editScope?: 'future' | 'all' | null // Scope of edit when in edit mode
}

interface Role {
  id: string
  name: string
  maxCount: number
  isRequired: boolean
  assignedMusicians?: string[]
}

interface Musician {
  id: string
  firstName: string
  lastName: string
  email: string
  instrument?: string
}

interface Hymn {
  id: string
  title: string
  servicePartId?: string
  servicePartName?: string
  notes?: string
}

interface ServicePart {
  id: string
  name: string
  isRequired: boolean
  order: number
}

interface Group {
  id: string
  name: string
  description?: string
  members: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
  }>
}

interface RecurrencePattern {
  type: 'weekly' | 'biweekly' | 'monthly' | 'custom'
  interval?: number
  weekdays?: number[]
  monthlyType?: 'date' | 'weekday'
  weekOfMonth?: number
}

const RECURRENCE_TYPES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' }
]

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

const EVENT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6B7280'
]

export function CreateRecurringEventModal({ 
  isOpen, 
  onClose, 
  onEventCreated, 
  editingEvent = null, 
  editScope = null 
}: CreateRecurringEventModalProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [musicians, setMusicians] = useState<Musician[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [serviceParts, setServiceParts] = useState<ServicePart[]>([])
  const [showColorPicker, setShowColorPicker] = useState(false)

  const isEditing = !!editingEvent

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    startDate: '',
    startTime: '',
    endTime: '',
    endDate: '', // When the recurring series ends (optional)
    signupType: 'open',
    eventTypeColor: '#3B82F6' // Default color
  })

  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>({
    type: 'weekly'
  })

  const [roles, setRoles] = useState<Role[]>([
    { id: '1', name: 'Accompanist', maxCount: 1, isRequired: true, assignedMusicians: [] },
    { id: '2', name: 'Vocalist', maxCount: 4, isRequired: false, assignedMusicians: [] }
  ])

  const [hymns, setHymns] = useState<Hymn[]>([])

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchServiceParts()
      fetchGroups()
      if (formData.signupType === 'assigned') {
        fetchMusicians()
      }
    }
  }, [isOpen, formData.signupType])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.color-picker-container')) {
        setShowColorPicker(false)
      }
    }

    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColorPicker])

  // Populate form when editing
  useEffect(() => {
    if (isEditing && editingEvent) {
      const eventDate = new Date(editingEvent.startTime)
      const eventEndDate = editingEvent.endTime ? new Date(editingEvent.endTime) : null
      
      setFormData({
        name: editingEvent.name,
        description: editingEvent.description || '',
        location: editingEvent.location || '',
        startDate: eventDate.toISOString().split('T')[0],
        startTime: eventDate.toTimeString().slice(0, 5),
        endTime: eventEndDate ? eventEndDate.toTimeString().slice(0, 5) : '',
        endDate: editingEvent.recurrenceEnd ? new Date(editingEvent.recurrenceEnd).toISOString().split('T')[0] : '',
        signupType: 'open', // Default, will be updated based on assignments
        eventTypeColor: editingEvent.eventType?.color || '#3B82F6'
      })

      // Parse and set recurrence pattern
      if (editingEvent.recurrencePattern) {
        try {
          const pattern = JSON.parse(editingEvent.recurrencePattern)
          setRecurrencePattern(pattern)
        } catch (error) {
          console.error('Error parsing recurrence pattern:', error)
        }
      }

      // Set assigned groups
      if (editingEvent.assignedGroups && editingEvent.assignedGroups.length > 0) {
        setSelectedGroups(editingEvent.assignedGroups)
      }

      // Set roles from assignments
      if (editingEvent.assignments && editingEvent.assignments.length > 0) {
        const roleMap = new Map()
        editingEvent.assignments.forEach((assignment: any) => {
          const roleName = assignment.roleName || 'Unassigned'
          if (!roleMap.has(roleName)) {
            roleMap.set(roleName, {
              id: `role-${roleName.toLowerCase().replace(/\s+/g, '-')}`,
              name: roleName,
              maxCount: 1,
              isRequired: false,
              assignedMusicians: []
            })
          }
          if (assignment.user) {
            roleMap.get(roleName).assignedMusicians.push(assignment.user.id)
          }
        })
        setRoles(Array.from(roleMap.values()))
      }

      // Set hymns
      if (editingEvent.hymns && editingEvent.hymns.length > 0) {
        const editHymns = editingEvent.hymns.map((hymn: any, index: number) => ({
          id: hymn.id || `hymn-${index}`,
          title: hymn.title,
          servicePartId: hymn.servicePart?.id || '',
          servicePartName: hymn.servicePart?.name || '',
          notes: hymn.notes || ''
        }))
        setHymns(editHymns)
      }
    }
  }, [isEditing, editingEvent])

  const fetchMusicians = async () => {
    try {
      const response = await fetch('/api/musicians')
      if (response.ok) {
        const data = await response.json()
        setMusicians(data.musicians || [])
      }
    } catch (error) {
      console.error('Error fetching musicians:', error)
    }
  }

  const fetchServiceParts = async () => {
    try {
      const response = await fetch('/api/service-parts')
      if (response.ok) {
        const data = await response.json()
        setServiceParts(data.serviceParts || [])
        
        // Add required service parts automatically
        const requiredParts = data.serviceParts.filter((part: ServicePart) => part.isRequired)
        if (requiredParts.length > 0 && hymns.length === 0) {
          const defaultHymns = requiredParts.map((part: ServicePart) => ({
            id: `hymn-${Date.now()}-${part.id}`,
            title: '',
            servicePartId: part.id,
            servicePartName: part.name,
            notes: ''
          }))
          setHymns(defaultHymns)
        }
      }
    } catch (error) {
      console.error('Error fetching service parts:', error)
    }
  }

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
    
    if (name === 'signupType' && value === 'assigned') {
      fetchMusicians()
    }
  }

  const handleRecurrenceChange = (field: keyof RecurrencePattern, value: any) => {
    setRecurrencePattern(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addRole = () => {
    const newRole: Role = {
      id: Date.now().toString(),
      name: '',
      maxCount: 1,
      isRequired: false,
      assignedMusicians: []
    }
    setRoles([...roles, newRole])
  }

  const updateRole = (id: string, field: keyof Role, value: any) => {
    setRoles(roles.map(role => 
      role.id === id ? { ...role, [field]: value } : role
    ))
  }

  const removeRole = (id: string) => {
    setRoles(roles.filter(role => role.id !== id))
  }

  const assignMusicianToRole = (roleId: string, musicianId: string) => {
    setRoles(roles.map(role => {
      if (role.id === roleId) {
        const currentAssignments = role.assignedMusicians || []
        const isAlreadyAssigned = currentAssignments.includes(musicianId)
        
        return {
          ...role,
          assignedMusicians: isAlreadyAssigned
            ? currentAssignments.filter(id => id !== musicianId)
            : [...currentAssignments, musicianId]
        }
      }
      return role
    }))
  }

  const addHymn = () => {
    const newHymn: Hymn = {
      id: Date.now().toString(),
      title: '',
      servicePartId: '',
      servicePartName: 'Custom',
      notes: ''
    }
    setHymns([...hymns, newHymn])
  }

  const updateHymn = (id: string, field: keyof Hymn, value: string) => {
    setHymns(hymns.map(hymn => {
      if (hymn.id === id) {
        const updatedHymn = { ...hymn, [field]: value }
        
        if (field === 'servicePartId') {
          const servicePart = serviceParts.find(part => part.id === value)
          updatedHymn.servicePartName = servicePart ? servicePart.name : 'Custom'
        }
        
        return updatedHymn
      }
      return hymn
    }))
  }

  const removeHymn = (id: string) => {
    setHymns(hymns.filter(hymn => hymn.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Validation
      if (!formData.name || !formData.location || !formData.startDate || !formData.startTime) {
        throw new Error('Please fill in all required fields')
      }

      if (roles.some(role => !role.name.trim())) {
        throw new Error('Please provide names for all roles')
      }

      // Prepare the event data
      const eventData = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        isRecurring: true,
        recurrencePattern: recurrencePattern,
        recurrenceEndDate: formData.endDate || null,
        roles: roles,
        hymns: hymns,
        selectedGroups: selectedGroups,
        eventTypeColor: formData.eventTypeColor,
        editScope: editScope // Include edit scope for editing mode
      }

      let response
      let successMessage

      if (isEditing && editingEvent) {
        // Edit existing recurring series
        response = await fetch(`/api/events/${editingEvent.id}/series`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        })
        successMessage = `Recurring event series updated successfully! (${editScope === 'future' ? 'Future events' : 'All events'} affected)`
      } else {
        // Create new recurring series
        response = await fetch('/api/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        })
        successMessage = 'Recurring event series created successfully!'
      }

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} recurring event`)
      }

      setSuccess(successMessage)
      
      // Show progress updates if provided
      if (result.progress) {
        setSuccess(`${successMessage}\n${result.progress}`)
      }
      
      // Reset form after short delay
      setTimeout(() => {
        if (!isEditing) {
          resetForm()
        }
        
        if (onEventCreated) {
          onEventCreated()
        }
        
        setTimeout(() => {
          onClose()
          setSuccess('')
        }, 1500)
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      location: '',
      startDate: '',
      startTime: '',
      endTime: '',
      endDate: '',
      signupType: 'open',
      eventTypeColor: '#3B82F6'
    })
    setRecurrencePattern({ type: 'weekly' })
    setRoles([
      { id: '1', name: 'Accompanist', maxCount: 1, isRequired: true, assignedMusicians: [] },
      { id: '2', name: 'Vocalist', maxCount: 4, isRequired: false, assignedMusicians: [] }
    ])
    setHymns([])
    setSelectedGroups([])
    setShowColorPicker(false)
  }

  const handleClose = () => {
    setShowColorPicker(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Recurring Event Series' : 'Create Recurring Event Series'}
            </h2>
            {isEditing && editScope && (
              <p className="text-sm text-gray-600 mt-1">
                Editing {editScope === 'future' ? 'future events only' : 'entire series'} for "{editingEvent?.name}"
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-600 text-sm flex items-center">
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {success}
              </p>
            </div>
          )}

          {/* Basic Information */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-blue-600" />
              Event Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Sunday Mass, Weekly Prayer Service, etc."
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Event description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Main Church, Chapel, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                <input
                  type="time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
          </section>

          {/* Recurrence Pattern */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-600" />
              Recurrence Pattern
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Repeat Type *</label>
                <select
                  value={recurrencePattern.type}
                  onChange={(e) => handleRecurrenceChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  {RECURRENCE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {recurrencePattern.type === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Every X weeks</label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={recurrencePattern.interval || 1}
                    onChange={(e) => handleRecurrenceChange('interval', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date (Optional)</label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for ongoing series (will generate 2 years ahead)
                </p>
              </div>
            </div>
          </section>

          {/* Event Color Selection */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <GripVertical className="h-5 w-5 mr-2 text-blue-600" />
              Event Color
            </h3>
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Choose Color</label>
                <div className="relative color-picker-container">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-8 h-8 rounded-full cursor-pointer border-2 border-gray-300 hover:border-gray-500 transition-colors shadow-sm"
                      style={{ backgroundColor: formData.eventTypeColor }}
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      title="Click to change event color"
                    />
                    <span className="text-sm text-gray-700 font-medium">{formData.eventTypeColor}</span>
                  </div>
                  
                  {/* Color Picker Popup */}
                  {showColorPicker && (
                    <div className="absolute top-10 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-4 min-w-[240px]">
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-gray-700">Select Event Color</h4>
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        {EVENT_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, eventTypeColor: color }))
                              setShowColorPicker(false)
                            }}
                            className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 hover:shadow-md ${
                              formData.eventTypeColor === color 
                                ? 'border-gray-900 scale-110 shadow-md' 
                                : 'border-gray-300 hover:border-gray-500'
                            }`}
                            style={{ backgroundColor: color }}
                            title={`Select ${color}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Roles Section */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-600" />
              Roles & Assignments
            </h3>
            
            <div className="space-y-4">
              {roles.map((role, index) => (
                <div key={role.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-4 flex-1">
                      <input
                        type="text"
                        placeholder="Role name"
                        value={role.name}
                        onChange={(e) => updateRole(role.id, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      />
                      <input
                        type="number"
                        min="1"
                        max="20"
                        placeholder="Max count"
                        value={role.maxCount}
                        onChange={(e) => updateRole(role.id, 'maxCount', parseInt(e.target.value) || 1)}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      />
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={role.isRequired}
                          onChange={(e) => updateRole(role.id, 'isRequired', e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Required</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRole(role.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {formData.signupType === 'assigned' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Musicians</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                        {musicians.map(musician => (
                          <label key={musician.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={role.assignedMusicians?.includes(musician.id) || false}
                              onChange={() => assignMusicianToRole(role.id, musician.id)}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">
                              {musician.firstName} {musician.lastName}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addRole}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
              >
                <Plus className="h-5 w-5 mx-auto mb-2" />
                Add Role
              </button>
            </div>
          </section>

          {/* Groups Section */}
          {groups.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-blue-600" />
                Auto-Assign Groups
              </h3>
              <div className="space-y-2">
                {groups.map(group => (
                  <label key={group.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGroups([...selectedGroups, group.id])
                        } else {
                          setSelectedGroups(selectedGroups.filter(id => id !== group.id))
                        }
                      }}
                      className="mr-3"
                    />
                    <div>
                      <span className="font-medium text-gray-900">{group.name}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({group.members.length} member{group.members.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Hymns Section */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Music2 className="h-5 w-5 mr-2 text-blue-600" />
              Music & Hymns
            </h3>
            
            <div className="space-y-4">
              {hymns.map((hymn, index) => (
                <div key={hymn.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service Part</label>
                      <select
                        value={hymn.servicePartId || 'custom'}
                        onChange={(e) => updateHymn(hymn.id, 'servicePartId', e.target.value === 'custom' ? '' : e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      >
                        <option value="custom">Custom</option>
                        {serviceParts.map(part => (
                          <option key={part.id} value={part.id}>
                            {part.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Song Title</label>
                      <input
                        type="text"
                        placeholder="Song title"
                        value={hymn.title}
                        onChange={(e) => updateHymn(hymn.id, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeHymn(hymn.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      placeholder="Notes or special instructions"
                      value={hymn.notes || ''}
                      onChange={(e) => updateHymn(hymn.id, 'notes', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addHymn}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
              >
                <Plus className="h-5 w-5 mx-auto mb-2" />
                Add Hymn
              </button>
            </div>
          </section>

          {/* Submit */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Recurring Event Series' : 'Create Recurring Event Series'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 