'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { 
  HandHeart, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  User, 
  Mail, 
  Lock,
  Crown,
  Building
} from 'lucide-react'

interface OwnershipTransfer {
  id: string
  inviteeEmail: string
  inviteeFirstName?: string
  inviteeLastName?: string
  inviteeRole: string
  status: string
  retireCurrentOwner: boolean
  currentOwnerRetireAt?: string
  expiresAt: string
  church: {
    name: string
  }
  inviter: {
    firstName: string
    lastName: string
  }
}

export default async function AcceptOwnershipPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  
  return <AcceptOwnershipClient token={token} />
}

function AcceptOwnershipClient({ token }: { token: string }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [transfer, setTransfer] = useState<OwnershipTransfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [needsAccount, setNeedsAccount] = useState(false)
  
  // Account creation form
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    const fetchTransfer = async () => {
      try {
        const response = await fetch(`/api/ownership-transfers/${token}`)
        if (response.ok) {
          const data = await response.json()
          setTransfer(data.transfer)
          
          // Pre-fill name fields if available
          if (data.transfer.inviteeFirstName) {
            setFirstName(data.transfer.inviteeFirstName)
          }
          if (data.transfer.inviteeLastName) {
            setLastName(data.transfer.inviteeLastName)
          }
        } else {
          const errorData = await response.json()
          setError(errorData.error || 'Invalid or expired invitation')
        }
      } catch (err) {
        setError('Failed to load invitation')
      } finally {
        setLoading(false)
      }
    }

    fetchTransfer()
  }, [token])

  useEffect(() => {
    if (transfer && status !== 'loading') {
      if (!session) {
        // Check if user already exists
        checkUserExists()
      } else if (session.user?.email !== transfer.inviteeEmail) {
        setError('You must be signed in with the invited email address to accept this invitation')
      }
    }
  }, [transfer, session, status])

  const checkUserExists = async () => {
    try {
      const response = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: transfer?.inviteeEmail })
      })
      
      const data = await response.json()
      if (data.exists) {
        setNeedsAccount(false)
      } else {
        setNeedsAccount(true)
      }
    } catch (err) {
      setNeedsAccount(true)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setAccepting(true)
    
    try {
      // Create account
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: transfer?.inviteeEmail,
          firstName,
          lastName,
          password,
          ownershipToken: token
        })
      })

      if (response.ok) {
        // Sign in the new user
        const result = await signIn('credentials', {
          email: transfer?.inviteeEmail,
          password,
          redirect: false
        })

        if (result?.ok) {
          // Accept the ownership transfer
          await acceptTransfer()
        } else {
          setError('Failed to sign in after account creation')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to create account')
      }
    } catch (err) {
      setError('Failed to create account')
    } finally {
      setAccepting(false)
    }
  }

  const handleSignIn = async () => {
    await signIn('credentials', { 
      callbackUrl: `/accept-ownership/${token}`,
      email: transfer?.inviteeEmail 
    })
  }

  const acceptTransfer = async () => {
    setAccepting(true)
    
    try {
      const response = await fetch(`/api/ownership-transfers/${token}/accept`, {
        method: 'POST'
      })

      if (response.ok) {
        router.push('/dashboard?welcome=owner')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to accept invitation')
      }
    } catch (err) {
      setError('Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invitation</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    )
  }

  if (!transfer) {
    return null
  }

  const isExpired = new Date() > new Date(transfer.expiresAt)
  
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border p-8 text-center">
          <Clock className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invitation Expired</h1>
          <p className="text-gray-600 mb-6">
            This ownership invitation has expired. Please contact {transfer.inviter.firstName} {transfer.inviter.lastName} 
            to request a new invitation.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <HandHeart className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ownership Invitation</h1>
            <p className="text-gray-600">
              You've been invited to join <strong>{transfer.church.name}</strong>
            </p>
          </div>

          {/* Invitation Details */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Crown className="h-5 w-5 text-blue-600 mt-1 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">
                  {transfer.inviteeRole.replace('_', ' ')} Role
                </h3>
                <p className="text-sm text-blue-800 mb-2">
                  {transfer.inviter.firstName} {transfer.inviter.lastName} has invited you to become a{' '}
                  <strong>{transfer.inviteeRole.toLowerCase().replace('_', ' ')}</strong> at {transfer.church.name}.
                </p>
                <p className="text-sm text-blue-700">
                  You'll have full access to manage events, musicians, communications, and all church settings.
                </p>
                {transfer.retireCurrentOwner && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800 font-medium">
                      ⚠️ This is a full ownership transfer. The current owner will retire their account 30 days after you accept.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Authentication/Account Creation */}
          {!session ? (
            needsAccount ? (
              // Create new account
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Create Your Account</h3>
                  <p className="text-sm text-gray-600">
                    Complete your profile to accept this invitation
                  </p>
                </div>

                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
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
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
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
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      value={transfer.inviteeEmail}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      disabled
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Minimum 8 characters"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={accepting}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {accepting ? 'Creating Account...' : 'Create Account & Accept Invitation'}
                </button>
              </form>
            ) : (
              // Sign in to existing account
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Sign In to Accept</h3>
                <p className="text-sm text-gray-600 mb-6">
                  You already have an account with this email. Please sign in to accept the invitation.
                </p>
                <button
                  onClick={handleSignIn}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign In to Accept Invitation
                </button>
              </div>
            )
          ) : (
            // User is signed in, show accept button
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Ready to Accept</h3>
              <p className="text-sm text-gray-600 mb-6">
                Click below to accept your invitation and gain access to {transfer.church.name}.
              </p>
              <button
                onClick={acceptTransfer}
                disabled={accepting}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-xs text-gray-500">
              This invitation expires on {new Date(transfer.expiresAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 