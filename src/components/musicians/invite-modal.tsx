'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { X, Plus, Trash2, Users, Mail, Upload, UserPlus } from 'lucide-react'

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
  onInvitesSent?: () => void
}

interface Invitation {
  id: string
  email: string
  name: string
  role: string
}

export function InviteModal({ isOpen, onClose, onInvitesSent }: InviteModalProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteMode, setInviteMode] = useState<'individual' | 'bulk'>('individual')

  const [singleInvite, setSingleInvite] = useState({
    email: '',
    name: '',
    role: 'musician'
  })

  const [bulkInvites, setBulkInvites] = useState<Invitation[]>([])
  const [bulkText, setBulkText] = useState('')

  const roles = [
    'musician',
    'accompanist',
    'vocalist',
    'cantor',
    'organist',
    'pianist',
    'guitarist',
    'drummer',
    'bassist',
    'violinist',
    'other'
  ]

  const addBulkInvite = () => {
    const newInvite: Invitation = {
      id: Date.now().toString(),
      email: '',
      name: '',
      role: 'musician'
    }
    setBulkInvites([...bulkInvites, newInvite])
  }

  const updateBulkInvite = (id: string, field: keyof Omit<Invitation, 'id'>, value: string) => {
    setBulkInvites(bulkInvites.map(invite => 
      invite.id === id ? { ...invite, [field]: value } : invite
    ))
  }

  const removeBulkInvite = (id: string) => {
    setBulkInvites(bulkInvites.filter(invite => invite.id !== id))
  }

  const parseBulkText = () => {
    const lines = bulkText.trim().split('\n')
    const newInvites: Invitation[] = []

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (trimmedLine) {
        // Try to parse email and name from various formats
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
        const emailMatch = trimmedLine.match(emailRegex)
        
        if (emailMatch) {
          const email = emailMatch[1]
          let name = trimmedLine.replace(email, '').replace(/[,\t]/g, '').trim()
          
          // Remove common separators and quotes
          name = name.replace(/^["']|["']$/g, '').trim()
          
          newInvites.push({
            id: (Date.now() + index).toString(),
            email,
            name: name || '',
            role: 'musician'
          })
        }
      }
    })

    setBulkInvites(newInvites)
    setBulkText('')
  }

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const [firstName, ...lastNameParts] = singleInvite.name.trim().split(' ')
      const lastName = lastNameParts.join(' ')

      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'single',
          data: {
            email: singleInvite.email,
            firstName: firstName || '',
            lastName: lastName || '',
            phone: '', // Could add phone field to form later
            message: 'You have been invited to join our church music ministry!'
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send invitation')
      }

      onInvitesSent?.()
      
      // Reset form
      setSingleInvite({
        email: '',
        name: '',
        role: 'musician'
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const validInvites = bulkInvites.filter(invite => invite.email.trim())
    
    if (validInvites.length === 0) {
      setError('Please add at least one valid email address.')
      setLoading(false)
      return
    }

    try {
      const invitations = validInvites.map(invite => {
        const [firstName, ...lastNameParts] = invite.name.trim().split(' ')
        const lastName = lastNameParts.join(' ')
        
        return {
          email: invite.email,
          firstName: firstName || invite.email.split('@')[0], // fallback to email username
          lastName: lastName || '',
          phone: ''
        }
      })

      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'bulk',
          data: {
            invitations,
            message: 'You have been invited to join our church music ministry!'
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send invitations')
      }

      const result = await response.json()
      
      if (result.results?.failed?.length > 0) {
        const failedEmails = result.results.failed.map((f: any) => f.email).join(', ')
        setError(`Some invitations failed: ${failedEmails}`)
      }
      
      onInvitesSent?.()
      
      // Reset form
      setBulkInvites([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitations. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-10 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Invite Musicians</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Mode Selection */}
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setInviteMode('individual')}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                inviteMode === 'individual'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Individual Invite
            </button>
            <button
              onClick={() => setInviteMode('bulk')}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                inviteMode === 'bulk'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="h-4 w-4 mr-2" />
              Bulk Invites
            </button>
          </div>

          {/* Individual Invite */}
          {inviteMode === 'individual' && (
            <form onSubmit={handleSingleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                <input
                  type="email"
                  value={singleInvite.email}
                  onChange={(e) => setSingleInvite(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="musician@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={singleInvite.name}
                  onChange={(e) => setSingleInvite(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={singleInvite.role}
                  onChange={(e) => setSingleInvite(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                >
                  {roles.map(role => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {loading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          )}

          {/* Bulk Invites */}
          {inviteMode === 'bulk' && (
            <div className="space-y-6">
              {/* Bulk Text Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste Email List
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  placeholder="Paste emails here, one per line:&#10;john@example.com&#10;Jane Smith <jane@example.com>&#10;mike.wilson@example.com"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">
                    Supported formats: email@domain.com or "Name" &lt;email@domain.com&gt;
                  </p>
                  <button
                    type="button"
                    onClick={parseBulkText}
                    disabled={!bulkText.trim()}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Parse List
                  </button>
                </div>
              </div>



              {bulkInvites.length > 0 && (
                <form onSubmit={handleBulkSubmit}>
                  <div className="flex justify-end space-x-4 pt-6 border-t">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {loading ? 'Sending...' : `Send ${bulkInvites.filter(i => i.email.trim()).length} Invitations`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 