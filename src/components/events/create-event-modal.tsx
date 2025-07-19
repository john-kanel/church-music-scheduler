'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { X, Plus, Upload, Trash2, Calendar, Users, ChevronDown, RefreshCw, FileText, GripVertical, Music2 } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import PdfProcessor to prevent SSR issues with react-pdf
const PdfProcessor = dynamic(() => import('./pdf-processor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4">Loading PDF processor...</div>
})

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onEventCreated?: () => void
}

interface Role {
  id: string
  name: string
  maxCount: number
  isRequired: boolean
  assignedMusicians?: string[] // Array of musician IDs
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

const RECURRENCE_PATTERNS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom pattern' }
]

export function CreateEventModal({ isOpen, onClose, onEventCreated }: CreateEventModalProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [musicians, setMusicians] = useState<Musician[]>([])
  const [loadingMusicians, setLoadingMusicians] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    startDate: '',
    startTime: '',
    endTime: '',
    signupType: 'open', // 'open' or 'assigned'
    notes: '',
    isRecurring: false,
    recurrencePattern: '',
    recurrenceEnd: '',
    copyHymnsToRecurring: true // Whether to copy hymns to recurring events
  })

  const [roles, setRoles] = useState<Role[]>([
    { id: '1', name: 'Accompanist', maxCount: 1, isRequired: true, assignedMusicians: [] },
    { id: '2', name: 'Vocalist', maxCount: 4, isRequired: false, assignedMusicians: [] }
  ])

  const [hymns, setHymns] = useState<Hymn[]>([])
  const [musicFiles, setMusicFiles] = useState<File[]>([])
  const [serviceParts, setServiceParts] = useState<ServicePart[]>([])
  const [loadingServiceParts, setLoadingServiceParts] = useState(false)
  const [showPdfProcessor, setShowPdfProcessor] = useState(false)
  const [draggedHymn, setDraggedHymn] = useState<Hymn | null>(null)

  // Fetch verified musicians when modal opens and assignment type is 'assigned'
  useEffect(() => {
    if (isOpen && formData.signupType === 'assigned') {
      fetchMusicians()
    }
  }, [isOpen, formData.signupType])

  // Fetch service parts when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchServiceParts()
      fetchGroups()
    }
  }, [isOpen])

  const fetchMusicians = async () => {
    setLoadingMusicians(true)
    try {
      const response = await fetch('/api/musicians?verified=true')
      if (response.ok) {
        const data = await response.json()
        setMusicians(data.musicians || [])
      }
    } catch (error) {
      console.error('Error fetching musicians:', error)
    } finally {
      setLoadingMusicians(false)
    }
  }

  const fetchServiceParts = async () => {
    setLoadingServiceParts(true)
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
    } finally {
      setLoadingServiceParts(false)
    }
  }

  const fetchGroups = async () => {
    setLoadingGroups(true)
    try {
      const response = await fetch('/api/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    } finally {
      setLoadingGroups(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
    
    // Fetch musicians when switching to assigned mode
    if (name === 'signupType' && value === 'assigned') {
      fetchMusicians()
    }
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
        const isAssigned = currentAssignments.includes(musicianId)
        
        if (isAssigned) {
          return {
            ...role,
            assignedMusicians: currentAssignments.filter(id => id !== musicianId)
          }
        } else {
          return {
            ...role,
            assignedMusicians: [...currentAssignments, musicianId]
          }
        }
      }
      return role
    }))
  }

  // Helper function to get all musician IDs from selected groups
  const getGroupMemberIds = (): string[] => {
    const memberIds: string[] = []
    selectedGroups.forEach(groupId => {
      const group = groups.find(g => g.id === groupId)
      if (group) {
        group.members.forEach(member => {
          if (!memberIds.includes(member.id)) {
            memberIds.push(member.id)
          }
        })
      }
    })
    return memberIds
  }

  // Filter musicians to exclude those already assigned via groups
  const getAvailableMusicians = (): Musician[] => {
    const groupMemberIds = getGroupMemberIds()
    return musicians.filter(musician => !groupMemberIds.includes(musician.id))
  }

  const addHymn = () => {
    const newHymn: Hymn = {
      id: Date.now().toString(),
      title: '',
      servicePartId: '',
      servicePartName: '',
      notes: ''
    }
    setHymns([...hymns, newHymn])
  }

  const updateHymn = (id: string, field: keyof Hymn, value: string) => {
    setHymns(hymns.map(hymn => {
      if (hymn.id === id) {
        if (field === 'servicePartId') {
          // Find the service part name when ID changes
          const servicePart = serviceParts.find(part => part.id === value)
          return {
            ...hymn,
            servicePartId: value,
            servicePartName: value === 'custom' ? 'Custom' : (servicePart?.name || '')
          }
        }
        return { ...hymn, [field]: value }
      }
      return hymn
    }))
  }

  const removeHymn = (id: string) => {
    setHymns(hymns.filter(hymn => hymn.id !== id))
  }

  const handleHymnDragStart = (e: React.DragEvent, hymn: Hymn) => {
    setDraggedHymn(hymn)
  }

  const handleHymnDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleHymnDrop = (e: React.DragEvent, targetHymn: Hymn) => {
    e.preventDefault()
    if (!draggedHymn || draggedHymn.id === targetHymn.id) return

    const newHymns = [...hymns]
    const draggedIndex = newHymns.findIndex(hymn => hymn.id === draggedHymn.id)
    const targetIndex = newHymns.findIndex(hymn => hymn.id === targetHymn.id)

    // Remove dragged item and insert at target position
    const [draggedItem] = newHymns.splice(draggedIndex, 1)
    newHymns.splice(targetIndex, 0, draggedItem)

    setHymns(newHymns)
    setDraggedHymn(null)
  }

  const handlePdfSuggestions = (suggestions: Array<{servicePartName: string, songTitle: string, notes: string}>) => {
    // Convert suggestions to hymns format
    const newHymns = suggestions.map((suggestion, index) => {
      // Find matching service part
      const servicePart = serviceParts.find(part => 
        part.name.toLowerCase() === suggestion.servicePartName.toLowerCase()
      )
      
      return {
        id: `hymn-${Date.now()}-${index}`,
        title: suggestion.songTitle,
        servicePartId: servicePart?.id || 'custom',
        servicePartName: servicePart?.name || suggestion.servicePartName,
        notes: suggestion.notes
      }
    })
    
    // Replace existing hymns with AI suggestions
    setHymns(newHymns)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMusicFiles([...musicFiles, ...Array.from(e.target.files)])
    }
  }

  const removeFile = (index: number) => {
    setMusicFiles(musicFiles.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Basic validation
      if (!formData.name || !formData.location || !formData.startDate || !formData.startTime) {
        throw new Error('Please fill in all required fields')
      }

      if (roles.some(role => !role.name.trim())) {
        throw new Error('Please provide names for all roles')
      }

      // Prepare event data as JSON
      const eventData = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        signupType: formData.signupType,
        notes: formData.notes,
        isRecurring: formData.isRecurring,
        recurrencePattern: formData.recurrencePattern,
        recurrenceEnd: formData.recurrenceEnd,
        copyHymnsToRecurring: formData.copyHymnsToRecurring,
        roles: roles,
        hymns: hymns,
        selectedGroups: selectedGroups
      }

      // Create the event first
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create event')
      }

      // If there are music files and the event was created successfully, upload them
      if (musicFiles.length > 0 && result.event?.id) {
        try {
          const fileFormData = new FormData()
          musicFiles.forEach((file, index) => {
            fileFormData.append(`musicFile_${index}`, file)
          })

          const fileResponse = await fetch(`/api/events/${result.event.id}/documents`, {
            method: 'POST',
            body: fileFormData,
          })

          if (!fileResponse.ok) {
            console.error('Failed to upload some music files')
            // Don't throw error here as the event was created successfully
          }
        } catch (fileError) {
          console.error('Error uploading music files:', fileError)
          // Don't throw error here as the event was created successfully
        }
      }

      setSuccess('Event created successfully!')
      
      // Reset form after short delay
      setTimeout(() => {
        setFormData({
          name: '',
          description: '',
          location: '',
          startDate: '',
          startTime: '',
          endTime: '',
          signupType: 'open',
          notes: '',
          isRecurring: false,
          recurrencePattern: '',
          recurrenceEnd: '',
          copyHymnsToRecurring: true
        })
        setRoles([
          { id: '1', name: 'Accompanist', maxCount: 1, isRequired: true, assignedMusicians: [] },
          { id: '2', name: 'Vocalist', maxCount: 4, isRequired: false, assignedMusicians: [] }
        ])
        setHymns([])
        setMusicFiles([])
        setSelectedGroups([])
        
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Create New Event</h2>
          <button
            onClick={onClose}
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
                  placeholder="Sunday Mass, Christmas Eve Service, etc."
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
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

          {/* Recurring Event Settings */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <RefreshCw className="h-5 w-5 mr-2 text-blue-600" />
              Recurring Event Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isRecurring"
                  name="isRecurring"
                  checked={formData.isRecurring}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isRecurring" className="ml-2 text-sm text-gray-700">
                  Make this a recurring event
                </label>
              </div>

              {formData.isRecurring && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Recurring Events:</strong> This will automatically create multiple instances of this event based on your selected pattern. 
                      All roles, assignments, and settings will be copied to each occurrence.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-blue-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Recurrence Pattern *</label>
                      <select
                        name="recurrencePattern"
                        value={formData.recurrencePattern}
                        onChange={handleInputChange}
                        required={formData.isRecurring}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      >
                        <option value="">Select pattern...</option>
                        {RECURRENCE_PATTERNS.map((pattern) => (
                          <option key={pattern.value} value={pattern.value}>
                            {pattern.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date (Optional)</label>
                      <input
                        type="date"
                        name="recurrenceEnd"
                        value={formData.recurrenceEnd}
                        onChange={handleInputChange}
                        min={formData.startDate}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        title="If left empty, the event will recur indefinitely"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty to recur indefinitely</p>
                    </div>
                  </div>
                  
                  {/* Copy Hymns Option - Only show if there are hymns */}
                  {hymns.length > 0 && (
                    <div className="pl-6 border-l-2 border-blue-200">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.copyHymnsToRecurring}
                          onChange={(e) => setFormData(prev => ({ ...prev, copyHymnsToRecurring: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Copy hymns/music to all recurring events
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        Uncheck if you want different music for each recurring event
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Signup Type */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-600" />
              Musician Assignment
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">How will musicians be assigned?</label>
                <select
                  name="signupType"
                  value={formData.signupType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="open">Open Signup - Musicians can volunteer themselves</option>
                  <option value="assigned">Director Assignment - You assign musicians manually</option>
                </select>
              </div>
            </div>
          </section>

          {/* Group Assignment */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-success-600" />
              Group Assignment
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select groups to automatically assign all members to this event. All group members will receive notifications.
              </p>
              
              {loadingGroups ? (
                <div className="text-sm text-gray-500">Loading groups...</div>
              ) : groups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groups.map((group) => {
                    const isSelected = selectedGroups.includes(group.id)
                    return (
                      <label
                        key={group.id}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-success-50 border-success-200 text-success-900' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGroups([...selectedGroups, group.id])
                            } else {
                              setSelectedGroups(selectedGroups.filter(id => id !== group.id))
                            }
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {group.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {group.description && (
                              <span className="mr-2">{group.description}</span>
                            )}
                            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg text-center">
                  No groups available. You can create groups in the Groups section to organize your musicians.
                </div>
              )}
              
              {selectedGroups.length > 0 && (
                <div className="bg-success-50 border border-success-200 rounded-lg p-3">
                  <p className="text-sm text-success-800 font-medium">
                    {selectedGroups.length} group{selectedGroups.length !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xs text-success-700 mt-1">
                    All members of selected groups will be automatically assigned to this event and receive notifications.
                  </p>
                  
                  {/* Show group members that will be auto-assigned */}
                  <div className="mt-3 pt-3 border-t border-success-300">
                    <p className="text-xs text-success-700 font-medium mb-2">
                      Musicians automatically assigned via groups:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {getGroupMemberIds().map(memberId => {
                        const member = musicians.find(m => m.id === memberId)
                        if (!member) return null
                        return (
                          <span 
                            key={memberId}
                            className="inline-flex items-center px-2 py-1 bg-success-100 text-success-800 text-xs rounded-full"
                          >
                            {member.firstName} {member.lastName}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Roles */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Musical Roles</h3>
              <button
                type="button"
                onClick={addRole}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Role
              </button>
            </div>
            <div className="space-y-4">
              {roles.map((role) => (
                <div key={role.id} className="p-4 bg-gray-50 rounded-lg space-y-3 group">
                  <div className="flex items-center space-x-3">
                    {/* Music Note / Trash Icon */}
                    <button
                      type="button"
                      onClick={() => removeRole(role.id)}
                      className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 hover:bg-red-50 group-hover:bg-red-50"
                      title="Remove role"
                    >
                      <Music2 className="h-4 w-4 text-blue-600 group-hover:hidden transition-all duration-200" />
                      <Trash2 className="h-4 w-4 text-red-600 hidden group-hover:block transition-all duration-200" />
                    </button>
                    
                    <input
                      type="text"
                      value={role.name}
                      onChange={(e) => updateRole(role.id, 'name', e.target.value)}
                      placeholder="Role name (e.g., Pianist, Cantor)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-700">Max:</label>
                      <input
                        type="number"
                        value={role.maxCount}
                        onChange={(e) => updateRole(role.id, 'maxCount', parseInt(e.target.value) || 1)}
                        min="1"
                        max="20"
                        className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      />
                    </div>
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
                  
                  {/* Musician Assignment Section - Only show for Director Assignment */}
                  {formData.signupType === 'assigned' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Assign Musicians ({(role.assignedMusicians || []).length}/{role.maxCount})
                      </h4>
                      {loadingMusicians ? (
                        <div className="text-sm text-gray-500">Loading musicians...</div>
                      ) : musicians.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                          {getAvailableMusicians().map((musician) => {
                            const isAssigned = (role.assignedMusicians || []).includes(musician.id)
                            const canAssign = !isAssigned && (role.assignedMusicians || []).length < role.maxCount
                            return (
                              <label
                                key={musician.id}
                                className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                                  isAssigned 
                                    ? 'bg-blue-50 border-blue-200 text-blue-900' 
                                    : canAssign
                                    ? 'bg-white border-gray-200 hover:bg-gray-50'
                                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => assignMusicianToRole(role.id, musician.id)}
                                  disabled={!canAssign && !isAssigned}
                                  className="mr-2"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {musician.firstName} {musician.lastName}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {musician.instrument && (
                                      <span className="mr-2">{musician.instrument}</span>
                                    )}
                                    {musician.email}
                                  </div>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {musicians.length === 0 
                            ? "No verified musicians available. Musicians need to accept their invitations first."
                            : "No musicians available for individual assignment. All verified musicians are already assigned via groups."
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Hymns/Music List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Music & Hymns</h3>
              <div className="flex gap-2">
                                  <button
                    type="button"
                    onClick={() => setShowPdfProcessor(true)}
                    className="flex items-center px-3 py-2 bg-[#660033] text-white rounded-lg hover:bg-[#800041] transition-colors"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Auto Populate from Document
                  </button>
                <button
                  type="button"
                  onClick={addHymn}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Music
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {hymns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p>No music parts added yet</p>
                  <p className="text-sm">Add music manually or use "Auto Populate Service Parts" to extract from a PDF</p>
                </div>
              ) : (
                hymns.map((hymn, index) => (
                  <div
                    key={hymn.id}
                    draggable
                    onDragStart={(e) => handleHymnDragStart(e, hymn)}
                    onDragOver={handleHymnDragOver}
                    onDrop={(e) => handleHymnDrop(e, hymn)}
                    className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-2 border-transparent hover:border-blue-200 transition-all cursor-move ${
                      draggedHymn?.id === hymn.id ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="flex items-center text-gray-400 hover:text-gray-600">
                      <GripVertical className="h-5 w-5" />
                      <span className="text-sm font-mono ml-1">{index + 1}</span>
                    </div>

                    {/* Content using flex layout to keep trash can inside */}
                    <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3">
                      <div className="w-full md:w-48">
                        <select
                          value={hymn.servicePartId || ''}
                          onChange={(e) => updateHymn(hymn.id, 'servicePartId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                          onClick={(e) => e.stopPropagation()} // Prevent drag when interacting with select
                        >
                          <option value="">Select service part...</option>
                          {serviceParts.map((part) => (
                            <option key={part.id} value={part.id}>
                              {part.name}
                            </option>
                          ))}
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={hymn.title}
                        onChange={(e) => updateHymn(hymn.id, 'title', e.target.value)}
                        placeholder="Song/Hymn title"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        onMouseDown={(e) => e.stopPropagation()} // Prevent drag when typing
                      />
                      <input
                        type="text"
                        value={hymn.notes || ''}
                        onChange={(e) => updateHymn(hymn.id, 'notes', e.target.value)}
                        placeholder="Notes"
                        className="w-full md:w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                        onMouseDown={(e) => e.stopPropagation()} // Prevent drag when typing
                      />
                      <button
                        type="button"
                        onClick={() => removeHymn(hymn.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors self-center"
                        onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking delete
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Music Files */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Upload className="h-5 w-5 mr-2 text-blue-600" />
              Music Files
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload sheet music, chord charts, or other music files
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: PDF, DOC, DOCX, JPG, PNG
                </p>
              </div>
              
              {musicFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Uploaded Files:</h4>
                  {musicFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!success}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : success ? (
                <>
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Created!
                </>
              ) : (
                'Create Event'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* PDF Processor Modal */}
      {showPdfProcessor && (
        <PdfProcessor
          onSuggestionsAccepted={handlePdfSuggestions}
          onClose={() => setShowPdfProcessor(false)}
        />
      )}
    </div>
  )
} 