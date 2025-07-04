'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  X, Calendar, Clock, MapPin, Users, Edit, Save, Trash2, 
  UserPlus, MessageCircle, Check, AlertTriangle, XCircle,
  Download, Upload, Music, Plus, RefreshCw, FileText, GripVertical, ExternalLink
} from 'lucide-react'
import { InviteModal } from '../musicians/invite-modal'
import { SendMessageModal } from '../messages/send-message-modal'
import PdfProcessor from './pdf-processor'

interface EventDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  event: CalendarEvent | null
  onEventUpdated?: () => void
  onEventDeleted?: () => void
}

interface CalendarEvent {
  id: string
  name: string
  description?: string
  location?: string
  startTime: string
  endTime?: string
  eventType: {
    id: string
    name: string
    color: string
  }
  templateId?: string
  status?: 'confirmed' | 'tentative' | 'cancelled' | 'pending' | 'error'
  isRecurring?: boolean
  recurrencePattern?: string
  assignments?: {
    id: string
    roleName: string
    status: string
    maxMusicians?: number
    user?: {
      id: string
      firstName: string
      lastName: string
      email: string
    }
    group?: {
      id: string
      name: string
    }
  }[]
  musicFiles?: any[]
}

interface Musician {
  id: string
  firstName: string
  lastName: string
  email: string
  instrument?: string
}

interface ToastMessage {
  id: string
  type: 'success' | 'error'
  message: string
}

interface EventHymn {
  id: string
  title: string
  notes?: string
  servicePartId?: string
  servicePart?: {
    id: string
    name: string
  }
}

interface ServicePart {
  id: string
  name: string
  isRequired: boolean
  order: number
}

interface EventDocument {
  id: string
  filename: string
  originalFilename: string
  filePath: string
  fileSize: number
  mimeType: string
  uploadedAt: string
  aiProcessed: boolean
  aiResults?: any
}

// Toast Container Component
function ToastContainer({ toasts, removeToast }: { toasts: ToastMessage[], removeToast: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-lg shadow-lg transition-all duration-300 transform ${
            toast.type === 'success' 
              ? 'bg-success-600 text-white' 
              : 'bg-red-600 text-white'
          } animate-in slide-in-from-right-full`}
          style={{
            animation: 'slideInRight 0.3s ease-out forwards, fadeOut 0.3s ease-out 2.7s forwards'
          }}
        >
          <div className="flex items-center space-x-2">
            {toast.type === 'success' ? (
              <Check className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}

const RECURRENCE_PATTERNS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom pattern' }
]

export function EventDetailsModal({ 
  isOpen, 
  onClose, 
  event, 
  onEventUpdated, 
  onEventDeleted 
}: EventDetailsModalProps) {
  const { data: session } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [musicians, setMusicians] = useState<Musician[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [openDropdowns, setOpenDropdowns] = useState<{ [key: string]: boolean }>({})
  const [searchTexts, setSearchTexts] = useState<{ [key: string]: string }>({})
  
  // Current event data that can be updated independently from props
  const [currentEvent, setCurrentEvent] = useState<CalendarEvent | null>(null)
  
  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  
  // Role creation for events without assignments
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [addingRole, setAddingRole] = useState(false)

  // Music and Documents state
  const [eventHymns, setEventHymns] = useState<EventHymn[]>([])
  const [eventDocuments, setEventDocuments] = useState<EventDocument[]>([])
  const [serviceParts, setServiceParts] = useState<ServicePart[]>([])
  const [draggedHymn, setDraggedHymn] = useState<EventHymn | null>(null)
  const [loadingHymns, setLoadingHymns] = useState(false)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [originalHymns, setOriginalHymns] = useState<EventHymn[]>([]) // To track changes
  const [showPdfProcessor, setShowPdfProcessor] = useState(false)

  const [editData, setEditData] = useState({
    name: '',
    description: '',
    location: '',
    startDate: '',
    startTime: '',
    endTime: '',
    status: 'confirmed' as 'confirmed' | 'tentative' | 'cancelled' | 'pending' | 'error',
    isRecurring: false,
    recurrencePattern: '',
    recurrenceEnd: ''
  })

  // Initialize current event when modal opens or event prop changes
  useEffect(() => {
    if (event) {
      setCurrentEvent(event)
    }
  }, [event])

  // Set edit data when event changes or editing mode starts
  useEffect(() => {
    if (currentEvent && isEditing) {
      const startDate = new Date(currentEvent.startTime)
      const endDate = currentEvent.endTime ? new Date(currentEvent.endTime) : null
      
      setEditData({
        name: currentEvent.name,
        description: currentEvent.description || '',
        location: currentEvent.location || '',
        startDate: startDate.toISOString().split('T')[0],
        startTime: startDate.toTimeString().slice(0, 5),
        endTime: endDate ? endDate.toTimeString().slice(0, 5) : '',
        status: (currentEvent.status && ['confirmed', 'tentative', 'cancelled', 'pending', 'error'].includes(currentEvent.status)) 
          ? currentEvent.status as 'confirmed' | 'tentative' | 'cancelled' | 'pending' | 'error'
          : 'confirmed',
        isRecurring: currentEvent.isRecurring || false,
        recurrencePattern: currentEvent.recurrencePattern || '',
        recurrenceEnd: '' // Note: recurrenceEnd is not stored in event yet, but ready for future enhancement
      })
    }
  }, [currentEvent, isEditing])

  // Check if user is director
  const isDirector = session?.user?.role === 'DIRECTOR' || session?.user?.role === 'PASTOR'

  // Fetch musicians for assignment
  useEffect(() => {
    if (isOpen && isDirector) {
      fetchMusicians()
    }
  }, [isOpen, isDirector])

  // Fetch music data when modal opens or event changes
  useEffect(() => {
    if (isOpen && currentEvent?.id) {
      fetchEventHymns()
      fetchEventDocuments()
      fetchServiceParts()
    }
  }, [isOpen, currentEvent?.id])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Don't close if clicking inside a dropdown or search input
      if (target.closest('.dropdown-container')) return
      
      // Close all dropdowns if clicking outside
      setOpenDropdowns({})
      setSearchTexts({})
    }

    if (Object.values(openDropdowns).some(Boolean)) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdowns])

  // Toast management
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now().toString()
    const newToast: ToastMessage = { id, type, message }
    setToasts(prev => [...prev, newToast])
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      removeToast(id)
    }, 3000)
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const fetchMusicians = async () => {
    try {
      const response = await fetch('/api/musicians?verified=true')
      if (response.ok) {
        const data = await response.json()
        setMusicians(data.musicians || [])
      }
    } catch (error) {
      console.error('Error fetching musicians:', error)
    }
  }

  const fetchEventHymns = async () => {
    if (!currentEvent?.id) return
    
    setLoadingHymns(true)
    try {
      const response = await fetch(`/api/events/${currentEvent.id}/hymns`)
      if (response.ok) {
        const data = await response.json()
        setEventHymns(data.hymns || [])
        setOriginalHymns(data.hymns || [])
      }
    } catch (error) {
      console.error('Error fetching event hymns:', error)
    } finally {
      setLoadingHymns(false)
    }
  }

  const fetchEventDocuments = async () => {
    if (!currentEvent?.id) return
    
    setLoadingDocuments(true)
    try {
      const response = await fetch(`/api/events/${currentEvent.id}/documents`)
      if (response.ok) {
        const data = await response.json()
        setEventDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error fetching event documents:', error)
    } finally {
      setLoadingDocuments(false)
    }
  }

  const fetchServiceParts = async () => {
    try {
      const response = await fetch('/api/service-parts')
      if (response.ok) {
        const data = await response.json()
        setServiceParts(data.serviceParts || [])
      }
    } catch (error) {
      console.error('Error fetching service parts:', error)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
    setError('')
    setSuccess('')
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setError('')
    setSuccess('')
  }

  const handleSave = async () => {
    if (!currentEvent) return
    
    // Additional validation for recurring events
    if (editData.isRecurring && !editData.recurrencePattern) {
      setError('Please select a recurrence pattern for recurring events.')
      showToast('error', 'Please select a recurrence pattern for recurring events.')
      return
    }

    // Check if this is a past event
    const eventDateTime = new Date(`${editData.startDate}T${editData.startTime}`)
    const now = new Date()
    const isPastEvent = eventDateTime < now

    // Show warning for past events
    if (isPastEvent) {
      const confirmEdit = window.confirm(
        'This event has already occurred. Editing past events will not trigger notifications to musicians or pastors. Do you want to continue?'
      )
      if (!confirmEdit) {
        return
      }
    }
    
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/events/${currentEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editData,
          isPastEvent // Include this flag so the API knows to skip notifications
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update event')
      }

      showToast('success', `Event updated successfully!${isPastEvent ? ' (No notifications sent for past event)' : ''}`)
      
      // Save hymns if changes were made
      await saveHymns()
      
      setIsEditing(false)
      
      // Refresh the event data and parent calendar
      await fetchEventData()
      onEventUpdated?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update event'
      setError(errorMessage)
      showToast('error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!currentEvent) return
    
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/events/${currentEvent.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete event')
      }

      showToast('success', 'Event deleted successfully!')
      onEventDeleted?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event'
      setError(errorMessage)
      showToast('error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchEventData = async () => {
    if (!currentEvent?.id) return

    try {
      setLoading(true)
      const response = await fetch(`/api/events/${currentEvent.id}`)
      
      if (!response.ok) throw new Error('Failed to fetch event data')
      
      const responseData = await response.json()
      const updatedEvent = responseData.event // Extract the event from the response wrapper
      
      // Preserve assignment order by mapping based on original order
      if (currentEvent.assignments && updatedEvent.assignments) {
        const originalOrder = currentEvent.assignments.map(a => a.id)
        const updatedAssignments = [...updatedEvent.assignments]
        
        // Sort updated assignments based on original order
        updatedAssignments.sort((a, b) => {
          const aIndex = originalOrder.indexOf(a.id)
          const bIndex = originalOrder.indexOf(b.id)
          
          // If both found in original, use original order
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex
          }
          // If only one found, put found one first
          if (aIndex !== -1) return -1
          if (bIndex !== -1) return 1
          // If neither found (new assignments), maintain current order
          return 0
        })
        
        updatedEvent.assignments = updatedAssignments
      }
      
      setCurrentEvent(updatedEvent)
      onEventUpdated?.()
    } catch (err) {
      console.error('Error fetching event data:', err)
      showToast('error', 'Failed to refresh event data')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignMusician = async (assignmentId: string, musicianId: string) => {
    try {
      setLoading(true)
      setError('')
      
      // Check if this is a past event
      const eventDateTime = new Date(currentEvent?.startTime || '')
      const now = new Date()
      const isPastEvent = eventDateTime < now
      
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          musicianId,
          isPastEvent // Include this flag so the API knows to skip notifications
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to assign musician')
      }

      showToast('success', `Musician assigned successfully!${isPastEvent ? ' (No notifications sent for past event)' : ''}`)
      // Close the dropdown and clear search text
      setOpenDropdowns(prev => ({ ...prev, [assignmentId]: false }))
      setSearchTexts(prev => ({ ...prev, [assignmentId]: '' }))
      
      // Refresh event data to show updated assignments
      await fetchEventData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign musician'
      setError(errorMessage)
      showToast('error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMusician = async (assignmentId: string) => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicianId: null })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove musician')
      }

      showToast('success', 'Musician removed successfully!')
      
      // Refresh event data to show updated assignments
      await fetchEventData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove musician'
      setError(errorMessage)
      showToast('error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRole = async () => {
    if (!currentEvent || !newRoleName.trim()) return
    
    try {
      setAddingRole(true)
      setError('')
      
      // Create a new assignment for this role
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: currentEvent.id,
          roleName: newRoleName.trim(),
          maxMusicians: 1,
          status: 'PENDING'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add role')
      }

      showToast('success', 'Role added successfully!')
      setNewRoleName('')
      setShowAddRole(false)
      
      // Refresh event data to show new role
      await fetchEventData()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add role'
      setError(errorMessage)
      showToast('error', errorMessage)
    } finally {
      setAddingRole(false)
    }
  }

  // Music management functions
  const addHymn = () => {
    const newHymn: EventHymn = {
      id: `temp-${Date.now()}`,
      title: '',
      notes: '',
      servicePartId: ''
    }
    setEventHymns([...eventHymns, newHymn])
  }

  const updateHymn = (id: string, field: keyof EventHymn, value: string) => {
    setEventHymns(hymns => hymns.map(hymn => {
      if (hymn.id === id) {
        const updatedHymn = { ...hymn, [field]: value }
        
        // If updating servicePartId, also update servicePart reference
        if (field === 'servicePartId') {
          if (value === 'custom' || value === '') {
            updatedHymn.servicePartId = value === 'custom' ? undefined : ''
            updatedHymn.servicePart = undefined
          } else {
            const selectedPart = serviceParts.find(part => part.id === value)
            updatedHymn.servicePart = selectedPart
          }
        }
        
        return updatedHymn
      }
      return hymn
    }))
  }

  const removeHymn = (id: string) => {
    setEventHymns(hymns => hymns.filter(hymn => hymn.id !== id))
  }

  const handleHymnDragStart = (e: React.DragEvent, hymn: EventHymn) => {
    setDraggedHymn(hymn)
  }

  const handleHymnDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleHymnDrop = (e: React.DragEvent, targetHymn: EventHymn) => {
    e.preventDefault()
    if (!draggedHymn || draggedHymn.id === targetHymn.id) return

    const newHymns = [...eventHymns]
    const draggedIndex = newHymns.findIndex(hymn => hymn.id === draggedHymn.id)
    const targetIndex = newHymns.findIndex(hymn => hymn.id === targetHymn.id)

    // Remove dragged item and insert at target position
    const [draggedItem] = newHymns.splice(draggedIndex, 1)
    newHymns.splice(targetIndex, 0, draggedItem)

    setEventHymns(newHymns)
    setDraggedHymn(null)
  }

  const saveHymns = async () => {
    if (!currentEvent?.id || !isEditing) return

    setLoadingHymns(true)
    try {
      const response = await fetch(`/api/events/${currentEvent.id}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: eventHymns })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save music')
      }

      // Check if changes were made to trigger notifications
      const hymnsChanged = JSON.stringify(originalHymns) !== JSON.stringify(eventHymns)
      
      if (hymnsChanged) {
        showToast('success', 'Music updated successfully! Musicians will be notified of changes.')
      }
      
      setOriginalHymns([...eventHymns])
      await fetchEventHymns() // Refresh with server data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save music'
      setError(errorMessage)
      showToast('error', errorMessage)
    } finally {
      setLoadingHymns(false)
    }
  }

  const openPDF = (document: EventDocument) => {
    // Open PDF in new tab
    window.open(`/api/events/${currentEvent?.id}/documents/${document.id}/view`, '_blank')
  }

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !currentEvent) return

    setLoading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch(`/api/events/${currentEvent.id}/documents`, {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) {
          throw new Error('Failed to upload document')
        }
      }
      
      showToast('success', `${files.length} document(s) uploaded successfully`)
      fetchEventDocuments() // Refresh the documents list
    } catch (error) {
      console.error('Error uploading documents:', error)
      showToast('error', 'Failed to upload documents')
    } finally {
      setLoading(false)
      // Reset the file input
      e.target.value = ''
    }
  }

  const handlePdfSuggestions = (suggestions: Array<{servicePartName: string, songTitle: string, notes: string}>) => {
    // Convert suggestions to hymns and add them
    const newHymns = suggestions.map((suggestion, index) => {
      // Find matching service part
      const matchingPart = serviceParts.find(part => 
        part.name.toLowerCase().includes(suggestion.servicePartName.toLowerCase()) ||
        suggestion.servicePartName.toLowerCase().includes(part.name.toLowerCase())
      )
      
      return {
        id: `hymn-${Date.now()}-${index}`,
        title: suggestion.songTitle,
        notes: suggestion.notes,
        servicePartId: matchingPart?.id || ''
      }
    })

    setEventHymns(prev => [...prev, ...newHymns])
    showToast('success', `Added ${suggestions.length} songs from PDF`)
  }

  // Filter musicians based on search text
  const getFilteredMusicians = (assignmentId: string) => {
    const searchText = searchTexts[assignmentId] || ''
    if (!searchText.trim()) {
      return musicians
    }
    
    return musicians.filter(musician => 
      `${musician.firstName} ${musician.lastName}`.toLowerCase().includes(searchText.toLowerCase())
    )
  }

  // Handle search text change
  const handleSearchChange = (assignmentId: string, value: string) => {
    setSearchTexts(prev => ({ ...prev, [assignmentId]: value }))
  }

  const toggleDropdown = (assignmentId: string) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [assignmentId]: !prev[assignmentId]
    }))
    
    // Clear search text when opening
    if (!openDropdowns[assignmentId]) {
      setSearchTexts(prev => ({ ...prev, [assignmentId]: '' }))
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return <Check className="h-4 w-4 text-success-600" />
      case 'tentative':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Check className="h-4 w-4 text-success-600" />
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-success-600 bg-success-50 border-success-200'
      case 'tentative':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'cancelled':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-success-600 bg-success-50 border-success-200'
    }
  }

  if (!isOpen || !currentEvent) return null

  const eventDate = new Date(currentEvent.startTime)
  const eventEndDate = currentEvent.endTime ? new Date(currentEvent.endTime) : null
  
  const timeString = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  
  const endTimeString = eventEndDate ? eventEndDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) : null

  const dateString = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <div
              className="w-4 h-4 rounded-full mr-3"
              style={{ backgroundColor: currentEvent.eventType.color }}
            />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    className="text-xl font-bold bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  currentEvent.name
                )}
              </h2>
              <p className="text-sm text-gray-600">{currentEvent.eventType.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isDirector && !isEditing && (
              <>
                <button
                  onClick={handleEdit}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit event"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete event"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={isEditing ? handleCancelEdit : onClose}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Past Event Warning */}
          {(() => {
            const eventDateTime = new Date(currentEvent.startTime)
            const now = new Date()
            const isPastEvent = eventDateTime < now
            
            return isPastEvent && isEditing ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 text-sm flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <strong>Past Event:</strong> This event has already occurred. Edits will not trigger notifications to musicians or pastors.
                </p>
              </div>
            ) : null
          })()}

          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
              <p className="text-success-600 text-sm flex items-center">
                <Check className="h-4 w-4 mr-2" />
                {success}
              </p>
            </div>
          )}

          {/* Event Status */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Event Status</h3>
            {isEditing ? (
              <select
                value={editData.status}
                onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value as any }))}
                className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="confirmed">Confirmed</option>
                <option value="tentative">Tentative</option>
                <option value="cancelled">Cancelled</option>
              </select>
            ) : (
              <div className={`flex items-center px-3 py-1 rounded-full border ${getStatusColor(currentEvent.status)}`}>
                {getStatusIcon(currentEvent.status)}
                <span className="ml-2 text-sm font-medium capitalize">
                  {currentEvent.status || 'Confirmed'}
                </span>
              </div>
            )}
          </div>

          {/* Event Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date & Time */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Date & Time</h3>
              
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={editData.startDate}
                      onChange={(e) => setEditData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={editData.startTime}
                        onChange={(e) => setEditData(prev => ({ ...prev, startTime: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={editData.endTime}
                        onChange={(e) => setEditData(prev => ({ ...prev, endTime: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center text-gray-700">
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    <span>{dateString}</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <Clock className="h-4 w-4 mr-2 text-blue-600" />
                    <span>{timeString}{endTimeString ? ` - ${endTimeString}` : ''}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Location</h3>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.location}
                  onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Event location..."
                />
              ) : (
                <div className="flex items-center text-gray-700">
                  <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                  <span>{currentEvent.location || 'No location specified'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Description</h3>
            {isEditing ? (
              <textarea
                value={editData.description}
                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Event description..."
              />
            ) : (
              <p className="text-gray-700">{currentEvent.description || 'No description provided'}</p>
            )}
          </div>

          {/* Recurring Event Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <RefreshCw className="h-5 w-5 mr-2 text-blue-600" />
              Recurring Event Settings
            </h3>
            
            {isEditing ? (
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isRecurringEdit"
                    checked={editData.isRecurring}
                    onChange={(e) => setEditData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isRecurringEdit" className="ml-2 text-sm text-gray-700">
                    Make this event recurring
                  </label>
                </div>

                {editData.isRecurring && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <strong>Recurring Events:</strong> This will automatically create multiple instances of this event based on your selected pattern. 
                        All roles, assignments, and settings will be copied to each occurrence.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-blue-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Recurrence Pattern *</label>
                        <select
                          value={editData.recurrencePattern}
                          onChange={(e) => setEditData(prev => ({ ...prev, recurrencePattern: e.target.value }))}
                          required={editData.isRecurring}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select pattern...</option>
                          {RECURRENCE_PATTERNS.map((pattern) => (
                            <option key={pattern.value} value={pattern.value}>
                              {pattern.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date (Optional)</label>
                        <input
                          type="date"
                          value={editData.recurrenceEnd}
                          onChange={(e) => setEditData(prev => ({ ...prev, recurrenceEnd: e.target.value }))}
                          min={editData.startDate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          title="If left empty, the event will recur indefinitely"
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave empty to recur indefinitely</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center text-gray-700">
                  <RefreshCw className="h-4 w-4 mr-2 text-blue-600" />
                  <span className="font-medium">
                    {currentEvent.isRecurring ? 'Yes' : 'No'}
                  </span>
                  {currentEvent.isRecurring && currentEvent.recurrencePattern && (
                    <span className="text-gray-500 ml-2">
                      ({RECURRENCE_PATTERNS.find(p => p.value === currentEvent.recurrencePattern)?.label})
                    </span>
                  )}
                </div>
                {currentEvent.isRecurring && (
                  <div className="text-sm text-gray-600 pl-6">
                    This event repeats based on the selected pattern. Changes to this event may affect future occurrences.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Music & Service Parts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Music className="h-5 w-5 mr-2 text-blue-600" />
                Music & Service Parts ({eventHymns.length})
              </h3>
              {isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPdfProcessor(true)}
                    className="flex items-center px-3 py-1 text-sm bg-[#660033] text-white rounded-lg hover:bg-[#800041] transition-colors"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Auto Populate
                  </button>
                  <button
                    onClick={addHymn}
                    className="flex items-center px-3 py-1 text-sm bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Music
                  </button>
                </div>
              )}
            </div>

            {loadingHymns ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                <span className="ml-2 text-gray-600">Loading music...</span>
              </div>
            ) : eventHymns.length > 0 ? (
              <div className="space-y-3">
                {eventHymns.map((hymn, index) => (
                  <div 
                    key={hymn.id} 
                    className={`relative bg-gray-50 rounded-lg p-4 border ${isEditing ? 'cursor-move' : ''} ${
                      draggedHymn?.id === hymn.id ? 'opacity-50' : ''
                    }`}
                    draggable={isEditing}
                    onDragStart={(e) => isEditing && handleHymnDragStart(e, hymn)}
                    onDragOver={(e) => isEditing && handleHymnDragOver(e)}
                    onDrop={(e) => isEditing && handleHymnDrop(e, hymn)}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        {/* Drag handle and remove button */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-gray-400">
                            <GripVertical className="h-4 w-4 mr-2" />
                            <span className="text-sm">Song {index + 1}</span>
                          </div>
                          <button
                            onClick={() => removeHymn(hymn.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove this music item"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Service part selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Service Part</label>
                          <select
                            value={hymn.servicePartId || ''}
                            onChange={(e) => updateHymn(hymn.id, 'servicePartId', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Select service part...</option>
                            {serviceParts.map((part) => (
                              <option key={part.id} value={part.id}>
                                {part.name}
                              </option>
                            ))}
                            <option value="custom">Custom / Other</option>
                          </select>
                        </div>

                        {/* Song title */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Song Title *</label>
                          <input
                            type="text"
                            value={hymn.title}
                            onChange={(e) => updateHymn(hymn.id, 'title', e.target.value)}
                            placeholder="Enter song title..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                          <textarea
                            value={hymn.notes || ''}
                            onChange={(e) => updateHymn(hymn.id, 'notes', e.target.value)}
                            placeholder="Special instructions, key, tempo, etc..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Read-only view */
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-1">
                              <span className="text-sm font-medium text-gray-500 mr-2">
                                {hymn.servicePart?.name || 'Other'}:
                              </span>
                              <span className="font-medium text-gray-900">{hymn.title}</span>
                            </div>
                            {hymn.notes && (
                              <p className="text-sm text-gray-600 mt-1">{hymn.notes}</p>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 ml-4">
                            #{index + 1}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Music className="h-8 w-8 mx-auto mb-2" />
                <p>No music assigned yet</p>
                <p className="text-sm">Use "Add Music" or "Auto Populate" to add songs</p>
              </div>
            )}
          </div>

          {/* Event Documents & PDFs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Event Documents ({eventDocuments.length})
              </h3>
              {isEditing && (
                <button
                  onClick={() => document.getElementById('document-upload')?.click()}
                  className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Document
                </button>
              )}
            </div>
            {/* Hidden file input */}
            <input
              id="document-upload"
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              onChange={handleDocumentUpload}
              className="hidden"
            />

            {loadingDocuments ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                <span className="ml-2 text-gray-600">Loading documents...</span>
              </div>
            ) : eventDocuments.length > 0 ? (
              <div className="space-y-3">
                {eventDocuments.map((document) => (
                  <div key={document.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center flex-1">
                      <FileText className="h-5 w-5 text-blue-600 mr-3" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{document.originalFilename}</div>
                        <div className="text-sm text-gray-500">
                          Uploaded {new Date(document.uploadedAt).toLocaleDateString()}
                          {document.aiProcessed && <span className="ml-2 text-green-600">✓ AI Processed</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openPDF(document)}
                        className="flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="Open PDF in new tab"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p>No documents uploaded</p>
              </div>
            )}
          </div>

          {/* Assigned Musicians */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2 text-blue-600" />
                Musicians & Roles ({currentEvent.assignments?.length || 0})
              </h3>
              {isDirector && isEditing && currentEvent.assignments && currentEvent.assignments.length > 0 && !showAddRole && (
                <button
                  onClick={() => setShowAddRole(true)}
                  className="flex items-center px-3 py-1 text-sm bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
                  title="Add another role"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Role
                </button>
              )}
            </div>
            
            {currentEvent.assignments && currentEvent.assignments.length > 0 ? (
              <div className="space-y-2">
                {currentEvent.assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <Music className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{assignment.roleName}</div>
                        {assignment.user ? (
                          <div className="text-sm text-gray-600">
                            {assignment.user.firstName} {assignment.user.lastName}
                          </div>
                        ) : assignment.group ? (
                          <div className="text-sm text-gray-600">
                            {assignment.group.name} (Group)
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">Open position</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 relative">
                      {/* Show assigned musician with edit option or assign button */}
                      {assignment.user ? (
                        <div className="flex items-center space-x-2 group">
                          <div className="text-sm text-gray-900">
                            <span className="font-medium">{assignment.user.firstName} {assignment.user.lastName}</span>
                          </div>
                          {/* Edit and Remove buttons for directors - only in edit mode */}
                          {isDirector && isEditing && (
                            <div className="flex items-center space-x-1">
                              {/* Remove musician button - visible on hover */}
                              <button
                                onClick={() => handleRemoveMusician(assignment.id)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove musician from role"
                                disabled={loading}
                              >
                                <X className="h-4 w-4" />
                              </button>
                              {/* Edit/change musician button */}
                              <div className="relative">
                                <button
                                  onClick={() => toggleDropdown(assignment.id)}
                                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Change musician assignment"
                                  disabled={loading}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              
                                {/* Searchable Dropdown Menu */}
                                {openDropdowns[assignment.id] && (
                                  <div className="dropdown-container absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                    <div className="p-2 border-b border-gray-200">
                                      <input
                                        type="text"
                                        placeholder="Search musicians..."
                                        value={searchTexts[assignment.id] || ''}
                                        onChange={(e) => handleSearchChange(assignment.id, e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                      {getFilteredMusicians(assignment.id).length > 0 ? (
                                        <>
                                          {getFilteredMusicians(assignment.id).map((musician) => (
                                            <button
                                              key={musician.id}
                                              onClick={() => handleAssignMusician(assignment.id, musician.id)}
                                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                                              disabled={loading}
                                            >
                                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                                <Users className="h-3 w-3 text-blue-600" />
                                              </div>
                                              <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-900">
                                                  {musician.firstName} {musician.lastName}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {musician.email}
                                                </div>
                                                {musician.instrument && (
                                                  <div className="text-xs text-blue-600">
                                                    {musician.instrument}
                                                  </div>
                                                )}
                                              </div>
                                            </button>
                                          ))}
                                        </>
                                      ) : (
                                        <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                          {searchTexts[assignment.id] ? 'No musicians found' : 'No musicians available'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Show assign musician button for open positions */
                        isDirector && isEditing ? (
                          <div className="relative">
                            <button
                              onClick={() => toggleDropdown(assignment.id)}
                              className="flex items-center px-3 py-1 text-sm bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50"
                              disabled={loading}
                            >
                              {loading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                              ) : (
                                <UserPlus className="h-4 w-4 mr-1" />
                              )}
                              Assign Musician
                            </button>
                            
                            {/* Searchable Dropdown Menu */}
                            {openDropdowns[assignment.id] && (
                              <div className="dropdown-container absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                <div className="p-2 border-b border-gray-200">
                                  <input
                                    type="text"
                                    placeholder="Search musicians..."
                                    value={searchTexts[assignment.id] || ''}
                                    onChange={(e) => handleSearchChange(assignment.id, e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {getFilteredMusicians(assignment.id).length > 0 ? (
                                    <>
                                      {getFilteredMusicians(assignment.id).map((musician) => (
                                        <button
                                          key={musician.id}
                                          onClick={() => handleAssignMusician(assignment.id, musician.id)}
                                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                                          disabled={loading}
                                        >
                                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Users className="h-3 w-3 text-blue-600" />
                                          </div>
                                          <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">
                                              {musician.firstName} {musician.lastName}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              {musician.email}
                                            </div>
                                            {musician.instrument && (
                                              <div className="text-xs text-blue-600">
                                                {musician.instrument}
                                              </div>
                                            )}
                                          </div>
                                        </button>
                                      ))}
                                    </>
                                  ) : (
                                    <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                      {searchTexts[assignment.id] ? 'No musicians found' : 'No musicians available'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Show status for non-directors or non-editing mode */
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            assignment.status === 'CONFIRMED' 
                              ? 'bg-success-100 text-success-800'
                              : assignment.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {assignment.status || 'OPEN'}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Add Role Form for existing assignments */}
                {isDirector && isEditing && showAddRole && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">Add New Role</h4>
                      <input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="Enter role name (e.g., Accompanist, Vocalist)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddRole()}
                        autoFocus
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleAddRole}
                          disabled={addingRole || !newRoleName.trim()}
                          className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50 text-sm flex items-center"
                        >
                          {addingRole ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : (
                            <Check className="h-4 w-4 mr-2" />
                          )}
                          Add Role
                        </button>
                        <button
                          onClick={() => {
                            setShowAddRole(false)
                            setNewRoleName('')
                          }}
                          disabled={addingRole}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <p>No roles available</p>
                {isDirector && isEditing && (
                  <div className="mt-4">
                    {!showAddRole ? (
                      <button
                        onClick={() => setShowAddRole(true)}
                        className="flex items-center mx-auto px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors text-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Role
                      </button>
                    ) : (
                      <div className="max-w-xs mx-auto space-y-3">
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="Enter role name (e.g., Accompanist, Vocalist)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddRole()}
                          autoFocus
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={handleAddRole}
                            disabled={addingRole || !newRoleName.trim()}
                            className="flex-1 px-3 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50 text-sm flex items-center justify-center"
                          >
                            {addingRole ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Add
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setShowAddRole(false)
                              setNewRoleName('')
                            }}
                            disabled={addingRole}
                            className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {isDirector && !isEditing && (
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <button
                onClick={() => setShowMessageModal(true)}
                className="flex items-center px-3 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors text-sm"
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Message Musicians
              </button>
            </div>
          )}

          {/* Save/Cancel Buttons for Editing */}
          {isEditing && (
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={handleCancelEdit}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !editData.name || !editData.location}
                className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Event</h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this event? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvitesSent={() => {
          setShowInviteModal(false)
          fetchMusicians()
        }}
      />

      {/* Message Modal */}
      <SendMessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        onMessageSent={() => setShowMessageModal(false)}
      />

      {/* PDF Processor Modal */}
      {showPdfProcessor && (
        <PdfProcessor
          onSuggestionsAccepted={handlePdfSuggestions}
          onClose={() => setShowPdfProcessor(false)}
        />
      )}

      {/* Toast Container */}
      <ToastContainer
        toasts={toasts}
        removeToast={removeToast}
      />
    </div>
  )
} 