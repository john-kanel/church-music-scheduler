'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Logo } from '@/components/ui/logo'
import { Mail, User, Phone, Lock, Music, Users, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react'
import { COMMON_INSTRUMENTS } from '@/lib/constants'

interface Church {
  id: string
  name: string
  groups: Array<{
    id: string
    name: string
    description?: string
  }>
}

interface FormData {
  email: string
  firstName: string
  lastName: string
  phone: string
  password: string
  confirmPassword: string
  instruments: string[]
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PROFESSIONAL'
  yearsExperience: number | null
  groupIds: string[]
}

const SKILL_LEVELS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'PROFESSIONAL', label: 'Professional' }
]



export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const slug = params?.slug as string

  const [church, setChurch] = useState<Church | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    instruments: [],
    skillLevel: 'INTERMEDIATE',
    yearsExperience: null,
    groupIds: []
  })

  const [showInstruments, setShowInstruments] = useState(false)
  const [showGroups, setShowGroups] = useState(false)

  // Redirect if user is already logged in
  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  // Load church data
  useEffect(() => {
    if (!slug) return

    const loadChurch = async () => {
      try {
        const response = await fetch(`/api/join/${slug}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Invitation link not found')
          } else if (response.status === 410) {
            setError('This invitation link is no longer active')
          } else {
            setError('Failed to load invitation')
          }
          return
        }

        const data = await response.json()
        setChurch(data.church)
      } catch (err) {
        setError('Failed to load invitation')
      } finally {
        setLoading(false)
      }
    }

    loadChurch()
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.phone || !formData.password) {
      setError('Please fill in all required fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/join/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          password: formData.password,
          instruments: formData.instruments,
          skillLevel: formData.skillLevel,
          yearsExperience: formData.yearsExperience || undefined,
          groupIds: formData.groupIds
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create account')
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('Failed to create account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleInstrument = (instrument: string) => {
    setFormData(prev => ({
      ...prev,
      instruments: prev.instruments.includes(instrument)
        ? prev.instruments.filter(i => i !== instrument)
        : [...prev.instruments, instrument]
    }))
  }

  const toggleGroup = (groupId: string) => {
    setFormData(prev => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter(id => id !== groupId)
        : [...prev.groupIds, groupId]
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Logo size="xl" />
            </div>
            <div className="text-red-500 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Invitation Error
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <a
              href="/"
              className="inline-block bg-brand-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-700 transition-colors"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Logo size="xl" />
            </div>
            <div className="text-green-500 mb-4">
              <CheckCircle className="h-12 w-12 mx-auto mb-2" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to {church?.name}!
            </h2>
            <p className="text-gray-600 mb-6">
              Your account has been created successfully. Check your email for login details.
            </p>
            <a
              href="/auth/signin"
              className="inline-block bg-brand-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-700 transition-colors"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Logo size="xl" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Join {church?.name}
            </h1>
            <p className="text-gray-600">
              Create your account to join the music ministry
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="First name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="Last name"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Password</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="Min 8 characters"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Musical Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Musical Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instruments/Talents
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowInstruments(!showInstruments)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <Music className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-gray-700">
                        {formData.instruments.length > 0 
                          ? `${formData.instruments.length} selected` 
                          : 'Select instruments'
                        }
                      </span>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showInstruments ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showInstruments && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {COMMON_INSTRUMENTS.map((instrument) => (
                        <label key={instrument} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.instruments.includes(instrument)}
                            onChange={() => toggleInstrument(instrument)}
                            className="mr-3 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-gray-700">{instrument}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skill Level
                  </label>
                  <select
                    value={formData.skillLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, skillLevel: e.target.value as any }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    {SKILL_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.yearsExperience || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, yearsExperience: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="Years"
                  />
                </div>
              </div>
            </div>

            {/* Groups */}
            {church?.groups && church.groups.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Groups (Optional)</h3>
                <p className="text-sm text-gray-600">Select which groups you'd like to join:</p>
                
                <div className="space-y-2">
                  {church.groups.map((group) => (
                    <label key={group.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.groupIds.includes(group.id)}
                        onChange={() => toggleGroup(group.id)}
                        className="mt-1 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{group.name}</div>
                        {group.description && (
                          <div className="text-sm text-gray-600">{group.description}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <a href="/auth/signin" className="text-brand-600 hover:text-brand-700 font-medium">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 