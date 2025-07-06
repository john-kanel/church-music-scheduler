'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, User, MapPin, Bell, Lock, CreditCard, Save, Edit3, Zap, Clock, Mail, Users, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface ServicePart {
  id: string
  name: string
  isRequired: boolean
  order: number
  isNew?: boolean
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('personal')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    // Personal Information
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    phone: '',
    
    // Parish Information
    churchName: session?.user?.churchName || '',
    parishAddress: '',
    parishCity: '',
    parishState: '',
    parishZip: '',
    parishPhone: '',
    parishWebsite: '',
    
    // Notification Preferences
    emailNotifications: true,
    smsNotifications: false,
    eventReminders: true,
    invitationAlerts: true,
    weeklyDigest: true,
    
    // Other Settings
    timeZone: 'America/Chicago',
    defaultEventDuration: '60',
    autoAssignMusicians: false
  })

  // Automation Settings
  const [automationSettings, setAutomationSettings] = useState({
    musicianNotifications: [
      { id: '1', hoursBeforeEvent: 168, isEnabled: true }, // 1 week
      { id: '2', hoursBeforeEvent: 24, isEnabled: true }   // 24 hours
    ],
    pastorEmailEnabled: true,
    pastorMonthlyReportDay: 27,
    pastorWeeklyReportEnabled: false,
    pastorWeeklyReportDay: 0, // Sunday
    pastorDailyDigestEnabled: true,
    pastorDailyDigestTime: '08:00'
  })

  const [pastorEmail, setPastorEmail] = useState('')
  const [pastorName, setPastorName] = useState('')

  // Service Parts Management
  const [serviceParts, setServiceParts] = useState<ServicePart[]>([])
  const [loadingServiceParts, setLoadingServiceParts] = useState(false)
  const [draggedItem, setDraggedItem] = useState<ServicePart | null>(null)

  useEffect(() => {
    if (session?.user?.role === 'DIRECTOR' || session?.user?.role === 'ASSOCIATE_DIRECTOR') {
      fetchAutomationSettings()
      fetchServiceParts()
    }
    fetchUserProfile()
  }, [session])

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        const user = data.user
        setFormData(prev => ({
          ...prev,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone || '',
          emailNotifications: user.emailNotifications,
          smsNotifications: user.smsNotifications,
          timeZone: user.timezone
        }))
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const fetchAutomationSettings = async () => {
    try {
      const response = await fetch('/api/automation-settings')
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setAutomationSettings(data)
        }
      }
    } catch (error) {
      console.error('Error fetching automation settings:', error)
    }
  }

  const fetchServiceParts = async () => {
    setLoadingServiceParts(true)
    try {
      const response = await fetch('/api/service-parts')
      if (response.ok) {
        const data = await response.json()
        setServiceParts(data.serviceParts || [])
      }
    } catch (error) {
      console.error('Error fetching service parts:', error)
    } finally {
      setLoadingServiceParts(false)
    }
  }

  const addServicePart = () => {
    const newServicePart = {
      id: `temp-${Date.now()}`,
      name: '',
      isRequired: false,
      order: serviceParts.length,
      isNew: true
    }
    setServiceParts([...serviceParts, newServicePart])
  }

  const updateServicePart = (id: string, field: keyof ServicePart, value: any) => {
    setServiceParts(serviceParts.map(part => 
      part.id === id ? { ...part, [field]: value } : part
    ))
  }

  const removeServicePart = async (id: string) => {
    if (id.startsWith('temp-')) {
      // Remove from local state only
      setServiceParts(serviceParts.filter(part => part.id !== id))
      return
    }

    // For existing service parts, check for usage first
    try {
      const response = await fetch(`/api/service-parts/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setServiceParts(serviceParts.filter(part => part.id !== id))
        setSuccess('Service part deleted successfully!')
      } else {
        const data = await response.json()
        
        if (data.usageCount > 0) {
          // Show confirmation dialog for parts in use
          const confirmDelete = window.confirm(
            `${data.message}\n\nThis will mark ${data.templateUsage} template(s) and ${data.eventUsage} event(s) as "Custom". Do you want to continue?`
          )
          
          if (confirmDelete) {
            // Force delete
            const forceResponse = await fetch(`/api/service-parts/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ forceDelete: true })
            })
            
            if (forceResponse.ok) {
              setServiceParts(serviceParts.filter(part => part.id !== id))
              setSuccess('Service part deleted. Existing usages marked as "Custom".')
            } else {
              const forceData = await forceResponse.json()
              alert(forceData.error || 'Failed to delete service part')
            }
          }
        } else {
          alert(data.error || 'Failed to delete service part')
        }
      }
    } catch (error) {
      console.error('Error deleting service part:', error)
      alert('Failed to delete service part')
    }
  }

  const saveServiceParts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/service-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceParts })
      })
      
      if (response.ok) {
        const data = await response.json()
        setServiceParts(data.serviceParts)
        setSuccess('Service parts saved successfully!')
      } else {
        throw new Error('Failed to save service parts')
      }
    } catch (error) {
      console.error('Error saving service parts:', error)
      alert('Failed to save service parts')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, item: ServicePart) => {
    setDraggedItem(item)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetItem: ServicePart) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetItem.id) return

    const newServiceParts = [...serviceParts]
    const draggedIndex = newServiceParts.findIndex(part => part.id === draggedItem.id)
    const targetIndex = newServiceParts.findIndex(part => part.id === targetItem.id)

    // Remove dragged item and insert at target position
    const [draggedPart] = newServiceParts.splice(draggedIndex, 1)
    newServiceParts.splice(targetIndex, 0, draggedPart)

    // Update order values
    newServiceParts.forEach((part, index) => {
      part.order = index
    })

    setServiceParts(newServiceParts)
    setDraggedItem(null)
  }

  const tabs = [
    { id: 'personal', name: 'Personal', icon: User },
    { id: 'church', name: 'Church', icon: MapPin },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    ...(session?.user?.role === 'DIRECTOR' || session?.user?.role === 'ASSOCIATE_DIRECTOR' 
      ? [
          { id: 'automations', name: 'Automations', icon: Zap },
          { id: 'service-parts', name: 'Service Parts', icon: Users }
        ] 
      : []),
    { id: 'preferences', name: 'Preferences', icon: Lock },
    { id: 'billing', name: 'Billing', icon: CreditCard }
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleAutomationChange = (field: string, value: any) => {
    setAutomationSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addMusicianNotification = () => {
    const newNotification = {
      id: Date.now().toString(),
      hoursBeforeEvent: 72, // Default 3 days
      isEnabled: true
    }
    setAutomationSettings(prev => ({
      ...prev,
      musicianNotifications: [...prev.musicianNotifications, newNotification]
    }))
  }

  const removeMusicianNotification = (id: string) => {
    setAutomationSettings(prev => ({
      ...prev,
      musicianNotifications: prev.musicianNotifications.filter(n => n.id !== id)
    }))
  }

  const updateMusicianNotification = (id: string, field: string, value: any) => {
    setAutomationSettings(prev => ({
      ...prev,
      musicianNotifications: prev.musicianNotifications.map(n => 
        n.id === id ? { ...n, [field]: value } : n
      )
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess('')

    try {
      if (activeTab === 'automations') {
        await saveAutomationSettings()
      } else if (activeTab === 'personal') {
        await savePersonalSettings()
      } else if (activeTab === 'service-parts') {
        await saveServiceParts()
      } else {
        // For now, simulate saving other settings
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      
      setSuccess('Settings saved successfully!')
      setIsEditing(false)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveAutomationSettings = async () => {
    const response = await fetch('/api/automation-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(automationSettings)
    })
    
    if (!response.ok) {
      throw new Error('Failed to save automation settings')
    }
  }

  const savePersonalSettings = async () => {
    // Extract first and last name from the full name
    const names = formData.name.trim().split(' ')
    const firstName = names[0] || ''
    const lastName = names.slice(1).join(' ') || ''

    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        phone: formData.phone,
        emailNotifications: formData.emailNotifications,
        smsNotifications: formData.smsNotifications,
        timezone: formData.timeZone
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to save personal settings')
    }
  }

  const invitePastor = async () => {
    if (!pastorEmail || !pastorName) return

    try {
      setLoading(true)
      const response = await fetch('/api/pastor-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pastorEmail,
          name: pastorName
        })
      })

      if (response.ok) {
        setSuccess('Pastor invitation sent successfully!')
        setPastorEmail('')
        setPastorName('')
      }
    } catch (error) {
      console.error('Error inviting pastor:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatHours = (hours: number) => {
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (remainingHours === 0) return `${days} day${days !== 1 ? 's' : ''}`
    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to access settings</h1>
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
                <User className="h-8 w-8 text-gray-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                  <p className="text-sm text-gray-600">Manage your account and preferences</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                                        className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Edit3 className="h-4 w-4 mr-1.5" />
                  Edit Settings
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>

        {success && (
          <div className="mb-6 bg-success-50 border border-success-200 rounded-lg p-4">
            <p className="text-success-600 text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information Tab */}
          {activeTab === 'personal' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time Zone</label>
                  <select
                    name="timeZone"
                    value={formData.timeZone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Church Information Tab */}
          {activeTab === 'church' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                Church Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Church Name</label>
                  <input
                    type="text"
                    name="churchName"
                    value={formData.churchName}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    name="parishAddress"
                    value={formData.parishAddress}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="123 Main Street"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    name="parishCity"
                    value={formData.parishCity}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    name="parishState"
                    value={formData.parishState}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="NY"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                  <input
                    type="text"
                    name="parishZip"
                    value={formData.parishZip}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="12345"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Church Phone</label>
                  <input
                    type="tel"
                    name="parishPhone"
                    value={formData.parishPhone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Church Website</label>
                  <input
                    type="url"
                    name="parishWebsite"
                    value={formData.parishWebsite}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="https://www.yourparish.org"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <Bell className="h-5 w-5 mr-2 text-blue-600" />
                Notification Preferences
              </h2>
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="emailNotifications"
                    checked={formData.emailNotifications}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Email Notifications</span>
                    <p className="text-sm text-gray-500">Receive notifications via email</p>
                  </div>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="smsNotifications"
                    checked={formData.smsNotifications}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium text-gray-900">SMS Notifications</span>
                    <p className="text-sm text-gray-500">Receive urgent notifications via text message</p>
                  </div>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="eventReminders"
                    checked={formData.eventReminders}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Event Reminders</span>
                    <p className="text-sm text-gray-500">Get reminders before events</p>
                  </div>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="invitationAlerts"
                    checked={formData.invitationAlerts}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Invitation Alerts</span>
                    <p className="text-sm text-gray-500">Get notified when musicians respond to invitations</p>
                  </div>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="weeklyDigest"
                    checked={formData.weeklyDigest}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="mr-3"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Weekly Digest</span>
                    <p className="text-sm text-gray-500">Receive a weekly summary of activity</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Automations Tab */}
          {activeTab === 'automations' && (
            <div className="space-y-8">
              {/* Musician Notifications */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Musician Notifications
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Configure when musicians receive automatic email notifications about events they're assigned to.
                </p>

                <div className="space-y-4">
                  {automationSettings.musicianNotifications.map((notification) => (
                    <div key={notification.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={notification.isEnabled}
                          onChange={(e) => updateMusicianNotification(notification.id, 'isEnabled', e.target.checked)}
                          disabled={!isEditing}
                          className="mr-3"
                        />
                        <span className="text-sm font-medium text-gray-900">Send notification</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={notification.hoursBeforeEvent}
                          onChange={(e) => updateMusicianNotification(notification.id, 'hoursBeforeEvent', parseInt(e.target.value))}
                          disabled={!isEditing}
                          min="1"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-50"
                        />
                        <span className="text-sm text-gray-600">hours before event</span>
                        <span className="text-xs text-gray-500">({formatHours(notification.hoursBeforeEvent)})</span>
                      </div>

                      {automationSettings.musicianNotifications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMusicianNotification(notification.id)}
                          disabled={!isEditing}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  {isEditing && (
                    <button
                      type="button"
                      onClick={addMusicianNotification}
                      className="flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Another Notification
                    </button>
                  )}
                </div>
              </div>

              {/* Pastor Notifications */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-blue-600" />
                  Pastor Notifications
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Configure automatic email notifications for pastors and assistant pastors.
                </p>

                <div className="space-y-6">
                  {/* Monthly Report Settings */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Monthly Report</h3>
                    <div className="space-y-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={automationSettings.pastorEmailEnabled}
                          onChange={(e) => handleAutomationChange('pastorEmailEnabled', e.target.checked)}
                          disabled={!isEditing}
                          className="mr-3"
                        />
                        <span className="text-sm font-medium text-gray-900">Send monthly event report</span>
                      </label>

                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">Send on the</span>
                        <select
                          value={automationSettings.pastorMonthlyReportDay}
                          onChange={(e) => handleAutomationChange('pastorMonthlyReportDay', parseInt(e.target.value))}
                          disabled={!isEditing || !automationSettings.pastorEmailEnabled}
                          className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-50"
                        >
                          {Array.from({ length: 28 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                        <span className="text-sm text-gray-600">of each month</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Report will include all events for the following month as a PDF attachment.
                      </p>
                    </div>
                  </div>

                  {/* Weekly Report Settings */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Weekly Report</h3>
                    <div className="space-y-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={automationSettings.pastorWeeklyReportEnabled}
                          onChange={(e) => handleAutomationChange('pastorWeeklyReportEnabled', e.target.checked)}
                          disabled={!isEditing}
                          className="mr-3"
                        />
                        <span className="text-sm font-medium text-gray-900">Send weekly event report</span>
                      </label>

                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">Send on</span>
                        <select
                          value={automationSettings.pastorWeeklyReportDay}
                          onChange={(e) => handleAutomationChange('pastorWeeklyReportDay', parseInt(e.target.value))}
                          disabled={!isEditing || !automationSettings.pastorWeeklyReportEnabled}
                          className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-50"
                        >
                          <option value={0}>Sunday</option>
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                        </select>
                        <span className="text-sm text-gray-600">of each week</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                        <p className="text-xs text-amber-800">
                          <strong>Note:</strong> If you select any day following Sunday (Monday-Saturday), the report will include events for the <em>following</em> week (Monday-Sunday). 
                          If you select Sunday, the report will include events for the <em>current</em> week (Sunday-Saturday).
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        Report will include all scheduled events for the relevant week as a PDF attachment.
                      </p>
                    </div>
                  </div>

                  {/* Daily Digest Settings */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Daily Digest</h3>
                    <div className="space-y-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={automationSettings.pastorDailyDigestEnabled}
                          onChange={(e) => handleAutomationChange('pastorDailyDigestEnabled', e.target.checked)}
                          disabled={!isEditing}
                          className="mr-3"
                        />
                        <span className="text-sm font-medium text-gray-900">Send daily digest of changes</span>
                      </label>

                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">Send at</span>
                        <input
                          type="time"
                          value={automationSettings.pastorDailyDigestTime}
                          onChange={(e) => handleAutomationChange('pastorDailyDigestTime', e.target.value)}
                          disabled={!isEditing || !automationSettings.pastorDailyDigestEnabled}
                          className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-50"
                        />
                        <span className="text-sm text-gray-600">each day</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Only sent if there were changes in the previous day (new events, assignments, cancellations).
                      </p>
                    </div>
                  </div>

                  {/* Pastor Invitation */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Add Pastor</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Invite your pastor or associate pastor to receive these automated notifications.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Pastor's Name</label>
                        <input
                          type="text"
                          value={pastorName}
                          onChange={(e) => setPastorName(e.target.value)}
                          disabled={!isEditing}
                          placeholder="Fr. John Doe"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Pastor's Email</label>
                        <input
                          type="email"
                          value={pastorEmail}
                          onChange={(e) => setPastorEmail(e.target.value)}
                          disabled={!isEditing}
                          placeholder="pastor@church.org"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-50"
                        />
                      </div>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={invitePastor}
                        disabled={!pastorEmail || !pastorName || loading}
                        className="mt-4 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send Invitation
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Service Parts Tab */}
          {activeTab === 'service-parts' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Service Parts Management
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Define the parts of your services (e.g., Opening Hymn, Communion Song, etc.) that will appear in event creation
                </p>
              </div>

              {loadingServiceParts ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                  <p className="text-gray-500 mt-2">Loading service parts...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {serviceParts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-8 w-8 mx-auto mb-2" />
                      <p>No service parts defined yet</p>
                      {isEditing && (
                        <button
                          onClick={addServicePart}
                          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white text-sm font-medium rounded-lg hover:from-brand-700 hover:to-brand-800 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                          Add your first service part
                        </button>
                      )}
                    </div>
                  ) : (
                    serviceParts.map((part, index) => (
                      <div
                        key={part.id}
                        draggable={isEditing}
                        onDragStart={(e) => handleDragStart(e, part)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, part)}
                        className={`flex items-center space-x-4 p-4 border border-gray-200 rounded-lg transition-colors ${
                          isEditing ? 'cursor-move hover:bg-gray-50' : ''
                        } ${draggedItem?.id === part.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center text-gray-400">
                          <span className="text-sm font-mono">{index + 1}</span>
                        </div>
                        
                        <div className="flex-1">
                          <input
                            type="text"
                            value={part.name}
                            onChange={(e) => updateServicePart(part.id, 'name', e.target.value)}
                            disabled={!isEditing}
                            placeholder="Service part name (e.g., Opening Hymn, Communion Song)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:border-transparent"
                          />
                        </div>

                        <div className="flex items-center">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={part.isRequired}
                              onChange={(e) => updateServicePart(part.id, 'isRequired', e.target.checked)}
                              disabled={!isEditing}
                              className="mr-2 text-brand-600"
                            />
                            <span className="text-sm text-gray-700">Required</span>
                          </label>
                        </div>

                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => removeServicePart(part.id)}
                            className="p-2.5 text-red-600 hover:text-white hover:bg-gradient-to-r hover:from-red-600 hover:to-red-700 rounded-lg transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-lg"
                            title="Delete service part"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                  
                  {/* Save button for existing service parts */}
                  {isEditing && serviceParts.length > 0 && (
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={addServicePart}
                        className="flex items-center px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-700 text-white text-sm font-medium rounded-lg hover:from-brand-700 hover:to-brand-800 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another Service Part
                      </button>
                      <button
                        type="button"
                        onClick={saveServiceParts}
                        disabled={loading}
                        className="flex items-center px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-medium rounded-lg hover:from-emerald-700 hover:to-emerald-800 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? 'Saving...' : 'Save Parts'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!isEditing && serviceParts.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">How Service Parts Work</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• These parts will appear as dropdown options when creating events</li>
                    <li>• Required parts will automatically be added to new events</li>
                    <li>• You can reorder parts by dragging when editing</li>
                    <li>• Deleting a part that's in use will mark it as "Custom" in existing events</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <Lock className="h-5 w-5 mr-2 text-blue-600" />
                Application Preferences
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Event Duration (minutes)</label>
                  <select
                    name="defaultEventDuration"
                    value={formData.defaultEventDuration}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="autoAssignMusicians"
                      checked={formData.autoAssignMusicians}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="mr-3"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Auto-assign Musicians</span>
                      <p className="text-sm text-gray-500">Automatically assign regular musicians to events</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                Account & Billing
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">Current Plan</h3>
                    <p className="text-sm text-gray-500">Free Trial - 30 days remaining (then $35/month)</p>
                  </div>
                  <Link 
                    href="/billing"
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Manage Billing
                  </Link>
                </div>
                
                <div className="border-t pt-4">
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Delete Account
                  </button>
                  <p className="text-xs text-gray-500 mt-1">Permanently delete your account and all data</p>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
} 