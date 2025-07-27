'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Users, Plus, Search, UserPlus, Music, Phone, Calendar, Check, X, Edit2, Filter, Download, Eye, EyeOff, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { InviteModal } from '../../components/musicians/invite-modal'
import InvitationModal from '../../components/musicians/invitation-modal'
import { COMMON_INSTRUMENTS } from '@/lib/constants'

interface Musician {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  isVerified: boolean
  createdAt: string
  status?: 'active' | 'pending' | 'inactive'
  instruments?: string[]
  groups?: Array<{
    id: string
    name: string
  }>
  pin?: string
}

interface EditingMusician {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  status: 'active' | 'pending' | 'inactive'
  instruments: string[]
  groups: Array<{
    id: string
    name: string
  }>
}

interface Group {
  id: string
  name: string
  description?: string
}

interface PinCellProps {
  musician: Musician & { pin?: string }
  showPin: boolean
  onPinUpdate: () => void
}

function PinCell({ musician, showPin, onPinUpdate }: PinCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [pinValue, setPinValue] = useState(musician.pin || '')
  const [isLoading, setIsLoading] = useState(false)

  const handleSavePin = async () => {
    if (pinValue.length !== 4 || !/^\d{4}$/.test(pinValue)) {
      alert('PIN must be exactly 4 digits')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/musicians/${musician.id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue })
      })

      if (response.ok) {
        setIsEditing(false)
        onPinUpdate()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to update PIN')
      }
    } catch (error) {
      console.error('Error updating PIN:', error)
      alert('Failed to update PIN')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGeneratePin = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/musicians/${musician.id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body to generate random PIN
      })

      if (response.ok) {
        const data = await response.json()
        setPinValue(data.pin)
        setIsEditing(false)
        onPinUpdate()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to generate PIN')
      }
    } catch (error) {
      console.error('Error generating PIN:', error)
      alert('Failed to generate PIN')
    } finally {
      setIsLoading(false)
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={pinValue}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="0000"
          className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center font-mono"
          maxLength={4}
        />
        <button
          onClick={handleSavePin}
          disabled={isLoading || pinValue.length !== 4}
          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
          title="Save PIN"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setIsEditing(false)
            setPinValue(musician.pin || '')
          }}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={handleGeneratePin}
          disabled={isLoading}
          className="p-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
          title="Generate random PIN"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-mono text-gray-700">
        {showPin ? (musician.pin || '----') : '••••'}
      </span>
      <button
        onClick={() => setIsEditing(true)}
        className="p-1 text-gray-400 hover:text-gray-600"
        title="Edit PIN"
      >
        <Edit2 className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function MusiciansPage() {
  const { data: session } = useSession()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showInvitationLinkModal, setShowInvitationLinkModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [musicians, setMusicians] = useState<Musician[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<EditingMusician | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all')
  const [exporting, setExporting] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [showPins, setShowPins] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [musicianToDelete, setMusicianToDelete] = useState<Musician | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const fetchGroups = async () => {
    setLoadingGroups(true)
    try {
      const response = await fetch('/api/groups')
      if (response.ok) {
        const data = await response.json()
        setAvailableGroups(data.groups || [])
      } else {
        console.error('Failed to fetch groups')
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    } finally {
      setLoadingGroups(false)
    }
  }

  const handleInvitesSent = () => {
    // Refresh the musicians list after sending invites
    fetchMusicians()
  }

  const startEditing = (musician: Musician) => {
    setEditingId(musician.id)
    
    // Debug: Log the original instruments
    console.log('🔍 DEBUG: Original musician instruments:', musician.instruments)
    console.log('🔍 DEBUG: Available instruments:', availableInstruments)
    
    // Use case-insensitive matching to find matching instruments
    const matchedInstruments = (musician.instruments || [])
      .map(musicianInst => {
        // Find matching instrument from availableInstruments (case-insensitive)
        const match = availableInstruments.find(availableInst => 
          availableInst.toLowerCase() === musicianInst.toLowerCase()
        )
        return match || musicianInst // Use the properly cased version or original if no match
      })
    
    console.log('🔍 DEBUG: Matched instruments:', matchedInstruments)
    
    setEditingData({
      id: musician.id,
      firstName: musician.firstName,
      lastName: musician.lastName,
      email: musician.email,
      phone: musician.phone || '',
      status: musician.status || (musician.isVerified ? 'active' : 'pending'),
      instruments: matchedInstruments,
      groups: musician.groups || []
    })
    // Fetch available groups when editing starts
    fetchGroups()
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingData(null)
  }

  const saveEdit = async () => {
    if (!editingData) return

    // Debug: Log user role
    console.log('💾 DEBUG: Current user role:', session?.user?.role)
    console.log('💾 DEBUG: Current user church ID:', session?.user?.churchId)

    setSaving(true)
    try {
      // First, update the musician's basic info
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
          status: editingData.status,
          instruments: editingData.instruments
        }),
      })

      if (!response.ok) {
        console.error('Failed to update musician - Response status:', response.status)
        try {
          const errorData = await response.json()
          alert(`Failed to update musician: ${errorData.error || 'Please try again.'}`)
        } catch {
          alert('Failed to update musician. Please try again.')
        }
        return
      }

      // Get the original musician data to compare groups
      const originalMusician = musicians.find(m => m.id === editingData.id)
      const originalGroups = originalMusician?.groups || []
      const newGroups = editingData.groups

      // Find groups to add and remove
      const groupsToAdd = newGroups.filter(newGroup => 
        !originalGroups.some(oldGroup => oldGroup.id === newGroup.id)
      )
      const groupsToRemove = originalGroups.filter(oldGroup => 
        !newGroups.some(newGroup => newGroup.id === oldGroup.id)
      )

      // Handle group membership changes
      const groupPromises = []

      // Add musician to new groups
      for (const group of groupsToAdd) {
        groupPromises.push(
          fetch('/api/groups', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              groupId: group.id,
              action: 'add',
              musicianId: editingData.id
            })
          })
        )
      }

      // Remove musician from old groups
      for (const group of groupsToRemove) {
        groupPromises.push(
          fetch('/api/groups', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              groupId: group.id,
              action: 'remove',
              musicianId: editingData.id
            })
          })
        )
      }

      // Wait for all group operations to complete
      await Promise.all(groupPromises)

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
              isVerified: editingData.status === 'active',
              instruments: editingData.instruments,
              groups: editingData.groups
            }
          : musician
      ))
      setEditingId(null)
      setEditingData(null)

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

  const handleGroupToggle = (group: Group) => {
    if (!editingData) return

    const isCurrentlyMember = editingData.groups.some(g => g.id === group.id)
    
    if (isCurrentlyMember) {
      // Remove from groups
      setEditingData({
        ...editingData,
        groups: editingData.groups.filter(g => g.id !== group.id)
      })
    } else {
      // Add to groups
      setEditingData({
        ...editingData,
        groups: [...editingData.groups, { id: group.id, name: group.name }]
      })
    }
  }

  const handleInstrumentToggle = (instrument: string) => {
    if (!editingData) return

    const isCurrentlySelected = editingData.instruments.includes(instrument)
    
    if (isCurrentlySelected) {
      // Remove from instruments
      setEditingData({
        ...editingData,
        instruments: editingData.instruments.filter(i => i !== instrument)
      })
    } else {
      // Add to instruments
      setEditingData({
        ...editingData,
        instruments: [...editingData.instruments, instrument]
      })
    }
  }

  const handleExport = async () => {
    if (!session?.user?.churchId) return
    
    setExporting(true)
    try {
      const response = await fetch('/api/musicians/export', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // Create a download link
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Get filename from response headers or use default
        const contentDisposition = response.headers.get('content-disposition')
        let filename = 'musicians_export.csv'
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]*)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }
        
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Failed to export: ${errorData.error || 'Please try again.'}`)
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('Error exporting data. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteClick = (musician: Musician) => {
    setMusicianToDelete(musician)
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!musicianToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/musicians/${musicianToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove musician from local state
        setMusicians(prev => prev.filter(m => m.id !== musicianToDelete.id))
        setDeleteModalOpen(false)
        setMusicianToDelete(null)
        // If we were editing this musician, cancel the edit
        if (editingId === musicianToDelete.id) {
          cancelEditing()
        }
      } else {
        const errorData = await response.json()
        alert(`Failed to delete musician: ${errorData.error || 'Please try again.'}`)
      }
    } catch (error) {
      console.error('Error deleting musician:', error)
      alert('Error deleting musician. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false)
    setMusicianToDelete(null)
  }

  // Check if user can edit musicians
  const canEditMusicians = session?.user?.role && ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)

  // Available instrument/role options (shared with join page)
  const availableInstruments = COMMON_INSTRUMENTS

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
                <Users className="h-8 w-8 text-success-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Musicians</h1>
                  <p className="text-sm text-gray-600">{session.user?.churchName || 'Your Church'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {canEditMusicians && (
                <button 
                  onClick={handleExport}
                  disabled={exporting || musicians.length === 0}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
              )}
              {canEditMusicians && (
                <button 
                  onClick={() => setShowInvitationLinkModal(true)}
                  className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invitation Link
                </button>
              )}
              {canEditMusicians && (
                <button 
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Email Invites
                </button>
              )}
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
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
                className="inline-flex items-center px-6 py-3 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors"
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
                      Instruments/Roles
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
                    {canEditMusicians && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <span>PIN</span>
                          <button
                            onClick={() => setShowPins(!showPins)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title={showPins ? "Hide PINs" : "Show PINs"}
                          >
                            {showPins ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Groups
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    {canEditMusicians && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMusicians.length === 0 ? (
                    /* No results message */
                    <tr>
                      <td colSpan={canEditMusicians ? 8 : 6} className="px-6 py-12 text-center">
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
                            <div className="h-10 w-10 rounded-full bg-success-100 flex items-center justify-center">
                              <span className="text-success-600 font-medium text-sm">
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
                          <div className="max-w-96">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-gray-700 mb-2">Select Instruments/Roles:</div>
                              <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-1">
                                {availableInstruments.map((instrument) => {
                                  const isSelected = editingData.instruments.includes(instrument)
                                  return (
                                    <label
                                      key={instrument}
                                      className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleInstrumentToggle(instrument)}
                                        className="h-3 w-3 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                      />
                                      <span className="text-gray-700 capitalize">{instrument}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 max-w-96">
                            {musician.instruments && musician.instruments.length > 0 ? (
                              musician.instruments.map((instrument, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center justify-center px-8 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                                >
                                  {instrument.charAt(0).toUpperCase() + instrument.slice(1)}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 italic col-span-2">No instruments specified</span>
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
                              ? 'bg-success-100 text-success-800' 
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
                      {canEditMusicians && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <PinCell 
                            musician={musician} 
                            showPin={showPins}
                            onPinUpdate={() => fetchMusicians()}
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingId === musician.id && editingData ? (
                          <div className="max-w-64">
                            {loadingGroups ? (
                              <div className="text-xs text-gray-400">Loading groups...</div>
                            ) : availableGroups.length > 0 ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-gray-700 mb-2">Select Groups:</div>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {availableGroups.map((group) => {
                                    const isSelected = editingData.groups.some(g => g.id === group.id)
                                    return (
                                      <label
                                        key={group.id}
                                        className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleGroupToggle(group)}
                                          className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="text-gray-700">{group.name}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">No groups available</div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {musician.groups && musician.groups.length > 0 ? (
                              musician.groups.map((group) => (
                                <span
                                  key={group.id}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {group.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 italic">No groups</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(musician.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      {canEditMusicians && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {editingId === musician.id ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button 
                                onClick={saveEdit}
                                disabled={saving}
                                className="text-success-600 hover:text-success-900 disabled:opacity-50"
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
                              <button 
                                onClick={() => handleDeleteClick(musician)}
                                disabled={saving}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                title="Delete musician"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditing(musician)}
                              className="inline-flex items-center px-2 py-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                              title="Edit musician"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      )}
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
        {canEditMusicians && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => setShowInvitationLinkModal(true)}
              className="bg-white rounded-xl shadow-sm border p-6 hover:border-brand-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center mb-4">
                <UserPlus className="h-8 w-8 text-brand-600 mr-3" />
                <h3 className="font-medium text-gray-900">Invitation Link</h3>
              </div>
              <p className="text-sm text-gray-600">Share a link or QR code for musicians to join themselves</p>
            </button>

            <button 
              onClick={() => setShowInviteModal(true)}
              className="bg-white rounded-xl shadow-sm border p-6 hover:border-success-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center mb-4">
                <UserPlus className="h-8 w-8 text-success-600 mr-3" />
                <h3 className="font-medium text-gray-900">Email Invites</h3>
              </div>
              <p className="text-sm text-gray-600">Send personal invitations or import multiple musicians</p>
            </button>

            <Link 
              href="/groups"
              className="bg-white rounded-xl shadow-sm border p-6 hover:border-secondary-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center mb-4">
                <Music className="h-8 w-8 text-secondary-600 mr-3" />
                <h3 className="font-medium text-gray-900">Create Groups</h3>
              </div>
              <p className="text-sm text-gray-600">Organize musicians into choirs or ensembles</p>
            </Link>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <InviteModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvitesSent={handleInvitesSent}
      />

      {/* Invitation Link Modal */}
      <InvitationModal 
        isOpen={showInvitationLinkModal}
        onClose={() => setShowInvitationLinkModal(false)}
      />

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Musician
                </h3>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete{' '}
                <span className="font-medium">
                  {musicianToDelete?.firstName} {musicianToDelete?.lastName}
                </span>
                ? This action cannot be undone and will remove all their event assignments and group memberships.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 