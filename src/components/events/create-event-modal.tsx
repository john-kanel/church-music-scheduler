'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { X, Plus, Upload, Trash2, Calendar, Users, ChevronDown } from 'lucide-react'

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
  composer?: string
  notes?: string
}

export function CreateEventModal({ isOpen, onClose, onEventCreated }: CreateEventModalProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [musicians, setMusicians] = useState<Musician[]>([])
  const [loadingMusicians, setLoadingMusicians] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    startDate: '',
    startTime: '',
    endTime: '',
    signupType: 'open', // 'open' or 'assigned'
    notes: ''
  })

  const [roles, setRoles] = useState<Role[]>([
    { id: '1', name: 'Accompanist', maxCount: 1, isRequired: true, assignedMusicians: [] },
    { id: '2', name: 'Vocalist', maxCount: 4, isRequired: false, assignedMusicians: [] }
  ])

  const [hymns, setHymns] = useState<Hymn[]>([])
  const [musicFiles, setMusicFiles] = useState<File[]>([])

  // Fetch verified musicians when modal opens and assignment type is 'assigned'
  useEffect(() => {
    if (isOpen && formData.signupType === 'assigned') {
      fetchMusicians()
    }
  }, [isOpen, formData.signupType])

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
        const currentAssigned = role.assignedMusicians || []
        if (currentAssigned.includes(musicianId)) {
          // Remove musician if already assigned
          return {
            ...role,
            assignedMusicians: currentAssigned.filter(id => id !== musicianId)
          }
        } else if (currentAssigned.length < role.maxCount) {
          // Add musician if under max count
          return {
            ...role,
            assignedMusicians: [...currentAssigned, musicianId]
          }
        }
      }
      return role
    }))
  }

  const addHymn = () => {
    const newHymn: Hymn = {
      id: Date.now().toString(),
      title: '',
      composer: '',
      notes: ''
    }
    setHymns([...hymns, newHymn])
  }

  const updateHymn = (id: string, field: keyof Hymn, value: string) => {
    setHymns(hymns.map(hymn => 
      hymn.id === id ? { ...hymn, [field]: value } : hymn
    ))
  }

  const removeHymn = (id: string) => {
    setHymns(hymns.filter(hymn => hymn.id !== id))
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
      const eventData = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        roles: roles.filter(role => role.name.trim() !== '').map(role => ({
          name: role.name,
          maxCount: role.maxCount,
          isRequired: role.isRequired,
          assignedMusicians: formData.signupType === 'assigned' ? role.assignedMusicians : undefined
        })),
        hymns: hymns.filter(hymn => hymn.title.trim() !== ''),
        notes: formData.notes
      }

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create event')
      }

      const result = await response.json()
      
      setSuccess(`Event "${formData.name}" created successfully!`)
      
      // Wait a moment to show success message, then close
      setTimeout(() => {
        onEventCreated?.()
        onClose()
        
        // Reset form
        setFormData({
          name: '',
          description: '',
          location: '',
          startDate: '',
          startTime: '',
          endTime: '',
          signupType: 'open',
          notes: ''
        })
        setRoles([
          { id: '1', name: 'Accompanist', maxCount: 1, isRequired: true },
          { id: '2', name: 'Vocalist', maxCount: 4, isRequired: false }
        ])
        setHymns([])
        setMusicFiles([])
        setSuccess('')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-10 z-50 flex items-center justify-center p-4">
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
                <div key={role.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-center space-x-3">
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
                    <button
                      type="button"
                      onClick={() => removeRole(role.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
                          {musicians.map((musician) => {
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
                          No verified musicians available. Musicians need to accept their invitations first.
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
              <button
                type="button"
                onClick={addHymn}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Music
              </button>
            </div>
            <div className="space-y-3">
              {hymns.map((hymn) => (
                <div key={hymn.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={hymn.title}
                    onChange={(e) => updateHymn(hymn.id, 'title', e.target.value)}
                    placeholder="Song/Hymn title"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                  <input
                    type="text"
                    value={hymn.composer || ''}
                    onChange={(e) => updateHymn(hymn.id, 'composer', e.target.value)}
                    placeholder="Composer/Artist"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={hymn.notes || ''}
                      onChange={(e) => updateHymn(hymn.id, 'notes', e.target.value)}
                      placeholder="Notes"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => removeHymn(hymn.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
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
    </div>
  )
} 