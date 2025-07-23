'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, User, Mail, Phone, Settings, Save, Edit2, 
  Clock, Church, Check, X, Music, Award, Calendar 
} from 'lucide-react'
import Link from 'next/link'
import { AvailabilityCard } from '@/components/profile/availability-card'

interface UserProfile {
  id: string
  email: string
  phone?: string
  firstName: string
  lastName: string
  role: string
  emailNotifications: boolean
  smsNotifications: boolean
  timezone: string
  instruments: string[]
  skillLevel: string
  yearsExperience?: number
  pin?: string
  createdAt: string
  church: {
    name: string
  }
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    emailNotifications: true,
    smsNotifications: true,
    timezone: 'America/Chicago',
    instruments: [] as string[],
    skillLevel: 'INTERMEDIATE',
    yearsExperience: '',
    pin: ''
  })

  useEffect(() => {
    if (session?.user) {
      fetchProfile()
    }
  }, [session])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
        setFormData({
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          phone: data.user.phone || '',
          emailNotifications: data.user.emailNotifications,
          smsNotifications: data.user.smsNotifications,
          timezone: data.user.timezone,
          instruments: data.user.instruments || [],
          skillLevel: data.user.skillLevel || 'INTERMEDIATE',
          yearsExperience: data.user.yearsExperience ? data.user.yearsExperience.toString() : '',
          pin: data.user.pin || ''
        })
      } else {
        setError('Failed to load profile')
      }
    } catch (error) {
      setError('Error loading profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setProfile(data.user)
        setEditing(false)
        setMessage('Profile updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setError(data.error || 'Failed to update profile')
      }
    } catch (error) {
      setError('Error updating profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone || '',
        emailNotifications: profile.emailNotifications,
        smsNotifications: profile.smsNotifications,
        timezone: profile.timezone,
        instruments: profile.instruments || [],
        skillLevel: profile.skillLevel || 'INTERMEDIATE',
        yearsExperience: profile.yearsExperience ? profile.yearsExperience.toString() : '',
        pin: profile.pin || ''
      })
    }
    setEditing(false)
    setError('')
  }

  const formatJoinDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getRoleDisplayName = (role: string) => {
    const roleMap: Record<string, string> = {
      'MUSICIAN': 'Musician',
      'DIRECTOR': 'Music Director',
      'ASSOCIATE_DIRECTOR': 'Associate Director',
      'PASTOR': 'Pastor',
      'ASSOCIATE_PASTOR': 'Associate Pastor'
    }
    return roleMap[role] || role
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view your profile</h1>
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile not found</h1>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                <User className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                  <p className="text-gray-600">Manage your personal information</p>
                </div>
              </div>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Messages */}
        {message && (
          <div className="mb-6 bg-success-50 border border-success-200 rounded-lg p-4">
            <p className="text-success-600 text-sm flex items-center">
              <Check className="h-4 w-4 mr-2" />
              {message}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm flex items-center">
              <X className="h-4 w-4 mr-2" />
              {error}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Personal Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{profile.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{profile.lastName}</p>
                  )}
                </div>

                {/* Email (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    <p className="text-gray-600">{profile.email}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-400 mr-2" />
                      <p className="text-gray-900">{profile.phone || 'Not provided'}</p>
                    </div>
                  )}
                </div>

                {/* PIN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    4-Digit PIN
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="0000"
                      maxLength={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono tracking-widest"
                    />
                  ) : (
                    <div className="flex items-center">
                      <Settings className="h-4 w-4 text-gray-400 mr-2" />
                      <p className="text-gray-900 font-mono tracking-wider">{profile.pin ? '••••' : 'Not set'}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Used for public schedule sign-ups</p>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone
                  </label>
                  {editing ? (
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                    </select>
                  ) : (
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-400 mr-2" />
                      <p className="text-gray-900">
                        {profile.timezone.includes('New_York') && 'Eastern Time'}
                        {profile.timezone.includes('Chicago') && 'Central Time'}
                        {profile.timezone.includes('Denver') && 'Mountain Time'}
                        {profile.timezone.includes('Los_Angeles') && 'Pacific Time'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Musical Skills */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Musical Skills</h2>
              
              <div className="space-y-6">
                {/* Instruments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instruments
                  </label>
                  {editing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {['Piano', 'Organ', 'Guitar', 'Violin', 'Flute', 'Clarinet', 'Trumpet', 
                          'Trombone', 'Drums', 'Bass Guitar', 'Saxophone', 'Cello', 'Voice'].map(instrument => (
                          <label key={instrument} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.instruments.includes(instrument)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ 
                                    ...formData, 
                                    instruments: [...formData.instruments, instrument] 
                                  })
                                } else {
                                  setFormData({ 
                                    ...formData, 
                                    instruments: formData.instruments.filter(i => i !== instrument) 
                                  })
                                }
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                            />
                            <span className="text-sm text-gray-700">{instrument}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {profile?.instruments && profile.instruments.length > 0 ? (
                        profile.instruments.map(instrument => (
                          <span key={instrument} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            {instrument}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 text-sm">No instruments specified</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Skill Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overall Skill Level
                  </label>
                  {editing ? (
                    <select
                      value={formData.skillLevel}
                      onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="BEGINNER">Beginner</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="ADVANCED">Advanced</option>
                      <option value="PROFESSIONAL">Professional</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      profile?.skillLevel === 'BEGINNER' ? 'bg-gray-100 text-gray-800' :
                      profile?.skillLevel === 'INTERMEDIATE' ? 'bg-blue-100 text-blue-800' :
                      profile?.skillLevel === 'ADVANCED' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {profile?.skillLevel === 'BEGINNER' && 'Beginner'}
                      {profile?.skillLevel === 'INTERMEDIATE' && 'Intermediate'}
                      {profile?.skillLevel === 'ADVANCED' && 'Advanced'}
                      {profile?.skillLevel === 'PROFESSIONAL' && 'Professional'}
                    </span>
                  )}
                </div>

                {/* Years of Experience */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Years of Experience
                  </label>
                  {editing ? (
                    <input
                      type="number"
                      min="0"
                      max="80"
                      value={formData.yearsExperience}
                      onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <span className="text-gray-900">
                      {profile?.yearsExperience ? `${profile.yearsExperience} years` : 'Not specified'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Notification Preferences</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                    <p className="text-sm text-gray-500">Receive notifications about events and assignments via email</p>
                  </div>
                  {editing ? (
                    <input
                      type="checkbox"
                      checked={formData.emailNotifications}
                      onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  ) : (
                    <span className={`px-2 py-1 rounded text-xs ${
                      profile.emailNotifications 
                        ? 'bg-success-100 text-success-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile.emailNotifications ? 'Enabled' : 'Disabled'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">SMS Notifications</label>
                    <p className="text-sm text-gray-500">Receive urgent notifications via text message</p>
                  </div>
                  {editing ? (
                    <input
                      type="checkbox"
                      checked={formData.smsNotifications}
                      onChange={(e) => setFormData({ ...formData, smsNotifications: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  ) : (
                    <span className={`px-2 py-1 rounded text-xs ${
                      profile.smsNotifications 
                        ? 'bg-success-100 text-success-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile.smsNotifications ? 'Enabled' : 'Disabled'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Availability Settings - Only show for musicians */}
            {profile.role === 'MUSICIAN' && !editing && (
              <AvailabilityCard isEditable={true} />
            )}

            {/* Action Buttons for Editing */}
            {editing && (
              <div className="flex gap-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center px-6 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Summary</h3>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <User className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{getRoleDisplayName(profile.role)}</p>
                    <p className="text-sm text-gray-500">Role</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Church className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{profile.church.name}</p>
                    <p className="text-sm text-gray-500">Church</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatJoinDate(profile.createdAt)}</p>
                    <p className="text-sm text-gray-500">Member since</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <Link 
                  href="/available-events"
                  className="flex items-center p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Music className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-sm">Browse Available Events</span>
                </Link>
                
                <Link 
                  href="/calendar"
                  className="flex items-center p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Calendar className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-sm">View Calendar</span>
                </Link>

                <Link 
                  href="/settings"
                  className="flex items-center p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Settings className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-sm">Account Settings</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 