'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Users, Plus, Search, UserPlus, Music, Phone, Calendar, Check, X, Edit2, Filter } from 'lucide-react'
import Link from 'next/link'
import { InviteModal } from '../../components/musicians/invite-modal'

interface Musician {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  isVerified: boolean
  createdAt: string
  status?: 'active' | 'pending' | 'inactive'
}

interface EditingMusician {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  status: 'active' | 'pending' | 'inactive'
}

export default function MusiciansPage() {
  const { data: session } = useSession()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [musicians, setMusicians] = useState<Musician[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<EditingMusician | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all')

  // Fetch musicians
  useEffect(() => {
    if (session?.user?.churchId) {
      fetchMusicians()
    }
  }, [session])

  const fetchMusicians = async () => {
    try {
      const response = await fetch('/api/musicians')
      if (response.ok) {
        const data = await response.json()
        setMusicians(data.musicians || [])
      } else {
        console.error('Failed to fetch musicians')
      }
    } catch (error) {
      console.error('Error fetching musicians:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInvitesSent = () => {
    // Refresh the musicians list after sending invites
    fetchMusicians()
  }

  const startEditing = (musician: Musician) => {
    setEditingId(musician.id)
    setEditingData({
      id: musician.id,
      firstName: musician.firstName,
      lastName: musician.lastName,
      email: musician.email,
      phone: musician.phone || '',
      status: musician.status || (musician.isVerified ? 'active' : 'pending')
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingData(null)
  }

  const saveEdit = async () => {
    if (!editingData) return

    // Debug: Log user role
    console.log('Current user role:', session?.user?.role)
    console.log('Current user church ID:', session?.user?.churchId)

    setSaving(true)
    try {
      const response = await fetch(`/api/musicians/${editingData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: editingData.firstName,
          lastName: editingData.lastName,
          email: editingData.email,
          phone: editingData.phone || null,
          status: editingData.status
        }),
      })

      if (response.ok) {
        const result = await response.json()
        // Update the local state
        setMusicians(prev => prev.map(musician => 
          musician.id === editingData.id 
            ? { 
                ...musician, 
                firstName: editingData.firstName,
                lastName: editingData.lastName,
                email: editingData.email,
                phone: editingData.phone || undefined,
                status: editingData.status,
                isVerified: editingData.status === 'active'
              }
            : musician
        ))
        setEditingId(null)
        setEditingData(null)
      } else {
        console.error('Failed to update musician - Response status:', response.status)
        try {
          const errorData = await response.json()
          alert(`Failed to update musician: ${errorData.error || 'Please try again.'}`)
        } catch {
          alert('Failed to update musician. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error updating musician:', error?.toString?.() || 'Unknown error')
      alert('Error updating musician. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleEditingChange = (field: keyof EditingMusician, value: string) => {
    if (editingData) {
      setEditingData({ ...editingData, [field]: value })
    }
  }

  // Check if user can edit musicians
  const canEditMusicians = session?.user?.role && ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)

  // Filter musicians based on search term and status
  const filteredMusicians = musicians.filter(musician => {
    const matchesSearch = `${musician.firstName} ${musician.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      musician.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Determine the actual status of the musician
    let musicianStatus: 'active' | 'pending' | 'inactive'
    if (musician.status) {
      // If status is explicitly set, use it
      musicianStatus = musician.status
    } else {
      // Fall back to isVerified for legacy data
      musicianStatus = musician.isVerified ? 'active' : 'pending'
    }
    
    const matchesStatus = statusFilter === 'all' || musicianStatus === statusFilter
    
    return matchesSearch && matchesStatus
  })

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view musicians</h1>
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link 
                href="/dashboard" 
                className="flex items-center text-gray-600 hover:text-gray-900 mr-6"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </Link>
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Musicians</h1>
                  <p className="text-sm text-gray-600">{session.user?.churchName || 'Your Church'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setShowInviteModal(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Musicians
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Musicians List */}
        <div className="bg-white rounded-xl shadow-sm border">
          {/* Musicians Header */}
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Church Musicians</h2>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search musicians..."
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 w-64"
                  />
                </div>
                <span className="text-sm text-gray-600">
                  {loading ? 'Loading...' : `${filteredMusicians.length} musicians`}
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading musicians...</p>
            </div>
          ) : musicians.length === 0 ? (
            /* Empty State - No musicians at all */
            <div className="p-8 text-center">
              <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No Musicians Added Yet</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Start building your music ministry by inviting musicians to join your church. You can add accompanists, vocalists, and other musicians.
              </p>
              <button 
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Invite Your First Musicians
              </button>
            </div>
          ) : (
            /* Musicians Table - Always show headers */
            <>
              {!canEditMusicians && (
                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 mb-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        <strong>Note:</strong> You have view-only access. Only Directors, Pastors, and Associate Pastors can edit musician information.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Musician
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <span>Status</span>
                        <div className="relative">
                          <button
                            onClick={() => {
                              const filterElement = document.getElementById('status-filter')
                              if (filterElement) {
                                filterElement.classList.toggle('hidden')
                              }
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Filter className="h-4 w-4" />
                          </button>
                          <div id="status-filter" className="hidden absolute top-6 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                            <button
                              onClick={() => {
                                setStatusFilter('all')
                                document.getElementById('status-filter')?.classList.add('hidden')
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${statusFilter === 'all' ? 'bg-blue-50 text-blue-700' : ''}`}
                            >
                              All
                            </button>
                            <button
                              onClick={() => {
                                setStatusFilter('active')
                                document.getElementById('status-filter')?.classList.add('hidden')
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${statusFilter === 'active' ? 'bg-blue-50 text-blue-700' : ''}`}
                            >
                              Active
                            </button>
                            <button
                              onClick={() => {
                                setStatusFilter('pending')
                                document.getElementById('status-filter')?.classList.add('hidden')
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${statusFilter === 'pending' ? 'bg-blue-50 text-blue-700' : ''}`}
                            >
                              Pending
                            </button>
                            <button
                              onClick={() => {
                                setStatusFilter('inactive')
                                document.getElementById('status-filter')?.classList.add('hidden')
                              }}
                              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${statusFilter === 'inactive' ? 'bg-blue-50 text-blue-700' : ''}`}
                            >
                              Inactive
                            </button>
                          </div>
                        </div>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMusicians.length === 0 ? (
                    /* No results message */
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No musicians match this filter
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {searchTerm && statusFilter !== 'all' 
                            ? `No musicians found matching "${searchTerm}" with status "${statusFilter}".`
                            : searchTerm 
                            ? `No musicians found matching "${searchTerm}".`
                            : `No musicians have "${statusFilter}" status.`
                          }
                        </p>
                        <div className="flex justify-center space-x-3">
                          {searchTerm && (
                            <button 
                              onClick={() => setSearchTerm('')}
                              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700"
                            >
                              Clear search
                            </button>
                          )}
                          {statusFilter !== 'all' && (
                            <button 
                              onClick={() => setStatusFilter('all')}
                              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700"
                            >
                              Show all statuses
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMusicians.map((musician) => (
                    <tr key={musician.id} className={`hover:bg-gray-50 ${editingId === musician.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-green-600 font-medium text-sm">
                                {musician.firstName.charAt(0)}{musician.lastName.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 min-w-0 flex-1">
                            {editingId === musician.id && editingData ? (
                              <div className="grid grid-cols-1 gap-1">
                                <input
                                  type="text"
                                  value={editingData.firstName}
                                  onChange={(e) => handleEditingChange('firstName', e.target.value)}
                                  className="text-sm font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 w-32"
                                  placeholder="First Name"
                                />
                                <input
                                  type="text"
                                  value={editingData.lastName}
                                  onChange={(e) => handleEditingChange('lastName', e.target.value)}
                                  className="text-sm font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 w-32"
                                  placeholder="Last Name"
                                />
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-gray-900">
                                {musician.firstName} {musician.lastName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingId === musician.id && editingData ? (
                          <div className="grid grid-cols-1 gap-1">
                            <input
                              type="email"
                              value={editingData.email}
                              onChange={(e) => handleEditingChange('email', e.target.value)}
                              className="text-sm text-gray-900 border border-gray-300 rounded px-2 py-1 w-48"
                              placeholder="Email"
                            />
                            <input
                              type="tel"
                              value={editingData.phone}
                              onChange={(e) => handleEditingChange('phone', e.target.value)}
                              className="text-sm text-gray-500 border border-gray-300 rounded px-2 py-1 w-36"
                              placeholder="Phone (optional)"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm text-gray-900 flex items-center">
                              <span className="mr-2">📧</span>
                              {musician.email}
                            </div>
                            {musician.phone && (
                              <div className="text-sm text-gray-500 flex items-center mt-1">
                                <Phone className="h-4 w-4 text-gray-400 mr-2" />
                                {musician.phone}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingId === musician.id && editingData ? (
                          <select
                            value={editingData.status}
                            onChange={(e) => setEditingData({
                              ...editingData,
                              status: e.target.value as 'active' | 'pending' | 'inactive'
                            })}
                            className="w-24 px-2 py-1 text-xs font-semibold border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        ) : (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            (musician.status === 'active' || (!musician.status && musician.isVerified))
                              ? 'bg-green-100 text-green-800' 
                              : musician.status === 'inactive'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {musician.status === 'active' || (!musician.status && musician.isVerified) 
                              ? 'Active' 
                              : musician.status === 'inactive'
                              ? 'Inactive'
                              : 'Pending'
                            }
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(musician.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingId === musician.id ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button 
                              onClick={saveEdit}
                              disabled={saving}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              title="Save changes"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={cancelEditing}
                              disabled={saving}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Cancel editing"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : canEditMusicians ? (
                          <button
                            onClick={() => startEditing(musician)}
                            className="inline-flex items-center px-2 py-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                            title="Edit musician"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400" title="Insufficient permissions to edit">
                            View only
                          </span>
                        )}
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => setShowInviteModal(true)}
            className="bg-white rounded-xl shadow-sm border p-6 hover:border-green-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center mb-4">
              <UserPlus className="h-8 w-8 text-green-600 mr-3" />
              <h3 className="font-medium text-gray-900">Individual Invite</h3>
            </div>
            <p className="text-sm text-gray-600">Send a personal invitation to a specific musician</p>
          </button>

          <button 
            onClick={() => setShowInviteModal(true)}
            className="bg-white rounded-xl shadow-sm border p-6 hover:border-blue-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center mb-4">
              <Users className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="font-medium text-gray-900">Bulk Invites</h3>
            </div>
            <p className="text-sm text-gray-600">Import multiple musicians from a list or spreadsheet</p>
          </button>

          <Link 
            href="/groups"
            className="bg-white rounded-xl shadow-sm border p-6 hover:border-purple-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center mb-4">
              <Music className="h-8 w-8 text-purple-600 mr-3" />
              <h3 className="font-medium text-gray-900">Create Groups</h3>
            </div>
            <p className="text-sm text-gray-600">Organize musicians into choirs or ensembles</p>
          </Link>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvitesSent={handleInvitesSent}
      />
    </div>
  )
} 