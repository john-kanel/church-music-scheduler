'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  X, Plus, Trash2, Calendar, Clock, Palette, Users, Music, 
  Save, Settings, Eye
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
  composer?: string
  notes?: string
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

  // Reset or set template data when modal opens/closes or editing changes
  useEffect(() => {
    if (editingTemplate) {
      setTemplateData({
        ...editingTemplate,
        roles: editingTemplate.roles?.length > 0 ? editingTemplate.roles : [
          { name: 'Accompanist', maxCount: 1, isRequired: true },
          { name: 'Vocalist', maxCount: 4, isRequired: false }
        ],
        hymns: editingTemplate.hymns || []
      })
    } else {
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

  const handleInputChange = (field: keyof EventTemplate, value: any) => {
    setTemplateData(prev => ({ ...prev, [field]: value }))
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
    setTemplateData(prev => ({
      ...prev,
      hymns: [...prev.hymns, { title: '', composer: '', notes: '' }]
    }))
  }

  const updateHymn = (index: number, field: keyof TemplateHymn, value: string) => {
    setTemplateData(prev => ({
      ...prev,
      hymns: prev.hymns.map((hymn, i) => 
        i === index ? { ...hymn, [field]: value } : hymn
      )
    }))
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

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...templateData,
          roles: templateData.roles.filter(role => role.name.trim() !== ''),
          hymns: templateData.hymns.filter(hymn => hymn.title.trim() !== '')
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save template')
      }

      setSuccess(editingTemplate ? 'Template updated successfully!' : 'Template created successfully!')
      
      setTimeout(() => {
        onTemplateCreated?.()
        onClose()
        setSuccess('')
      }, 1500)
    } catch (err) {
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
            { id: 'details', label: 'Details', icon: Settings },
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-600 text-sm flex items-center">
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
                <h3 className="text-lg font-semibold text-gray-900">Default Music & Hymns</h3>
                <button
                  onClick={addHymn}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Music
                </button>
              </div>

              <div className="space-y-3">
                {templateData.hymns.map((hymn, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={hymn.title}
                      onChange={(e) => updateHymn(index, 'title', e.target.value)}
                      placeholder="Song/Hymn title"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={hymn.composer || ''}
                      onChange={(e) => updateHymn(index, 'composer', e.target.value)}
                      placeholder="Composer/Artist"
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
                          {hymn.composer && <div className="text-sm text-gray-600">by {hymn.composer}</div>}
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