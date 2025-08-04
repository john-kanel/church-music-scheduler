'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Plus, Calendar, Clock, MapPin, User, Music, Users, Trash2, 
  Edit, Save, X, Search, Filter, ChevronDown, Download, 
  FileText, ArrowLeft, Settings, Eye, EyeOff, Palette, Share2,
  ChevronLeft, ChevronRight, Check, ExternalLink, ChevronUp, Zap, Copy
} from 'lucide-react'
import Link from 'next/link'
import { CreateEventModal } from '@/components/events/create-event-modal'
import { ServicePartEditModal } from '@/components/events/service-part-edit-modal'
import { AutoAssignModal } from '@/components/events/auto-assign-modal'
import { EventDetailsModal } from '@/components/events/event-details-modal'
import { CreateGroupModal } from '@/components/groups/create-group-modal'
import { GeneratePublicLinkModal } from '@/components/events/generate-public-link-modal'
import dynamic from 'next/dynamic'
import { formatEventTimeForDisplay, formatEventTimeCompact } from '@/lib/timezone-utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

// Sortable hymn item component
interface SortableHymnItemProps {
  hymn: any
  hymnIndex: number
  allHymns: any[]
  eventId: string
  data: any
  setData: any
  debouncedUpdateHymn: any
  updateHymnTitle: any
  handleReorderAnyHymn: (hymnId: string, direction: 'up' | 'down', eventId: string) => void
  handleEditServicePart: (servicePart: ServicePart, eventId: string, e: React.MouseEvent) => void
  handleEditIndividualHymn: (hymn: any, eventId: string, e: React.MouseEvent) => void
  handleDeleteIndividualHymn: (hymnId: string, eventId: string) => void
  handleSongHistoryClick: (hymnId: string, songTitle: string, currentEventId: string, e: React.MouseEvent) => void
  showingSongHistory: string | null
  songHistoryData: {[hymnId: string]: any[]}
  loadingSongHistory: string | null
}

function SortableHymnItem({
  hymn,
  hymnIndex,
  allHymns,
  eventId,
  data,
  setData,
  debouncedUpdateHymn,
  updateHymnTitle,
  handleReorderAnyHymn,
  handleEditServicePart,
  handleEditIndividualHymn,
  handleDeleteIndividualHymn,
  handleSongHistoryClick,
  showingSongHistory,
  songHistoryData,
  loadingSongHistory
}: SortableHymnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: hymn.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 p-3 min-h-[60px] bg-white group hover:bg-gray-50 transition-colors relative"
    >
      <div 
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ zIndex: isDragging ? 10 : 1 }}
      />
      <div className="relative" style={{ zIndex: 2 }}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-gray-500 font-normal">
            {hymn.type === 'service-part' ? hymn.servicePartName : 'Individual Song'}
          </div>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleReorderAnyHymn(hymn.id, 'up', eventId)
              }}
              disabled={hymnIndex <= 0}
              className="p-1 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-30"
              title="Move up"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleReorderAnyHymn(hymn.id, 'down', eventId)
              }}
              disabled={hymnIndex >= allHymns.length - 1}
              className="p-1 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-30"
              title="Move down"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
            {hymn.type === 'service-part' ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const servicePart = data?.serviceParts.find((sp: ServicePart) => sp.id === hymn.servicePartId)
                    if (servicePart) {
                      handleEditServicePart(servicePart, eventId, e)
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-all"
                  title="Edit service part"
                >
                  <Edit className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteIndividualHymn(hymn.id, eventId)
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 transition-all"
                  title="Delete service part"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditIndividualHymn(hymn, eventId, e)
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-all"
                  title="Edit song notes"
                >
                  <Edit className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteIndividualHymn(hymn.id, eventId)
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 transition-all"
                  title="Delete song"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
            {/* Song History Clock Icon - Show for all songs with titles */}
            {hymn.title && hymn.title.trim() && (
              <button
                onClick={(e) => handleSongHistoryClick(hymn.id, hymn.title, eventId, e)}
                className="p-1 text-gray-400 hover:text-blue-600 transition-all"
                title={`See when "${hymn.title}" was last played`}
                disabled={loadingSongHistory === hymn.id}
              >
                {loadingSongHistory === hymn.id ? (
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
        </div>
        <input
          type="text"
          value={hymn.title || ''}
          onChange={(e) => {
            const newTitle = e.target.value
            // Update immediately in local state for responsive UI
            setData((prev: any) => {
              if (!prev) return prev
              return {
                ...prev,
                events: prev.events.map((ev: any) => 
                  ev.id === eventId 
                    ? {
                        ...ev,
                        hymns: ev.hymns.map((h: any) => 
                          h.id === hymn.id ? { ...h, title: newTitle } : h
                        )
                      }
                    : ev
                )
              }
            })
            // Debounced save to server
            debouncedUpdateHymn(eventId, newTitle, hymn.servicePartId || null, hymn.id)
          }}
          onBlur={(e) => {
            const newTitle = e.target.value
            console.log('🎵 Input blur - saving immediately:', { eventId, newTitle, hymnId: hymn.id })
            // Save immediately when user clicks away (including empty titles for deletion)
            updateHymnTitle(eventId, newTitle, hymn.servicePartId || null, hymn.id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const newTitle = e.currentTarget.value
              console.log('🎵 Enter key - saving immediately:', { eventId, newTitle, hymnId: hymn.id })
              // Save immediately on Enter key (including empty titles for deletion)
              updateHymnTitle(eventId, newTitle, hymn.servicePartId || null, hymn.id)
              e.currentTarget.blur() // Remove focus
            }
          }}
          placeholder="Enter hymn title..."
          className="w-full text-sm text-gray-900 border-none outline-none bg-transparent placeholder-gray-400 focus:bg-gray-50 rounded-sm px-2 py-1 font-normal"
        />
        
        {/* Song History Dropdown */}
        {showingSongHistory === hymn.id && songHistoryData[hymn.id] && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-xs font-medium text-blue-800 mb-2">
              Last played history for "{hymn.title}":
            </div>
            {songHistoryData[hymn.id].length > 0 ? (
              <div className="space-y-2">
                {songHistoryData[hymn.id].map((history, index) => (
                  <div key={index} className="text-xs text-blue-700 bg-white p-2 rounded border">
                    <div className="font-medium">{history.title}</div>
                    <div className="text-blue-600 mt-1">
                      <span className="font-medium">{history.event?.name}</span>
                      {history.event?.startTime && (
                        <span className="ml-2">
                          {new Date(history.event.startTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      )}
                    </div>
                                         {history.servicePart && (
                       <div className="text-blue-500 text-xs mt-1">
                         Service part: {history.servicePart.name}
                       </div>
                     )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-blue-600">
                No matches found in the last 60 days.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface ToastMessage {
  id: string
  type: 'success' | 'error'
  message: string
}

interface Event {
  id: string
  name: string
  description?: string
  startTime: string
  endTime: string
  location: string
  status?: 'error' | 'confirmed' | 'tentative' | 'cancelled' | 'pending'
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
  pagination?: {
    offset: number
    limit: number
    total: number
    hasMore: boolean
  }
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
  const router = useRouter()
  const [data, setData] = useState<EventPlannerData | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Load more state
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  // Scroll position and pagination preservation
  const [lastEditedEventId, setLastEditedEventId] = useState<string | null>(null)
  const [preserveLoadedCount, setPreserveLoadedCount] = useState<number | null>(null)

  // CRITICAL SECURITY: Redirect musicians away from plan page
  useEffect(() => {
    if (session?.user?.role && !['DIRECTOR', 'PASTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      console.warn('🚫 SECURITY: Musician attempted to access plan page, redirecting to calendar')
      router.push('/calendar')
      return
    }
  }, [session?.user?.role, router])
  const [visibleServiceParts, setVisibleServiceParts] = useState<Set<string>>(new Set())
  const [visibleEventColors, setVisibleEventColors] = useState<Set<string>>(new Set())

  // Load filter settings from localStorage on component mount
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem('eventPlannerFilters')
      if (savedFilters) {
        const { visibleServiceParts: savedServiceParts, visibleEventColors: savedEventColors } = JSON.parse(savedFilters)
        if (savedServiceParts) {
          setVisibleServiceParts(new Set(savedServiceParts))
        }
        if (savedEventColors) {
          setVisibleEventColors(new Set(savedEventColors))
        }
        console.log('✅ Restored filter settings from localStorage:', { savedServiceParts, savedEventColors })
      }
    } catch (error) {
      console.error('❌ Error loading filter settings from localStorage:', error)
    }
  }, [])

  // Save filter settings to localStorage when they change
  useEffect(() => {
    try {
      const filterSettings = {
        visibleServiceParts: Array.from(visibleServiceParts),
        visibleEventColors: Array.from(visibleEventColors)
      }
      localStorage.setItem('eventPlannerFilters', JSON.stringify(filterSettings))
      console.log('💾 Saved filter settings to localStorage:', filterSettings)
    } catch (error) {
      console.error('❌ Error saving filter settings to localStorage:', error)
    }
  }, [visibleServiceParts, visibleEventColors])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPublicLinkModal, setShowPublicLinkModal] = useState(false)
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

  
  // Event details modal state
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false)
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<Event | null>(null)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null)

  // Debug selectedEventForEdit changes
  useEffect(() => {
    console.log('🔄 selectedEventForEdit state changed:', {
      hasEvent: !!selectedEventForEdit,
      eventId: selectedEventForEdit?.id,
      eventName: selectedEventForEdit?.name
    })
  }, [selectedEventForEdit])

  // Debug modal open state changes
  useEffect(() => {
    console.log('🔄 showEventDetailsModal state changed:', {
      isOpen: showEventDetailsModal,
      hasSelectedEvent: !!selectedEventForEdit,
      selectedEventId: selectedEventForEdit?.id
    })
  }, [showEventDetailsModal, selectedEventForEdit])
  
  // Create group modal state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)

  // Role creation state
  const [openRoleCreation, setOpenRoleCreation] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState('')

  // Copy event state
  const [showCopyDropdown, setShowCopyDropdown] = useState<string | null>(null)
  const [copyTargetEvent, setCopyTargetEvent] = useState<Event | null>(null)
  const [selectedSourceEventId, setSelectedSourceEventId] = useState<string | null>(null)
  const [copySelectedParts, setCopySelectedParts] = useState<{
    documents: boolean
    serviceParts: boolean
    groups: boolean
    musicians: boolean
  }>({
    documents: false,
    serviceParts: false,
    groups: false,
    musicians: false
  })

  // Event description editing state
  const [editingDescription, setEditingDescription] = useState<string | null>(null)
  const [tempDescription, setTempDescription] = useState<string>('')
  const [addingRole, setAddingRole] = useState(false)

  // Service parts dropdown state
  const [openServicePartsDropdown, setOpenServicePartsDropdown] = useState<string | null>(null)

  // Song History functionality
  const [showingSongHistory, setShowingSongHistory] = useState<string | null>(null) // hymn ID whose history is being shown
  const [songHistoryData, setSongHistoryData] = useState<{[hymnId: string]: any[]}>({}) // cache for song history
  const [loadingSongHistory, setLoadingSongHistory] = useState<string | null>(null) // hymn ID currently loading

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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

  // Function to scroll to a specific event
  const scrollToEvent = (eventId: string) => {
    console.log(`🎯 scrollToEvent called with eventId: ${eventId}`)
    
    // Try multiple times with increasing delays to ensure DOM is ready
    const attemptScroll = (attempt: number) => {
      const eventElement = document.querySelector(`[data-event-id="${eventId}"]`)
      console.log(`📍 Attempt ${attempt}: Found element:`, eventElement)
      
      if (eventElement) {
        // Log current scroll position before scrolling
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop
        console.log(`📍 Current scroll position: ${currentScrollTop}`)
        
        eventElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        })
        
        // Log new position after a short delay
        setTimeout(() => {
          const newScrollTop = window.pageYOffset || document.documentElement.scrollTop
          console.log(`🎯 Scrolled to event ${eventId}. New position: ${newScrollTop}`)
        }, 500)
        
        return true // Success
      } else {
        console.warn(`⚠️ Attempt ${attempt}: Could not find event element with ID: ${eventId}`)
        
        // Log all elements with data-event-id for debugging
        const allEventElements = document.querySelectorAll('[data-event-id]')
        console.log(`🔍 Available event elements:`, Array.from(allEventElements).map(el => el.getAttribute('data-event-id')))
        
        if (attempt < 5) {
          // Try again with longer delay
          setTimeout(() => attemptScroll(attempt + 1), attempt * 200)
        }
        return false
      }
    }
    
    // Start with immediate attempt, then retry with delays if needed
    setTimeout(() => attemptScroll(1), 100)
  }

  // Service part order persistence (database)
  const saveEventServicePartOrder = async (order: Record<string, string[]>) => {
    try {
      const response = await fetch('/api/user/service-part-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventServicePartOrder: order })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save service part order')
      }
      
      console.log('✅ Saved event service part order to database:', order)
    } catch (error) {
      console.error('❌ Error saving event service part order:', error)
    }
  }

  const restoreEventServicePartOrder = async () => {
    try {
      const response = await fetch('/api/user/service-part-order')
      if (response.ok) {
        const data = await response.json()
        const order = data.eventServicePartOrder || {}
        setEventServicePartOrder(order)
        console.log('✅ Restored event service part order from database:', order)
      }
    } catch (error) {
      console.error('❌ Error restoring event service part order:', error)
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      fetchPlannerData()
      fetchMusicians()
      fetchGroups()
      // Check for backed-up changes on page load
      restoreBackedUpChanges()
      // Restore event service part order from database
      restoreEventServicePartOrder()
    }
  }, [session?.user?.id])

  // Save eventServicePartOrder whenever it changes
  useEffect(() => {
    if (Object.keys(eventServicePartOrder).length > 0) {
      saveEventServicePartOrder(eventServicePartOrder)
    }
  }, [eventServicePartOrder])

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setStatusDropdownOpen(null)
    }
    
    if (statusDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [statusDropdownOpen])

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

  const fetchPlannerData = async (appendMode = false, preservePosition = false) => {
    try {
      if (!appendMode) setLoading(true)
      if (appendMode) setIsLoadingMore(true)
      
      let offset = 0
      let limit = 20
      
      if (appendMode) {
        offset = data?.events.length || 0
        limit = 30
      } else if (preservePosition && preserveLoadedCount) {
        // Load all events up to the previously loaded count to restore pagination state
        offset = 0
        limit = preserveLoadedCount
        console.log(`🔄 Preserving position: Loading ${limit} events to restore pagination state`)
      }
      
      const response = await fetch(`/api/planner?offset=${offset}&limit=${limit}`)
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
        
        setData(prevData => {
          if (appendMode && prevData) {
            // Append new events to existing data
            return {
              ...updatedPlannerData,
              events: [...prevData.events, ...eventsWithDocuments]
            }
          } else {
            // Replace all data (initial load)
            return updatedPlannerData
          }
        })

        // Scroll to edited event after data refresh
        if (preservePosition && lastEditedEventId) {
          console.log(`🔄 fetchPlannerData: preservePosition=${preservePosition}, lastEditedEventId=${lastEditedEventId}`)
          console.log(`🔄 fetchPlannerData: Data loaded successfully, ${eventsWithDocuments.length} events`)
          console.log(`🎯 Attempting to scroll to edited event: ${lastEditedEventId}`)
          scrollToEvent(lastEditedEventId)
          setLastEditedEventId(null) // Clear after scrolling
          setPreserveLoadedCount(null) // Clear preserved count
        } else {
          console.log(`🔄 fetchPlannerData: No scroll needed. preservePosition=${preservePosition}, lastEditedEventId=${lastEditedEventId}`)
        }
        
        // Only set initial filter state if not already set from localStorage
        setVisibleServiceParts(prev => {
          if (prev.size === 0) {
            // If no saved filters, show all service parts initially
            return new Set(plannerData.serviceParts.map((sp: ServicePart) => sp.id))
          }
          return prev
        })
        
        setVisibleEventColors(prev => {
          if (prev.size === 0) {
            // If no saved filters, show all event colors initially
            const uniqueColors = plannerData.events.map((event: Event) => event.eventType.color)
            return new Set<string>(uniqueColors)
          }
          return prev
        })
        
        // Close any open interfaces when data refreshes
        setOpenGroupDropdown(null)
        setOpenRoleCreation(null)
        setNewRoleName('')
        setOpenServicePartsDropdown(null)
      } else {
        console.error('Failed to fetch planner data')
      }
    } catch (error) {
      console.error('Error fetching planner data:', error)
    } finally {
      if (!appendMode) setLoading(false)
      if (appendMode) setIsLoadingMore(false)
    }
  }

  // Load more events when "See more" button is clicked
  const loadMoreEvents = () => {
    if (isLoadingMore || !data?.pagination?.hasMore) return
    fetchPlannerData(true)
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



  const clearEventSelection = () => {
    setSelectedEvents(new Set())
  }



  const getEventsForFilterGroup = (color: string): Event[] => {
    if (!data?.events) return []
    
    return data.events.filter(event => 
      event.eventType.color === color && 
      visibleEventColors.has(event.eventType.color)
    )
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
      console.log('🎵 Saving hymn title:', { eventId, newTitle, servicePartId, hymnId })
      
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
        const errorData = await response.json()
        console.error('❌ Failed to save hymn:', errorData)
        showToast('error', errorData.error || 'Failed to save hymn title')
        // Revert local state if server update failed
        await fetchPlannerData()
      } else {
        const result = await response.json()
        console.log('✅ Hymn title saved successfully:', result)
        showToast('success', 'Hymn title saved!')
      }
    } catch (error) {
      console.error('❌ Error updating hymn:', error)
      showToast('error', 'Failed to save hymn title. Please try again.')
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
        // Page is hidden, save all pending updates immediately (including empty titles for deletion)
        Object.entries(pendingUpdatesRef.current).forEach(([key, update]) => {
          console.log('Saving update for', key, update.title)
          updateHymnTitle(update.eventId, update.title, update.servicePartId, update.hymnId)
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
        
        // Group updates by eventId to send as batches (including empty titles for deletion)
        const updatesByEvent: Record<string, any[]> = {}
        Object.entries(pendingUpdatesRef.current).forEach(([key, update]) => {
          // Always process updates, including empty titles (for deletion)
          if (!updatesByEvent[update.eventId]) {
            updatesByEvent[update.eventId] = []
          }
          updatesByEvent[update.eventId].push(update)
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
      // Always save, including empty titles (for deletion)
      console.log('Auto-saving after delay:', key, newTitle)
      updateHymnTitle(eventId, newTitle, servicePartId, hymnId)
      
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

      // Get all default service parts
      const defaultServiceParts = data.serviceParts.filter(sp => sp.isRequired)
      
      if (defaultServiceParts.length === 0) {
        showToast('error', 'No default service parts are configured. Please mark some service parts as "Required" in your church settings.')
        return
      }

      // Create placeholder hymns for each default service part
      const defaultHymns = defaultServiceParts.map(sp => ({
        title: '',
        notes: '',
        servicePartId: sp.id
      }))

      // Get current event hymns
      const currentEvent = data.events.find(e => e.id === eventId)
      const existingHymns = currentEvent?.hymns || []



      // Combine existing hymns with new default parts (avoiding duplicates)
      const existingServicePartIds = existingHymns.map(h => h.servicePartId).filter(Boolean)
      const newHymns = defaultHymns.filter(h => !existingServicePartIds.includes(h.servicePartId))



      if (newHymns.length === 0) {
        showToast('error', 'All default service parts are already added to this event')
        return
      }

      const allHymns = [
        ...existingHymns.map(hymn => ({
          title: hymn.title || '', // Allow empty titles
          notes: hymn.notes || '',
          servicePartId: hymn.servicePartId || null
        })),
        ...newHymns
      ]

      // Save to the event
      const response = await fetch(`/api/events/${eventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: allHymns })
      })


      
      if (!response.ok) {
        const errorText = await response.text()
        console.log('🔧 ERROR: API response error:', errorText)
        throw new Error(`Failed to add default service parts: ${errorText}`)
      }

      const responseData = await response.json()

      // Optimistic update - add the new service parts to local state immediately
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          events: prev.events.map(ev => 
            ev.id === eventId 
              ? {
                  ...ev,
                  hymns: [
                    ...ev.hymns,
                    ...newHymns.map(hymn => ({
                      id: `temp-${Date.now()}-${hymn.servicePartId}`,
                      title: hymn.title,
                      notes: hymn.notes,
                      servicePartId: hymn.servicePartId
                    }))
                  ]
                }
              : ev
          )
        }
      })

      showToast('success', `Added ${newHymns.length} default service parts`)

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
        title: '',
        notes: '',
        servicePartId: null
      }

      // Add the new individual song to existing hymns (preserving ALL existing hymns including empty ones)
      const allHymns = [
        ...existingHymns.map(hymn => ({
          title: hymn.title || '', // Allow empty titles
          notes: hymn.notes || '',
          servicePartId: hymn.servicePartId || null
        })),
        newHymn
      ]

      console.log('🎵 DEBUG: Final hymns array with new hymns:', allHymns)

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

      // Optimistic update - add the new song to local state immediately
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          events: prev.events.map(ev => 
            ev.id === eventId 
              ? {
                  ...ev,
                  hymns: [
                    ...ev.hymns,
                    {
                      id: `temp-${Date.now()}`,
                      title: '',
                      notes: '',
                      servicePartId: undefined
                    }
                  ]
                }
              : ev
          )
        }
      })

      showToast('success', 'Added new service part slot')
      console.log('🎵 DEBUG: Song added with optimistic update')
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

      console.log('🎵 AUTO-POPULATE: Processing suggestions:', suggestions.length)
      console.log('🎵 AUTO-POPULATE: Existing hymns:', existingHymns.length)

      // Process suggestions and intelligently merge with existing hymns
      // PRESERVE ORIGINAL ORDER by mapping existing hymns with their original index
      // Leave empty hymns as empty instead of adding placeholder titles
      const processedHymns = [...existingHymns.map((hymn, index) => ({
        title: hymn.title || '', // Leave empty instead of adding 'New Song'
        notes: hymn.notes || '',
        servicePartId: hymn.servicePartId || null,
        orderIndex: index // Preserve original order
      }))]

                    // Track which service parts already have content (original titles, not placeholder or empty)
      const servicePartsWithContent = new Set(
        existingHymns
          .filter(h => h.servicePartId && h.title?.trim())
          .map(h => h.servicePartId)
      )

      for (const suggestion of suggestions) {
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
                    // FIXED: DO NOT auto-sort when adding new service parts - preserve user order
                    serviceParts: [...prev.serviceParts, matchingPart]
                  }
                })
              }
            }
          } catch (error) {
            console.error('Error creating service part:', error)
          }
        }

        const servicePartId = matchingPart?.id || null

        // Check if this service part already has real content (not just placeholders)
        if (servicePartId && servicePartsWithContent.has(servicePartId)) {
          // Service part already has real content, add as additional song
          processedHymns.push({
            title: suggestion.songTitle,
            notes: suggestion.notes || '',
            servicePartId: servicePartId,
            orderIndex: processedHymns.length // Next available index
          })
          console.log(`🎵 AUTO-POPULATE: Added additional song to existing service part: ${suggestion.servicePartName}`)
        } else {
          // Service part doesn't have real content yet, try to find empty slot to update
          const existingIndex = processedHymns.findIndex(h => 
            h.servicePartId === servicePartId && (!h.title?.trim())
          )
          
          if (existingIndex !== -1) {
            // Update empty existing service part - preserve its original orderIndex
            processedHymns[existingIndex] = {
              title: suggestion.songTitle,
              notes: suggestion.notes || '',
              servicePartId: servicePartId,
              orderIndex: processedHymns[existingIndex].orderIndex // Keep original order
            }
            console.log(`🎵 AUTO-POPULATE: Updated existing empty service part: ${suggestion.servicePartName}`)
          } else {
            // No empty slot found, add as new song
            processedHymns.push({
              title: suggestion.songTitle,
              notes: suggestion.notes || '',
              servicePartId: servicePartId,
              orderIndex: processedHymns.length // Next available index
            })
            console.log(`🎵 AUTO-POPULATE: Added new hymn to service part: ${suggestion.servicePartName}`)
          }
          
          if (servicePartId) {
            servicePartsWithContent.add(servicePartId)
            console.log(`🎵 AUTO-POPULATE: Added song to service part: ${suggestion.servicePartName}`)
          } else {
            console.log(`🎵 AUTO-POPULATE: Added individual song: ${suggestion.songTitle}`)
          }
        }
      }

      console.log('🎵 AUTO-POPULATE: Final hymns count:', processedHymns.length)

      // Save all hymns to the event using the correct API format
      const response = await fetch(`/api/events/${currentEventIdForUpload}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hymns: processedHymns,
          isAutoPopulate: true  // Skip email notifications for auto-populate
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save hymns')
      }

      showToast('success', `Added ${suggestions.length} songs from document (merged with existing content)`)
      
      // Refresh the data to show updated hymns with position preservation
      if (editingEventId) {
        setLastEditedEventId(editingEventId)
        setPreserveLoadedCount(data?.events.length || 20)
        await fetchPlannerData(false, true)
      } else {
        await fetchPlannerData()
      }
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

  const handleSaveIndividualHymn = async (songId: string, title: string, notes: string, sectionTitle?: string) => {
    if (!editingEventId || !editingIndividualHymn) return
    
    try {
      console.log('🎵 INDIVIDUAL SONG: Saving with custom section title:', { songId, title, notes, sectionTitle })
      
      // For now, we'll store the custom section title in the notes with a special prefix
      // This allows us to maintain backward compatibility while adding the feature
      const notesWithSectionTitle = sectionTitle && sectionTitle !== 'Individual Song' 
        ? `[SECTION:${sectionTitle}]${notes ? '\n' + notes : ''}`
        : notes

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
                    h.id === editingIndividualHymn.id ? { ...h, title, notes: notesWithSectionTitle } : h
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
          ? { title, notes: notesWithSectionTitle, servicePartId: h.servicePartId }
          : { title: h.title, notes: h.notes || '', servicePartId: h.servicePartId }
      ) || []

      console.log('🎵 INDIVIDUAL SONG: Sending API request:', {
        eventId: editingEventId,
        hymnId: editingIndividualHymn.id,
        encodedNotes: notesWithSectionTitle,
        totalHymns: updatedHymns.length
      })

      const response = await fetch(`/api/events/${editingEventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: updatedHymns })
      })
      
      console.log('🎵 INDIVIDUAL SONG: API response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Individual song saved successfully:', result)
        showToast('success', 'Song updated successfully')
        
              // Refresh data to ensure we have the latest state from the server with position preservation
      if (editingEventId) {
        setLastEditedEventId(editingEventId)
        setPreserveLoadedCount(data?.events.length || 20)
        await fetchPlannerData(false, true)
      } else {
        await fetchPlannerData()
      }
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to save individual song:', errorData)
        showToast('error', errorData.error || 'Failed to update song')
        
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
      }
      
      setShowIndividualHymnEditModal(false)
      setEditingIndividualHymn(null)
      setEditingEventId('')
    } catch (error) {
      console.error('❌ Error saving individual song:', error)
      showToast('error', 'Error updating song. Please try again.')
      
      // Revert optimistic update on error
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
    
    // FIXED: DO NOT auto-sort - preserve the order as the user left it
    // Only filter by visibility, but maintain the original order from the event
    return servicePartsWithHymns
      .filter(sp => visibleServiceParts.has(sp.id))
  }

  // Helper function to get hymns without service parts for a specific event  
  const getHymnsWithoutServiceParts = (eventId: string) => {
    if (!data) return []
    
    const event = data.events.find(e => e.id === eventId)
    if (!event) return []
    
    return event.hymns.filter(h => !h.servicePartId)
  }

  // Helper function to extract custom section title from individual song notes
  const extractSectionTitle = (notes: string | undefined): { sectionTitle: string; cleanNotes: string } => {
    if (!notes) return { sectionTitle: 'Individual Song', cleanNotes: '' }
    
    if (notes.startsWith('[SECTION:')) {
      const endIndex = notes.indexOf(']')
      if (endIndex !== -1) {
        const sectionTitle = notes.substring(9, endIndex) // Extract between '[SECTION:' and ']'
        const cleanNotes = notes.substring(endIndex + 1).replace(/^\n/, '') // Remove leading newline if present
        return {
          sectionTitle,
          cleanNotes
        }
      }
    }
    
    return { sectionTitle: 'Individual Song', cleanNotes: notes }
  }

  // Get all hymns (service parts + individual) in unified database order
  const getAllHymnsInOrder = (eventId: string) => {
    const event = data?.events.find(e => e.id === eventId)
    if (!event) return []

    // Return all hymns in their actual database order (already ordered by createdAt from API)
    // This preserves the unified order that we set during reordering
    return event.hymns.map(hymn => {
      const servicePart = data?.serviceParts.find(sp => sp.id === hymn.servicePartId)
      const isIndividual = !hymn.servicePartId
      
      if (isIndividual) {
        const { sectionTitle, cleanNotes } = extractSectionTitle(hymn.notes)
        return {
          ...hymn,
          type: 'individual' as const,
          servicePartName: sectionTitle,
          notes: cleanNotes // Use clean notes without the section title prefix
        }
      }
      
      return {
        ...hymn,
        type: 'service-part' as const,
        servicePartName: servicePart?.name
      }
    })
  }

  // Unified function to reorder any hymn (service part or individual)
  const handleReorderAnyHymn = async (hymnId: string, direction: 'up' | 'down', eventId: string) => {
    try {
      const allHymns = getAllHymnsInOrder(eventId)
      const hymnIndex = allHymns.findIndex(h => h.id === hymnId)
      
      if (hymnIndex === -1) return
      
      const newIndex = direction === 'up' ? hymnIndex - 1 : hymnIndex + 1
      if (newIndex < 0 || newIndex >= allHymns.length) return

      // Reorder the unified hymns array
      const reorderedHymns = [...allHymns]
      const [movedHymn] = reorderedHymns.splice(hymnIndex, 1)
      reorderedHymns.splice(newIndex, 0, movedHymn)

      // Optimistic update - show movement immediately
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          events: prev.events.map(ev => 
            ev.id === eventId 
              ? { 
                  ...ev, 
                  hymns: reorderedHymns.map(hymn => ({ 
                    id: hymn.id, 
                    title: hymn.title || '', // Allow empty titles
                    notes: hymn.notes || undefined, 
                    servicePartId: hymn.servicePartId || undefined 
                  })) 
                }
              : ev
          )
        }
      })

      // Convert back to API format with proper ordering timestamps
      const hymnsForAPI = reorderedHymns.map((hymn, index) => ({
                  title: hymn.title || '', // Allow empty titles
        notes: hymn.notes || '',
        servicePartId: hymn.servicePartId || null,
        // Use index to preserve order - API will use this for creation timestamp offset
        orderIndex: index
      }))

      // Send to API in background
      const response = await fetch(`/api/events/${eventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: hymnsForAPI })
      })

      if (!response.ok) {
        // Revert optimistic update on failure - restore original order
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            events: prev.events.map(ev => 
              ev.id === eventId 
                ? { 
                    ...ev, 
                    hymns: allHymns.map(hymn => ({ 
                      id: hymn.id, 
                      title: hymn.title || '', 
                      notes: hymn.notes || undefined, 
                      servicePartId: hymn.servicePartId || undefined 
                    })) 
                  }
                : ev
            )
          }
        })
        throw new Error('Failed to reorder hymn')
      }

      showToast('success', 'Song reordered successfully')
    } catch (error) {
      console.error('Error reordering hymn:', error)
      showToast('error', 'Failed to reorder hymn')
    }
  }

  // Legacy function for individual hymns (now calls unified function)
  const handleReorderIndividualHymn = (hymnId: string, direction: 'up' | 'down', eventId: string) => {
    return handleReorderAnyHymn(hymnId, direction, eventId)
  }

  // Drag and drop handler
  const handleDragEnd = async (event: DragEndEvent, eventId: string) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const allHymns = getAllHymnsInOrder(eventId)
    const oldIndex = allHymns.findIndex(hymn => hymn.id === active.id)
    const newIndex = allHymns.findIndex(hymn => hymn.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Reorder the hymns array
    const reorderedHymns = arrayMove(allHymns, oldIndex, newIndex)

    // Optimistic update - show movement immediately
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        events: prev.events.map(ev => 
          ev.id === eventId 
            ? { 
                ...ev, 
                hymns: reorderedHymns.map(hymn => ({ 
                  id: hymn.id, 
                  title: hymn.title || '', 
                  notes: hymn.notes || undefined, 
                  servicePartId: hymn.servicePartId || undefined 
                })) 
              }
            : ev
        )
      }
    })

    // Convert to API format and save
    try {
      const hymnsForAPI = reorderedHymns.map((hymn, index) => ({
        title: hymn.title || 'New Song',
        notes: hymn.notes || '',
        servicePartId: hymn.servicePartId || null,
        orderIndex: index
      }))

      const response = await fetch(`/api/events/${eventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: hymnsForAPI })
      })

      if (!response.ok) {
        // Revert optimistic update on failure
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            events: prev.events.map(ev => 
              ev.id === eventId 
                ? { 
                    ...ev, 
                    hymns: allHymns.map(hymn => ({ 
                      id: hymn.id, 
                      title: hymn.title || '', 
                      notes: hymn.notes || undefined, 
                      servicePartId: hymn.servicePartId || undefined 
                    })) 
                  }
                : ev
            )
          }
        })
        throw new Error('Failed to reorder hymn')
      }

      showToast('success', 'Songs reordered successfully')
    } catch (error) {
      console.error('Error reordering hymns:', error)
      showToast('error', 'Failed to reorder songs')
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
    const event = data?.events.find(e => e.id === eventId)
    if (!event) return
    
    // Find the hymn associated with this service part
    const hymn = event.hymns.find(h => h.servicePartId === servicePartId)
    if (!hymn) return
    
    // Use the unified reordering system
    return handleReorderAnyHymn(hymn.id, direction, eventId)
  }

  // Helper function to find eventId from assignmentId
  const findEventIdByAssignmentId = (assignmentId: string): string | null => {
    if (!data?.events) return null
    
    for (const event of data.events) {
      const assignment = event.assignments?.find(a => a.id === assignmentId)
      if (assignment) {
        return event.id
      }
    }
    return null
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
          // Refresh data to show new document with position preservation
          setLastEditedEventId(eventId)
          setPreserveLoadedCount(data?.events.length || 20)
          await fetchPlannerData(false, true)
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
        // Refresh data to remove deleted document with position preservation
        setLastEditedEventId(eventId)
        setPreserveLoadedCount(data?.events.length || 20)
        await fetchPlannerData(false, true)
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
      console.log('🎵 Assigning musician:', { assignmentId, musicianId })
      
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicianId })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Assignment successful:', result)
        
        // Show success message
        showToast('success', 'Musician assigned successfully!')
        
        // Update local state to reflect the assignment with position preservation
        const eventId = findEventIdByAssignmentId(assignmentId)
        if (eventId) {
          setLastEditedEventId(eventId)
          setPreserveLoadedCount(data?.events.length || 20)
          await fetchPlannerData(false, true)
        } else {
          await fetchPlannerData()
        }
        setOpenDropdowns(prev => ({ ...prev, [assignmentId]: false }))
        setSearchTexts(prev => ({ ...prev, [assignmentId]: '' }))
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to assign musician:', errorData)
        showToast('error', errorData.error || 'Failed to assign musician')
      }
    } catch (error) {
      console.error('❌ Error assigning musician:', error)
      showToast('error', 'Error assigning musician. Please try again.')
    }
  }

  const handleRemoveMusician = async (assignmentId: string) => {
    try {
      console.log('🗑️ Removing musician assignment:', { assignmentId })
      
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicianId: null })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Musician removed successfully:', result)
        showToast('success', 'Musician removed successfully!')
        
        // Update local state with position preservation
        const eventId = findEventIdByAssignmentId(assignmentId)
        if (eventId) {
          setLastEditedEventId(eventId)
          setPreserveLoadedCount(data?.events.length || 20)
          await fetchPlannerData(false, true)
        } else {
          await fetchPlannerData()
        }
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to remove musician:', errorData)
        showToast('error', errorData.error || 'Failed to remove musician')
      }
    } catch (error) {
      console.error('❌ Error removing musician:', error)
      showToast('error', 'Error removing musician. Please try again.')
    }
  }

  const toggleGroupDropdown = (eventId: string) => {
    if (openGroupDropdown === eventId) {
      setOpenGroupDropdown(null)
    } else {
      // Close other interfaces when opening group dropdown
      setOpenRoleCreation(null)
      setNewRoleName('')
      setOpenServicePartsDropdown(null)
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
      
      // Validate that selected groups have members
      const selectedGroupObjects = groups.filter(g => groupIds.includes(g.id))
      const emptyGroups = selectedGroupObjects.filter(group => !group.members || group.members.length === 0)
      
      if (emptyGroups.length > 0) {
        const groupNames = emptyGroups.map(g => g.name).join(', ')
        showToast('error', `Cannot assign empty groups: ${groupNames}. Please add musicians to these groups first.`)
        return
      }
      

      
      // Optimistic update - update local state immediately
      setData(prev => {
        if (!prev) return prev
        
        // Create new group assignments
        const newGroupAssignments = selectedGroupObjects.flatMap(group => 
          group.members?.map(member => ({
            id: `temp-${Date.now()}-${Math.random()}`,
            eventId: eventId,
            userId: member.id,
            groupId: group.id,
            roleName: 'Group Member',
            status: 'PENDING' as const,
            user: {
              id: member.id,
              firstName: member.firstName || '',
              lastName: member.lastName || '',
              email: ''
            },
            group: {
              id: group.id,
              name: group.name
            }
          })) || []
        )
        
        return {
          ...prev,
          events: prev.events.map(ev => 
            ev.id === eventId 
              ? {
                  ...ev,
                  assignments: [
                    // Keep non-group assignments
                    ...ev.assignments.filter(a => !a.group),
                    // Add new group assignments
                    ...newGroupAssignments
                  ]
                }
              : ev
          )
        }
      })

      const response = await fetch(`/api/events/${eventId}/groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedGroups: groupIds
        })
      })

      if (response.ok) {
        showToast('success', 'Group assignments updated successfully!')
        setOpenGroupDropdown(null)
        setSelectedGroups(prev => ({ ...prev, [eventId]: [] }))
      } else {
        // Revert optimistic update on failure with position preservation
        setLastEditedEventId(eventId)
        setPreserveLoadedCount(data?.events.length || 20)
        await fetchPlannerData(false, true)
        const errorData = await response.json()
        showToast('error', errorData.error || 'Failed to update group assignments')
      }
    } catch (error) {
      console.error('Error updating group assignments:', error)
      // Revert optimistic update on error with position preservation
      setLastEditedEventId(eventId)
      setPreserveLoadedCount(data?.events.length || 20)
      await fetchPlannerData(false, true)
      showToast('error', 'Error updating group assignments')
    }
  }

  const toggleRoleCreation = (eventId: string) => {
    if (openRoleCreation === eventId) {
      setOpenRoleCreation(null)
      setNewRoleName('')
    } else {
      // Close other interfaces when opening role creation
      setOpenGroupDropdown(null)
      setOpenServicePartsDropdown(null)
      setOpenRoleCreation(eventId)
      setNewRoleName('')
    }
  }

  const toggleServicePartsDropdown = (eventId: string) => {
    if (openServicePartsDropdown === eventId) {
      setOpenServicePartsDropdown(null)
    } else {
      // Close other interfaces when opening service parts dropdown
      setOpenGroupDropdown(null)
      setOpenRoleCreation(null)
      setNewRoleName('')
      setOpenServicePartsDropdown(eventId)
    }
  }

  const handleAddRole = async (eventId: string) => {
    if (!newRoleName.trim()) {
      showToast('error', 'Please enter a role name')
      return
    }
    
    try {
      setAddingRole(true)
      console.log('🎭 Adding new role:', { eventId, roleName: newRoleName.trim() })
      
      // Create a new assignment for this role
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: eventId,
          roleName: newRoleName.trim(),
          maxMusicians: 1,
          status: 'PENDING'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Failed to add role:', errorData)
        throw new Error(errorData.error || 'Failed to add role')
      }

      const result = await response.json()
      console.log('✅ Role added successfully:', result)
      
      // Refresh the data to get the new role from the server with position preservation
      setLastEditedEventId(eventId)
      setPreserveLoadedCount(data?.events.length || 20)
      await fetchPlannerData(false, true)

      showToast('success', 'Role added successfully!')
      setNewRoleName('')
      setOpenRoleCreation(null)
    } catch (error) {
      console.error('❌ Error adding role:', error)
      showToast('error', error instanceof Error ? error.message : 'Failed to add role')
    } finally {
      setAddingRole(false)
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

  // Get unique colors for filter (blue = General, other colors = recurring series)
  const uniqueEvents = data ? 
    (() => {
      const colorMap = new Map()
      
      data.events.forEach(event => {
        const color = event.eventType.color
        const isBlue = color.toLowerCase() === '#3b82f6' || color.toLowerCase() === '#2563eb' || color.toLowerCase() === '#1d4ed8' // Various shades of blue (case-insensitive)
        
        if (!colorMap.has(color)) {
          colorMap.set(color, {
            name: isBlue ? 'General' : event.name, // Blue = General, others = recurring series name
            color: color,
            id: event.id,
            isRecurring: !isBlue
          })
        } else {
          const existing = colorMap.get(color)
          if (isBlue) {
            // For blue events, ALWAYS keep the name as "General" - never override
            existing.name = 'General'
          } else if (event.isRootEvent || event.generatedFrom) {
            // For non-blue events, make sure we have the recurring series name (not just any event name)
            existing.name = event.name
          }
        }
      })
      
      return [...colorMap.values()]
    })()
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

  // Helper function to get status tag styling
  const getStatusTagStyles = (status?: string) => {
    const normalizedStatus = status?.toUpperCase() || 'CONFIRMED'
    
    switch (normalizedStatus) {
      case 'CONFIRMED':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          label: 'Confirmed'
        }
      case 'TENTATIVE':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          label: 'Tentative'
        }
      case 'CANCELLED':
        return {
          bg: 'bg-red-100',
          text: 'text-red-800',
          label: 'Cancelled'
        }
      case 'PENDING':
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          label: 'Pending'
        }
      default:
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          label: 'Confirmed'
        }
    }
  }

  // Handle quick status change
  const handleStatusChange = async (eventId: string, newStatus: string) => {
    try {
      console.log('🎯 Changing event status:', { eventId, newStatus })
      
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus.toUpperCase()
        }),
      })

      if (response.ok) {
        console.log('✅ Status updated successfully')
        showToast('success', `Event status changed to ${newStatus.toLowerCase()}`)
        
        // Refresh the planner data to reflect the change with position preservation
        setLastEditedEventId(eventId)
        setPreserveLoadedCount(data?.events.length || 20)
        await fetchPlannerData(false, true)
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to update status:', errorData)
        throw new Error(errorData.error || 'Failed to update event status')
      }
    } catch (error) {
      console.error('❌ Error updating event status:', error)
      showToast('error', 'Failed to update event status')
    }
  }

  // Clickable status component
  const StatusDropdown = ({ event }: { event: Event }) => {
    const statusStyles = getStatusTagStyles(event.status)
    const isOpen = statusDropdownOpen === event.id
    
    const statusOptions = [
      { value: 'CONFIRMED', label: 'Confirmed', styles: getStatusTagStyles('CONFIRMED') },
      { value: 'TENTATIVE', label: 'Tentative', styles: getStatusTagStyles('TENTATIVE') },
      { value: 'CANCELLED', label: 'Cancelled', styles: getStatusTagStyles('CANCELLED') }
    ]

    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setStatusDropdownOpen(isOpen ? null : event.id)
          }}
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusStyles.bg} ${statusStyles.text}`}
          title="Click to change status"
        >
          {statusStyles.label}
          {isOpen ? (
            <ChevronUp className="h-3 w-3 ml-1" />
          ) : (
            <ChevronDown className="h-3 w-3 ml-1" />
          )}
        </button>
        
        {isOpen && (
          <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-32">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusChange(event.id, option.value)
                  setStatusDropdownOpen(null)
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                  option.value === (event.status?.toUpperCase() || 'CONFIRMED') 
                    ? `${option.styles.bg} ${option.styles.text}` 
                    : 'text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const handleEditEvent = (event: Event) => {
    console.log('🚀 handleEditEvent called with:', {
      eventId: event?.id,
      eventName: event?.name,
      eventData: event
    })
    
    if (!event) {
      console.error('🚨 ERROR: handleEditEvent received null/undefined event!')
      return
    }
    
    console.log('🚀 Setting selectedEventForEdit and opening modal')
    setSelectedEventForEdit(event)
    setShowEventDetailsModal(true)
    console.log('🚀 Modal should be opening now with event:', event.id)
  }

  // Copy event functionality
  const handleCopyEvent = (targetEvent: Event) => {
    setCopyTargetEvent(targetEvent)
    setShowCopyDropdown(targetEvent.id)
    setSelectedSourceEventId(null)
    // Reset copy selection
    setCopySelectedParts({
      documents: false,
      serviceParts: false,
      groups: false,
      musicians: false
    })
  }

  const getSortedEventsForCopy = (currentEvent: Event) => {
    if (!data?.events) return []
    
    const currentDate = new Date(currentEvent.startTime)
    const otherEvents = data.events.filter(e => e.id !== currentEvent.id)
    
    // Sort events by proximity to current event date
    return otherEvents.sort((a, b) => {
      const dateA = new Date(a.startTime)
      const dateB = new Date(b.startTime)
      
      // Calculate days difference from current event
      const diffA = Math.abs((dateA.getTime() - currentDate.getTime()) / (1000 * 3600 * 24))
      const diffB = Math.abs((dateB.getTime() - currentDate.getTime()) / (1000 * 3600 * 24))
      
      // If dates are very close, prioritize future events over past events
      if (Math.abs(diffA - diffB) < 1) {
        if (dateA >= currentDate && dateB < currentDate) return -1
        if (dateB >= currentDate && dateA < currentDate) return 1
      }
      
      return diffA - diffB
    })
  }

  const handleSelectSourceEvent = (sourceEventId: string) => {
    setSelectedSourceEventId(sourceEventId)
  }

  const handleCopySubmit = async () => {
    if (!copyTargetEvent || !selectedSourceEventId) return
    
    // Check if trying to copy to the same event
    if (selectedSourceEventId === copyTargetEvent.id) {
      showToast('error', 'Cannot copy from an event to itself')
      return
    }
    
    const selectedParts = Object.entries(copySelectedParts)
      .filter(([_, selected]) => selected)
      .map(([part, _]) => part)
    
    if (selectedParts.length === 0) {
      showToast('error', 'Please select at least one part to copy')
      return
    }

    try {
      const response = await fetch('/api/events/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceEventId: selectedSourceEventId,  // Event we're copying FROM
          targetEventId: copyTargetEvent.id,     // Event we're copying TO
          parts: selectedParts
        })
      })

      if (!response.ok) {
        throw new Error('Failed to copy event parts')
      }

      const sourceEventName = getSortedEventsForCopy(copyTargetEvent).find(e => e.id === selectedSourceEventId)?.name || 'source event'
      showToast('success', `Successfully copied ${selectedParts.join(', ')} from "${sourceEventName}" to "${copyTargetEvent.name}"`)
      setShowCopyDropdown(null)
      setCopyTargetEvent(null)
      setSelectedSourceEventId(null)
      // Refresh to show copied data with position preservation
      if (copyTargetEvent?.id) {
        setLastEditedEventId(copyTargetEvent.id)
        setPreserveLoadedCount(data?.events.length || 20)
        fetchPlannerData(false, true)
      } else {
        fetchPlannerData()
      }
    } catch (error) {
      console.error('Error copying event parts:', error)
      showToast('error', 'Failed to copy event parts')
    }
  }

  // Event description editing
  const handleEditDescription = (eventId: string, currentDescription: string) => {
    setEditingDescription(eventId)
    setTempDescription(currentDescription || '')
  }

  const handleSaveDescription = async (eventId: string) => {
    try {
      // Find the current event to get its complete data
      const currentEvent = data?.events.find(e => e.id === eventId)
      if (!currentEvent) {
        throw new Error('Event not found')
      }

      // Send complete event data with updated description
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentEvent.name,
          description: tempDescription,
          location: currentEvent.location,
          startDate: new Date(currentEvent.startTime).toISOString().split('T')[0],
          startTime: new Date(currentEvent.startTime).toTimeString().slice(0, 5),
          endTime: currentEvent.endTime ? new Date(currentEvent.endTime).toTimeString().slice(0, 5) : '',
          status: currentEvent.status,
          eventTypeId: currentEvent.eventType.id
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('API Error:', errorData)
        throw new Error('Failed to update description')
      }

      // Update local state
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          events: prev.events.map(event => 
            event.id === eventId 
              ? { ...event, description: tempDescription }
              : event
          )
        }
      })

      setEditingDescription(null)
      setTempDescription('')
      showToast('success', 'Description updated')
    } catch (error) {
      console.error('Error updating description:', error)
      showToast('error', 'Failed to update description')
    }
  }

  const handleCancelDescriptionEdit = () => {
    setEditingDescription(null)
    setTempDescription('')
  }

  // Handle song history search
  const handleSongHistoryClick = async (hymnId: string, songTitle: string, currentEventId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    // If already showing this hymn's history, hide it
    if (showingSongHistory === hymnId) {
      setShowingSongHistory(null)
      return
    }

    // If we already have the data cached, just show it
    if (songHistoryData[hymnId]) {
      setShowingSongHistory(hymnId)
      return
    }

    // Fetch the history
    setLoadingSongHistory(hymnId)
    try {
      const response = await fetch(`/api/song-history?title=${encodeURIComponent(songTitle)}&excludeEventId=${currentEventId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch song history')
      }
      
      const data = await response.json()
      console.log('🎵 Song history fetched:', { songTitle, results: data.songHistory })
      
      // Cache the results
      setSongHistoryData(prev => ({
        ...prev,
        [hymnId]: data.songHistory || []
      }))
      
      // Show the dropdown
      setShowingSongHistory(hymnId)
      
    } catch (error) {
      console.error('Error fetching song history:', error)
      showToast('error', 'Failed to fetch song history')
    } finally {
      setLoadingSongHistory(null)
    }
  }

  // Clear all service parts for an event
  const handleClearAllServiceParts = async (eventId: string) => {
    const confirmed = window.confirm('Are you sure you want to clear all service parts for this event? This action cannot be undone.')
    
    if (!confirmed) return

    try {
      // Get current event hymns
      const currentEvent = data?.events.find(e => e.id === eventId)
      const existingHymns = currentEvent?.hymns || []

      if (existingHymns.length === 0) {
        showToast('error', 'No service parts to clear')
        return
      }

      const response = await fetch(`/api/events/${eventId}/hymns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hymns: [] }) // Empty array to clear all
      })

      if (!response.ok) {
        throw new Error('Failed to clear service parts')
      }

      // Update local state
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          events: prev.events.map(event => 
            event.id === eventId 
              ? { ...event, hymns: [] }
              : event
          )
        }
      })

      showToast('success', `Cleared ${existingHymns.length} service parts`)
    } catch (error) {
      console.error('Error clearing service parts:', error)
      showToast('error', 'Failed to clear service parts')
    }
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
              
              {/* Generate Public Link Button */}
              <button
                onClick={() => setShowPublicLinkModal(true)}
                className="bg-secondary-600 text-white px-4 py-2 rounded-lg hover:bg-secondary-700 transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Public Link</span>
              </button>
              
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
                return (
                  <div key={eventGroup.color} className="relative flex-shrink-0">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={visibleEventColors.has(eventGroup.color)}
                        onChange={() => toggleEventColor(eventGroup.color)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: eventGroup.color }}
                      />
                      <span className="text-sm text-gray-700">{eventGroup.name}</span>
                    </label>
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
            
            {/* Select All Visible Events Button */}
            <button
              onClick={() => {
                const allVisibleEventIds = filteredEvents.map(event => event.id)
                const newSelected = new Set(allVisibleEventIds)
                setSelectedEvents(newSelected)
              }}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded flex-shrink-0 ml-auto"
            >
              <Check className="w-3 h-3" />
              Select All Visible
            </button>
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
                    <div key={event.id} data-event-id={event.id} className="flex-shrink-0 w-80 border-r border-gray-200 bg-white relative">
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
                              onClick={() => handleCopyEvent(event)}
                              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Copy from another event"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                console.log('🔘 EDIT BUTTON CLICKED! Event:', event?.id)
                                console.log('🔘 Button click event fired, calling handleEditEvent...')
                                handleEditEvent(event)
                              }}
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
                        
                        {/* Status Tag - Above date/time and location */}
                        <div className="mt-2 mb-1">
                          <StatusDropdown event={event} />
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                          {new Date(event.startTime).toLocaleDateString()} at{' '}
                          {formatEventTimeForDisplay(event.startTime)}
                        </p>
                        <p className="text-xs text-gray-500 mb-1">{event.location}</p>
                        
                        {/* Event Description with inline editing */}
                        <div className="mt-1">
                          {editingDescription === event.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={tempDescription}
                                onChange={(e) => setTempDescription(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveDescription(event.id)
                                  } else if (e.key === 'Escape') {
                                    handleCancelDescriptionEdit()
                                  }
                                }}
                                className="text-xs text-gray-600 bg-white border border-gray-300 rounded px-1 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Add description..."
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveDescription(event.id)}
                                className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                                title="Save description"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={handleCancelDescriptionEdit}
                                className="p-0.5 text-gray-400 hover:bg-gray-50 rounded"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <p 
                              className="text-xs text-gray-600 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                              onClick={() => handleEditDescription(event.id, event.description || '')}
                              title="Click to edit description"
                            >
                              {event.description || 'No Description'}
                            </p>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="mt-3">
                          <button 
                            onClick={() => handleAddDocument(event.id)}
                            className="w-full bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-xs hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
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

                        {/* Copy Event Dropdown - appears as its own cell */}
                        {showCopyDropdown === event.id && (
                          <div className="border-b border-gray-100 bg-green-50">
                            <div className="p-3 border-b border-green-200 bg-green-100">
                              <h4 className="text-sm font-medium text-gray-900 mb-1">Copy from Another Event</h4>
                              <p className="text-xs text-gray-600">
                                Select an event to copy from and choose what to copy.
                              </p>
                            </div>

                            {/* Event Selection */}
                            <div className="p-3 border-b border-green-200">
                              <h5 className="text-xs font-medium text-gray-700 mb-2">Select Event to Copy From:</h5>
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {getSortedEventsForCopy(event).map((sourceEvent) => (
                                  <button
                                    key={sourceEvent.id}
                                    onClick={() => handleSelectSourceEvent(sourceEvent.id)}
                                    className={`w-full text-left p-2 rounded border transition-colors ${
                                      selectedSourceEventId === sourceEvent.id 
                                        ? 'border-green-500 bg-green-50' 
                                        : 'border-gray-200 bg-white hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: sourceEvent.eventType.color }}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-gray-900 truncate">
                                          {sourceEvent.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {new Date(sourceEvent.startTime).toLocaleDateString()}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Copy Options */}
                            <div className="p-3">
                              <h5 className="text-xs font-medium text-gray-700 mb-2">What to Copy:</h5>
                              <div className="space-y-2">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={copySelectedParts.documents}
                                    onChange={(e) => setCopySelectedParts(prev => ({
                                      ...prev,
                                      documents: e.target.checked
                                    }))}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500 mr-2"
                                  />
                                  <span className="text-xs text-gray-700">Documents</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={copySelectedParts.serviceParts}
                                    onChange={(e) => setCopySelectedParts(prev => ({
                                      ...prev,
                                      serviceParts: e.target.checked
                                    }))}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500 mr-2"
                                  />
                                  <span className="text-xs text-gray-700">Service Parts & Music</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={copySelectedParts.groups}
                                    onChange={(e) => setCopySelectedParts(prev => ({
                                      ...prev,
                                      groups: e.target.checked
                                    }))}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500 mr-2"
                                  />
                                  <span className="text-xs text-gray-700">Groups</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={copySelectedParts.musicians}
                                    onChange={(e) => setCopySelectedParts(prev => ({
                                      ...prev,
                                      musicians: e.target.checked
                                    }))}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500 mr-2"
                                  />
                                  <span className="text-xs text-gray-700">Musicians & Roles</span>
                                </label>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 mt-3 pt-2 border-t border-green-200">
                                <button
                                  onClick={() => {
                                    setShowCopyDropdown(null)
                                    setCopyTargetEvent(null)
                                    setSelectedSourceEventId(null)
                                  }}
                                  className="flex-1 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleCopySubmit}
                                  disabled={Object.values(copySelectedParts).every(v => !v) || !selectedSourceEventId}
                                  className="flex-1 px-3 py-1.5 text-xs text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded transition-colors"
                                >
                                  Copy Now
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Service Parts Header */}
                      <div className="border-t border-gray-200">
                        <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50 group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-black font-bold">Service Parts</div>
                              <button
                                onClick={() => handleClearAllServiceParts(event.id)}
                                className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title="Clear all service parts"
                              >
                                Clear
                              </button>
                            </div>
                            <button
                              onClick={() => toggleServicePartsDropdown(event.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                              title="Add service parts or songs"
                            >
                              + Add
                            </button>
                          </div>
                        </div>

                        {/* Service Parts Dropdown - appears as its own cell */}
                        {openServicePartsDropdown === event.id && (
                          <div className="border-b border-gray-100 bg-orange-50">
                            <div className="p-3 border-b border-orange-200 bg-orange-100">
                              <h4 className="text-sm font-medium text-gray-900 mb-1">Add Music</h4>
                              <p className="text-xs text-gray-600">
                                Choose how you'd like to add music to this event.
                              </p>
                            </div>

                            <div className="p-3 space-y-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAutoPopulate(event.id)
                                  setOpenServicePartsDropdown(null)
                                }}
                                className="w-full flex items-center p-3 rounded border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
                              >
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                                  <Zap className="h-4 w-4 text-purple-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-purple-900">Auto-populate</div>
                                  <div className="text-xs text-purple-700">
                                    Extract songs from uploaded documents
                                  </div>
                                </div>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddDefaultServiceParts(event.id)
                                  setOpenServicePartsDropdown(null)
                                }}
                                className="w-full flex items-center p-3 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                              >
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                  <Plus className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-blue-900">Add Default Parts</div>
                                  <div className="text-xs text-blue-700">
                                    Add all required service parts at once
                                  </div>
                                </div>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddSingleSong(event.id)
                                  setOpenServicePartsDropdown(null)
                                }}
                                className="w-full flex items-center p-3 rounded border border-green-200 bg-green-50 hover:bg-green-100 transition-colors text-left"
                              >
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                  <Plus className="h-4 w-4 text-green-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-green-900">Add Single Song</div>
                                  <div className="text-xs text-green-700">
                                    Add one individual song or piece
                                  </div>
                                </div>
                              </button>
                            </div>

                            <div className="flex justify-end space-x-2 p-3 border-t border-orange-200 bg-orange-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenServicePartsDropdown(null)
                                }}
                                className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Hymns Grid - Unified Order with Drag & Drop */}
                      <div className="flex-1 overflow-y-auto">
                        <DndContext 
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(dragEvent) => handleDragEnd(dragEvent, event.id)}
                        >
                          <SortableContext 
                            items={getAllHymnsInOrder(event.id).map(hymn => hymn.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {getAllHymnsInOrder(event.id).map((hymn, index) => {
                              const allHymns = getAllHymnsInOrder(event.id)
                              const hymnIndex = index
                              
                              return (
                                <SortableHymnItem
                                  key={`hymn-${hymn.id || index}`}
                                  hymn={hymn}
                                  hymnIndex={hymnIndex}
                                  allHymns={allHymns}
                                  eventId={event.id}
                                  data={data}
                                  setData={setData}
                                  debouncedUpdateHymn={debouncedUpdateHymn}
                                  updateHymnTitle={updateHymnTitle}
                                  handleReorderAnyHymn={handleReorderAnyHymn}
                                  handleEditServicePart={handleEditServicePart}
                                  handleEditIndividualHymn={handleEditIndividualHymn}
                                  handleDeleteIndividualHymn={handleDeleteIndividualHymn}
                                  handleSongHistoryClick={handleSongHistoryClick}
                                  showingSongHistory={showingSongHistory}
                                  songHistoryData={songHistoryData}
                                  loadingSongHistory={loadingSongHistory}
                                />
                              )
                            })}
                          </SortableContext>
                        </DndContext>
                      </div>

                      {/* Groups Section */}
                      <div className="border-t border-gray-200">
                        <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-black font-bold">Groups</div>
                            <button
                              onClick={() => toggleGroupDropdown(event.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                              title="Add or manage groups"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                        
                        {event.assignments?.filter(assignment => assignment.group).length > 0 ? (
                          <div 
                            className="border-b border-gray-100 p-3 min-h-[60px] bg-white hover:bg-gray-50 transition-colors cursor-pointer relative"
                            onClick={() => toggleGroupDropdown(event.id)}
                          >
                            <div className="text-xs text-gray-500 mb-1 font-normal">
                              Groups ({event.assignments.filter(assignment => assignment.group).length})
                            </div>
                            <div className="text-sm text-gray-900 font-normal">
                              {Array.from(new Set(event.assignments
                                .filter(assignment => assignment.group)
                                .map(assignment => assignment.group?.name)
                              )).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <div className="border-b border-gray-100 p-3 min-h-[60px] bg-white flex items-center justify-center">
                            <div className="text-xs text-gray-400">No groups assigned</div>
                          </div>
                        )}
                            
                        {/* Group Assignment Interface - appears as its own cell */}
                        {openGroupDropdown === event.id && (
                          <div className="border-b border-gray-100 bg-blue-50">
                            <div className="p-3 border-b border-blue-200 bg-blue-100">
                              <h4 className="text-sm font-medium text-gray-900 mb-1">Assign Groups</h4>
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
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleToggleGroup(event.id, group.id)
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            handleToggleGroup(event.id, group.id)
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
                            
                            <div className="flex justify-end space-x-2 p-3 border-t border-blue-200 bg-blue-50">
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

                      {/* Musicians and Roles Section */}
                      <div>
                        <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-black font-bold">Musicians and Roles</div>
                            <button
                              onClick={() => toggleRoleCreation(event.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                              title="Add role"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                        
                        {/* Role Creation Interface - appears as its own cell */}
                        {openRoleCreation === event.id && (
                          <div className="border-b border-gray-100 bg-green-50">
                            <div className="p-3 border-b border-green-200 bg-green-100">
                              <h4 className="text-sm font-medium text-gray-900 mb-1">Add New Role</h4>
                              <p className="text-xs text-gray-600">
                                Enter a role name to add a new assignment position for this event.
                              </p>
                            </div>
                            
                            <div className="p-3">
                              <input
                                type="text"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                placeholder="Enter role name (e.g., Accompanist, Vocalist, Guitarist)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddRole(event.id)}
                                autoFocus
                              />
                            </div>
                            
                            <div className="flex justify-end space-x-2 p-3 border-t border-green-200 bg-green-50">
                              <button
                                onClick={() => toggleRoleCreation(event.id)}
                                disabled={addingRole}
                                className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleAddRole(event.id)}
                                disabled={addingRole || !newRoleName.trim()}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                              >
                                {addingRole ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                ) : (
                                  <Plus className="h-4 w-4 mr-2" />
                                )}
                                Add Role
                              </button>
                            </div>
                          </div>
                        )}
                        
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
                  
                  {/* See More button */}
                  {data?.pagination?.hasMore && !isLoadingMore && (
                    <div className="flex-shrink-0 w-80 border-r border-gray-200 bg-gray-50 flex items-center justify-center min-h-screen">
                      <button
                        onClick={loadMoreEvents}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span className="font-medium">See More</span>
                      </button>
                    </div>
                  )}
                  
                  {/* Loading more indicator */}
                  {isLoadingMore && (
                    <div className="flex-shrink-0 w-80 border-r border-gray-200 bg-white flex items-center justify-center min-h-screen">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-gray-600 text-sm">Loading 30 more events...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* End of events indicator */}
                  {!isLoadingMore && data?.pagination && !data.pagination.hasMore && (
                    <div className="flex-shrink-0 w-80 border-r border-gray-200 bg-gray-50 flex items-center justify-center min-h-screen">
                      <div className="text-center text-gray-500">
                        <p className="text-sm font-medium">No more events</p>
                        <p className="text-xs">You've reached the end</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile View - Single Column */}
                {filteredEvents[currentEventIndex] && (
                  <div className="lg:hidden bg-white h-full relative" data-event-id={filteredEvents[currentEventIndex].id}>
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
                                   onClick={() => handleCopyEvent(event)}
                                   className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                   title="Copy from another event"
                                 >
                                   <Copy className="w-3 h-3" />
                                 </button>
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
                            
                            {/* Status Tag - Mobile - Above date/time and location */}
                            <div className="mt-2 mb-1">
                              <StatusDropdown event={event} />
                            </div>
                            <p className="text-xs text-gray-500 mb-1">
                              {new Date(event.startTime).toLocaleDateString()} at{' '}
                              {formatEventTimeForDisplay(event.startTime)}
                            </p>
                            <p className="text-xs text-gray-500 mb-1">{event.location}</p>
                            
                            {/* Event Description with inline editing - Mobile */}
                            <div className="mt-1">
                              {editingDescription === event.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={tempDescription}
                                    onChange={(e) => setTempDescription(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveDescription(event.id)
                                      } else if (e.key === 'Escape') {
                                        handleCancelDescriptionEdit()
                                      }
                                    }}
                                    className="text-xs text-gray-600 bg-white border border-gray-300 rounded px-1 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Add description..."
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveDescription(event.id)}
                                    className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                                    title="Save description"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={handleCancelDescriptionEdit}
                                    className="p-0.5 text-gray-400 hover:bg-gray-50 rounded"
                                    title="Cancel"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <p 
                                  className="text-xs text-gray-600 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
                                  onClick={() => handleEditDescription(event.id, event.description || '')}
                                  title="Click to edit description"
                                >
                                  {event.description || 'No Description'}
                                </p>
                              )}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="mt-3">
                              <button 
                                onClick={() => handleAddDocument(event.id)}
                                className="w-full bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-xs hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
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

                          {/* Service Parts Header - Mobile */}
                          <div className="border-t border-gray-200">
                            <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50 group">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-black font-bold">Service Parts</div>
                                  <button
                                    onClick={() => handleClearAllServiceParts(event.id)}
                                    className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="Clear all service parts"
                                  >
                                    Clear
                                  </button>
                                </div>
                                <button
                                  onClick={() => toggleServicePartsDropdown(event.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                                  title="Add service parts or songs"
                                >
                                  + Add
                                </button>
                              </div>
                            </div>

                            {/* Service Parts Dropdown - Mobile */}
                            {openServicePartsDropdown === event.id && (
                              <div className="border-b border-gray-100 bg-orange-50">
                                <div className="p-3 border-b border-orange-200 bg-orange-100">
                                  <h4 className="text-sm font-medium text-gray-900 mb-1">Add Music</h4>
                                  <p className="text-xs text-gray-600">
                                    Choose how you'd like to add music to this event.
                                  </p>
                                </div>

                                <div className="p-3 space-y-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleAutoPopulate(event.id)
                                      setOpenServicePartsDropdown(null)
                                    }}
                                    className="w-full flex items-center p-3 rounded border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
                                  >
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                                      <Zap className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-purple-900">Auto-populate</div>
                                      <div className="text-xs text-purple-700">
                                        Extract songs from uploaded documents
                                      </div>
                                    </div>
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleAddDefaultServiceParts(event.id)
                                      setOpenServicePartsDropdown(null)
                                    }}
                                    className="w-full flex items-center p-3 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                                  >
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                      <Plus className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-blue-900">Add Default Parts</div>
                                      <div className="text-xs text-blue-700">
                                        Add all required service parts at once
                                      </div>
                                    </div>
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleAddSingleSong(event.id)
                                      setOpenServicePartsDropdown(null)
                                    }}
                                    className="w-full flex items-center p-3 rounded border border-green-200 bg-green-50 hover:bg-green-100 transition-colors text-left"
                                  >
                                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                      <Plus className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-green-900">Add Single Song</div>
                                      <div className="text-xs text-green-700">
                                        Add one individual song or piece
                                      </div>
                                    </div>
                                  </button>
                                </div>

                                <div className="flex justify-end space-x-2 p-3 border-t border-orange-200 bg-orange-50">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenServicePartsDropdown(null)
                                    }}
                                    className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Hymns Grid - Mobile Unified Order with Drag & Drop */}
                          <div className="flex-1 overflow-y-auto">
                            <DndContext 
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(dragEvent) => handleDragEnd(dragEvent, event.id)}
                            >
                              <SortableContext 
                                items={getAllHymnsInOrder(event.id).map(hymn => hymn.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {getAllHymnsInOrder(event.id).map((hymn, index) => {
                                  const allHymns = getAllHymnsInOrder(event.id)
                                  const hymnIndex = index
                                  
                                  return (
                                    <SortableHymnItem
                                      key={`mobile-hymn-${hymn.id || index}`}
                                      hymn={hymn}
                                      hymnIndex={hymnIndex}
                                      allHymns={allHymns}
                                      eventId={event.id}
                                      data={data}
                                      setData={setData}
                                      debouncedUpdateHymn={debouncedUpdateHymn}
                                      updateHymnTitle={updateHymnTitle}
                                      handleReorderAnyHymn={handleReorderAnyHymn}
                                      handleEditServicePart={handleEditServicePart}
                                      handleEditIndividualHymn={handleEditIndividualHymn}
                                      handleDeleteIndividualHymn={handleDeleteIndividualHymn}
                                      handleSongHistoryClick={handleSongHistoryClick}
                                      showingSongHistory={showingSongHistory}
                                      songHistoryData={songHistoryData}
                                      loadingSongHistory={loadingSongHistory}
                                    />
                                  )
                                })}
                              </SortableContext>
                            </DndContext>
                          </div>

                          {/* Groups Section - Mobile */}
                          <div className="border-t border-gray-200">
                            <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-black font-bold">Groups</div>
                                <button
                                  onClick={() => toggleGroupDropdown(event.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                                  title="Add or manage groups"
                                >
                                  + Add
                                </button>
                              </div>
                            </div>
                            
                            {event.assignments?.filter(assignment => assignment.group).length > 0 ? (
                              <div 
                                className="border-b border-gray-100 p-3 min-h-[60px] bg-white hover:bg-gray-50 transition-colors cursor-pointer relative"
                                onClick={() => toggleGroupDropdown(event.id)}
                              >
                                <div className="text-xs text-gray-500 mb-1 font-normal">
                                  Groups ({event.assignments.filter(assignment => assignment.group).length})
                                </div>
                                <div className="text-sm text-gray-900 font-normal">
                                  {Array.from(new Set(event.assignments
                                    .filter(assignment => assignment.group)
                                    .map(assignment => assignment.group?.name)
                                  )).join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div className="border-b border-gray-100 p-3 min-h-[60px] bg-white flex items-center justify-center">
                                <div className="text-xs text-gray-400">No groups assigned</div>
                              </div>
                            )}
                            
                            {/* Group Assignment Interface - Mobile */}
                            {openGroupDropdown === event.id && (
                              <div className="border-b border-gray-100 bg-blue-50">
                                <div className="p-3 border-b border-blue-200 bg-blue-100">
                                  <h4 className="text-sm font-medium text-gray-900 mb-1">Assign Groups</h4>
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
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleToggleGroup(event.id, group.id)
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                e.stopPropagation()
                                                handleToggleGroup(event.id, group.id)
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
                                
                                <div className="flex justify-end space-x-2 p-3 border-t border-blue-200 bg-blue-50">
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

                          {/* Musicians and Roles Section - Mobile */}
                          <div>
                            <div className="border-b border-gray-100 p-3 min-h-[30px] bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-black font-bold">Musicians and Roles</div>
                                <button
                                  onClick={() => toggleRoleCreation(event.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                                  title="Add role"
                                >
                                  + Add
                                </button>
                              </div>
                            </div>
                            
                            {/* Role Creation Interface - Mobile */}
                            {openRoleCreation === event.id && (
                              <div className="border-b border-gray-100 bg-green-50">
                                <div className="p-3 border-b border-green-200 bg-green-100">
                                  <h4 className="text-sm font-medium text-gray-900 mb-1">Add New Role</h4>
                                  <p className="text-xs text-gray-600">
                                    Enter a role name to add a new assignment position for this event.
                                  </p>
                                </div>
                                
                                <div className="p-3">
                                  <input
                                    type="text"
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                    placeholder="Enter role name (e.g., Accompanist, Vocalist, Guitarist)"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddRole(event.id)}
                                    autoFocus
                                  />
                                </div>
                                
                                <div className="flex justify-end space-x-2 p-3 border-t border-green-200 bg-green-50">
                                  <button
                                    onClick={() => toggleRoleCreation(event.id)}
                                    disabled={addingRole}
                                    className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAddRole(event.id)}
                                    disabled={addingRole || !newRoleName.trim()}
                                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                                  >
                                    {addingRole ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    ) : (
                                      <Plus className="h-4 w-4 mr-2" />
                                    )}
                                    Add Role
                                  </button>
                                </div>
                              </div>
                            )}
                            
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

      {/* Generate Public Link Modal */}
      <GeneratePublicLinkModal
        isOpen={showPublicLinkModal}
        onClose={() => setShowPublicLinkModal(false)}
      />

      {/* PDF Processor Modal */}
      {showPdfProcessor && (
        <PdfProcessor
          onSuggestionsAccepted={handlePdfSuggestions}
          onClose={() => setShowPdfProcessor(false)}
          eventId={currentEventIdForUpload}
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
        servicePart={editingIndividualHymn ? (() => {
          const { sectionTitle, cleanNotes } = extractSectionTitle(editingIndividualHymn.notes)
          return {
            id: editingIndividualHymn.id,
            name: sectionTitle,
            songTitle: editingIndividualHymn.title,
            notes: cleanNotes,
            order: 0,
            isIndividualSong: true // Mark as individual song
          }
        })() : null}
        onSave={(hymnId: string, sectionTitle: string, notes: string, songTitle?: string) => {
          handleSaveIndividualHymn(hymnId, songTitle || '', notes, sectionTitle)
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
          console.log('🔄 Modal closing, clearing selectedEventForEdit')
          setShowEventDetailsModal(false)
          setSelectedEventForEdit(null)
        }}
        event={selectedEventForEdit}
        onEventUpdated={() => {
          console.log('🔄 Event updated, refreshing data')
          console.log(`🔄 selectedEventForEdit?.id: ${selectedEventForEdit?.id}`)
          console.log(`🔄 data?.events.length: ${data?.events.length}`)
          if (selectedEventForEdit?.id) {
            // Preserve position when refreshing after edit
            setLastEditedEventId(selectedEventForEdit.id)
            setPreserveLoadedCount(data?.events.length || 20)
            console.log(`🔄 Set lastEditedEventId to: ${selectedEventForEdit.id}`)
            console.log(`🔄 Set preserveLoadedCount to: ${data?.events.length || 20}`)
            console.log(`🔄 Calling fetchPlannerData(false, true)`)
            fetchPlannerData(false, true) // Refresh with position preservation
          } else {
            console.log(`🔄 No selectedEventForEdit.id, calling normal fetchPlannerData`)
            fetchPlannerData() // Fallback to normal refresh
          }
        }}
        onEventDeleted={() => {
          console.log('🔄 Event deleted, closing modal and refreshing')
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