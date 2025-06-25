'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  HandHeart, 
  Mail, 
  User, 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  UserPlus,
  Crown
} from 'lucide-react'
import Link from 'next/link'

interface OwnershipTransfer {
  id: string
  inviteeEmail: string
  inviteeFirstName?: string
  inviteeLastName?: string
  inviteeRole: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED' | 'COMPLETED'
  retireCurrentOwner: boolean
  currentOwnerRetireAt?: string
  expiresAt: string
  createdAt: string
  reminderSentAt?: string
}

export default function TransferOwnershipPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [existingTransfers, setExistingTransfers] = useState<OwnershipTransfer[]>([])
  const [showForm, setShowForm] = useState(false)
  
  // Form state
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('DIRECTOR')
  const [retireCurrentOwner, setRetireCurrentOwner] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Check authentication and permissions
  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (session.user?.role !== 'DIRECTOR' && session.user?.role !== 'PASTOR') {
      router.push('/dashboard')
      return
    }

    setLoading(false)
  }, [session, status, router])

  // Fetch existing transfers
  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const response = await fetch('/api/ownership-transfers')
        if (response.ok) {
          const data = await response.json()
          setExistingTransfers(data.transfers)
        }
      } catch (error) {
        console.error('Error fetching transfers:', error)
      }
    }

    if (!loading) {
      fetchTransfers()
    }
  }, [loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!showConfirmation) {
      setShowConfirmation(true)
      return
    }

    setSubmitting(true)
    
    try {
      const response = await fetch('/api/ownership-transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          role,
          retireCurrentOwner,
        }),
      })

      if (response.ok) {
        // Reset form and refresh transfers
        setEmail('')
        setFirstName('')
        setLastName('')
        setRole('DIRECTOR')
        setRetireCurrentOwner(false)
        setShowForm(false)
        setShowConfirmation(false)
        
        // Refresh transfers list
        const refreshResponse = await fetch('/api/ownership-transfers')
        if (refreshResponse.ok) {
          const data = await refreshResponse.json()
          setExistingTransfers(data.transfers)
        }
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      alert('Failed to send invitation')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-100'
      case 'ACCEPTED': return 'text-success-600 bg-success-100'
      case 'EXPIRED': return 'text-red-600 bg-red-100'
      case 'CANCELLED': return 'text-gray-600 bg-gray-100'
      case 'COMPLETED': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4" />
      case 'ACCEPTED': return <CheckCircle className="h-4 w-4" />
      case 'EXPIRED': return <AlertCircle className="h-4 w-4" />
      case 'CANCELLED': return <AlertCircle className="h-4 w-4" />
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDaysRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diffTime = expires.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Dashboard
              </Link>
              <div className="flex items-center">
                <HandHeart className="h-6 w-6 text-blue-600 mr-2" />
                <h1 className="text-2xl font-bold text-gray-900">Add or Transfer Ownership</h1>
              </div>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add New Owner
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Information Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <Crown className="h-6 w-6 text-blue-600 mt-1 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Church Account Ownership
              </h3>
              <p className="text-blue-800 mb-3">
                You can add additional owners (directors, pastors, associate pastors) to your church account 
                or transfer complete ownership to someone else.
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• New owners will have full access to manage events, musicians, and settings</li>
                <li>• Invitations expire after 30 days</li>
                <li>• You'll receive reminders if invitations are still pending</li>
                <li>• Payment will continue with the current method during transitions</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Add New Owner Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Invite New Owner</h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setShowConfirmation(false)
                  setEmail('')
                  setFirstName('')
                  setLastName('')
                  setRole('DIRECTOR')
                  setRetireCurrentOwner(false)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="DIRECTOR">Director</option>
                      <option value="ASSOCIATE_DIRECTOR">Associate Director</option>
                      <option value="PASTOR">Pastor</option>
                      <option value="ASSOCIATE_PASTOR">Associate Pastor</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter first name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Transfer Ownership Option */}
              <div className="border-t pt-6">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="retireCurrentOwner"
                    checked={retireCurrentOwner}
                    onChange={(e) => setRetireCurrentOwner(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <label htmlFor="retireCurrentOwner" className="text-sm font-medium text-gray-700">
                      If you want to transfer ownership of the account and retire your own access
                    </label>
                    <p className="text-sm text-gray-500 mt-1">
                      Checking this box will deactivate your account 30 days after the invitation is sent. 
                      The payment method will continue to work, but your login credentials will become inactive.
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation Dialog */}
              {showConfirmation && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-800">Final Confirmation</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        You are about to invite <strong>{email}</strong> as a <strong>{role.toLowerCase().replace('_', ' ')}</strong>.
                        {retireCurrentOwner && (
                          <span className="block mt-2 font-medium">
                            ⚠️ Your account will be deactivated in 30 days after sending this invitation.
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-yellow-700 mt-2">
                        Are you sure you want to proceed?
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                {showConfirmation && (
                  <button
                    type="button"
                    onClick={() => setShowConfirmation(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Go Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Sending...' : showConfirmation ? 'Send Invitation' : 'Review Invitation'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Existing Transfers */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Ownership Invitations</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track pending and completed ownership transfers
            </p>
          </div>

          <div className="p-6">
            {existingTransfers.length === 0 ? (
              <div className="text-center py-8">
                <HandHeart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No ownership invitations yet</h3>
                <p className="text-gray-600">
                  When you invite someone to become an owner, they'll appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {existingTransfers.map((transfer) => (
                  <div key={transfer.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h4 className="text-lg font-medium text-gray-900">
                            {transfer.inviteeFirstName && transfer.inviteeLastName 
                              ? `${transfer.inviteeFirstName} ${transfer.inviteeLastName}` 
                              : transfer.inviteeEmail}
                          </h4>
                          <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transfer.status)}`}>
                            {getStatusIcon(transfer.status)}
                            <span className="ml-1">{transfer.status}</span>
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {transfer.inviteeEmail} • {transfer.inviteeRole.replace('_', ' ')}
                        </p>
                        <div className="flex items-center text-sm text-gray-500 mt-2 space-x-4">
                          <span>Invited {formatDate(transfer.createdAt)}</span>
                          {transfer.status === 'PENDING' && (
                            <span>
                              Expires in {getDaysRemaining(transfer.expiresAt)} days
                            </span>
                          )}
                          {transfer.retireCurrentOwner && (
                            <span className="text-amber-600 font-medium">
                              Will retire current owner
                            </span>
                          )}
                        </div>
                        {transfer.status === 'PENDING' && transfer.reminderSentAt && (
                          <p className="text-sm text-blue-600 mt-1">
                            Reminder sent {formatDate(transfer.reminderSentAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 