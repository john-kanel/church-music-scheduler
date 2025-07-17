'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Plus, Filter, Calendar, FileText, Zap, ChevronLeft, ChevronRight, Edit, ChevronUp, ChevronDown, Check, XCircle, X, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { CreateEventModal } from '@/components/events/create-event-modal'
import { ServicePartEditModal } from '@/components/events/service-part-edit-modal'
import dynamic from 'next/dynamic'

// Dynamically import PdfProcessor to prevent SSR issues
const PdfProcessor = dynamic(() => import('@/components/events/pdf-processor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4">Loading PDF processor...</div>
})

interface ServicePart {
  id: string
  name: string
  order: number
}

interface ToastMessage {
  id: string
  type: 'success' | 'error'
  message: string
}

interface Event {
  id: string
  name: string
  startTime: string
  endTime: string
  location: string
  eventType: {
    id: string
    name: string
    color: string
  }
  hymns: Array<{
    id: string
    title: string
    servicePartId?: string
    notes?: string
  }>
  assignments: Array<{
    id: string
    roleName: string
    status: string
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
  }>
  documents?: Array<{
    id: string
    filename: string
    originalFilename: string
    fileSize: number
    mimeType: string
    uploadedAt: string
  }>
}

interface EventPlannerData {
  serviceParts: ServicePart[]
  events: Event[]
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
              ? 'bg-green-600 text-white' 
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

export default function EventPlannerPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<EventPlannerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [visibleServiceParts, setVisibleServiceParts] = useState<Set<string>>(new Set())
  const [visibleEventColors, setVisibleEventColors] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPdfProcessor, setShowPdfProcessor] = useState(false)
  
  // Toast state
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [currentEventIdForUpload, setCurrentEventIdForUpload] = useState<string>('')
  const [currentEventIndex, setCurrentEventIndex] = useState(0) // For mobile navigation
  
  // Service part editing
  const [showServicePartEditModal, setShowServicePartEditModal] = useState(false)
  const [editingServicePart, setEditingServicePart] = useState<ServicePart | null>(null)
  const [editingEventId, setEditingEventId] = useState<string>('')
  const [clickPosition, setClickPosition] = useState<{ x: number, y: number } | undefined>(undefined)
  // Event-specific service part ordering
  const [eventServicePartOrder, setEventServicePartOrder] = useState<Record<string, string[]>>({})
  
  // Musician assignment
  const [musicians, setMusicians] = useState<Array<{id: string, firstName: string, lastName: string, email: string}>>([])
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({})
  const [searchTexts, setSearchTexts] = useState<Record<string, string>>({})

  // Group assignment
  const [groups, setGroups] = useState<Array<{id: string, name: string, description?: string, members: Array<{id: string, firstName: string, lastName: string}>}>>([])
  const [showGroupAssignmentModal, setShowGroupAssignmentModal] = useState(false)
  const [editingGroupEventId, setEditingGroupEventId] = useState<string>('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])

  // Toast functions
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

  useEffect(() => {
    if (session?.user) {
      fetchPlannerData()
      fetchMusicians()
      fetchGroups()
      // Check for backed-up changes on page load
      restoreBackedUpChanges()
    }
  }, [session])

  // Recovery mechanism for backed-up changes
  const restoreBackedUpChanges = () => {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('hymn_backup_'))
      console.log('Found', keys.length, 'backup entries')
      
      keys.forEach(key => {
        const backup = localStorage.getItem(key)
        if (backup) {
          try {
            const data = JSON.parse(backup)
            // Only restore if backup is less than 1 hour old
            if (Date.now() - data.timestamp < 60 * 60 * 1000) {
              console.log('Restoring backup:', data)
              updateHymnTitle(data.eventId, data.title, data.servicePartId, data.hymnId)
            }
            // Clean up old backups
            localStorage.removeItem(key)
          } catch (err) {
            console.error('Error parsing backup:', err)
            localStorage.removeItem(key)
          }
        }
      })
    } catch (error) {
      console.error('Error restoring backups:', error)
    }
  }

  const fetchPlannerData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/planner')
      if (response.ok) {
        const plannerData = await response.json()
        
        // Fetch documents for each event
        const eventsWithDocuments = await Promise.all(
          plannerData.events.map(async (event: Event) => {
            try {
              const documentsResponse = await fetch(`/api/events/${event.id}/documents`)
              if (documentsResponse.ok) {
                const documentsData = await documentsResponse.json()
                return {
                  ...event,
                  documents: documentsData.documents || []
                }
              }
              return {
                ...event,
                documents: []
              }
            } catch (error) {
              console.error(`Error fetching documents for event ${event.id}:`, error)
              return {
                ...event,
                documents: []
              }
            }
          })
        )
        
        const updatedPlannerData = {
          ...plannerData,
          events: eventsWithDocuments
        }
        
        setData(updatedPlannerData)
        // Initially show all service parts
        setVisibleServiceParts(new Set(plannerData.serviceParts.map((sp: ServicePart) => sp.id)))
        // Get unique event colors and show all initially
        const uniqueColors = plannerData.events.map((event: Event) => event.eventType.color)
        setVisibleEventColors(new Set<string>(uniqueColors))
      } else {
        console.error('Failed to fetch planner data')
      }
    } catch (error) {
      console.error('Error fetching planner data:', error)
    } finally {
      setLoading(false)
    }
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

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const toggleEventColor = (color: string) => {
    const newVisible = new Set(visibleEventColors)
    if (newVisible.has(color)) {
      newVisible.delete(color)
    } else {
      newVisible.add(color)
    }
    setVisibleEventColors(newVisible)
  }

  const updateHymnTitle = async (eventId: string, newTitle: string, servicePartId: string, hymnId?: string) => {
    try {
      // First update local state immediately for responsiveness
      let currentHymns: any[] = []
      setData(prev => {
        if (!prev) return prev
        const event = prev.events.find(e => e.id === eventId)
        if (!event) return prev
        
        currentHymns = [...event.hymns]
        
        if (hymnId) {
          // Update existing hymn
          currentHymns = currentHymns.map(hymn =>
            hymn.id === hymnId ? { ...hymn, title: newTitle } : hymn
          )
        } else {
          // Add new hymn
          currentHymns.push({
            id: `temp-${Date.now()}`,
            title: newTitle,
            servicePartId,
            notes: null
          })
        }
        
        return {
          ...prev,
          events: prev.events.map(e => 
            e.id === eventId ? { ...e, hymns: currentHymns } : e
          )
        }
      })

      // Send to server using the format the API expects
      const hymnsToSend = data?.events.find(e => e.id === eventId)?.hymns.map(hymn => ({
        title: hymn.id === hymnId ? newTitle : hymn.title,
        notes: hymn.notes || '',
        servicePartId: hymn.servicePartId === servicePartId && hymn.id === hymnId ? servicePartId : hymn.servicePartId
      })) || []

      // If this is a new hymn, add it to the array
      if (!hymnId) {
        hymnsToSend.push({
          title: newTitle,
          notes: '',
          servicePartId
        })
      }

      const response = await fetch(`/api/events/${eventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: hymnsToSend })
      })

      if (!response.ok) {
        console.error('Failed to save hymn:', response.statusText)
        // Revert local state if server update failed
        await fetchPlannerData()
      }
    } catch (error) {
      console.error('Error updating hymn:', error)
      // Revert local state if there was an error
      await fetchPlannerData()
    }
  }

  // More aggressive auto-save with refs to avoid stale closures
  const [updateTimeouts, setUpdateTimeouts] = useState<Record<string, NodeJS.Timeout>>({})
  const pendingUpdatesRef = useRef<Record<string, {eventId: string, title: string, servicePartId: string, hymnId?: string}>>({})
  const updateTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({})
  
  // Auto-save when page becomes hidden (user switches tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page hidden, saving pending updates:', pendingUpdatesRef.current)
        // Page is hidden, save all pending updates immediately
        Object.entries(pendingUpdatesRef.current).forEach(([key, update]) => {
          if (update.title.trim()) {
            console.log('Saving update for', key, update.title)
            updateHymnTitle(update.eventId, update.title, update.servicePartId, update.hymnId)
          }
        })
        pendingUpdatesRef.current = {}
        // Clear all timeouts
        Object.values(updateTimeoutsRef.current).forEach(clearTimeout)
        updateTimeoutsRef.current = {}
        setUpdateTimeouts({})
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])
  
  // Auto-save before page unload using both approaches
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const pendingCount = Object.keys(pendingUpdatesRef.current).length
      if (pendingCount > 0) {
        console.log('Page unloading, saving', pendingCount, 'pending updates')
        
        // Group updates by eventId to send as batches
        const updatesByEvent: Record<string, any[]> = {}
        Object.entries(pendingUpdatesRef.current).forEach(([key, update]) => {
          if (update.title.trim()) {
            if (!updatesByEvent[update.eventId]) {
              updatesByEvent[update.eventId] = []
            }
            updatesByEvent[update.eventId].push(update)
          }
        })

        // Send each event's updates as a batch
        Object.entries(updatesByEvent).forEach(([eventId, updates]) => {
          try {
            // Get current hymns for this event to build proper update
            const currentEvent = data?.events.find(e => e.id === eventId)
            if (!currentEvent) return

            const hymnsToSend = currentEvent.hymns.map(hymn => {
              const update = updates.find(u => u.servicePartId === hymn.servicePartId)
              return {
                title: update ? update.title : hymn.title,
                notes: hymn.notes || '',
                servicePartId: hymn.servicePartId
              }
            })

            // Add any new hymns
            updates.forEach(update => {
              if (!currentEvent.hymns.find(h => h.servicePartId === update.servicePartId)) {
                hymnsToSend.push({
                  title: update.title,
                  notes: '',
                  servicePartId: update.servicePartId
                })
              }
            })

            // Approach 1: Try fetch with keepalive
            fetch(`/api/events/${eventId}/hymns`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hymns: hymnsToSend }),
              keepalive: true
            }).catch(err => console.error('Fetch failed:', err))
            
            // Approach 2: localStorage backup for recovery
            updates.forEach(update => {
              const backupKey = `hymn_backup_${update.eventId}_${update.servicePartId}`
              localStorage.setItem(backupKey, JSON.stringify({
                ...update,
                timestamp: Date.now()
              }))
            })
          } catch (err) {
            console.error('Error saving updates for event', eventId, err)
          }
        })
        
        // Don't show "Are you sure?" dialog for this
        delete e.returnValue
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])
  
  const debouncedUpdateHymn = (eventId: string, newTitle: string, servicePartId: string, hymnId?: string) => {
    const key = `${eventId}-${servicePartId}`
    
    // Store pending update in ref (survives tab switches)
    pendingUpdatesRef.current[key] = { eventId, title: newTitle, servicePartId, hymnId }
    
    // Clear existing timeout
    if (updateTimeoutsRef.current[key]) {
      clearTimeout(updateTimeoutsRef.current[key])
    }
    
    // More aggressive auto-save: reduce delay from 500ms to 200ms
    const timeoutId = setTimeout(() => {
      if (newTitle.trim()) {
        console.log('Auto-saving after delay:', key, newTitle)
        updateHymnTitle(eventId, newTitle, servicePartId, hymnId)
      }
      
      // Clean up after successful save
      delete pendingUpdatesRef.current[key]
      delete updateTimeoutsRef.current[key]
      setUpdateTimeouts(prev => {
        const newTimeouts = { ...prev }
        delete newTimeouts[key]
        return newTimeouts
      })
    }, 200) // Reduced from 500ms to 200ms for faster saving
    
    updateTimeoutsRef.current[key] = timeoutId
    setUpdateTimeouts(prev => ({ ...prev, [key]: timeoutId }))
  }

  const handleAutoPopulate = (eventId: string) => {
    setCurrentEventIdForUpload(eventId)
    setShowPdfProcessor(true)
  }

  const handlePdfSuggestions = async (suggestions: Array<{servicePartName: string, songTitle: string, notes: string}>) => {
    try {
      // Convert suggestions to hymns and update the event
      for (const suggestion of suggestions) {
        const servicePart = data?.serviceParts.find(sp => 
          sp.name.toLowerCase().includes(suggestion.servicePartName.toLowerCase()) ||
          suggestion.servicePartName.toLowerCase().includes(sp.name.toLowerCase())
        )
        
        if (servicePart) {
          await updateHymnTitle(currentEventIdForUpload, suggestion.songTitle, servicePart.id)
        }
      }
      
      // Refresh the data to show updated hymns
      await fetchPlannerData()
      setShowPdfProcessor(false)
    } catch (error) {
      console.error('Error processing PDF suggestions:', error)
    }
  }

  const handleEditServicePart = (servicePart: ServicePart, eventId: string, event: React.MouseEvent) => {
    setEditingServicePart(servicePart)
    setEditingEventId(eventId)
    setClickPosition({ x: event.clientX, y: event.clientY })
    setShowServicePartEditModal(true)
  }

  const handleSaveServicePart = async (servicePartId: string, name: string, notes: string) => {
    if (!editingEventId) return
    
    try {
      // This would be a custom API call to update the service part for this specific event
      // For now, we'll just update the local state
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          serviceParts: prev.serviceParts.map(sp => 
            sp.id === servicePartId 
              ? { ...sp, name, notes }
              : sp
          )
        }
      })
      setShowServicePartEditModal(false)
      setEditingServicePart(null)
      setEditingEventId('')
    } catch (error) {
      console.error('Error saving service part:', error)
    }
  }

  // Helper function to get ordered service parts for a specific event
  const getOrderedServicePartsForEvent = (eventId: string) => {
    if (!data) return []
    
    const customOrder = eventServicePartOrder[eventId]
    if (customOrder) {
      // Use custom order for this event
      const visibleParts = data.serviceParts.filter(sp => visibleServiceParts.has(sp.id))
      return customOrder
        .map(id => visibleParts.find(sp => sp.id === id))
        .filter(Boolean) as ServicePart[]
    }
    
    // Use default global order
    return data.serviceParts.filter(sp => visibleServiceParts.has(sp.id))
  }

  const handleReorderServicePart = async (servicePartId: string, direction: 'up' | 'down', eventId: string) => {
    if (!data) return
    
    // Get the current order for this specific event
    const currentOrder = getOrderedServicePartsForEvent(eventId)
    const currentIndex = currentOrder.findIndex(sp => sp.id === servicePartId)
    if (currentIndex === -1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= currentOrder.length) return
    
    try {
      // Create new order for this event
      const newOrder = [...currentOrder]
      const [movedItem] = newOrder.splice(currentIndex, 1)
      newOrder.splice(newIndex, 0, movedItem)
      
      // Update event-specific ordering
      setEventServicePartOrder(prev => ({
        ...prev,
        [eventId]: newOrder.map(sp => sp.id)
      }))
      
      // Here you would make an API call to persist the event-specific order
      // For now, this just updates the UI for this specific event
    } catch (error) {
      console.error('Error reordering service part:', error)
    }
  }

  const handleAddDocument = async (eventId: string) => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.pdf,.doc,.docx'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`/api/events/${eventId}/documents`, {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          showToast('success', 'Document uploaded successfully!')
          // Refresh data to show new document
          await fetchPlannerData()
        } else {
          showToast('error', 'Failed to upload document')
        }
      }
      input.click()
    } catch (error) {
      console.error('Error uploading document:', error)
      showToast('error', 'Error uploading document')
    }
  }

  const handleViewDocument = (eventId: string, documentId: string) => {
    const url = `/api/events/${eventId}/documents/${documentId}/view`
    window.open(url, '_blank')
  }

  const handleDeleteDocument = async (eventId: string, documentId: string, documentName: string) => {
    if (!confirm(`Are you sure you want to delete "${documentName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/events/${eventId}/documents/${documentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showToast('success', 'Document deleted successfully!')
        // Refresh data to remove deleted document
        await fetchPlannerData()
      } else {
        showToast('error', 'Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      showToast('error', 'Error deleting document')
    }
  }

  const handleAssignMusician = async (assignmentId: string, musicianId: string) => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicianId })
      })

      if (response.ok) {
        // Update local state to reflect the assignment
        await fetchPlannerData()
        setOpenDropdowns(prev => ({ ...prev, [assignmentId]: false }))
        setSearchTexts(prev => ({ ...prev, [assignmentId]: '' }))
      } else {
        console.error('Failed to assign musician')
      }
    } catch (error) {
      console.error('Error assigning musician:', error)
    }
  }

  const handleRemoveMusician = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicianId: null })
      })

      if (response.ok) {
        await fetchPlannerData()
      } else {
        console.error('Failed to remove musician')
      }
    } catch (error) {
      console.error('Error removing musician:', error)
    }
  }

  const handleOpenGroupAssignment = (eventId: string, clickEvent?: React.MouseEvent) => {
    setEditingGroupEventId(eventId)
    
    // Get current groups assigned to this event
    const event = data?.events.find(e => e.id === eventId)
    const currentGroups = event?.assignments
      ?.filter(assignment => assignment.group)
      .map(assignment => assignment.group!.id) || []
    
    setSelectedGroups(currentGroups)
    
    // Set click position for modal positioning
    if (clickEvent) {
      setClickPosition({ x: clickEvent.clientX, y: clickEvent.clientY })
    } else {
      setClickPosition(undefined)
    }
    
    setShowGroupAssignmentModal(true)
  }

  const handleSaveGroupAssignment = async () => {
    if (!editingGroupEventId) return
    
    try {
      const response = await fetch(`/api/events/${editingGroupEventId}/groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedGroups: selectedGroups
        })
      })

      if (response.ok) {
        showToast('success', 'Group assignments updated successfully!')
        await fetchPlannerData()
        setShowGroupAssignmentModal(false)
        setEditingGroupEventId('')
        setSelectedGroups([])
        setClickPosition(undefined)
      } else {
        const errorData = await response.json()
        showToast('error', errorData.error || 'Failed to update group assignments')
      }
    } catch (error) {
      console.error('Error updating group assignments:', error)
      showToast('error', 'Error updating group assignments')
    }
  }

  const toggleDropdown = (assignmentId: string) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [assignmentId]: !prev[assignmentId]
    }))
    
    if (!openDropdowns[assignmentId]) {
      setSearchTexts(prev => ({ ...prev, [assignmentId]: '' }))
    }
  }

  const handleSearchChange = (assignmentId: string, value: string) => {
    setSearchTexts(prev => ({ ...prev, [assignmentId]: value }))
  }

  const getFilteredMusicians = (assignmentId: string) => {
    const searchText = searchTexts[assignmentId] || ''
    if (!searchText.trim()) {
      return musicians
    }
    
    return musicians.filter(musician => 
      `${musician.firstName} ${musician.lastName}`.toLowerCase().includes(searchText.toLowerCase())
    )
  }

  // Filter events by selected colors
  const filteredEvents = data?.events.filter(event => 
    visibleEventColors.has(event.eventType.color)
  ) || []

  // Get unique event types for filter
  const uniqueEventTypes = data ? 
    [...new Map(data.events.map(event => [event.eventType.color, event.eventType])).values()] 
    : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event planner...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back Navigation */}
            <Link 
              href="/calendar" 
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">Back to Calendar</span>
            </Link>

            {/* Title */}
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold text-gray-900">Event Planner</h1>
              <p className="text-sm text-gray-500">View all events in one seamless view</p>
            </div>

            {/* Create Event Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Event</span>
            </button>
          </div>
        </div>
      </div>

      {/* Event Color Filter Bar */}
      {uniqueEventTypes.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3 overflow-x-auto">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-700 flex-shrink-0">Event Types:</span>
            <div className="flex gap-4 min-w-0">
              {uniqueEventTypes.map(eventType => (
                <label key={eventType.id} className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={visibleEventColors.has(eventType.color)}
                    onChange={() => toggleEventColor(eventType.color)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: eventType.color }}
                  />
                  <span className="text-sm text-gray-700">{eventType.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex h-[calc(100vh-8rem)]">
        {/* Events Grid - Full Width */}
        <div className="flex-1 overflow-x-auto">
          {filteredEvents.length > 0 ? (
            <>
              {/* Mobile Navigation Controls */}
              <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <button
                  onClick={() => setCurrentEventIndex(Math.max(0, currentEventIndex - 1))}
                  disabled={currentEventIndex === 0}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">
                    {currentEventIndex + 1} of {filteredEvents.length}
                  </p>
                  <p className="text-xs text-gray-500">
                    {filteredEvents[currentEventIndex]?.name}
                  </p>
                </div>
                
                <button
                  onClick={() => setCurrentEventIndex(Math.min(filteredEvents.length - 1, currentEventIndex + 1))}
                  disabled={currentEventIndex >= filteredEvents.length - 1}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Desktop: Horizontal scroll, Mobile: Single column */}
              <div className="h-full">
                {/* Desktop View */}
                <div className="hidden lg:flex h-full">
                  {filteredEvents.map(event => (
                    <div key={event.id} className="flex-shrink-0 w-80 border-r border-gray-200 bg-white">
                      {/* Event Header */}
                      <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: event.eventType.color }}
                          />
                          <h3 className="font-semibold text-gray-900 truncate">{event.name}</h3>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                          {new Date(event.startTime).toLocaleDateString()} at{' '}
                          {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-gray-500">{event.location}</p>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3">
                          <button 
                            onClick={() => handleAutoPopulate(event.id)}
                            className="flex-1 bg-[#660033] text-white px-3 py-1.5 rounded text-xs hover:bg-[#800041] transition-colors flex items-center justify-center gap-1"
                          >
                            <Zap className="w-3 h-3" />
                            Auto-populate
                          </button>
                          <button 
                            onClick={() => handleAddDocument(event.id)}
                            className="flex-1 bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-xs hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            Add Document
                          </button>
                        </div>
                        
                        {/* Documents List */}
                        {event.documents && event.documents.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {event.documents.map((document) => (
                              <div 
                                key={document.id} 
                                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-xs group hover:bg-gray-100 transition-colors"
                              >
                                <button
                                  onClick={() => handleViewDocument(event.id, document.id)}
                                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors flex-1 text-left truncate"
                                  title={document.originalFilename}
                                >
                                  <FileText className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{document.originalFilename}</span>
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDocument(event.id, document.id, document.originalFilename)}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete document"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Hymns Grid */}
                      <div className="flex-1 overflow-y-auto">
                        {getOrderedServicePartsForEvent(event.id)
                          .map(servicePart => {
                            const hymn = event.hymns.find(h => h.servicePartId === servicePart.id)
                            return (
                              <div key={servicePart.id} className="border-b border-gray-100 p-3 min-h-[60px] bg-white group hover:bg-gray-50 transition-colors relative">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-xs text-gray-500 font-normal">{servicePart.name}</div>
                                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                      onClick={() => handleReorderServicePart(servicePart.id, 'up', event.id)}
                                      disabled={getOrderedServicePartsForEvent(event.id).findIndex(sp => sp.id === servicePart.id) === 0}
                                      className="p-1 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-30"
                                      title="Move up"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleReorderServicePart(servicePart.id, 'down', event.id)}
                                      disabled={getOrderedServicePartsForEvent(event.id).findIndex(sp => sp.id === servicePart.id) === getOrderedServicePartsForEvent(event.id).length - 1}
                                      className="p-1 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-30"
                                      title="Move down"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={(e) => handleEditServicePart(servicePart, event.id, e)}
                                      className="p-1 text-gray-400 hover:text-gray-600 transition-all"
                                      title="Edit service part"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  value={hymn?.title || ''}
                                  onChange={(e) => {
                                    const newTitle = e.target.value
                                    // Update immediately in local state for responsive UI
                                    setData(prev => {
                                      if (!prev) return prev
                                      return {
                                        ...prev,
                                        events: prev.events.map(ev => 
                                          ev.id === event.id 
                                            ? {
                                                ...ev,
                                                hymns: hymn 
                                                  ? ev.hymns.map(h => h.id === hymn.id ? { ...h, title: newTitle } : h)
                                                  : [...ev.hymns, { 
                                                      id: `temp-${servicePart.id}`, 
                                                      title: newTitle, 
                                                      servicePartId: servicePart.id 
                                                    }]
                                              }
                                            : ev
                                        )
                                      }
                                    })
                                    // Debounced save to server
                                    debouncedUpdateHymn(event.id, newTitle, servicePart.id, hymn?.id)
                                  }}
                                  placeholder="Enter hymn title..."
                                  className="w-full text-sm text-gray-900 border-none outline-none bg-transparent placeholder-gray-400 focus:bg-gray-50 rounded-sm px-2 py-1 font-normal"
                                />
                              </div>
                            )
                          })}
                      </div>

                      {/* Groups Section */}
                      <div className="border-t border-gray-200">
                        <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50">
                          <div className="text-xs text-black font-bold">Groups</div>
                        </div>
                        
                        {event.assignments?.filter(assignment => assignment.group).length > 0 ? (
                          event.assignments
                            .filter(assignment => assignment.group)
                            .map((assignment, index) => (
                              <div 
                                key={`group-${assignment.id}-${index}`} 
                                className="border-b border-gray-100 p-3 min-h-[60px] bg-white group hover:bg-gray-50 transition-colors relative cursor-pointer"
                                onClick={(e) => handleOpenGroupAssignment(event.id, e)}
                              >
                                <div className="text-xs text-gray-500 mb-1 font-normal">Group</div>
                                <div className="text-sm text-gray-900 font-normal">
                                  {assignment.group?.name}
                                </div>
                              </div>
                            ))
                        ) : (
                          <div 
                            className="border-b border-gray-100 p-3 min-h-[60px] bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={(e) => handleOpenGroupAssignment(event.id, e)}
                          >
                            <div className="text-xs text-blue-600 hover:text-blue-800">+ Assign groups</div>
                          </div>
                        )}
                      </div>

                      {/* Musicians and Roles Section */}
                      <div>
                        <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50">
                          <div className="text-xs text-black font-bold">Musicians and Roles</div>
                        </div>
                        
                        {event.assignments?.map((assignment) => (
                          <div key={assignment.id} className="border-b border-gray-100 p-3 min-h-[60px] bg-white group hover:bg-gray-50 transition-colors relative">
                            <div className="text-xs text-gray-500 mb-1 font-normal">{assignment.roleName}</div>
                            
                            {assignment.user ? (
                              // Show assigned musician name (clickable to change)
                              <div className="relative">
                                <button
                                  onClick={() => toggleDropdown(assignment.id)}
                                  className="w-full text-sm text-gray-900 text-left hover:bg-gray-100 rounded-sm px-2 py-1 font-normal"
                                >
                                  {assignment.user.firstName} {assignment.user.lastName}
                                </button>
                                
                                {/* Dropdown for changing assignment */}
                                {openDropdowns[assignment.id] && (
                                  <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
                                      <button
                                        onClick={() => handleRemoveMusician(assignment.id)}
                                        className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 border-b border-gray-100 text-sm"
                                      >
                                        Remove assignment
                                      </button>
                                      {getFilteredMusicians(assignment.id).map((musician) => (
                                        <button
                                          key={musician.id}
                                          onClick={() => handleAssignMusician(assignment.id, musician.id)}
                                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                                        >
                                          <div className="font-medium text-gray-900">
                                            {musician.firstName} {musician.lastName}
                                          </div>
                                          <div className="text-xs text-gray-500">{musician.email}</div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              // Show "Assign Musician" button for unassigned roles
                              <div className="relative">
                                <button
                                  onClick={() => toggleDropdown(assignment.id)}
                                  className="w-full text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-sm px-2 py-1 font-normal text-left transition-colors"
                                >
                                  Assign Musician
                                </button>
                                
                                {/* Dropdown for assignment */}
                                {openDropdowns[assignment.id] && (
                                  <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
                                      {getFilteredMusicians(assignment.id).map((musician) => (
                                        <button
                                          key={musician.id}
                                          onClick={() => handleAssignMusician(assignment.id, musician.id)}
                                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                                        >
                                          <div className="font-medium text-gray-900">
                                            {musician.firstName} {musician.lastName}
                                          </div>
                                          <div className="text-xs text-gray-500">{musician.email}</div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile View - Single Column */}
                {filteredEvents[currentEventIndex] && (
                  <div className="lg:hidden bg-white h-full">
                    {(() => {
                      const event = filteredEvents[currentEventIndex]
                      return (
                        <>
                          {/* Event Header */}
                          <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2 mb-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: event.eventType.color }}
                              />
                              <h3 className="font-semibold text-gray-900 truncate">{event.name}</h3>
                            </div>
                            <p className="text-xs text-gray-500 mb-1">
                              {new Date(event.startTime).toLocaleDateString()} at{' '}
                              {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">{event.location}</p>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2 mt-3">
                              <button 
                                onClick={() => handleAutoPopulate(event.id)}
                                className="flex-1 bg-[#660033] text-white px-3 py-1.5 rounded text-xs hover:bg-[#800041] transition-colors flex items-center justify-center gap-1"
                              >
                                <Zap className="w-3 h-3" />
                                Auto-populate
                              </button>
                              <button 
                                onClick={() => handleAddDocument(event.id)}
                                className="flex-1 bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-xs hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                              >
                                <FileText className="w-3 h-3" />
                                Add Document
                              </button>
                            </div>
                            
                            {/* Documents List - Mobile */}
                            {event.documents && event.documents.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {event.documents.map((document) => (
                                  <div 
                                    key={document.id} 
                                    className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-xs group hover:bg-gray-100 transition-colors"
                                  >
                                    <button
                                      onClick={() => handleViewDocument(event.id, document.id)}
                                      className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors flex-1 text-left truncate"
                                      title={document.originalFilename}
                                    >
                                      <FileText className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">{document.originalFilename}</span>
                                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDocument(event.id, document.id, document.originalFilename)}
                                      className="p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Delete document"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Hymns Grid */}
                          <div className="flex-1 overflow-y-auto">
                            {getOrderedServicePartsForEvent(event.id)
                              .map(servicePart => {
                                const hymn = event.hymns.find(h => h.servicePartId === servicePart.id)
                                return (
                                  <div key={servicePart.id} className="border-b border-gray-100 p-3 min-h-[60px] bg-white group hover:bg-gray-50 transition-colors relative">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="text-xs text-gray-500 font-normal">{servicePart.name}</div>
                                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                          onClick={() => handleReorderServicePart(servicePart.id, 'up', event.id)}
                                          disabled={getOrderedServicePartsForEvent(event.id).findIndex(sp => sp.id === servicePart.id) === 0}
                                          className="p-1 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-30"
                                          title="Move up"
                                        >
                                          <ChevronUp className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={() => handleReorderServicePart(servicePart.id, 'down', event.id)}
                                          disabled={getOrderedServicePartsForEvent(event.id).findIndex(sp => sp.id === servicePart.id) === getOrderedServicePartsForEvent(event.id).length - 1}
                                          className="p-1 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-30"
                                          title="Move down"
                                        >
                                          <ChevronDown className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={(e) => handleEditServicePart(servicePart, event.id, e)}
                                          className="p-1 text-gray-400 hover:text-gray-600 transition-all"
                                          title="Edit service part"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <input
                                      type="text"
                                      value={hymn?.title || ''}
                                      onChange={(e) => {
                                        const newTitle = e.target.value
                                        // Update immediately in local state for responsive UI
                                        setData(prev => {
                                          if (!prev) return prev
                                          return {
                                            ...prev,
                                            events: prev.events.map(ev => 
                                              ev.id === event.id 
                                                ? {
                                                    ...ev,
                                                    hymns: hymn 
                                                      ? ev.hymns.map(h => h.id === hymn.id ? { ...h, title: newTitle } : h)
                                                      : [...ev.hymns, { 
                                                          id: `temp-${servicePart.id}`, 
                                                          title: newTitle, 
                                                          servicePartId: servicePart.id 
                                                        }]
                                                  }
                                                : ev
                                            )
                                          }
                                        })
                                        // Debounced save to server
                                        debouncedUpdateHymn(event.id, newTitle, servicePart.id, hymn?.id)
                                      }}
                                      placeholder="Enter hymn title..."
                                      className="w-full text-sm text-gray-900 border-none outline-none bg-transparent placeholder-gray-400 focus:bg-gray-50 rounded-sm px-2 py-1 font-normal"
                                    />
                                  </div>
                                )
                              })}
                          </div>

                          {/* Groups Section - Mobile */}
                          <div className="border-t border-gray-200">
                            <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50">
                              <div className="text-xs text-black font-bold">Groups</div>
                            </div>
                            
                            {event.assignments?.filter(assignment => assignment.group).length > 0 ? (
                              event.assignments
                                .filter(assignment => assignment.group)
                                .map((assignment, index) => (
                                  <div 
                                    key={`group-mobile-${assignment.id}-${index}`} 
                                    className="border-b border-gray-100 p-3 min-h-[60px] bg-white group hover:bg-gray-50 transition-colors relative cursor-pointer"
                                    onClick={(e) => handleOpenGroupAssignment(event.id, e)}
                                  >
                                    <div className="text-xs text-gray-500 mb-1 font-normal">Group</div>
                                    <div className="text-sm text-gray-900 font-normal">
                                      {assignment.group?.name}
                                    </div>
                                  </div>
                                ))
                            ) : (
                              <div 
                                className="border-b border-gray-100 p-3 min-h-[60px] bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={(e) => handleOpenGroupAssignment(event.id, e)}
                              >
                                <div className="text-xs text-blue-600 hover:text-blue-800">+ Assign groups</div>
                              </div>
                            )}
                          </div>

                          {/* Musicians and Roles Section - Mobile */}
                          <div>
                            <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50">
                              <div className="text-xs text-black font-bold">Musicians and Roles</div>
                            </div>
                            
                            {event.assignments?.map((assignment) => (
                              <div key={assignment.id} className="border-b border-gray-100 p-3 min-h-[60px] bg-white group hover:bg-gray-50 transition-colors relative">
                                <div className="text-xs text-gray-500 mb-1 font-normal">{assignment.roleName}</div>
                                
                                {assignment.user ? (
                                  // Show assigned musician name (clickable to change)
                                  <div className="relative">
                                    <button
                                      onClick={() => toggleDropdown(assignment.id)}
                                      className="w-full text-sm text-gray-900 text-left hover:bg-gray-100 rounded-sm px-2 py-1 font-normal"
                                    >
                                      {assignment.user.firstName} {assignment.user.lastName}
                                    </button>
                                    
                                    {/* Dropdown for changing assignment */}
                                    {openDropdowns[assignment.id] && (
                                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
                                          <button
                                            onClick={() => handleRemoveMusician(assignment.id)}
                                            className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 border-b border-gray-100 text-sm"
                                          >
                                            Remove assignment
                                          </button>
                                          {getFilteredMusicians(assignment.id).map((musician) => (
                                            <button
                                              key={musician.id}
                                              onClick={() => handleAssignMusician(assignment.id, musician.id)}
                                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                                            >
                                              <div className="font-medium text-gray-900">
                                                {musician.firstName} {musician.lastName}
                                              </div>
                                              <div className="text-xs text-gray-500">{musician.email}</div>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  // Show "Assign Musician" button for unassigned roles
                                  <div className="relative">
                                    <button
                                      onClick={() => toggleDropdown(assignment.id)}
                                      className="w-full text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-sm px-2 py-1 font-normal text-left transition-colors"
                                    >
                                      Assign Musician
                                    </button>
                                    
                                    {/* Dropdown for assignment */}
                                    {openDropdowns[assignment.id] && (
                                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
                                          {getFilteredMusicians(assignment.id).map((musician) => (
                                            <button
                                              key={musician.id}
                                              onClick={() => handleAssignMusician(assignment.id, musician.id)}
                                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                                            >
                                              <div className="font-medium text-gray-900">
                                                {musician.firstName} {musician.lastName}
                                              </div>
                                              <div className="text-xs text-gray-500">{musician.email}</div>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            </>
          ) : (
            // Empty State
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Events Yet</h3>
                <p className="text-gray-500 mb-6 max-w-sm">
                  Create your first event to start planning your services with the seamless column view.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Event
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onEventCreated={() => {
          setShowCreateModal(false)
          fetchPlannerData() // Refresh the data to show the new event
        }}
      />

      {/* PDF Processor Modal */}
      {showPdfProcessor && (
        <PdfProcessor
          onSuggestionsAccepted={handlePdfSuggestions}
          onClose={() => setShowPdfProcessor(false)}
        />
      )}

      {/* Service Part Edit Popup */}
      <ServicePartEditModal
        isOpen={showServicePartEditModal}
        onClose={() => {
          setShowServicePartEditModal(false)
          setEditingServicePart(null)
          setEditingEventId('')
          setClickPosition(undefined)
        }}
        servicePart={editingServicePart}
        onSave={handleSaveServicePart}
        clickPosition={clickPosition}
      />

      {/* Group Assignment Modal */}
      {showGroupAssignmentModal && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-40" />
          <div 
            className="fixed bg-white rounded-xl shadow-xl border z-50"
            style={{
              left: clickPosition ? Math.min(clickPosition.x - 200, window.innerWidth - 400) : '50%',
              top: clickPosition ? Math.min(clickPosition.y - 50, window.innerHeight - 400) : '50%',
              transform: clickPosition ? 'none' : 'translate(-50%, -50%)',
              maxWidth: '400px',
              width: 'auto',
              minWidth: '350px',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">Assign Groups</h2>
              <button
                onClick={() => {
                  setShowGroupAssignmentModal(false)
                  setEditingGroupEventId('')
                  setSelectedGroups([])
                  setClickPosition(undefined)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Select groups to automatically assign all members to this event. All group members will receive notifications.
              </p>
              
              {groups.length > 0 ? (
                <div className="space-y-3">
                  {groups.map((group) => {
                    const isSelected = selectedGroups.includes(group.id)
                    return (
                      <label
                        key={group.id}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-green-50 border-green-200 text-green-900' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGroups([...selectedGroups, group.id])
                            } else {
                              setSelectedGroups(selectedGroups.filter(id => id !== group.id))
                            }
                          }}
                          className="mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {group.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {group.description && (
                              <span className="mr-2">{group.description}</span>
                            )}
                            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg text-center">
                  No groups available. You can create groups in the Groups section to organize your musicians.
                </div>
              )}
              
              {selectedGroups.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                  <p className="text-sm text-green-800 font-medium">
                    {selectedGroups.length} group{selectedGroups.length !== 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    All members of selected groups will be automatically assigned to this event and receive notifications.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t">
              <button
                onClick={() => {
                  setShowGroupAssignmentModal(false)
                  setEditingGroupEventId('')
                  setSelectedGroups([])
                  setClickPosition(undefined)
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGroupAssignment}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Save Groups
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
} 