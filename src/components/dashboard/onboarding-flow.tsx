'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, ArrowRight, Phone, Link as LinkIcon, FileText, Upload, Settings, Bell, User, Mail, Plus, Trash2 } from 'lucide-react'

interface OnboardingFlowProps {
  isVisible: boolean
  onComplete: () => void
}

interface OnboardingData {
  personalInfo: {
    phone: string
    calendarLink: string
  }
  serviceParts: Array<{
    name: string
    order: number
  }>
  documents: Array<{
    title: string
    file: File
  }>
  links: Array<{
    title: string
    url: string
    description: string
  }>
  musicianNotifications: Array<{
    hoursBeforeEvent: number
    isEnabled: boolean
  }>
  pastorInfo: {
    name: string
    email: string
    phone: string
    role: string
  }
  pastorNotifications: {
    pastorEmailEnabled: boolean
    pastorDailyDigestEnabled: boolean
    pastorDailyDigestTime: string
    pastorWeeklyReportEnabled: boolean
    pastorWeeklyReportDay: number
    pastorMonthlyReportDay: number
  }
}

const ONBOARDING_STEPS = [
  {
    id: 'personal-info',
    title: 'Personal Information',
    description: 'Add your contact details that will be visible to musicians in your ministry.'
  },
  {
    id: 'service-parts',
    title: 'Service Parts',
    description: 'Define the parts of your service where music is played in order (e.g., "Prelude", "Opening Hymn", "Offertory", "Postlude").'
  },
  {
    id: 'docs-links',
    title: 'Church Documents & Links',
    description: 'Upload important documents and add helpful links for your music ministry.'
  },
  {
    id: 'musician-notifications',
    title: 'Musician Notifications',
    description: 'Set up automatic event reminders for your musicians.'
  },
  {
    id: 'pastor-notifications',
    title: 'Pastor Notifications',
    description: 'Configure pastor information and email report preferences.'
  },
  {
    id: 'complete',
    title: 'Congratulations!',
    description: 'Your music ministry is ready to go.'
  }
]

export function OnboardingFlow({ isVisible, onComplete }: OnboardingFlowProps) {
  const { data: session } = useSession()
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    personalInfo: { phone: '', calendarLink: '' },
    serviceParts: [],
    documents: [],
    links: [],
    musicianNotifications: [
      { hoursBeforeEvent: 168, isEnabled: true }, // 7 days
      { hoursBeforeEvent: 24, isEnabled: true }   // 1 day
    ],
    pastorInfo: { name: '', email: '', phone: '', role: 'PASTOR' },
    pastorNotifications: {
      pastorEmailEnabled: true,
      pastorDailyDigestEnabled: false,
      pastorDailyDigestTime: '08:00',
      pastorWeeklyReportEnabled: true,
      pastorWeeklyReportDay: 0, // Sunday
      pastorMonthlyReportDay: 27
    }
  })

  // Helper functions for managing onboarding data
  const updatePersonalInfo = (field: string, value: string) => {
    setOnboardingData(prev => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: value }
    }))
  }

  const addServicePart = (name: string) => {
    if (!name.trim()) return
    setOnboardingData(prev => ({
      ...prev,
      serviceParts: [...prev.serviceParts, { name: name.trim(), order: prev.serviceParts.length }]
    }))
  }

  const removeServicePart = (index: number) => {
    setOnboardingData(prev => ({
      ...prev,
      serviceParts: prev.serviceParts.filter((_, i) => i !== index)
    }))
  }

  const addDocument = (title: string, file: File) => {
    setOnboardingData(prev => ({
      ...prev,
      documents: [...prev.documents, { title, file }]
    }))
  }

  const addLink = (title: string, url: string, description: string) => {
    setOnboardingData(prev => ({
      ...prev,
      links: [...prev.links, { title, url, description }]
    }))
  }

  const addMusicianNotification = () => {
    setOnboardingData(prev => ({
      ...prev,
      musicianNotifications: [
        ...prev.musicianNotifications,
        { hoursBeforeEvent: 24, isEnabled: true }
      ]
    }))
  }

  const updateMusicianNotification = (index: number, field: 'hoursBeforeEvent' | 'isEnabled', value: number | boolean) => {
    setOnboardingData(prev => ({
      ...prev,
      musicianNotifications: prev.musicianNotifications.map((notif, i) =>
        i === index ? { ...notif, [field]: value } : notif
      )
    }))
  }

  const removeMusicianNotification = (index: number) => {
    setOnboardingData(prev => ({
      ...prev,
      musicianNotifications: prev.musicianNotifications.filter((_, i) => i !== index)
    }))
  }

  const updatePastorInfo = (field: string, value: string) => {
    setOnboardingData(prev => ({
      ...prev,
      pastorInfo: { ...prev.pastorInfo, [field]: value }
    }))
  }

  const updatePastorNotifications = (field: string, value: any) => {
    setOnboardingData(prev => ({
      ...prev,
      pastorNotifications: { ...prev.pastorNotifications, [field]: value }
    }))
  }

  // Save data to backend
  const saveStepData = async (stepData: any, endpoint: string) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stepData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to save data')
      }
    } catch (error) {
      console.error('Error saving step data:', error)
      // Don't block progression on save errors
    }
  }

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

  const handleNext = async () => {
    setIsLoading(true)
    
    try {
      // Save current step data
      switch (currentStep) {
        case 0: // Personal Info
          if (onboardingData.personalInfo.phone || onboardingData.personalInfo.calendarLink) {
            await saveStepData(onboardingData.personalInfo, '/api/profile')
          }
          break
        case 1: // Service Parts
          if (onboardingData.serviceParts.length > 0) {
            const servicePartsForAPI = onboardingData.serviceParts.map((part, index) => ({
              id: `temp-${Date.now()}-${index}`,
              name: part.name,
              order: part.order,
              isRequired: false
            }))
            await saveStepData({ serviceParts: servicePartsForAPI }, '/api/service-parts')
          }
          break
        case 2: // Documents & Links
          // Save documents and links (implementation would depend on upload API)
          break
        case 3: // Musician Notifications
          // Will be saved with pastor notifications in next step
          break
        case 4: // Pastor Notifications
          const automationData = {
            musicianNotifications: onboardingData.musicianNotifications || [],
            pastorEmailEnabled: onboardingData.pastorNotifications.pastorEmailEnabled,
            pastorDailyDigestEnabled: onboardingData.pastorNotifications.pastorDailyDigestEnabled,
            pastorDailyDigestTime: onboardingData.pastorNotifications.pastorDailyDigestTime,
            pastorWeeklyReportEnabled: onboardingData.pastorNotifications.pastorWeeklyReportEnabled,
            pastorWeeklyReportDay: onboardingData.pastorNotifications.pastorWeeklyReportDay,
            pastorMonthlyReportDay: onboardingData.pastorNotifications.pastorMonthlyReportDay
          }
          await saveStepData(automationData, '/api/automation-settings')
          break
        case 5: // Complete
          // Mark onboarding as complete
          await saveStepData({ hasCompletedOnboarding: true }, '/api/profile')
          onComplete()
          return
      }
      
      setCurrentStep(prev => prev + 1)
    } catch (error) {
      console.error('Error proceeding to next step:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  if (!isVisible) return null

  const currentStepData = ONBOARDING_STEPS[currentStep]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl border">
        {/* Step Indicator */}
        <div className="flex justify-center mb-6">
          <div className="flex space-x-2">
            {ONBOARDING_STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep || index < currentStep ? 'bg-[#660033]' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {currentStep === 0 && <PersonalInfoStep data={onboardingData.personalInfo} onChange={updatePersonalInfo} />}
          {currentStep === 1 && <ServicePartsStep data={onboardingData.serviceParts} onAdd={addServicePart} onRemove={removeServicePart} />}
          {currentStep === 2 && <DocsLinksStep documents={onboardingData.documents} links={onboardingData.links} onAddDocument={addDocument} onAddLink={addLink} />}
          {currentStep === 3 && <MusicianNotificationsStep data={onboardingData.musicianNotifications} onAdd={addMusicianNotification} onUpdate={updateMusicianNotification} onRemove={removeMusicianNotification} formatHours={formatHoursToDays} />}
          {currentStep === 4 && <PastorNotificationsStep pastorInfo={onboardingData.pastorInfo} pastorNotifications={onboardingData.pastorNotifications} onUpdateInfo={updatePastorInfo} onUpdateNotifications={updatePastorNotifications} />}
          {currentStep === 5 && <CompletionStep />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          {currentStep === 5 ? (
            // Congratulations step - no back button
            <div></div>
          ) : (
            <button
              onClick={handleBack}
              disabled={currentStep === 0 || isLoading}
              className={`p-2 rounded-lg transition-colors ${
                currentStep === 0 || isLoading
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={isLoading}
            className={`py-3 px-4 rounded-lg hover:bg-[#550028] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-[#660033] text-white ${
              currentStep === 5 ? 'w-full' : 'w-full max-w-xs'
            }`}
          >
            {isLoading ? 'Saving...' : currentStep === 5 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Step Components
function PersonalInfoStep({ data, onChange }: { data: any, onChange: (field: string, value: string) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Personal Information</h2>
      <p className="text-gray-700 mb-6 text-base">
        Add your contact details that will be visible to musicians in your ministry.
      </p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number (Optional)
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="tel"
              value={data.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#660033] focus:border-transparent"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Calendar Link (Optional)
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="url"
              value={data.calendarLink}
              onChange={(e) => onChange('calendarLink', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#660033] focus:border-transparent"
              placeholder="https://calendly.com/your-link"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Share your Calendly or Google Calendar scheduling link</p>
        </div>
      </div>
    </div>
  )
}

function ServicePartsStep({ data, onAdd, onRemove }: { data: any[], onAdd: (name: string) => void, onRemove: (index: number) => void }) {
  const [newPartName, setNewPartName] = useState('')

  const handleAdd = () => {
    if (newPartName.trim()) {
      onAdd(newPartName)
      setNewPartName('')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Service Parts</h2>
      <p className="text-gray-700 mb-6 text-base">
        Define the parts of your service where music is played in order (e.g., "Prelude", "Opening Hymn", "Offertory", "Postlude").
      </p>

      <div className="space-y-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newPartName}
            onChange={(e) => setNewPartName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#660033] focus:border-transparent"
            placeholder="Enter service part name"
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-[#660033] text-white rounded-lg hover:bg-[#550028] transition-colors"
          >
            Add
          </button>
        </div>

        {data.length > 0 && (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data.map((part, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                <span className="text-sm text-gray-900">{part.name}</span>
                <button
                  onClick={() => onRemove(index)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">
          You can edit these later in your settings if needed.
        </p>
      </div>
    </div>
  )
}

function DocsLinksStep({ documents, links, onAddDocument, onAddLink }: any) {
  const [linkData, setLinkData] = useState({ title: '', url: '', description: '' })

  const handleAddLink = () => {
    if (linkData.title && linkData.url) {
      onAddLink(linkData.title, linkData.url, linkData.description)
      setLinkData({ title: '', url: '', description: '' })
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Documents & Links</h2>
      <p className="text-gray-700 mb-6 text-base">
        Upload important documents and add helpful links for your music ministry.
      </p>

      <div className="space-y-6">
        {/* Add Link Section */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Add Link</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={linkData.title}
              onChange={(e) => setLinkData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#660033] focus:border-transparent text-sm"
              placeholder="Link title"
            />
            <input
              type="url"
              value={linkData.url}
              onChange={(e) => setLinkData(prev => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#660033] focus:border-transparent text-sm"
              placeholder="https://example.com"
            />
            <input
              type="text"
              value={linkData.description}
              onChange={(e) => setLinkData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#660033] focus:border-transparent text-sm"
              placeholder="Description (optional)"
            />
            <button
              onClick={handleAddLink}
              disabled={!linkData.title || !linkData.url}
              className="w-full px-4 py-2 bg-[#660033] text-white rounded-lg hover:bg-[#550028] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Add Link
            </button>
          </div>
        </div>

        {links.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Added Links:</h4>
            {links.map((link: any, index: number) => (
              <div key={index} className="bg-gray-50 px-3 py-2 rounded-lg text-sm">
                <div className="font-medium text-gray-900">{link.title}</div>
                <div className="text-gray-600">{link.url}</div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Documents and links can be managed later in your settings section.
        </p>
      </div>
    </div>
  )
}

function MusicianNotificationsStep({ data, onAdd, onUpdate, onRemove, formatHours }: any) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Musician Notifications</h2>
      <p className="text-gray-700 mb-6 text-base">
        Set up automatic event reminders for your musicians.
      </p>

      <div className="space-y-4">
        {data.map((notification: any, index: number) => (
          <div key={index} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg">
            <input
              type="number"
              value={notification.hoursBeforeEvent}
              onChange={(e) => onUpdate(index, 'hoursBeforeEvent', parseInt(e.target.value) || 1)}
              min="1"
              max="168"
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#660033] text-gray-900"
            />
            <div className="flex flex-col">
              <span className="text-sm text-gray-600">hours before event</span>
              <span className="text-xs text-gray-500">({formatHours(notification.hoursBeforeEvent)})</span>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={notification.isEnabled}
                onChange={(e) => onUpdate(index, 'isEnabled', e.target.checked)}
                className="mr-2 h-4 w-4 text-[#660033] focus:ring-[#660033] border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">Enabled</span>
            </label>
            <button
              onClick={() => onRemove(index)}
              className="p-1 text-red-600 hover:bg-red-100 rounded"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        
        <button
          onClick={onAdd}
          className="flex items-center px-3 py-2 text-[#660033] hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Notification
        </button>

        <p className="text-xs text-gray-500">
          These settings can be modified later in your automation settings.
        </p>
      </div>
    </div>
  )
}

function PastorNotificationsStep({ pastorInfo, pastorNotifications, onUpdateInfo, onUpdateNotifications }: any) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Pastor Notifications</h2>
      <p className="text-gray-700 mb-6 text-base">
        Configure pastor information and email report preferences.
      </p>

      <div className="space-y-6">
        {/* Pastor Information */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Pastor Information</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={pastorInfo.name}
              onChange={(e) => onUpdateInfo('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#660033] focus:border-transparent text-sm"
              placeholder="Pastor's name"
            />
            <input
              type="email"
              value={pastorInfo.email}
              onChange={(e) => onUpdateInfo('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#660033] focus:border-transparent text-sm"
              placeholder="Pastor's email"
            />
            <select
              value={pastorInfo.role}
              onChange={(e) => onUpdateInfo('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#660033] focus:border-transparent text-sm"
            >
              <option value="PASTOR">Pastor</option>
              <option value="ASSOCIATE_PASTOR">Associate Pastor</option>
            </select>
          </div>
        </div>

        {/* Pastor Email Reports */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Email Reports</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 text-sm">Daily Digest</h4>
                <p className="text-xs text-gray-500">Daily summary of upcoming events</p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="time"
                  value={pastorNotifications.pastorDailyDigestTime}
                  onChange={(e) => onUpdateNotifications('pastorDailyDigestTime', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#660033]"
                />
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pastorNotifications.pastorDailyDigestEnabled}
                    onChange={(e) => onUpdateNotifications('pastorDailyDigestEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#660033]/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#660033]"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 text-sm">Weekly Report</h4>
                <p className="text-xs text-gray-500">Weekly summary sent on a specific day</p>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={pastorNotifications.pastorWeeklyReportDay}
                  onChange={(e) => onUpdateNotifications('pastorWeeklyReportDay', parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#660033]"
                >
                  {dayNames.map((day, index) => (
                    <option key={index} value={index}>{day}</option>
                  ))}
                </select>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pastorNotifications.pastorWeeklyReportEnabled}
                    onChange={(e) => onUpdateNotifications('pastorWeeklyReportEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#660033]/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#660033]"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 text-sm">Monthly Report</h4>
                <p className="text-xs text-gray-500">Monthly summary sent on day {pastorNotifications.pastorMonthlyReportDay} of each month</p>
              </div>
              <input
                type="number"
                value={pastorNotifications.pastorMonthlyReportDay}
                onChange={(e) => onUpdateNotifications('pastorMonthlyReportDay', parseInt(e.target.value) || 1)}
                min="1"
                max="28"
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#660033]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompletionStep() {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Congratulations!</h2>
      <p className="text-gray-700 mb-6 text-base">
        Your music ministry is ready to go.
      </p>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-center mb-2">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-green-800 text-sm font-medium">Setup Complete!</p>
        <p className="text-green-700 text-sm">Your music ministry is ready to be organized.</p>
      </div>
    </div>
  )
} 