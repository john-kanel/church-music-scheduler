'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { X, Users, Plus, Trash2, User, UserPlus, UserMinus, MessageSquare } from 'lucide-react'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onGroupCreated?: () => void
  onMessageGroup?: (members: any[]) => void
}

export function CreateGroupModal({ isOpen, onClose, onGroupCreated, onMessageGroup }: CreateGroupModalProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  // Musicians management state
  const [musicians, setMusicians] = useState<any[]>([])
  const [loadingMusicians, setLoadingMusicians] = useState(false)
  const [selectedMusicianId, setSelectedMusicianId] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<any[]>([])

  useEffect(() => {
    if (isOpen) {
      fetchMusicians()
    }
  }, [isOpen])

  const fetchMusicians = async () => {
    setLoadingMusicians(true)
    try {
      const response = await fetch('/api/musicians')
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAddMember = () => {
    if (!selectedMusicianId) return

    const musician = musicians.find(m => m.id === selectedMusicianId)
    if (musician && !selectedMembers.some(member => member.id === musician.id)) {
      setSelectedMembers(prev => [...prev, {
        id: musician.id,
        name: `${musician.firstName} ${musician.lastName}`,
        email: musician.email,
        role: musician.role
      }])
    }
    setSelectedMusicianId('')
  }

  const handleRemoveMember = (musicianId: string) => {
    setSelectedMembers(prev => prev.filter(member => member.id !== musicianId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const groupData = {
        name: formData.name,
        description: formData.description
      }

      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(groupData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create group')
      }

      const result = await response.json()
      
      // Add selected musicians to the group
      if (selectedMembers.length > 0) {
        for (const member of selectedMembers) {
          try {
            await fetch('/api/groups', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                groupId: result.group.id,
                action: 'add',
                musicianId: member.id
              })
            })
          } catch (memberError) {
            console.error('Error adding member to group:', memberError)
            // Continue adding other members even if one fails
          }
        }
      }
      
      setSuccess(`Group "${formData.name}" created successfully!`)
      
      // Wait a moment to show success message, then close
      setTimeout(() => {
        onGroupCreated?.()
        onClose()
        
        // Reset form
        setFormData({
          name: '',
          description: ''
        })
        setSelectedMembers([])
        setSelectedMusicianId('')
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
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Users className="h-6 w-6 mr-2 text-blue-600" />
            Create New Group
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
              <p className="text-success-600 text-sm flex items-center">
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {success}
              </p>
            </div>
          )}

          {/* Basic Information */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Group Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="e.g., Adult Choir, Youth Band, Praise Team"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Brief description of the group's purpose, role, and any special requirements..."
              />
            </div>
          </section>

          {/* Musicians Management Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Musicians ({selectedMembers.length})
            </h3>

            {/* Add Musicians */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Add Musicians (Optional)</label>
              <div className="flex gap-3">
                <select
                  value={selectedMusicianId}
                  onChange={(e) => setSelectedMusicianId(e.target.value)}
                  disabled={loadingMusicians}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:opacity-50"
                >
                  <option value="">
                    {loadingMusicians ? 'Loading musicians...' : 'Select a musician to add'}
                  </option>
                  {musicians.filter(musician => !selectedMembers.some(member => member.id === musician.id)).map((musician) => (
                    <option key={musician.id} value={musician.id}>
                      {musician.firstName} {musician.lastName} ({musician.email})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={!selectedMusicianId}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add
                </button>
              </div>
            </div>

            {/* Selected Members */}
            {selectedMembers.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Selected Members</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {selectedMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-600">{member.email}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove from selection"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <Users className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
              <div>
                <h4 className="text-sm font-medium text-blue-800">Tip</h4>
                <p className="text-sm text-blue-700 mt-1">
                  You can add musicians now or later after creating the group. 
                  Groups make it easier to assign multiple musicians to events at once.
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-between items-center pt-6 border-t">
            {/* Message Button - Bottom Left */}
            {onMessageGroup && (
              <button
                type="button"
                onClick={() => onMessageGroup(selectedMembers)}
                disabled={selectedMembers.length === 0}
                className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                title={selectedMembers.length === 0 ? 'Add musicians to the group first' : 'Send message to selected members'}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Message Selected ({selectedMembers.length})
              </button>
            )}

            {/* Form Actions - Bottom Right */}
            <div className="flex space-x-4">
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
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
} 