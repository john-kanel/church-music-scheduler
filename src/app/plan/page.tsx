'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, Calendar, Plus, Search, Filter, Users, Clock, MapPin, 
  ChevronLeft, ChevronRight, Settings, Trash2, Edit, Eye, EyeOff,
  Palette, Save, X, FileText, Zap, ChevronDown, Check, ExternalLink, ChevronUp
  } from 'lucide-react'
import Link from 'next/link'
import { CreateEventModal } from '@/components/events/create-event-modal'
import { ServicePartEditModal } from '@/components/events/service-part-edit-modal'
import { AutoAssignModal } from '@/components/events/auto-assign-modal'
import { EventDetailsModal } from '@/components/events/event-details-modal'
import { CreateGroupModal } from '@/components/groups/create-group-modal'
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
  isRequired?: boolean
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
    isAutoAssigned?: boolean
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
  isRootEvent?: boolean
  generatedFrom?: string
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
              <X className="h-4 w-4" />
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
  
  // Individual hymn editing (uses same modal as service parts)
  const [showIndividualHymnEditModal, setShowIndividualHymnEditModal] = useState(false)
  const [editingIndividualHymn, setEditingIndividualHymn] = useState<{id: string, title: string, notes?: string} | null>(null)
  
  // Event-specific service part ordering
  const [eventServicePartOrder, setEventServicePartOrder] = useState<Record<string, string[]>>({})
  
  // Musician assignment
  const [musicians, setMusicians] = useState<Array<{id: string, firstName: string, lastName: string, email: string}>>([])
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({})
  const [searchTexts, setSearchTexts] = useState<Record<string, string>>({})

  // Group assignment
  const [groups, setGroups] = useState<Array<{id: string, name: string, description?: string, members: Array<{id: string, firstName: string, lastName: string}>}>>([])
  const [openGroupDropdown, setOpenGroupDropdown] = useState<string | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string[]>>({})

  // Auto-assignment state
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false)
  const [lastAutoAssignBatch, setLastAutoAssignBatch] = useState<string[]>([]) // Track last batch for undo
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null)
  
  // Event details modal state
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false)
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<Event | null>(null)
  
  // Create group modal state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)

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
    if (session?.user?.id) {
      fetchPlannerData()
      fetchMusicians()
      fetchGroups()
      // Check for backed-up changes on page load
      restoreBackedUpChanges()
    }
  }, [session?.user?.id])

  // Click outside handler for filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openFilterDropdown) {
        setOpenFilterDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openFilterDropdown])

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

  // Auto-assignment functions
  const toggleEventSelection = (eventId: string) => {
    const newSelected = new Set(selectedEvents)
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId)
    } else {
      newSelected.add(eventId)
    }
    setSelectedEvents(newSelected)
  }

  const selectAllEventsForFilter = (eventNames: string[]) => {
    const eventsToSelect = data?.events.filter(event => 
      eventNames.includes(event.name) && visibleEventColors.has(event.eventType.color)
    ).map(event => event.id) || []
    
    const newSelected = new Set(selectedEvents)
    eventsToSelect.forEach(eventId => newSelected.add(eventId))
    setSelectedEvents(newSelected)
    setOpenFilterDropdown(null) // Close dropdown after selection
  }

  const clearEventSelection = () => {
    setSelectedEvents(new Set())
  }

  const toggleFilterDropdown = (filterKey: string) => {
    setOpenFilterDropdown(openFilterDropdown === filterKey ? null : filterKey)
  }

  const getEventsForFilterGroup = (eventName: string): Event[] => {
    if (!data?.events) return []
    
    console.log(`🔍 Getting events for filter group: "${eventName}"`)
    
    if (eventName === 'General') {
      // Return all non-recurring events
      const generalEvents = data.events.filter(event => 
        !event.isRootEvent && !event.generatedFrom && 
        visibleEventColors.has(event.eventType.color)
      )
      console.log(`📋 General events found: ${generalEvents.length}`, generalEvents.map(e => ({
        name: e.name, 
        id: e.id, 
        isRootEvent: e.isRootEvent, 
        generatedFrom: e.generatedFrom
      })))
      return generalEvents
    } else {
      // Return events with matching name (recurring events)
      const matchingEvents = data.events.filter(event => 
        event.name === eventName && 
        visibleEventColors.has(event.eventType.color)
      )
      console.log(`📋 Events for "${eventName}": ${matchingEvents.length}`, matchingEvents.map(e => ({
        name: e.name, 
        id: e.id, 
        isRootEvent: e.isRootEvent, 
        generatedFrom: e.generatedFrom
      })))
      return matchingEvents
    }
  }

  const handleUndoAutoAssignment = async () => {
    if (lastAutoAssignBatch.length === 0) return

    try {
      const undoPromises = lastAutoAssignBatch.map(async (assignmentId) => {
        try {
          const response = await fetch(`/api/assignments/${assignmentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ musicianId: null })
          })
          return response.ok
        } catch (error) {
          console.error(`Failed to undo assignment ${assignmentId}:`, error)
          return false
        }
      })

      const results = await Promise.all(undoPromises)
      const successCount = results.filter(Boolean).length

      if (successCount > 0) {
        setLastAutoAssignBatch([]) // Clear the batch
        await fetchPlannerData() // Refresh data
        showToast('success', `Undid ${successCount} auto-assignments`)
      } else {
        showToast('error', 'Failed to undo auto-assignments')
      }
    } catch (error) {
      console.error('Error undoing auto-assignments:', error)
      showToast('error', 'Error undoing auto-assignments')
    }
  }

  const updateHymnTitle = async (eventId: string, newTitle: string, servicePartId: string | null, hymnId?: string) => {
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
          servicePartId: servicePartId ?? undefined
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
  const pendingUpdatesRef = useRef<Record<string, {eventId: string, title: string, servicePartId: string | null, hymnId?: string}>>({})
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
  
  const debouncedUpdateHymn = (eventId: string, newTitle: string, servicePartId: string | null, hymnId?: string) => {
    const key = `${eventId}-${servicePartId || 'no-service-part'}`
    
    // Store pending update in ref (survives tab switches)
    pendingUpdatesRef.current[key] = { eventId, title: newTitle, servicePartId: servicePartId, hymnId }
    
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

  const handleAddDefaultServiceParts = async (eventId: string) => {
    console.log('🔧 BUTTON CLICKED: Add Default Service Parts for event:', eventId)
    try {
      if (!data) {
        console.log('🔧 ERROR: No data available')
        return
      }

      console.log('🔧 DEBUG: Available service parts:', data.serviceParts)
      
      // Get all default service parts
      const defaultServiceParts = data.serviceParts.filter(sp => sp.isRequired)
      
      console.log('🔧 DEBUG: Default service parts (isRequired=true):', defaultServiceParts)
      
      if (defaultServiceParts.length === 0) {
        showToast('error', 'No default service parts are configured. Please mark some service parts as "Required" in your church settings.')
        return
      }

      // Create placeholder hymns for each default service part
      const defaultHymns = defaultServiceParts.map(sp => ({
        title: 'New Song',
        notes: '',
        servicePartId: sp.id
      }))

      // Get current event hymns
      const currentEvent = data.events.find(e => e.id === eventId)
      const existingHymns = currentEvent?.hymns || []

      console.log('🔧 DEBUG: Current event hymns:', existingHymns)
      console.log('🔧 DEBUG: New default hymns to add:', defaultHymns)

      // Combine existing hymns with new default parts (avoiding duplicates)
      const existingServicePartIds = existingHymns.map(h => h.servicePartId).filter(Boolean)
      const newHymns = defaultHymns.filter(h => !existingServicePartIds.includes(h.servicePartId))

      console.log('🔧 DEBUG: Existing service part IDs:', existingServicePartIds)
      console.log('🔧 DEBUG: New hymns after duplicate removal:', newHymns)

      if (newHymns.length === 0) {
        showToast('error', 'All default service parts are already added to this event')
        return
      }

      const allHymns = [
        ...existingHymns.map(hymn => ({
          title: hymn.title,
          notes: hymn.notes || '',
          servicePartId: hymn.servicePartId || null
        })),
        ...newHymns
      ]

      console.log('🔧 DEBUG: Final hymns array to save:', allHymns)

      // Save to the event
      console.log('🔧 DEBUG: Making API call to:', `/api/events/${eventId}/hymns`)
      const response = await fetch(`/api/events/${eventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: allHymns })
      })

      console.log('🔧 DEBUG: API response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.log('🔧 ERROR: API response error:', errorText)
        throw new Error(`Failed to add default service parts: ${errorText}`)
      }

      const responseData = await response.json()
      console.log('🔧 DEBUG: API response data:', responseData)

      showToast('success', `Added ${newHymns.length} default service parts`)
      console.log('🔧 DEBUG: Refreshing planner data...')
      await fetchPlannerData()
      console.log('🔧 DEBUG: Planner data refreshed')
    } catch (error) {
      console.error('Error adding default service parts:', error)
      showToast('error', 'Failed to add default service parts')
    }
  }

  const handleAddSingleSong = async (eventId: string) => {
    console.log('🎵 BUTTON CLICKED: Add Single Song for event:', eventId)
    try {
      if (!data) {
        console.log('🎵 ERROR: No data available')
        return
      }

      // Get current event hymns
      const currentEvent = data.events.find(e => e.id === eventId)
      const existingHymns = currentEvent?.hymns || []
      
      console.log('🎵 DEBUG: Current event:', currentEvent?.name)
      console.log('🎵 DEBUG: Existing hymns count:', existingHymns.length)

      // Add a new hymn without a service part (general music)
      const newHymn = {
        title: 'New Song',
        notes: '',
        servicePartId: null
      }

      const allHymns = [
        ...existingHymns.map(hymn => ({
          title: hymn.title,
          notes: hymn.notes || '',
          servicePartId: hymn.servicePartId || null
        })),
        newHymn
      ]

      console.log('🎵 DEBUG: Final hymns array with new song:', allHymns)

      // Save to the event
      console.log('🎵 DEBUG: Making API call to:', `/api/events/${eventId}/hymns`)
      const response = await fetch(`/api/events/${eventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: allHymns })
      })

      console.log('🎵 DEBUG: API response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.log('🎵 ERROR: API response error:', errorText)
        throw new Error(`Failed to add song: ${errorText}`)
      }

      const responseData = await response.json()
      console.log('🎵 DEBUG: API response data:', responseData)

      showToast('success', 'Added new song slot')
      console.log('🎵 DEBUG: Refreshing planner data...')
      await fetchPlannerData()
      console.log('🎵 DEBUG: Planner data refreshed')
    } catch (error) {
      console.error('Error adding song:', error)
      showToast('error', 'Failed to add song')
    }
  }

  const handlePdfSuggestions = async (suggestions: Array<{servicePartName: string, songTitle: string, notes: string}>) => {
    try {
      if (!currentEventIdForUpload) {
        console.error('No event ID set for PDF suggestions')
        return
      }

      // Get current event hymns
      const currentEvent = data?.events.find(e => e.id === currentEventIdForUpload)
      const existingHymns = currentEvent?.hymns || []

      // Convert suggestions to hymns format, creating service parts as needed
      const newHymns = await Promise.all(suggestions.map(async (suggestion) => {
        // Find matching service part
        let matchingPart = data?.serviceParts.find(part => 
          part.name.toLowerCase().includes(suggestion.servicePartName.toLowerCase()) ||
          suggestion.servicePartName.toLowerCase().includes(part.name.toLowerCase())
        )
        
        // If no matching service part found, create it automatically
        if (!matchingPart && suggestion.servicePartName?.trim()) {
          try {
            const response = await fetch('/api/service-parts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                serviceParts: [{
                  id: `temp-${Date.now()}`,
                  name: suggestion.servicePartName.trim(),
                  isRequired: false,
                  order: (data?.serviceParts.length || 0) + 1
                }]
              })
            })
            
            if (response.ok) {
              const result = await response.json()
              if (result.serviceParts && result.serviceParts.length > 0) {
                matchingPart = result.serviceParts[0]
                                 // Update local data to include the new service part
                 setData(prev => {
                   if (!prev || !matchingPart) return prev
                   return {
                     ...prev,
                     serviceParts: [...prev.serviceParts, matchingPart].sort((a, b) => (a?.order || 0) - (b?.order || 0))
                   }
                 })
              }
            }
          } catch (error) {
            console.error('Error creating service part:', error)
          }
        }
        
        return {
          title: suggestion.songTitle,
          notes: suggestion.notes || '',
          servicePartId: matchingPart?.id || null
        }
      }))

      // Combine existing hymns with new ones (keeping existing hymns)
      const allHymns = [
        ...existingHymns.map(hymn => ({
          title: hymn.title,
          notes: hymn.notes || '',
          servicePartId: hymn.servicePartId || null
        })),
        ...newHymns
      ]

      // Save all hymns to the event using the correct API format
      const response = await fetch(`/api/events/${currentEventIdForUpload}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hymns: allHymns,
          isAutoPopulate: true  // Skip email notifications for auto-populate
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save hymns')
      }

      showToast('success', `Added ${suggestions.length} songs from document`)
      
      // Refresh the data to show updated hymns
      await fetchPlannerData()
      setShowPdfProcessor(false)
      setCurrentEventIdForUpload('')
    } catch (error) {
      console.error('Error processing PDF suggestions:', error)
      showToast('error', 'Failed to save songs from document')
    }
  }

  const handleEditServicePart = (servicePart: ServicePart, eventId: string, event: React.MouseEvent) => {
    setEditingServicePart(servicePart)
    setEditingEventId(eventId)
    setClickPosition({ x: event.clientX, y: event.clientY })
    setShowServicePartEditModal(true)
  }

  const handleEditIndividualHymn = (hymn: {id: string, title: string, notes?: string}, eventId: string, event: React.MouseEvent) => {
    setEditingIndividualHymn(hymn)
    setEditingEventId(eventId)
    setClickPosition({ x: event.clientX, y: event.clientY })
    setShowIndividualHymnEditModal(true)
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

  const handleSaveIndividualHymn = async (songId: string, title: string, notes: string) => {
    if (!editingEventId || !editingIndividualHymn) return
    
    try {
      // Optimistic update first
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          events: prev.events.map(ev => 
            ev.id === editingEventId 
              ? {
                  ...ev,
                  hymns: ev.hymns.map(h => 
                    h.id === editingIndividualHymn.id ? { ...h, title, notes } : h
                  )
                }
              : ev
          )
        }
      })

      // Update the hymn via API
      const currentEvent = data?.events.find(e => e.id === editingEventId)
      const updatedHymns = currentEvent?.hymns.map(h => 
        h.id === editingIndividualHymn.id 
          ? { title, notes, servicePartId: h.servicePartId }
          : { title: h.title, notes: h.notes || '', servicePartId: h.servicePartId }
      ) || []

      const response = await fetch(`/api/events/${editingEventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: updatedHymns })
      })

      if (response.ok) {
        showToast('success', 'Song updated successfully')
      } else {
        // Revert optimistic update on failure
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            events: prev.events.map(ev => 
              ev.id === editingEventId 
                ? {
                    ...ev,
                    hymns: ev.hymns.map(h => 
                      h.id === editingIndividualHymn.id 
                        ? { ...h, title: editingIndividualHymn.title, notes: editingIndividualHymn.notes || '' } 
                        : h
                    )
                  }
                : ev
            )
          }
        })
        showToast('error', 'Failed to update song')
      }
      
      setShowIndividualHymnEditModal(false)
      setEditingIndividualHymn(null)
      setEditingEventId('')
    } catch (error) {
      console.error('Error saving individual hymn:', error)
      showToast('error', 'Error updating song')
    }
  }

  // Helper function to get ordered service parts for a specific event
  const getOrderedServicePartsForEvent = (eventId: string) => {
    if (!data) return []
    
    const event = data.events.find(e => e.id === eventId)
    if (!event) return []
    
    // Get service parts that actually have hymns for this event
    const servicePartsWithHymns = event.hymns
      .filter(h => h.servicePartId) // Only hymns with service parts
      .map(h => h.servicePartId) // Get service part IDs
      .filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates
      .map(id => data.serviceParts.find(sp => sp.id === id)) // Get service part objects
      .filter(Boolean) as ServicePart[] // Remove any undefined
    
    const customOrder = eventServicePartOrder[eventId]
    if (customOrder) {
      // Use custom order for this event, but only show parts with hymns
      return customOrder
        .map(id => servicePartsWithHymns.find(sp => sp.id === id))
        .filter(Boolean) as ServicePart[]
    }
    
    // Use default global order, but only show parts with hymns
    return servicePartsWithHymns
      .filter(sp => visibleServiceParts.has(sp.id))
      .sort((a, b) => a.order - b.order)
  }

  // Helper function to get hymns without service parts for a specific event  
  const getHymnsWithoutServiceParts = (eventId: string) => {
    if (!data) return []
    
    const event = data.events.find(e => e.id === eventId)
    if (!event) return []
    
    return event.hymns.filter(h => !h.servicePartId)
  }

  // Function to reorder individual hymns (without service parts)
  const handleReorderIndividualHymn = async (hymnId: string, direction: 'up' | 'down', eventId: string) => {
    try {
      const event = data?.events.find(e => e.id === eventId)
      if (!event) return

      const individualHymns = event.hymns.filter(h => !h.servicePartId)
      const hymnIndex = individualHymns.findIndex(h => h.id === hymnId)
      
      if (hymnIndex === -1) return
      
      const newIndex = direction === 'up' ? hymnIndex - 1 : hymnIndex + 1
      if (newIndex < 0 || newIndex >= individualHymns.length) return

      // Reorder the hymns array
      const reorderedHymns = [...individualHymns]
      const [movedHymn] = reorderedHymns.splice(hymnIndex, 1)
      reorderedHymns.splice(newIndex, 0, movedHymn)

      // Combine with service part hymns and save
      const servicePartHymns = event.hymns.filter(h => h.servicePartId)
      const allHymns = [
        ...servicePartHymns.map(hymn => ({
          title: hymn.title,
          notes: hymn.notes || '',
          servicePartId: hymn.servicePartId
        })),
        ...reorderedHymns.map(hymn => ({
          title: hymn.title,
          notes: hymn.notes || '',
          servicePartId: null
        }))
      ]

      const response = await fetch(`/api/events/${eventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: allHymns })
      })

      if (!response.ok) {
        throw new Error('Failed to reorder hymn')
      }

      // Optimistic update instead of full reload
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          events: prev.events.map(ev => 
            ev.id === eventId 
              ? { ...ev, hymns: allHymns.map((h, i) => ({ 
                  id: reorderedHymns.find(rh => rh.title === h.title)?.id || servicePartHymns.find(sh => sh.title === h.title)?.id || `temp-${i}`, 
                  title: h.title, 
                  notes: h.notes || undefined, 
                  servicePartId: h.servicePartId || undefined 
                })) }
              : ev
          )
        }
      })
      showToast('success', 'Song reordered successfully')
    } catch (error) {
      console.error('Error reordering individual hymn:', error)
      showToast('error', 'Failed to reorder hymn')
    }
  }

  // Function to delete individual hymn
  const handleDeleteIndividualHymn = async (hymnId: string, eventId: string) => {
    try {
      const event = data?.events.find(e => e.id === eventId)
      if (!event) return

      // Remove the hymn from the list
      const updatedHymns = event.hymns
        .filter(h => h.id !== hymnId)
        .map(hymn => ({
          title: hymn.title,
          notes: hymn.notes || '',
          servicePartId: hymn.servicePartId || null
        }))

      const response = await fetch(`/api/events/${eventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: updatedHymns })
      })

      if (!response.ok) {
        throw new Error('Failed to delete hymn')
      }

      // Optimistic update instead of full reload
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          events: prev.events.map(ev => 
            ev.id === eventId 
              ? { ...ev, hymns: updatedHymns.map((h, i) => ({ 
                  id: event.hymns.find(eh => eh.title === h.title && eh.servicePartId === h.servicePartId)?.id || `temp-${i}`, 
                  title: h.title, 
                  notes: h.notes || undefined, 
                  servicePartId: h.servicePartId || undefined 
                })) }
              : ev
          )
        }
      })
      showToast('success', 'Song deleted successfully')
    } catch (error) {
      console.error('Error deleting individual hymn:', error)
      showToast('error', 'Failed to delete song')
    }
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

  const toggleGroupDropdown = (eventId: string) => {
    if (openGroupDropdown === eventId) {
      setOpenGroupDropdown(null)
    } else {
      setOpenGroupDropdown(eventId)
      
      // Get current groups assigned to this event
      const event = data?.events.find(e => e.id === eventId)
      const currentGroups = event?.assignments
        ?.filter(assignment => assignment.group)
        .map(assignment => assignment.group!.id) || []
      
      setSelectedGroups(prev => ({ ...prev, [eventId]: currentGroups }))
    }
  }

  const handleToggleGroup = (eventId: string, groupId: string) => {
    setSelectedGroups(prev => {
      const currentGroups = prev[eventId] || []
      const isSelected = currentGroups.includes(groupId)
      
      if (isSelected) {
        return { ...prev, [eventId]: currentGroups.filter(id => id !== groupId) }
      } else {
        return { ...prev, [eventId]: [...currentGroups, groupId] }
      }
    })
  }

  const handleSaveGroupAssignment = async (eventId: string) => {
    try {
      const groupIds = selectedGroups[eventId] || []
      const response = await fetch(`/api/events/${eventId}/groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedGroups: groupIds
        })
      })

      if (response.ok) {
        showToast('success', 'Group assignments updated successfully!')
        await fetchPlannerData()
        setOpenGroupDropdown(null)
        setSelectedGroups(prev => ({ ...prev, [eventId]: [] }))
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

  // Get unique event names for filter (grouped by event name instead of event type)
  const uniqueEvents = data ? 
    [...new Map(data.events.map(event => {
      // Show recurring events by their name, non-recurring as "General"
      const displayName = event.isRootEvent || event.generatedFrom ? event.name : 'General'
      
      // Debug logging for filter categorization
      console.log('🏷️ Filter categorization:', {
        eventName: event.name,
        eventId: event.id,
        isRootEvent: event.isRootEvent,
        generatedFrom: event.generatedFrom,
        displayName: displayName,
        eventTypeColor: event.eventType.color,
        eventTypeName: event.eventType.name
      })
      
      return [displayName, { 
        name: displayName, 
        color: event.eventType.color,
        id: event.id,
        isRecurring: event.isRootEvent || !!event.generatedFrom
      }]
    })).values()] 
    : []

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error('Failed to delete event')
      }

      // Optimistic update instead of full reload
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          events: prev.events.filter(ev => ev.id !== eventId)
        }
      })
      showToast('success', 'Event deleted successfully')
    } catch (error) {
      console.error('Error deleting event:', error)
      showToast('error', 'Failed to delete event')
    }
  }

  const handleDeleteMultipleEvents = async () => {
    const selectedEventIds = Array.from(selectedEvents)
    if (selectedEventIds.length === 0) return

    const confirmMessage = `Are you sure you want to delete ${selectedEventIds.length} selected events? This action cannot be undone.`
    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      // Delete all selected events
      const deletePromises = selectedEventIds.map(eventId => 
        fetch(`/api/events/${eventId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })
      )

      const responses = await Promise.all(deletePromises)
      const successfulDeletes = responses.filter(response => response.ok)

      if (successfulDeletes.length > 0) {
        // Optimistic update instead of full reload
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            events: prev.events.filter(ev => !selectedEventIds.includes(ev.id))
          }
        })
        
        setSelectedEvents(new Set()) // Clear selection
        showToast('success', `Successfully deleted ${successfulDeletes.length} events`)
      }

      if (successfulDeletes.length < selectedEventIds.length) {
        const failedCount = selectedEventIds.length - successfulDeletes.length
        showToast('error', `Failed to delete ${failedCount} events`)
      }
    } catch (error) {
      console.error('Error deleting multiple events:', error)
      showToast('error', 'Failed to delete events')
    }
  }

  const handleEditEvent = (event: Event) => {
    setSelectedEventForEdit(event)
    setShowEventDetailsModal(true)
  }

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

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {/* Undo Auto Assignment Button - only show if there's a recent batch */}
              {lastAutoAssignBatch.length > 0 && (
                <button
                  onClick={handleUndoAutoAssignment}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Undo Auto Assign ({lastAutoAssignBatch.length})</span>
                  <span className="sm:hidden">Undo ({lastAutoAssignBatch.length})</span>
                </button>
              )}
              
              {/* Auto Assign Button - only show if events selected */}
              {selectedEvents.size > 0 && (
                <button
                  onClick={() => setShowAutoAssignModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline">Auto Assign ({selectedEvents.size})</span>
                  <span className="sm:hidden">{selectedEvents.size}</span>
                </button>
              )}
              
              {/* Delete Multiple Events Button - only show if events selected */}
              {selectedEvents.size > 0 && (
                <button
                  onClick={handleDeleteMultipleEvents}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete ({selectedEvents.size})</span>
                  <span className="sm:hidden">Delete ({selectedEvents.size})</span>
                </button>
              )}
              
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
      </div>

      {/* Event Filter Bar */}
      {uniqueEvents.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3 overflow-x-auto">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-700 flex-shrink-0">Events:</span>
            <div className="flex gap-4 min-w-0">
              {uniqueEvents.map((eventGroup: any) => {
                const eventsInThisGroup = getEventsForFilterGroup(eventGroup.name)
                const allSelected = eventsInThisGroup.every((e: any) => selectedEvents.has(e.id))
                const someSelected = eventsInThisGroup.some((e: any) => selectedEvents.has(e.id))
                
                return (
                  <div key={eventGroup.id} className="relative flex-shrink-0">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          eventGroup.name === 'General' 
                            ? eventsInThisGroup.some(e => visibleEventColors.has(e.eventType.color))
                            : visibleEventColors.has(eventGroup.color)
                        }
                        onChange={() => toggleEventColor(eventGroup.color)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: eventGroup.color }}
                      />
                      <span className="text-sm text-gray-700">{eventGroup.name}</span>
                      
                      {/* Dropdown arrow - only show if multiple events and any events in group are visible */}
                      {eventsInThisGroup.length > 1 && eventsInThisGroup.some(e => visibleEventColors.has(e.eventType.color)) && (
                        <button
                          onClick={() => toggleFilterDropdown(eventGroup.name)}
                          className="ml-1 p-1 text-gray-400 hover:text-gray-600"
                          title="Show individual events"
                        >
                          <ChevronDown 
                            className={`w-3 h-3 transition-transform ${
                              openFilterDropdown === eventGroup.name ? 'rotate-180' : ''
                            }`} 
                          />
                        </button>
                      )}
                    </label>
                    
                    {/* Dropdown for individual event selection */}
                    {openFilterDropdown === eventGroup.name && eventsInThisGroup.length > 1 && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[200px]">
                        <div className="p-2 space-y-1">
                          <button
                            onClick={() => selectAllEventsForFilter([eventGroup.name])}
                            className="w-full text-left px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >
                            {allSelected ? 'Deselect All' : 'Select All'}
                          </button>
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            {eventsInThisGroup.map((individualEvent: any) => (
                              <label key={individualEvent.id} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedEvents.has(individualEvent.id)}
                                  onChange={() => toggleEventSelection(individualEvent.id)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-gray-700 truncate">
                                  {new Date(individualEvent.startTime).toLocaleDateString()} - {individualEvent.location}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            
            {/* Clear Selection Button */}
            {selectedEvents.size > 0 && (
              <button
                onClick={clearEventSelection}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded flex-shrink-0"
              >
                <X className="w-3 h-3" />
                Clear ({selectedEvents.size})
              </button>
            )}
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
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedEvents.has(event.id)}
                              onChange={() => toggleEventSelection(event.id)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: event.eventType.color }}
                            />
                            <h3 className="font-semibold text-gray-900 truncate">{event.name}</h3>
                          </div>
                          
                          {/* Edit and Delete buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditEvent(event)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit event"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete event"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                          {new Date(event.startTime).toLocaleDateString()} at{' '}
                          {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-gray-500">{event.location}</p>
                        
                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <button 
                            onClick={() => handleAutoPopulate(event.id)}
                            className="bg-[#660033] text-white px-3 py-1.5 rounded text-xs hover:bg-[#800041] transition-colors flex items-center justify-center gap-1"
                          >
                            <Zap className="w-3 h-3" />
                            Auto-populate
                          </button>
                          <button 
                            onClick={() => handleAddDocument(event.id)}
                            className="bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-xs hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            Add Document
                          </button>
                          <button 
                            onClick={() => handleAddDefaultServiceParts(event.id)}
                            className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-xs hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Default Parts
                          </button>
                          <button 
                            onClick={() => handleAddSingleSong(event.id)}
                            className="bg-green-50 text-green-600 px-3 py-1.5 rounded text-xs hover:bg-green-100 transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Song
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
                        
                        {/* Individual Songs (without service parts) */}
                        {getHymnsWithoutServiceParts(event.id).map((hymn, index) => {
                          const individualHymns = getHymnsWithoutServiceParts(event.id)
                          
                          return (
                            <div key={`no-service-part-${hymn.id || index}`} className="border-b border-gray-100 p-3 min-h-[60px] bg-white group hover:bg-gray-50 transition-colors relative">
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-xs text-gray-500 font-normal">Individual Song</div>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                                  <button
                                    onClick={() => handleReorderIndividualHymn(hymn.id, 'up', event.id)}
                                    disabled={index === 0}
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-30"
                                    title="Move up"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleReorderIndividualHymn(hymn.id, 'down', event.id)}
                                    disabled={index === individualHymns.length - 1}
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-30"
                                    title="Move down"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => handleEditIndividualHymn(hymn, event.id, e)}
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-all"
                                    title="Edit song notes"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteIndividualHymn(hymn.id, event.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 transition-all"
                                    title="Delete song"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                value={hymn.title || ''}
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
                                              hymns: ev.hymns.map(h => 
                                                h.id === hymn.id ? { ...h, title: newTitle } : h
                                              )
                                            }
                                          : ev
                                      )
                                    }
                                  })
                                  // Debounced save to server
                                  debouncedUpdateHymn(event.id, newTitle, null, hymn.id)
                                }}
                                placeholder="Enter song title..."
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
                                onClick={() => toggleGroupDropdown(event.id)}
                              >
                                <div className="text-xs text-gray-500 mb-1 font-normal">Group</div>
                                <div className="text-sm text-gray-900 font-normal">
                                  {assignment.group?.name}
                                </div>
                              </div>
                            ))
                        ) : (
                          <div 
                            className="border-b border-gray-100 p-3 min-h-[60px] bg-white hover:bg-gray-50 transition-colors cursor-pointer relative"
                            onClick={() => toggleGroupDropdown(event.id)}
                          >
                            <div className="text-xs text-blue-600 hover:text-blue-800">+ Assign groups</div>
                            
                            {/* Group Assignment Dropdown */}
                            {openGroupDropdown === event.id && (
                              <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                <div className="p-4 border-b border-gray-200">
                                  <h4 className="text-sm font-medium text-gray-900 mb-2">Assign Groups</h4>
                                  <p className="text-xs text-gray-600">
                                    Select groups to automatically assign all members to this event.
                                  </p>
                                </div>
                                
                                <div className="p-3 max-h-48 overflow-y-auto">
                                  {groups.length > 0 ? (
                                    <div className="space-y-2">
                                      {groups.map((group) => {
                                        const isSelected = (selectedGroups[event.id] || []).includes(group.id)
                                        return (
                                          <label
                                            key={group.id}
                                            className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                                              isSelected 
                                                ? 'bg-green-50 border-green-200 text-green-900' 
                                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => handleToggleGroup(event.id, group.id)}
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
                                                {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''}
                                              </div>
                                            </div>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-center py-4">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setShowCreateGroupModal(true)
                                        }}
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-4 py-2 rounded transition-colors text-sm font-medium"
                                      >
                                        + Create Group
                                      </button>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Create your first group to assign multiple musicians at once
                                      </p>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex justify-end space-x-2 p-3 border-t">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenGroupDropdown(null)
                                    }}
                                    className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSaveGroupAssignment(event.id)
                                    }}
                                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            )}
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
                                  className="w-full text-sm text-gray-900 text-left hover:bg-gray-100 rounded-sm px-2 py-1 font-normal flex items-center gap-2"
                                >
                                  <span className="flex-1 truncate">
                                    {assignment.user.firstName} {assignment.user.lastName}
                                  </span>
                                  {assignment.isAutoAssigned && (
                                    <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium flex-shrink-0">
                                      AUTO
                                    </span>
                                  )}
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
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedEvents.has(event.id)}
                                  onChange={() => toggleEventSelection(event.id)}
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: event.eventType.color }}
                                />
                                <h3 className="font-semibold text-gray-900 truncate">{event.name}</h3>
                              </div>
                              
                                                             {/* Edit and Delete buttons */}
                               <div className="flex items-center gap-1">
                                 <button
                                   onClick={() => handleEditEvent(event)}
                                   className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                   title="Edit event"
                                 >
                                   <Edit className="w-3 h-3" />
                                 </button>
                                 <button
                                   onClick={() => handleDeleteEvent(event.id)}
                                   className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                   title="Delete event"
                                 >
                                   <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mb-1">
                              {new Date(event.startTime).toLocaleDateString()} at{' '}
                              {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">{event.location}</p>
                            
                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <button 
                                onClick={() => handleAutoPopulate(event.id)}
                                className="bg-[#660033] text-white px-3 py-1.5 rounded text-xs hover:bg-[#800041] transition-colors flex items-center justify-center gap-1"
                              >
                                <Zap className="w-3 h-3" />
                                Auto-populate
                              </button>
                              <button 
                                onClick={() => handleAddDocument(event.id)}
                                className="bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-xs hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                              >
                                <FileText className="w-3 h-3" />
                                Add Document
                              </button>
                              <button 
                                onClick={() => handleAddDefaultServiceParts(event.id)}
                                className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-xs hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Default Parts
                              </button>
                              <button 
                                onClick={() => handleAddSingleSong(event.id)}
                                className="bg-green-50 text-green-600 px-3 py-1.5 rounded text-xs hover:bg-green-100 transition-colors flex items-center justify-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Song
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
                                    onClick={() => toggleGroupDropdown(event.id)}
                                  >
                                    <div className="text-xs text-gray-500 mb-1 font-normal">Group</div>
                                    <div className="text-sm text-gray-900 font-normal">
                                      {assignment.group?.name}
                                    </div>
                                  </div>
                                ))
                            ) : (
                              <div 
                                className="border-b border-gray-100 p-3 min-h-[60px] bg-white hover:bg-gray-50 transition-colors cursor-pointer relative"
                                onClick={() => toggleGroupDropdown(event.id)}
                              >
                                <div className="text-xs text-blue-600 hover:text-blue-800">+ Assign groups</div>
                                
                                {/* Group Assignment Dropdown - Mobile */}
                                {openGroupDropdown === event.id && (
                                  <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                    <div className="p-4 border-b border-gray-200">
                                      <h4 className="text-sm font-medium text-gray-900 mb-2">Assign Groups</h4>
                                      <p className="text-xs text-gray-600">
                                        Select groups to automatically assign all members to this event.
                                      </p>
                                    </div>
                                    
                                    <div className="p-3 max-h-48 overflow-y-auto">
                                      {groups.length > 0 ? (
                                        <div className="space-y-2">
                                          {groups.map((group) => {
                                            const isSelected = (selectedGroups[event.id] || []).includes(group.id)
                                            return (
                                              <label
                                                key={group.id}
                                                className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
                                                  isSelected 
                                                    ? 'bg-green-50 border-green-200 text-green-900' 
                                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => handleToggleGroup(event.id, group.id)}
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
                                                    {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''}
                                                  </div>
                                                </div>
                                              </label>
                                            )
                                          })}
                                        </div>
                                      ) : (
                                        <div className="text-center py-4">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setShowCreateGroupModal(true)
                                            }}
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-4 py-2 rounded transition-colors text-sm font-medium"
                                          >
                                            + Create Group
                                          </button>
                                          <p className="text-xs text-gray-500 mt-1">
                                            Create your first group to assign multiple musicians at once
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex justify-end space-x-2 p-3 border-t">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setOpenGroupDropdown(null)
                                        }}
                                        className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleSaveGroupAssignment(event.id)
                                        }}
                                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                )}
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
                                      className="w-full text-sm text-gray-900 text-left hover:bg-gray-100 rounded-sm px-2 py-1 font-normal flex items-center gap-2"
                                    >
                                      <span className="flex-1 truncate">
                                        {assignment.user.firstName} {assignment.user.lastName}
                                      </span>
                                      {assignment.isAutoAssigned && (
                                        <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium flex-shrink-0">
                                          AUTO
                                        </span>
                                      )}
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

      {/* Individual Song Edit Modal - Uses same UX as service parts */}
      <ServicePartEditModal
        isOpen={showIndividualHymnEditModal}
        onClose={() => {
          setShowIndividualHymnEditModal(false)
          setEditingIndividualHymn(null)
          setEditingEventId('')
          setClickPosition(undefined)
        }}
        servicePart={editingIndividualHymn ? {
          id: editingIndividualHymn.id,
          name: editingIndividualHymn.title,
          notes: editingIndividualHymn.notes || '',
          order: 0
        } : null}
        onSave={(hymnId: string, title: string, notes: string) => {
          handleSaveIndividualHymn(hymnId, title, notes)
        }}
        clickPosition={clickPosition}
      />

      {/* Auto Assign Modal */}
      {showAutoAssignModal && (
        <AutoAssignModal
          isOpen={showAutoAssignModal}
          onClose={() => setShowAutoAssignModal(false)}
          selectedEventIds={Array.from(selectedEvents)}
          groups={groups}
          onAssignComplete={async (assignmentIds) => {
            setLastAutoAssignBatch(assignmentIds)
            const eventCount = selectedEvents.size
            setSelectedEvents(new Set()) // Clear selection after assignment
            setShowAutoAssignModal(false)
            // Refresh data to show assignments
            await fetchPlannerData()
            showToast('success', `Auto-assigned musicians to ${eventCount} events`)
          }}
        />
      )}

      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={showEventDetailsModal}
        onClose={() => {
          setShowEventDetailsModal(false)
          setSelectedEventForEdit(null)
        }}
        event={selectedEventForEdit}
        onEventUpdated={() => {
          fetchPlannerData() // Refresh data after event update
        }}
        onEventDeleted={() => {
          setShowEventDetailsModal(false)
          setSelectedEventForEdit(null)
          fetchPlannerData() // Refresh data after event deletion
        }}
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onGroupCreated={async () => {
          setShowCreateGroupModal(false)
          await fetchGroups() // Refresh groups list
          showToast('success', 'Group created successfully')
        }}
        onMessageGroup={() => {}} // Not needed for this context
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
} 