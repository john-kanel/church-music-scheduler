'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Music, Users, Plus, ArrowLeft, Edit2, Trash2, X, UserPlus, UserMinus, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { CreateGroupModal } from '@/components/groups/create-group-modal'
import { SendMessageModal } from '@/components/messages/send-message-modal'

export default function GroupsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<any>(null)
  const [messagingGroup, setMessagingGroup] = useState<any>(null)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user?.churchId) {
      fetchGroups()
    }
  }, [session])

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGroupCreated = () => {
    fetchGroups() // Refresh the groups list
  }

  const handleEditGroup = (group: any) => {
    setEditingGroup(group)
    setShowEditModal(true)
  }

  const handleGroupUpdated = () => {
    fetchGroups() // Refresh the groups list
    setShowEditModal(false)
    setEditingGroup(null)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const canCreateGroups = ['DIRECTOR', 'PASTOR'].includes(session.user.role)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Music className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                {session.user.churchName}
              </span>
            </div>
            <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-blue-600 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Users className="h-8 w-8 mr-3 text-success-600" />
                Groups
              </h1>
              <p className="text-gray-600 mt-2">Organize musicians into groups like choir, band, or ensemble</p>
            </div>
            {canCreateGroups && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </button>
            )}
          </div>
        </div>

        {/* Groups List */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="p-8 text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading groups...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="p-8">
              <div className="text-center py-16">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No groups created yet</h3>
                <p className="text-gray-600 mb-6">
                  Create groups to organize your musicians by ensembles, choirs, or instruments.
                </p>
                {canCreateGroups && (
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-success-600 text-white px-6 py-3 rounded-lg hover:bg-success-700 transition-colors"
                  >
                    Create Your First Group
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map((group: any) => (
                  <div
                    key={group.id}
                    className="border border-gray-200 rounded-lg p-6 hover:border-success-300 hover:shadow-md transition-all relative group cursor-pointer"
                    onClick={() => {
                      // Open read-only modal by reusing edit modal with a readOnly flag
                      setEditingGroup(group)
                      setShowEditModal(true)
                    }}
                  >
                    {/* Edit button - only show for directors/pastors */}
                    {canCreateGroups && (
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="p-2 text-gray-400 hover:text-success-600 hover:bg-success-50 rounded-full shadow-lg border border-gray-200 bg-white transition-colors"
                          title="Edit group"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 pr-8">{group.name}</h3>
                      <span className="bg-success-100 text-success-800 text-xs px-2 py-1 rounded-lg">
                        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    
                    {group.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{group.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{group.assignmentCount} assignments</span>
                      <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGroupCreated={handleGroupCreated}
        onMessageGroup={(members) => {
          setMessagingGroup({ name: 'Selected Members', members })
          setShowMessageModal(true)
        }}
      />

      {/* Edit Group Modal */}
      <EditGroupModal 
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingGroup(null)
        }}
        group={editingGroup}
        onGroupUpdated={handleGroupUpdated}
        onMessageGroup={(group) => {
          setMessagingGroup(group)
          setShowMessageModal(true)
        }}
      />

      {/* Send Message Modal */}
      <SendMessageModal
        isOpen={showMessageModal}
        onClose={() => {
          setShowMessageModal(false)
          setMessagingGroup(null)
        }}
        onMessageSent={() => {
          setShowMessageModal(false)
          setMessagingGroup(null)
          fetchGroups()
        }}
        recipients={messagingGroup?.members || []}
        groupName={messagingGroup?.name}
      />
    </div>
  )
}

// Edit Group Modal Component
function EditGroupModal({ isOpen, onClose, group, onGroupUpdated, onMessageGroup }: {
  isOpen: boolean
  onClose: () => void
  group: any
  onGroupUpdated: () => void
  onMessageGroup: (group: any) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaderIds: [] as string[]
  })
  const [readOnly, setReadOnly] = useState(true)

  // Musicians management state
  const [musicians, setMusicians] = useState<any[]>([])
  const [loadingMusicians, setLoadingMusicians] = useState(false)
  const [selectedMusicianId, setSelectedMusicianId] = useState('')
  const [currentMembers, setCurrentMembers] = useState<any[]>([])

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name || '',
        description: group.description || '',
        leaderIds: Array.isArray(group.leaderIds) ? group.leaderIds : []
      })
      setCurrentMembers(group.members || [])
      
      // Fetch musicians when group is loaded
      if (isOpen) {
        fetchMusicians()
      }
      setReadOnly(true)
    }
  }, [group, isOpen])

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

  const handleLeaderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions).map(opt => opt.value)
    setFormData(prev => ({ ...prev, leaderIds: selected }))
  }

  const handleAddMusician = async () => {
    if (!selectedMusicianId || !group) return

    setMembershipLoading(true)
    try {
      const response = await fetch('/api/groups', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          groupId: group.id,
          action: 'add',
          musicianId: selectedMusicianId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add musician')
      }

      // Find the musician and add to current members
      const musician = musicians.find(m => m.id === selectedMusicianId)
      if (musician) {
        setCurrentMembers(prev => [...prev, {
          id: musician.id,
          name: `${musician.firstName} ${musician.lastName}`,
          email: musician.email,
          role: musician.role,
          joinedAt: new Date().toISOString()
        }])
      }

      setSelectedMusicianId('')
      setSuccess('Musician added successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add musician')
      setTimeout(() => setError(''), 3000)
    } finally {
      setMembershipLoading(false)
    }
  }

  const handleRemoveMusician = async (musicianId: string) => {
    if (!group) return

    setMembershipLoading(true)
    try {
      const response = await fetch('/api/groups', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          groupId: group.id,
          action: 'remove',
          musicianId: musicianId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove musician')
      }

      // Remove from current members
      setCurrentMembers(prev => prev.filter(member => member.id !== musicianId))
      setSuccess('Musician removed successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove musician')
      setTimeout(() => setError(''), 3000)
    } finally {
      setMembershipLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!group) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/groups', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          groupId: group.id,
          updates: {
            name: formData.name,
            description: formData.description,
            leaderIds: formData.leaderIds
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update group')
      }

      setSuccess('Group updated successfully!')
      
      // Wait a moment to show success message, then close
      setTimeout(() => {
        onGroupUpdated()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Get available musicians (not already in group)
  const availableMusicians = musicians.filter(musician => 
    !currentMembers.some(member => member.id === musician.id)
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backgroundColor: '#E9EFE9'}}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            {readOnly ? 'Group Details' : (
              <>
                <Edit2 className="h-6 w-6 mr-2 text-blue-600" /> Edit Group
              </>
            )}
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-600 text-sm flex items-center">
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {success}
              </p>
            </div>
          )}

          {/* Group Details Section */}
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
                disabled={readOnly}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${readOnly ? 'bg-gray-50' : ''}`}
                placeholder="e.g., Adult Choir, Youth Band, Praise Team"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                disabled={readOnly}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${readOnly ? 'bg-gray-50' : ''}`}
                placeholder="Brief description of the group's purpose, role, and any special requirements..."
              />
            </div>
          </section>

          {/* Leaders Section */}
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Leaders</h3>
            <select
              multiple
              value={formData.leaderIds}
              onChange={handleLeaderChange}
              disabled={readOnly}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${readOnly ? 'bg-gray-50' : ''}`}
            >
              {musicians
                .filter(m => (m.status === 'active'))
                .map(m => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} ({m.email})
                  </option>
                ))}
            </select>
          </section>

          {/* Musicians Management Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Musicians ({currentMembers.length})
            </h3>

            {/* Add Musicians */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Add Musician</label>
              <div className="flex gap-3">
                <select
                  value={selectedMusicianId}
                  onChange={(e) => setSelectedMusicianId(e.target.value)}
                  disabled={loadingMusicians || membershipLoading}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:opacity-50"
                >
                  <option value="">
                    {loadingMusicians ? 'Loading musicians...' : 'Select a musician to add'}
                  </option>
                  {availableMusicians.map((musician) => (
                    <option key={musician.id} value={musician.id}>
                      {musician.firstName} {musician.lastName} ({musician.email})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMusician}
                  disabled={!selectedMusicianId || membershipLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {membershipLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Add
                </button>
              </div>
            </div>

            {/* Current Members */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Current Members</label>
              {currentMembers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No musicians in this group yet</p>
                  <p className="text-sm">Use the dropdown above to add members</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {currentMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-600">{member.email}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMusician(member.id)}
                        disabled={membershipLoading}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Remove from group"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

            <div className="flex justify-between items-center pt-6 border-t">
            {/* Message Button - Bottom Left */}
            <button
              type="button"
              onClick={() => onMessageGroup(group)}
              disabled={currentMembers.length === 0}
              className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              title={currentMembers.length === 0 ? 'Add musicians to the group first' : 'Send message to all group members'}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Message Group ({currentMembers.length})
            </button>

            {/* Form Actions - Bottom Right */}
            <div className="flex space-x-4">
              {/* PDF Button */}
              <a
                href={`/api/groups/${group.id}/assignments/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Download Upcoming Assignments (PDF)
              </a>

              {/* Toggle Edit */}
              <button
                type="button"
                onClick={() => setReadOnly(r => !r)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {readOnly ? 'Edit' : 'View'}
              </button>

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
                className="px-6 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : success ? (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Updated!
                  </>
                ) : (
                  <>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Update Group
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