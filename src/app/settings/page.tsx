'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, User, MapPin, Bell, Lock, CreditCard, Save, Edit3, Zap, Users,
  FileText, ExternalLink, Upload, X, Trash2, Plus, GripVertical, Clock,
  Mail, Calendar, Settings as SettingsIcon, Globe, UserPlus
} from 'lucide-react'
import Link from 'next/link'

interface ChurchDocument {
  id: string
  title: string
  description?: string
  originalFilename: string
  fileSize: number
  order: number
  uploadedAt: string
  uploader: {
    firstName: string
    lastName: string
  }
}

interface ChurchLink {
  id: string
  title: string
  description?: string
  url: string
  order: number
  createdAt: string
  creator: {
    firstName: string
    lastName: string
  }
}

interface ServicePart {
  id: string
  name: string
  isRequired: boolean
  order: number
}

interface MusicianNotification {
  id: string
  hoursBeforeEvent: number
  isEnabled: boolean
}

interface AutomationSettings {
  id?: string
  musicianNotifications: MusicianNotification[]
  allowMusiciansToSendMessages: boolean
  pastorEmailEnabled: boolean
  pastorMonthlyReportDay: number
  pastorWeeklyReportEnabled: boolean
  pastorWeeklyReportDay: number
  pastorDailyDigestEnabled: boolean
  pastorDailyDigestTime: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('personal')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    phone: '',
    calendarLink: '',
    churchName: session?.user?.churchName || '',
    parishPhone: '',
    emailNotifications: true,
    smsNotifications: false,
    timezone: 'America/Chicago'
  })

  // Documents & Links Management
  const [churchDocuments, setChurchDocuments] = useState<ChurchDocument[]>([])
  const [churchLinks, setChurchLinks] = useState<ChurchLink[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)

  // Service Parts Management
  const [serviceParts, setServiceParts] = useState<ServicePart[]>([])
  const [loadingServiceParts, setLoadingServiceParts] = useState(false)
  const [editingServiceParts, setEditingServiceParts] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  // Automation Settings
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>({
    musicianNotifications: [],
    allowMusiciansToSendMessages: false,
    pastorEmailEnabled: true,
    pastorMonthlyReportDay: 27,
    pastorWeeklyReportEnabled: false,
    pastorWeeklyReportDay: 0,
    pastorDailyDigestEnabled: true,
    pastorDailyDigestTime: '08:00'
  })
  const [loadingAutomation, setLoadingAutomation] = useState(false)

  // Pastor Invitations Log
  const [pastorInvitations, setPastorInvitations] = useState<any[]>([])
  const [existingPastors, setExistingPastors] = useState<any[]>([])
  const [loadingPastorLog, setLoadingPastorLog] = useState(false)

  // Musician Availability (Musicians only)
  const [unavailabilities, setUnavailabilities] = useState<any[]>([])
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false)
  const [editingAvailability, setEditingAvailability] = useState<any>(null)
  const [availabilityType, setAvailabilityType] = useState<'date' | 'day'>('date')

  // Pastor Information
  const [pastorInfo, setPastorInfo] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'PASTOR'
  })

  useEffect(() => {
    fetchUserProfile()
    if (session?.user?.role === 'DIRECTOR' || session?.user?.role === 'ASSOCIATE_DIRECTOR') {
      fetchChurchDocuments()
      fetchChurchLinks()
      fetchServiceParts()
      fetchAutomationSettings()
      fetchPastorInvitations()
    }
    if (session?.user?.role === 'MUSICIAN') {
      fetchAvailability()
    }
  }, [session])

  // Set availability type when editing
  useEffect(() => {
    if (editingAvailability) {
      setAvailabilityType(editingAvailability.dayOfWeek !== null ? 'day' : 'date')
    } else {
      setAvailabilityType('date')
    }
  }, [editingAvailability])

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
          calendarLink: user.calendarLink || '',
          emailNotifications: user.emailNotifications,
          smsNotifications: user.smsNotifications,
          timezone: user.timezone || 'America/Chicago',
          churchName: user.church?.name || '',
          parishPhone: user.church?.phone || ''
        }))
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const fetchChurchDocuments = async () => {
    try {
      setLoadingDocuments(true)
      const response = await fetch('/api/church-documents')
      if (response.ok) {
        const data = await response.json()
        setChurchDocuments(data.documents)
      }
    } catch (error) {
      console.error('Error fetching church documents:', error)
    } finally {
      setLoadingDocuments(false)
    }
  }

  const fetchChurchLinks = async () => {
    try {
      const response = await fetch('/api/church-links')
      if (response.ok) {
        const data = await response.json()
        setChurchLinks(data.links)
      }
    } catch (error) {
      console.error('Error fetching church links:', error)
    }
  }

  const fetchAvailability = async () => {
    try {
      setLoadingAvailability(true)
      const response = await fetch('/api/musician-availability')
      if (response.ok) {
        const data = await response.json()
        setUnavailabilities(data.unavailabilities)
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoadingAvailability(false)
    }
  }

  const deleteAvailability = async (id: string) => {
    if (!confirm('Are you sure you want to delete this unavailability?')) return
    
    try {
      const response = await fetch(`/api/musician-availability/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setUnavailabilities(prev => prev.filter(item => item.id !== id))
      } else {
        throw new Error('Failed to delete availability')
      }
    } catch (error) {
      console.error('Error deleting availability:', error)
      alert('Failed to delete availability. Please try again.')
    }
  }

  const saveAvailability = async (data: any) => {
    try {
      const url = editingAvailability 
        ? `/api/musician-availability/${editingAvailability.id}`
        : '/api/musician-availability'
      
      const method = editingAvailability ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (response.ok) {
        const result = await response.json()
        if (editingAvailability) {
          setUnavailabilities(prev => 
            prev.map(item => item.id === editingAvailability.id ? result.unavailability : item)
          )
        } else {
          setUnavailabilities(prev => [...prev, result.unavailability])
        }
        setShowAvailabilityModal(false)
        setEditingAvailability(null)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save availability')
      }
    } catch (error) {
      console.error('Error saving availability:', error)
      alert(error instanceof Error ? error.message : 'Failed to save availability. Please try again.')
    }
  }



  const fetchServiceParts = async () => {
    try {
      setLoadingServiceParts(true)
      const response = await fetch('/api/service-parts')
      if (response.ok) {
        const data = await response.json()
        const sortedParts = (data.serviceParts || []).sort((a: ServicePart, b: ServicePart) => a.order - b.order)
        setServiceParts(sortedParts)
      }
    } catch (error) {
      console.error('Error fetching service parts:', error)
    } finally {
      setLoadingServiceParts(false)
    }
  }

  const fetchAutomationSettings = async () => {
    try {
      setLoadingAutomation(true)
      const response = await fetch('/api/automation-settings')
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setAutomationSettings({
            id: data.id,
            musicianNotifications: data.musicianNotifications || [],
            allowMusiciansToSendMessages: data.allowMusiciansToSendMessages ?? false,
            pastorEmailEnabled: data.pastorEmailEnabled ?? true,
            pastorMonthlyReportDay: data.pastorMonthlyReportDay ?? 27,
            pastorWeeklyReportEnabled: data.pastorWeeklyReportEnabled ?? false,
            pastorWeeklyReportDay: data.pastorWeeklyReportDay ?? 0,
            pastorDailyDigestEnabled: data.pastorDailyDigestEnabled ?? true,
            pastorDailyDigestTime: data.pastorDailyDigestTime ?? '08:00'
          })
        }
      }
    } catch (error) {
      console.error('Error fetching automation settings:', error)
    } finally {
      setLoadingAutomation(false)
    }
  }

  const fetchPastorInvitations = async () => {
    try {
      setLoadingPastorLog(true)
      const response = await fetch('/api/pastor-invitations')
      if (response.ok) {
        const data = await response.json()
        setPastorInvitations(data.invitations || [])
        setExistingPastors(data.existingPastors || [])
      }
    } catch (error) {
      console.error('Error fetching pastor invitations:', error)
    } finally {
      setLoadingPastorLog(false)
    }
  }

  const invitePastor = async () => {
    if (!pastorInfo.name || !pastorInfo.email) {
      alert('Please fill in pastor name and email')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/pastor-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pastorInfo.email,
          name: pastorInfo.name
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Pastor invitation sent successfully!')
        // Clear the form
        setPastorInfo({ name: '', email: '', phone: '', role: 'PASTOR' })
        // Refresh the pastor invitations list
        fetchPastorInvitations()
      } else {
        alert(data.error || 'Failed to send pastor invitation')
      }
    } catch (error) {
      console.error('Error inviting pastor:', error)
      alert('Failed to send pastor invitation')
    } finally {
      setLoading(false)
    }
  }

  const sidebarItems = [
    { id: 'personal', name: 'Personal', icon: User },
    { id: 'church', name: 'Church', icon: MapPin },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    ...(session?.user?.role === 'MUSICIAN' 
      ? [{ id: 'availability', name: 'Availability', icon: Calendar }] 
      : []),
    ...(session?.user?.role === 'DIRECTOR' || session?.user?.role === 'ASSOCIATE_DIRECTOR' 
      ? [
          { id: 'documents-links', name: 'Documents & Links', icon: FileText },
          { id: 'automations', name: 'Automations', icon: Zap },
          { id: 'service-parts', name: 'Service Parts', icon: Users }
        ] 
      : []),
    { id: 'preferences', name: 'Preferences', icon: Lock },
    ...(session?.user?.role !== 'MUSICIAN' 
      ? [{ id: 'billing', name: 'Billing', icon: CreditCard }] 
      : [])
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    
    try {
      // Split the name into firstName and lastName for the API
      const nameParts = formData.name.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      
      const dataToSend = {
        ...formData,
        firstName,
        lastName
      }
      
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      if (response.ok) {
        setSuccess('Settings saved successfully!')
        setIsEditing(false)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setLoading(false)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const uploadChurchDocument = async (file: File) => {
    if (!file) return
    
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''))
      formData.append('description', '')

      const response = await fetch('/api/church-documents', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        if (data.sizeWarning) {
          alert(data.sizeWarning)
        }
        fetchChurchDocuments()
        setSuccess('Document uploaded successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload document')
      }
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Failed to upload document')
    } finally {
      setLoading(false)
    }
  }

  const removeChurchDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const response = await fetch(`/api/church-documents/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchChurchDocuments()
        setSuccess('Document deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const addChurchLink = async (title: string, url: string, description: string) => {
    try {
      const response = await fetch('/api/church-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, url, description })
      })

      if (response.ok) {
        fetchChurchLinks()
        setSuccess('Link added successfully!')
      }
    } catch (error) {
      console.error('Error adding link:', error)
    }
  }

  const removeChurchLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return

    try {
      const response = await fetch(`/api/church-links/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchChurchLinks()
        setSuccess('Link deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting link:', error)
    }
  }

  const saveServiceParts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/service-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceParts })
      })

      if (response.ok) {
        const data = await response.json()
        setServiceParts(data.serviceParts)
        setEditingServiceParts(false)
        setSuccess('Service parts saved successfully!')
      }
    } catch (error) {
      console.error('Error saving service parts:', error)
      alert('Failed to save service parts')
    } finally {
      setLoading(false)
    }
  }

  const addServicePart = () => {
    const maxOrder = serviceParts.length > 0 ? Math.max(...serviceParts.map(p => p.order)) : -1
    const newPart = {
      id: `temp-${Date.now()}`,
      name: '',
      isRequired: false,
      order: maxOrder + 1
    }
    setServiceParts([...serviceParts, newPart])
  }

  const updateServicePart = (id: string, field: keyof ServicePart, value: any) => {
    setServiceParts(parts => 
      parts.map(part => 
        part.id === id ? { ...part, [field]: value } : part
      )
    )
  }

  const removeServicePart = async (id: string) => {
    if (id.startsWith('temp-')) {
      setServiceParts(parts => parts.filter(part => part.id !== id))
    } else {
      if (!confirm('Are you sure you want to delete this service part?')) return
      
      try {
        const response = await fetch(`/api/service-parts/${id}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          setServiceParts(parts => parts.filter(part => part.id !== id))
          setSuccess('Service part deleted successfully!')
        } else {
          const data = await response.json()
          if (data.usageCount > 0) {
            const confirmed = confirm(data.message + ' Continue?')
            if (confirmed) {
              const forceResponse = await fetch(`/api/service-parts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forceDelete: true })
              })
              if (forceResponse.ok) {
                setServiceParts(parts => parts.filter(part => part.id !== id))
                setSuccess('Service part deleted successfully!')
              }
            }
          }
        }
      } catch (error) {
        console.error('Error deleting service part:', error)
      }
    }
  }

  const saveAutomationSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/automation-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(automationSettings)
      })

      if (response.ok) {
        const data = await response.json()
        setAutomationSettings(data)
        setSuccess('Automation settings saved successfully!')
      }
    } catch (error) {
      console.error('Error saving automation settings:', error)
      alert('Failed to save automation settings')
    } finally {
      setLoading(false)
    }
  }

  const addMusicianNotification = () => {
    setAutomationSettings(prev => ({
      ...prev,
      musicianNotifications: [
        ...prev.musicianNotifications,
        { id: `temp-${Date.now()}`, hoursBeforeEvent: 24, isEnabled: true }
      ]
    }))
  }

  const updateMusicianNotification = (id: string, field: keyof MusicianNotification, value: any) => {
    setAutomationSettings(prev => ({
      ...prev,
      musicianNotifications: prev.musicianNotifications.map(notif =>
        notif.id === id ? { ...notif, [field]: value } : notif
      )
    }))
  }

  const removeMusicianNotification = (id: string) => {
    setAutomationSettings(prev => ({
      ...prev,
      musicianNotifications: prev.musicianNotifications.filter(notif => notif.id !== id)
    }))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const timezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu'
  ]

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const formatHoursToDays = (hours: number) => {
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`
    } else if (hours % 24 === 0) {
      const days = hours / 24
      return `${days} day${days !== 1 ? 's' : ''}`
    } else {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h`
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link 
                href="/dashboard" 
                className="flex items-center text-gray-600 hover:text-gray-900 mr-6"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </Link>
              <div className="flex items-center">
                <SettingsIcon className="h-8 w-8 text-gray-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                  <p className="text-sm text-gray-600">Manage your account and preferences</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {!isEditing && activeTab !== 'billing' ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Edit3 className="h-4 w-4 mr-1.5" />
                  Edit Settings
                </button>
              ) : activeTab !== 'billing' ? (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      if (activeTab === 'service-parts') {
                        saveServiceParts()
                      } else if (activeTab === 'automations') {
                        saveAutomationSettings()
                      } else {
                        handleSubmit()
                      }
                    }}
                    disabled={loading}
                    className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-white rounded-lg shadow-sm border p-6">
            <nav className="space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'billing') {
                        router.push('/billing')
                      } else {
                        setActiveTab(item.id)
                        setIsEditing(false) // Reset editing state when switching tabs
                      }
                    }}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === item.id && item.id !== 'billing'
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {item.name}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Calendar Link
                      <span className="text-xs text-gray-500 ml-1">(e.g., Calendly, Google Calendar booking link)</span>
                    </label>
                    <input
                      type="url"
                      name="calendarLink"
                      value={formData.calendarLink}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="https://calendly.com/yourname or https://calendar.google.com/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This link will be shown to musicians so they can easily schedule meetings with you
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Church Tab */}
            {activeTab === 'church' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                  Church Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Church Name</label>
                    <input
                      type="text"
                      name="churchName"
                      value={formData.churchName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900"
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
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Email Notifications</h3>
                      <p className="text-sm text-gray-500">Receive notifications about events and assignments via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="emailNotifications"
                        checked={formData.emailNotifications}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">SMS Notifications</h3>
                      <p className="text-sm text-gray-500">Receive urgent notifications via text message</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="smsNotifications"
                        checked={formData.smsNotifications}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Musician Messaging Permission - Directors only */}
                  {(session?.user?.role === 'DIRECTOR' || session?.user?.role === 'ASSOCIATE_DIRECTOR') && (
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h3 className="font-medium text-gray-900">Allow Musicians to Send Messages</h3>
                        <p className="text-sm text-gray-500">
                          When enabled, musicians can send messages to other musicians and ministry members. 
                          When disabled, only directors and pastors can send messages.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={automationSettings.allowMusiciansToSendMessages}
                          onChange={(e) => setAutomationSettings(prev => ({ ...prev, allowMusiciansToSendMessages: e.target.checked }))}
                          disabled={!isEditing}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Availability Tab */}
            {activeTab === 'availability' && session?.user?.role === 'MUSICIAN' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                    My Availability
                  </h2>
                  <button
                    onClick={() => setShowAvailabilityModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Unavailability
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-600">
                    Set your unavailable dates and recurring weekly unavailability. This will be considered during auto-assignment.
                  </p>
                </div>

                {loadingAvailability ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unavailabilities.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p>No unavailability set</p>
                        <p className="text-sm">You're currently available for all events</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {unavailabilities.map((unavailability) => (
                          <div
                            key={unavailability.id}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                          >
                            <div className="flex-1">
                              {unavailability.dayOfWeek !== null ? (
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][unavailability.dayOfWeek]}s
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Recurring weekly unavailability
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {unavailability.endDate && unavailability.endDate !== unavailability.startDate
                                      ? `${new Date(unavailability.startDate).toLocaleDateString()} - ${new Date(unavailability.endDate).toLocaleDateString()}`
                                      : new Date(unavailability.startDate).toLocaleDateString()
                                    }
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {unavailability.endDate && unavailability.endDate !== unavailability.startDate
                                      ? 'Date range unavailability'
                                      : 'Single date unavailability'
                                    }
                                  </div>
                                </div>
                              )}
                              {unavailability.reason && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {unavailability.reason}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setEditingAvailability(unavailability)
                                  setShowAvailabilityModal(true)
                                }}
                                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteAvailability(unavailability.id)}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <Lock className="h-5 w-5 mr-2 text-blue-600" />
                  User Preferences
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Globe className="h-4 w-4 mr-2" />
                      Timezone
                    </label>
                    <select
                      name="timezone"
                      value={formData.timezone}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-gray-900"
                    >
                      {timezones.map(tz => (
                        <option key={tz} value={tz}>
                          {tz.replace('_', ' ').replace('America/', '').replace('Pacific/', '')}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-500 mt-1">
                      Used for scheduling and notification timing
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Documents & Links Tab */}
            {activeTab === 'documents-links' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-blue-600" />
                    Documents & Links Management
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload and manage church documents and external links that will be visible to all musicians.
                  </p>
                </div>

                {/* Documents Section */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-gray-900">Church Documents</h3>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <Upload className="h-4 w-4 mr-1.5" />
                        Upload Document
                      </button>
                    )}
                  </div>

                  {loadingDocuments ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-gray-500 mt-2">Loading documents...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {churchDocuments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p>No documents uploaded yet</p>
                        </div>
                      ) : (
                        churchDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-400 mr-3" />
                              <div>
                                <p className="font-medium text-gray-900">{doc.title}</p>
                                <p className="text-sm text-gray-500">{doc.originalFilename} • {formatFileSize(doc.fileSize)}</p>
                              </div>
                            </div>
                            {isEditing && (
                              <button
                                type="button"
                                onClick={() => removeChurchDocument(doc.id)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Links Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-gray-900">Church Links</h3>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => setShowLinkModal(true)}
                        className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 mr-1.5" />
                        Add Link
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {churchLinks.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <ExternalLink className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No links added yet</p>
                      </div>
                    ) : (
                      churchLinks.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center">
                            <ExternalLink className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="font-medium text-gray-900">{link.title}</p>
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                                {link.url}
                              </a>
                            </div>
                          </div>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => removeChurchLink(link.id)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
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
                    Define the parts of your service where music is played (e.g., "Prelude", "Hymn", "Offertory", "Postlude").
                    {isEditing && (
                      <span className="text-blue-600 font-medium ml-2">
                        💡 Drag the grip handles to reorder service parts.
                      </span>
                    )}
                  </p>
                </div>

                {loadingServiceParts ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 mt-2">Loading service parts...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {serviceParts.map((part, index) => (
                                              <div
                          key={part.id}
                          className={`flex items-center space-x-3 p-4 border rounded-lg transition-all ${
                            draggedItem === part.id 
                              ? 'opacity-50 scale-95 border-blue-300 bg-blue-50' 
                              : dropTarget === part.id 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200'
                          }`}
                          draggable={isEditing}
                          onDragStart={(e) => {
                            setDraggedItem(part.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                            if (draggedItem !== part.id) {
                              setDropTarget(part.id)
                            }
                          }}
                          onDragEnd={() => {
                            setDraggedItem(null)
                            setDropTarget(null)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (draggedItem && dropTarget && draggedItem !== dropTarget) {
                              const draggedIndex = serviceParts.findIndex(p => p.id === draggedItem)
                              const dropIndex = serviceParts.findIndex(p => p.id === dropTarget)
                              if (draggedIndex !== -1 && dropIndex !== -1) {
                                const newParts = [...serviceParts]
                                const [movedItem] = newParts.splice(draggedIndex, 1)
                                newParts.splice(dropIndex, 0, movedItem)
                                
                                // Update order values
                                const updatedParts = newParts.map((item, index) => ({
                                  ...item,
                                  order: index
                                }))
                                setServiceParts(updatedParts)
                              }
                            }
                            setDraggedItem(null)
                            setDropTarget(null)
                          }}
                          onDragLeave={(e) => {
                            // Only reset if we're leaving the entire element
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              setDropTarget(null)
                            }
                          }}
                        >
                          {isEditing && (
                            <div className={`flex-shrink-0 ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                              <GripVertical className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                            </div>
                          )}
                        <div className="flex-1">
                          <input
                            type="text"
                            value={part.name}
                            onChange={(e) => updateServicePart(part.id, 'name', e.target.value)}
                            disabled={!isEditing}
                            placeholder="Service part name (e.g., Prelude, Hymn, Offertory)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-900"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={part.isRequired}
                              onChange={(e) => updateServicePart(part.id, 'isRequired', e.target.checked)}
                              disabled={!isEditing}
                              className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            Required
                          </label>
                          {isEditing && (
                            <button
                              onClick={() => removeServicePart(part.id)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {isEditing && (
                      <button
                        onClick={addServicePart}
                        className="w-full flex items-center justify-center px-4 py-3 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Add Service Part
                      </button>
                    )}

                    {serviceParts.length === 0 && !isEditing && (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No service parts configured yet</p>
                        <p className="text-sm">Click "Edit Settings" to add service parts</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Automations Tab */}
            {activeTab === 'automations' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <Zap className="h-5 w-5 mr-2 text-blue-600" />
                    Automation Settings
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure automated notifications and reports for your church.
                  </p>
                </div>

                {loadingAutomation ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 mt-2">Loading automation settings...</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Musician Notifications */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <Bell className="h-5 w-5 mr-2" />
                        Musician Event Reminders
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Automatically send reminder notifications to musicians before events.
                      </p>
                      
                      <div className="space-y-3">
                                                 {automationSettings.musicianNotifications.map((notification) => (
                           <div key={notification.id} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg">
                             <input
                               type="number"
                               value={notification.hoursBeforeEvent}
                               onChange={(e) => updateMusicianNotification(notification.id, 'hoursBeforeEvent', parseInt(e.target.value))}
                               disabled={!isEditing}
                               min="1"
                               max="168"
                               className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-900"
                             />
                             <div className="flex flex-col">
                               <span className="text-sm text-gray-600">hours before event</span>
                               <span className="text-xs text-gray-500">({formatHoursToDays(notification.hoursBeforeEvent)})</span>
                             </div>
                             <label className="flex items-center">
                               <input
                                 type="checkbox"
                                 checked={notification.isEnabled}
                                 onChange={(e) => updateMusicianNotification(notification.id, 'isEnabled', e.target.checked)}
                                 disabled={!isEditing}
                                 className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                               />
                               <span className="text-sm text-gray-600">Enabled</span>
                             </label>
                             {isEditing && (
                               <button
                                 onClick={() => removeMusicianNotification(notification.id)}
                                 className="p-1 text-red-600 hover:bg-red-100 rounded"
                               >
                                 <Trash2 className="h-4 w-4" />
                               </button>
                             )}
                           </div>
                         ))}
                        
                        {isEditing && (
                          <button
                            onClick={addMusicianNotification}
                            className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Notification
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Pastor Reports */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <Mail className="h-5 w-5 mr-2" />
                        Pastor Email Reports
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div>
                            <h4 className="font-medium text-gray-900">Pastor Email Notifications</h4>
                            <p className="text-sm text-gray-500">Send email notifications to pastors</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={automationSettings.pastorEmailEnabled}
                              onChange={(e) => setAutomationSettings(prev => ({ ...prev, pastorEmailEnabled: e.target.checked }))}
                              disabled={!isEditing}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>

                        <div className="p-4 border border-gray-200 rounded-lg">
                          <div className="mb-4">
                            <h4 className="font-medium text-gray-900">Pastor Information</h4>
                            <p className="text-sm text-gray-500">Configure pastor details for email reports</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                              <input
                                type="text"
                                value={pastorInfo.name}
                                onChange={(e) => setPastorInfo(prev => ({ ...prev, name: e.target.value }))}
                                disabled={!isEditing}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-sm"
                                placeholder="Pastor's name"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                              <input
                                type="email"
                                value={pastorInfo.email}
                                onChange={(e) => setPastorInfo(prev => ({ ...prev, email: e.target.value }))}
                                disabled={!isEditing}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-sm"
                                placeholder="Pastor's email"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                              <input
                                type="tel"
                                value={pastorInfo.phone}
                                onChange={(e) => setPastorInfo(prev => ({ ...prev, phone: e.target.value }))}
                                disabled={!isEditing}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-sm"
                                placeholder="Pastor's phone"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                              <select
                                value={pastorInfo.role}
                                onChange={(e) => setPastorInfo(prev => ({ ...prev, role: e.target.value }))}
                                disabled={!isEditing}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 text-sm"
                              >
                                <option value="PASTOR">Pastor</option>
                                <option value="ASSOCIATE_PASTOR">Associate Pastor</option>
                              </select>
                            </div>
                          </div>
                          {isEditing && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <button
                                onClick={invitePastor}
                                disabled={!pastorInfo.name || !pastorInfo.email || loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                {loading ? 'Inviting...' : 'Invite Pastor for Notifications'}
                              </button>
                              <p className="text-xs text-gray-500 mt-2">
                                Pastor will receive notifications based on your current automation settings
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div>
                            <h4 className="font-medium text-gray-900">Daily Digest</h4>
                            <p className="text-sm text-gray-500">Daily summary of upcoming events</p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="time"
                              value={automationSettings.pastorDailyDigestTime}
                              onChange={(e) => setAutomationSettings(prev => ({ ...prev, pastorDailyDigestTime: e.target.value }))}
                              disabled={!isEditing}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-900"
                            />
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={automationSettings.pastorDailyDigestEnabled}
                                onChange={(e) => setAutomationSettings(prev => ({ ...prev, pastorDailyDigestEnabled: e.target.checked }))}
                                disabled={!isEditing}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div>
                            <h4 className="font-medium text-gray-900">Weekly Report</h4>
                            <p className="text-sm text-gray-500">Weekly summary sent on a specific day</p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <select
                              value={automationSettings.pastorWeeklyReportDay}
                              onChange={(e) => setAutomationSettings(prev => ({ ...prev, pastorWeeklyReportDay: parseInt(e.target.value) }))}
                              disabled={!isEditing}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-900"
                            >
                              {dayNames.map((day, index) => (
                                <option key={index} value={index}>{day}</option>
                              ))}
                            </select>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={automationSettings.pastorWeeklyReportEnabled}
                                onChange={(e) => setAutomationSettings(prev => ({ ...prev, pastorWeeklyReportEnabled: e.target.checked }))}
                                disabled={!isEditing}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div>
                            <h4 className="font-medium text-gray-900">Monthly Report</h4>
                            <p className="text-sm text-gray-500">Monthly summary sent on day {automationSettings.pastorMonthlyReportDay} of each month</p>
                          </div>
                          <input
                            type="number"
                            value={automationSettings.pastorMonthlyReportDay}
                            onChange={(e) => setAutomationSettings(prev => ({ ...prev, pastorMonthlyReportDay: parseInt(e.target.value) }))}
                            disabled={!isEditing}
                            min="1"
                            max="28"
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-900"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pastor Notification Log */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Invited Pastors
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Pastors invited to receive automated notifications
                      </p>
                      
                      {loadingPastorLog ? (
                        <div className="text-center py-4">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                      ) : (
                        <div className="overflow-hidden border border-gray-200 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Name
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Date Invited
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {/* Existing Pastors */}
                              {existingPastors.map((pastor) => (
                                <tr key={`pastor-${pastor.id}`} className="bg-green-50">
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {pastor.firstName} {pastor.lastName}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {pastor.email}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {new Date(pastor.createdAt).toLocaleDateString()} (Active)
                                  </td>
                                </tr>
                              ))}
                              
                              {/* Pastor Invitations */}
                              {pastorInvitations.map((invitation) => (
                                <tr key={`invitation-${invitation.id}`}>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {invitation.firstName || invitation.email.split('@')[0]} {invitation.lastName || ''}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {invitation.email}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {new Date(invitation.createdAt).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                              
                              {/* Empty State */}
                              {existingPastors.length === 0 && pastorInvitations.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                                    No pastors invited yet
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative p-8 border w-96 mx-auto rounded-lg shadow-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    uploadChurchDocument(file)
                    setShowUploadModal(false)
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500">
                Supported formats: PDF, Word, Excel documents
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative p-8 border w-96 mx-auto rounded-lg shadow-lg bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Link</h3>
              <button onClick={() => setShowLinkModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.target as HTMLFormElement)
              const title = formData.get('title') as string
              const url = formData.get('url') as string
              const description = formData.get('description') as string
              addChurchLink(title, url, description)
              setShowLinkModal(false)
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  name="url"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Link
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Availability Modal */}
      {showAvailabilityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingAvailability ? 'Edit Unavailability' : 'Add Unavailability'}
              </h3>
              <button 
                onClick={() => {
                  setShowAvailabilityModal(false)
                  setEditingAvailability(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.target as HTMLFormElement)
              const type = formData.get('type') as string
              const startDate = formData.get('startDate') as string
              const endDate = formData.get('endDate') as string
              const dayOfWeek = formData.get('dayOfWeek') as string
              const reason = formData.get('reason') as string

              if (type === 'date' && startDate) {
                saveAvailability({
                  startDate,
                  endDate: endDate || null,
                  dayOfWeek: null,
                  reason: reason || null
                })
              } else if (type === 'day' && dayOfWeek) {
                saveAvailability({
                  startDate: null,
                  endDate: null,
                  dayOfWeek: parseInt(dayOfWeek),
                  reason: reason || null
                })
              }
            }} className="p-6 space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="date"
                      checked={availabilityType === 'date'}
                      onChange={(e) => setAvailabilityType(e.target.value as 'date' | 'day')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Specific dates</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="day"
                      checked={availabilityType === 'day'}
                      onChange={(e) => setAvailabilityType(e.target.value as 'date' | 'day')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Recurring day of week</span>
                  </label>
                </div>
              </div>

              {availabilityType === 'date' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={editingAvailability?.startDate ? new Date(editingAvailability.startDate).toISOString().split('T')[0] : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">End Date (optional)</label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={editingAvailability?.endDate ? new Date(editingAvailability.endDate).toISOString().split('T')[0] : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave end date empty for single day unavailability</p>
                </div>
              )}

              {availabilityType === 'day' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                  <select
                    name="dayOfWeek"
                    defaultValue={editingAvailability?.dayOfWeek?.toString() || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a day</option>
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea
                  name="reason"
                  rows={3}
                  defaultValue={editingAvailability?.reason || ''}
                  placeholder="e.g., Vacation, Work commitment, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAvailabilityModal(false)
                    setEditingAvailability(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingAvailability ? 'Update' : 'Add'}
                </button>
              </div>
            </form>


          </div>
        </div>
      )}


    </div>
  )
}