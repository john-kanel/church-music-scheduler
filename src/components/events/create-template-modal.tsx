'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  X, Plus, Trash2, Calendar, Clock, Palette, Users, Music, 
  Save, Eye, ChevronDown
} from 'lucide-react'

interface CreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onTemplateCreated?: () => void
  editingTemplate?: EventTemplate | null
}

interface EventTemplate {
  id?: string
  name: string
  description?: string
  duration: number
  color: string
  roles: TemplateRole[]
  hymns: TemplateHymn[]
  isActive?: boolean
}

interface TemplateRole {
  id?: string
  name: string
  maxCount: number
  isRequired: boolean
}

interface TemplateHymn {
  id?: string
  title: string
  servicePartId?: string
  servicePartName?: string
  notes?: string
}

interface ServicePart {
  id: string
  name: string
  isRequired: boolean
  order: number
}

const TEMPLATE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6B7280'
]



export function CreateTemplateModal({ 
  isOpen, 
  onClose, 
  onTemplateCreated, 
  editingTemplate 
}: CreateTemplateModalProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'roles' | 'music' | 'preview'>('details')
  const [serviceParts, setServiceParts] = useState<ServicePart[]>([])
  const [loadingServiceParts, setLoadingServiceParts] = useState(false)
  const [showDefaultsDropdown, setShowDefaultsDropdown] = useState(false)

  const [templateData, setTemplateData] = useState<EventTemplate>({
    name: '',
    description: '',
    duration: 60,
    color: TEMPLATE_COLORS[0],
    roles: [
      { name: 'Accompanist', maxCount: 1, isRequired: true },
      { name: 'Vocalist', maxCount: 4, isRequired: false }
    ],
    hymns: []
  })

  // Fetch service parts when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchServiceParts()
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showDefaultsDropdown && !target.closest('.relative')) {
        setShowDefaultsDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDefaultsDropdown])

  // Reset or set template data when modal opens/closes or editing changes
  useEffect(() => {
    console.log('🔧 Template Modal: editingTemplate changed:', editingTemplate)
    console.log('🔧 Template Modal: isOpen:', isOpen)
    
    if (editingTemplate) {
      console.log('✅ Loading existing template data:', editingTemplate)
      setTemplateData({
        ...editingTemplate,
        roles: editingTemplate.roles?.length > 0 ? editingTemplate.roles : [
          { name: 'Accompanist', maxCount: 1, isRequired: true },
          { name: 'Vocalist', maxCount: 4, isRequired: false }
        ],
        hymns: editingTemplate.hymns || []
      })
    } else {
      console.log('🆕 Creating new template - resetting data')
      setTemplateData({
        name: '',
        description: '',
        duration: 60,
        color: TEMPLATE_COLORS[0],
        roles: [
          { name: 'Accompanist', maxCount: 1, isRequired: true },
          { name: 'Vocalist', maxCount: 4, isRequired: false }
        ],
        hymns: []
      })
    }
  }, [editingTemplate, isOpen])

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

  const handleInputChange = (field: keyof EventTemplate, value: any) => {
    console.log('📝 Template Modal: Updating field:', field, 'value:', value)
    setTemplateData(prev => {
      const newData = { ...prev, [field]: value }
      console.log('📝 Template Modal: New templateData:', newData)
      return newData
    })
  }

  const addRole = () => {
    setTemplateData(prev => ({
      ...prev,
      roles: [...prev.roles, { name: '', maxCount: 1, isRequired: false }]
    }))
  }

  const updateRole = (index: number, field: keyof TemplateRole, value: any) => {
    setTemplateData(prev => ({
      ...prev,
      roles: prev.roles.map((role, i) => 
        i === index ? { ...role, [field]: value } : role
      )
    }))
  }

  const removeRole = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      roles: prev.roles.filter((_, i) => i !== index)
    }))
  }

  const addHymn = () => {
    console.log('➕ Template Modal: Adding new hymn')
    setTemplateData(prev => {
      const newHymns = [...prev.hymns, { title: '', servicePartId: '', servicePartName: '', notes: '' }]
      console.log('➕ Template Modal: New hymns array:', newHymns)
      return {
        ...prev,
        hymns: newHymns
      }
    })
  }

  const addDefaultServiceParts = (type: 'required' | 'all') => {
    console.log('🎶 Template Modal: Adding default service parts, type:', type)
    const partsToAdd = type === 'required' 
      ? serviceParts.filter(part => part.isRequired)
      : serviceParts

    console.log('🎶 Template Modal: Service parts to consider:', partsToAdd)

    // Filter out parts that are already added
    const existingServicePartIds = templateData.hymns
      .map(hymn => hymn.servicePartId)
      .filter(id => id && id !== 'custom')

    console.log('🎶 Template Modal: Existing service part IDs:', existingServicePartIds)

    const newParts = partsToAdd.filter(part => !existingServicePartIds.includes(part.id))
    console.log('🎶 Template Modal: New parts to add:', newParts)

    if (newParts.length === 0) {
      console.log('🎶 Template Modal: No new parts to add')
      return
    }

    const newHymns = newParts.map(part => ({
      title: '',
      servicePartId: part.id,
      servicePartName: part.name,
      notes: ''
    }))

    console.log('🎶 Template Modal: New hymns from service parts:', newHymns)

    setTemplateData(prev => {
      const updatedHymns = [...prev.hymns, ...newHymns]
      console.log('🎶 Template Modal: Updated hymns array:', updatedHymns)
      return {
        ...prev,
        hymns: updatedHymns
      }
    })
  }

  const updateHymn = (index: number, field: keyof TemplateHymn, value: string) => {
    console.log('🎵 Template Modal: Updating hymn', index, 'field:', field, 'value:', value)
    setTemplateData(prev => {
      const newHymns = prev.hymns.map((hymn, i) => {
        if (i === index) {
          const updatedHymn = { ...hymn, [field]: value }
          
          // If updating servicePartId, also update servicePartName
          if (field === 'servicePartId') {
            if (value === 'custom' || value === '') {
              updatedHymn.servicePartId = value === 'custom' ? undefined : ''
              updatedHymn.servicePartName = 'Custom'
            } else {
              const selectedPart = serviceParts.find(part => part.id === value)
              updatedHymn.servicePartName = selectedPart?.name || 'Custom'
            }
          }
          
          console.log('🎵 Template Modal: Updated hymn:', updatedHymn)
          return updatedHymn
        }
        return hymn
      })
      
      const newData = { ...prev, hymns: newHymns }
      console.log('🎵 Template Modal: New templateData with updated hymns:', newData)
      return newData
    })
  }

  const removeHymn = (index: number) => {
    setTemplateData(prev => ({
      ...prev,
      hymns: prev.hymns.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const method = editingTemplate ? 'PUT' : 'POST'
      const url = editingTemplate 
        ? `/api/event-templates/${editingTemplate.id}` 
        : '/api/event-templates'

      const dataToSend = {
        ...templateData,
        roles: templateData.roles.filter(role => role.name.trim() !== ''),
        hymns: templateData.hymns.filter(hymn => hymn.title.trim() !== '')
      }

      console.log('🚀 Template Modal: About to save template')
      console.log('🚀 Template Modal: Method:', method)
      console.log('🚀 Template Modal: URL:', url)
      console.log('🚀 Template Modal: Data being sent:', dataToSend)
      console.log('🚀 Template Modal: Hymns being sent:', dataToSend.hymns)

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      console.log('📤 Template Modal: API Response status:', response.status)
      console.log('📤 Template Modal: API Response ok:', response.ok)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Template Modal: API Error response:', errorData)
        throw new Error(errorData.error || 'Failed to save template')
      }

      const responseData = await response.json()
      console.log('✅ Template Modal: API Success response:', responseData)

      setSuccess(editingTemplate ? 'Template updated successfully!' : 'Template created successfully!')
      
      setTimeout(() => {
        console.log('🔄 Template Modal: Calling onTemplateCreated and onClose')
        onTemplateCreated?.()
        onClose()
        setSuccess('')
      }, 1500)
    } catch (err) {
      console.error('💥 Template Modal: Save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  if (!isOpen) return null

  console.log('🪟 Template Modal: Rendering modal with templateData:', templateData)
  console.log('🪟 Template Modal: editingTemplate:', editingTemplate)

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <div
              className="w-4 h-4 rounded-full mr-3"
              style={{ backgroundColor: templateData.color }}
            />
            <h2 className="text-xl font-bold text-gray-900">
              {editingTemplate ? 'Edit Template' : 'Create Event Template'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b bg-gray-50">
          {[
            { id: 'details', label: 'Details', icon: Clock },
            { id: 'roles', label: 'Roles', icon: Users },
            { id: 'music', label: 'Music', icon: Music },
            { id: 'preview', label: 'Preview', icon: Eye }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4 mb-6">
              <p className="text-success-600 text-sm flex items-center">
                <Save className="h-4 w-4 mr-2" />
                {success}
              </p>
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
                  <input
                    type="text"
                    value={templateData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Sunday Service, Wedding Service, etc."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={templateData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of this template..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Duration</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="15"
                      max="300"
                      step="15"
                      value={templateData.duration}
                      onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-600 w-16">
                      {formatDuration(templateData.duration)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template Color</label>
                  <div className="grid grid-cols-5 gap-2">
                    {TEMPLATE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleInputChange('color', color)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          templateData.color === color 
                            ? 'border-gray-900 scale-110' 
                            : 'border-gray-300 hover:border-gray-500'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>


            </div>
          )}

          {/* Roles Tab */}
          {activeTab === 'roles' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Musical Roles</h3>
                <button
                  onClick={addRole}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Role
                </button>
              </div>

              <div className="space-y-4">
                {templateData.roles.map((role, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                      <input
                        type="text"
                        value={role.name}
                        onChange={(e) => updateRole(index, 'name', e.target.value)}
                        placeholder="Role name"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-700">Max:</label>
                        <input
                          type="number"
                          value={role.maxCount}
                          onChange={(e) => updateRole(index, 'maxCount', parseInt(e.target.value) || 1)}
                          min="1"
                          max="20"
                          className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={role.isRequired}
                          onChange={(e) => updateRole(index, 'isRequired', e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Required</span>
                      </label>
                      <button
                        onClick={() => removeRole(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {templateData.roles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p>No roles defined yet</p>
                  <button
                    onClick={addRole}
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Add your first role
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Music Tab */}
          {activeTab === 'music' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Default Music & Hymns</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Define default music selections that will be included when creating events from this template
                  </p>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowDefaultsDropdown(!showDefaultsDropdown)}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Music
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </button>
                  
                  {showDefaultsDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            addHymn()
                            setShowDefaultsDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Music
                        </button>
                        <hr className="my-1" />
                        <button
                          onClick={() => {
                            addDefaultServiceParts('required')
                            setShowDefaultsDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          disabled={serviceParts.filter(p => p.isRequired).length === 0}
                        >
                          Add All Required Default Service Parts ({serviceParts.filter(p => p.isRequired).length})
                        </button>
                        <button
                          onClick={() => {
                            addDefaultServiceParts('all')
                            setShowDefaultsDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          disabled={serviceParts.length === 0}
                        >
                          Add All Default Service Parts ({serviceParts.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {templateData.hymns.map((hymn, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <select
                        value={hymn.servicePartId || ''}
                        onChange={(e) => updateHymn(index, 'servicePartId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select service part...</option>
                        {serviceParts.map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.name}
                          </option>
                        ))}
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={hymn.title}
                      onChange={(e) => updateHymn(index, 'title', e.target.value)}
                      placeholder="Song/Hymn title"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={hymn.notes || ''}
                        onChange={(e) => updateHymn(index, 'notes', e.target.value)}
                        placeholder="Notes"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => removeHymn(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {templateData.hymns.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Music className="h-8 w-8 mx-auto mb-2" />
                  <p>No default music defined yet</p>
                  <button
                    onClick={addHymn}
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Add default music
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <div
                    className="w-6 h-6 rounded-lg mr-3"
                    style={{ backgroundColor: templateData.color }}
                  />
                  <h3 className="text-xl font-bold text-gray-900">{templateData.name || 'Untitled Template'}</h3>
                </div>
                
                {templateData.description && (
                  <p className="text-gray-700 mb-4">{templateData.description}</p>
                )}

                <div className="mb-6">
                  <div>
                    <span className="text-sm text-gray-600">Duration:</span>
                    <span className="ml-2 font-medium">{formatDuration(templateData.duration)}</span>
                  </div>
                </div>

                {templateData.roles.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Roles ({templateData.roles.length})</h4>
                    <div className="space-y-2">
                      {templateData.roles.map((role, index) => (
                        <div key={index} className="flex items-center justify-between py-2 px-3 bg-white rounded border">
                          <span className="font-medium">{role.name}</span>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span>Max: {role.maxCount}</span>
                            {role.isRequired && <span className="text-red-600">Required</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {templateData.hymns.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Default Music ({templateData.hymns.length})</h4>
                    <div className="space-y-2">
                      {templateData.hymns.map((hymn, index) => (
                        <div key={index} className="py-2 px-3 bg-white rounded border">
                          <div className="font-medium">{hymn.title}</div>
                          {hymn.servicePartName && <div className="text-sm text-gray-600">{hymn.servicePartName}</div>}
                          {hymn.notes && <div className="text-sm text-gray-500">{hymn.notes}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !templateData.name.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : success ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Saved!
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
} 