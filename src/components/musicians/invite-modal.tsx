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
  const [success, setSuccess] = useState('')
  const [inviteMode, setInviteMode] = useState<'individual' | 'bulk'>('individual')

  const [singleInvite, setSingleInvite] = useState({
    email: '',
    name: '',
    role: 'musician'
  })

  const [bulkInvites, setBulkInvites] = useState<Invitation[]>([])
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvError, setCsvError] = useState('')

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

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setCsvError('Please select a CSV file')
      return
    }

    setCsvFile(file)
    setCsvError('')

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      parseCsvData(text)
    }
    reader.readAsText(file)
  }

  const parseCsvData = (csvText: string) => {
    const lines = csvText.trim().split('\n')
    const newInvites: Invitation[] = []

    // Skip header row if it exists
    const dataLines = lines[0].toLowerCase().includes('first name') || 
                     lines[0].toLowerCase().includes('last name') || 
                     lines[0].toLowerCase().includes('email') 
                     ? lines.slice(1) 
                     : lines

    dataLines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (trimmedLine) {
        const columns = trimmedLine.split(',').map(col => col.trim().replace(/^["']|["']$/g, ''))
        
        if (columns.length >= 3) {
          const firstName = columns[0]
          const lastName = columns[1]
          const email = columns[2]
          
          // Basic email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (emailRegex.test(email)) {
            newInvites.push({
              id: (Date.now() + index).toString(),
              email,
              name: `${firstName} ${lastName}`.trim(),
              role: 'musician'
            })
          }
        }
      }
    })

    setBulkInvites(newInvites)
  }

  const downloadCsvTemplate = () => {
    const csvContent = 'First Name,Last Name,Email\nJohn,Smith,john.smith@example.com\nJane,Doe,jane.doe@example.com'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'musician_invites_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

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

      const result = await response.json()
      
      // Show appropriate success message based on environment
      let successMessage = result.message || `Invitation sent successfully to ${singleInvite.email}! They can now sign in with their email and temporary password.`
      
      if (result.isDevelopmentMode) {
        successMessage = `Development mode: User created for ${singleInvite.email}! Login: ${result.credentials.email} / ${result.credentials.temporaryPassword} (Email simulated - check console)`
      }
      
      setSuccess(successMessage)
      
      // Wait longer for development mode messages
      const timeout = result.isDevelopmentMode ? 5000 : 2000
      setTimeout(() => {
        onInvitesSent?.()
        onClose()
        
        // Reset form
        setSingleInvite({
          email: '',
          name: '',
          role: 'musician'
        })
        setSuccess('')
      }, timeout)
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
    setSuccess('')

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
      
      let successMessage = `Successfully sent ${result.results?.successful?.length || validInvites.length} invitation(s)!`
      
      if (result.results?.failed?.length > 0) {
        const failedEmails = result.results.failed.map((f: any) => f.email).join(', ')
        successMessage += ` Some invitations failed: ${failedEmails}`
        setError(`Some invitations failed: ${failedEmails}`)
      } else {
        setSuccess(successMessage + ' All musicians can now sign in with their email and temporary passwords.')
        
        // Wait a moment to show success message, then close
        setTimeout(() => {
          onInvitesSent?.()
          onClose()
          
          // Reset form
          setBulkInvites([])
          setCsvFile(null)
          setSuccess('')
        }, 2500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitations. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Invite Musicians</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900 disabled:opacity-50"
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

          {success && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4 mb-6">
              <p className="text-success-600 text-sm flex items-center">
                <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {success}
              </p>
            </div>
          )}

          {/* Mode Selection */}
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setInviteMode('individual')}
              disabled={loading}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                inviteMode === 'individual'
                  ? 'bg-success-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Individual Invite
            </button>
            <button
              onClick={() => setInviteMode('bulk')}
              disabled={loading}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                inviteMode === 'bulk'
                  ? 'bg-success-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="h-4 w-4 mr-2" />
              Bulk Invites
            </button>
          </div>

          {/* Disclaimer for all invite types */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Get More Information About Your Musicians
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    Consider using the <strong>Invitation Link</strong> instead! It collects detailed information about musicians including their instruments, skill levels, years of experience, and group preferences. This helps you better organize your music ministry and assign appropriate roles.
                  </p>
                </div>
              </div>
            </div>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-transparent text-gray-900"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-transparent text-gray-900"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={singleInvite.role}
                  onChange={(e) => setSingleInvite(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-transparent text-gray-900"
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
                  disabled={loading}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !!success}
                  className="flex items-center px-6 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : success ? (
                    <>
                      <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Sent!
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Bulk Invites */}
          {inviteMode === 'bulk' && (
            <div className="space-y-6">
              {/* CSV Upload */}
              <div className="flex items-center space-x-4 mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-0">
                  Upload CSV
                </label>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="text-success-600 hover:underline text-sm font-semibold bg-transparent border-none p-0 focus:outline-none"
                  style={{ background: 'none', boxShadow: 'none' }}
                >
                  Download CSV Template
                </button>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-transparent text-gray-900"
              />
              {csvError && (
                <p className="text-red-500 text-sm mt-2">{csvError}</p>
              )}

              {/* Show review section and submit button as soon as file is uploaded */}
              <div className="space-y-4 mt-6">
                {bulkInvites.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Review Invitations ({bulkInvites.length} musicians)
                    </h3>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {bulkInvites.map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{invite.name}</div>
                            <div className="text-xs text-gray-600">{invite.email}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBulkInvite(invite.id)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Always show the form with submit button */}
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
                      disabled={loading || bulkInvites.length === 0}
                      className="flex items-center px-6 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {loading ? 'Sending...' : `Send ${bulkInvites.filter(i => i.email.trim()).length} Invitations`}
                    </button>
                  </div>
                </form>
              </div>


            </div>
          )}
        </div>
      </div>
    </div>
  )
} 