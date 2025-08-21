'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Calendar, Plus, Search, Filter, Users, Clock, MapPin, 
  ChevronLeft, ChevronRight, Settings, Trash2, Edit, Eye, EyeOff,
  Palette, Save, X, FileText, Zap, ChevronDown, Check, ExternalLink, ChevronUp
} from 'lucide-react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import { EventDetailsModal } from '@/components/events/event-details-modal'
import { CreateRecurringEventModal } from '@/components/events/create-recurring-event-modal'
import { CreateEventModal } from '@/components/events/create-event-modal'
import { EditScopeModal } from '@/components/events/edit-scope-modal'
import { OpenEventsCard } from '@/components/events/open-events-card'
import { ViewAllOpenEventsModal } from '@/components/events/view-all-open-events-modal'
import { GeneratePublicLinkModal } from '@/components/events/generate-public-link-modal'
import { fetchWithCache, invalidateCache } from '@/lib/performance-cache'
import { formatEventTimeForDisplay } from '@/lib/timezone-utils'

interface RootRecurringEvent {
  id: string
  name: string
  description?: string
  location: string
  startTime: string
  endTime?: string
  isRecurring: boolean
  recurrencePattern?: string
  recurrenceEnd?: string
  eventType: {
    id: string
    name: string
    color: string
  }
  assignments?: {
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
  }[]
  hymns?: {
    id: string
    title: string
    notes?: string
    servicePart?: {
      id: string
      name: string
    }
  }[]
  _count?: {
    assignments: number
    hymns: number
  }
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
  status?: 'confirmed' | 'tentative' | 'cancelled'
  isRootEvent?: boolean
  generatedFrom?: string
  assignments?: {
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
  }[]
  hymns?: {
    id: string
    title: string
    notes?: string
    servicePart?: {
      id: string
      name: string
    }
  }[]
  musicFiles?: any[]
  _count?: {
    assignments: number
    hymns: number
  }
  _tempState?: 'pending' | 'error' // Internal state for UI feedback
}

export default function CalendarPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [listFilter, setListFilter] = useState<'upcoming' | 'past'>('upcoming')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Use shared timezone utility function
  const formatEventTime = formatEventTimeForDisplay
  
  // Root recurring events management
  const [rootEvents, setRootEvents] = useState<RootRecurringEvent[]>([])
  const [showCreateRecurringEvent, setShowCreateRecurringEvent] = useState(false)
  
  // Edit recurring events
  const [showEditScopeModal, setShowEditScopeModal] = useState(false)
  const [showEditRecurringEvent, setShowEditRecurringEvent] = useState(false)
  const [editingRootEvent, setEditingRootEvent] = useState<RootRecurringEvent | null>(null)
  const [editScope, setEditScope] = useState<'future' | 'all' | null>(null)
  
  // Calendar events
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [rootEventsLoading, setRootEventsLoading] = useState(true)
  
  // Event details modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [isEditingEvent, setIsEditingEvent] = useState(false)
  
  // Create event modal
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  
  // Drag and drop
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Open events modal
  const [showViewAllOpenEvents, setShowViewAllOpenEvents] = useState(false)
  const [openEventsData, setOpenEventsData] = useState<any[]>([])


  
  // Public link modal
  const [showPublicLinkModal, setShowPublicLinkModal] = useState(false)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  useEffect(() => {
    if (session?.user?.id) {
      loadDataInParallel()
      prefetchAdjacentMonths()
    }
  }, [session, currentDate])

  const fetchRootEvents = useCallback(async () => {
    if (!session?.user?.id) return

    setRootEventsLoading(true)
    try {
      const data = await fetchWithCache<{ events: RootRecurringEvent[] }>(
        '/api/events',
        {},
        'events',
        session.user.id,
        { rootOnly: 'true' }
      )
      setRootEvents(data.events || [])
    } catch (error) {
      console.error('Error fetching root recurring events:', error)
    } finally {
      setRootEventsLoading(false)
    }
  }, [session?.user?.id])

  const fetchEvents = useCallback(async (targetDate?: Date) => {
    if (!session?.user?.id) return

    const dateToUse = targetDate || currentDate
    const month = dateToUse.getMonth() + 1
    const year = dateToUse.getFullYear()

    setEventsLoading(true)
    try {
      const data = await fetchWithCache<{ events: CalendarEvent[] }>(
        '/api/events',
        {},
        'events',
        session.user.id,
        { month: month.toString(), year: year.toString() }
      )
      
      if (!targetDate || targetDate === currentDate) {
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setEventsLoading(false)
    }
  }, [session?.user?.id, currentDate])

  const loadDataInParallel = useCallback(async () => {
    if (!session?.user?.id) return

    setLoading(true)
    
    // Load both root events and calendar events in parallel
    try {
      await Promise.allSettled([
        fetchRootEvents(),
        fetchEvents()
      ])
    } catch (error) {
      console.error('Error loading calendar data:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchRootEvents, fetchEvents])

  const prefetchAdjacentMonths = useCallback(async () => {
    if (!session?.user?.id) return

    const prevMonth = new Date(currentDate)
    prevMonth.setMonth(currentDate.getMonth() - 1)
    
    const nextMonth = new Date(currentDate)
    nextMonth.setMonth(currentDate.getMonth() + 1)

    // Prefetch adjacent months in background (no await to not block UI)
    Promise.allSettled([
      fetchEvents(prevMonth),
      fetchEvents(nextMonth)
    ]).catch(() => {
      // Silently handle prefetch errors
    })
  }, [session?.user?.id, currentDate, fetchEvents])

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      
      // Trigger immediate prefetch of the next/prev months for faster navigation
      if (session?.user?.id) {
        const adjacentMonth = new Date(newDate)
        if (direction === 'prev') {
          adjacentMonth.setMonth(newDate.getMonth() - 1)
        } else {
          adjacentMonth.setMonth(newDate.getMonth() + 1)
        }
        
        // Prefetch in background
        setTimeout(() => {
          fetchEvents(adjacentMonth).catch(() => {
            // Silently handle prefetch errors
          })
        }, 100)
      }
      
      return newDate
    })
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }
    
    return days
  }

  const getEventsForDay = (day: number) => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    return events.filter(event => {
      const eventDate = new Date(event.startTime)
      return eventDate.toDateString() === targetDate.toDateString()
    })
  }

  const handleEventDrag = async (day: number, event: CalendarEvent) => {
    if (!event) return

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    // Preserve the original LOCAL time from the event instead of hardcoding to 10 AM
    // Convert UTC time back to local time to get the correct hour/minute
    const originalEventDate = new Date(event.startTime)
    const originalHour = originalEventDate.getHours() // This gives us local hours
    const originalMinute = originalEventDate.getMinutes() // This gives us local minutes
    const dropDate = new Date(year, month, day, originalHour, originalMinute)

    // Create optimistic update
    const eventDate = new Date(event.startTime)
    const duration = event.endTime 
      ? new Date(event.endTime).getTime() - eventDate.getTime() 
      : 60 * 60 * 1000 // Default 1 hour

    const endDate = new Date(dropDate.getTime() + duration)

    console.log('🎯 Moving event:', {
      eventName: event.name,
      fromDate: eventDate.toISOString(),
      toDate: dropDate.toISOString(),
      duration: duration / (60 * 1000) // minutes
    })

    // Optimistic update
    const updatedEvents = events.map(e => 
      e.id === event.id 
        ? { 
            ...e, 
            startTime: dropDate.toISOString(),
            endTime: endDate.toISOString(),
            _tempState: 'pending' as const
          }
        : e
    )
    setEvents(updatedEvents)

    try {
      const requestBody = {
        startTime: dropDate.toISOString(),
        endTime: endDate.toISOString()
      }
      
      console.log('🚀 Making PATCH request to:', `/api/events/${event.id}`)
      console.log('📋 Request body:', requestBody)
      
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      console.log('📤 Response status:', response.status)
      console.log('📤 Response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        // Remove pending state
        const finalEvents = events.map(e => 
          e.id === event.id 
            ? { 
                ...e, 
                startTime: dropDate.toISOString(),
                endTime: endDate.toISOString(),
                _tempState: undefined
              }
            : e
        )
        setEvents(finalEvents)
      } else {
        const errorText = await response.text()
        console.error('❌ Response not OK. Status:', response.status, 'Text:', errorText)
        
        let errorData
        try {
          errorData = JSON.parse(errorText)
          console.error('❌ Parsed error data:', errorData)
        } catch (e) {
          console.error('❌ Could not parse error response as JSON')
        }
        
        throw new Error(`Failed to update event (${response.status}): ${errorData?.error || errorText}`)
      }
    } catch (error) {
      console.error('❌ Error moving event:', error)
      
      // Revert optimistic update and show error
      const revertedEvents = events.map(e => 
        e.id === event.id 
          ? { ...e, _tempState: 'error' as const }
          : e
      )
      setEvents(revertedEvents)
      
      // Remove error state after 3 seconds
      setTimeout(() => {
        setEvents(events => events.map(e => 
          e.id === event.id 
            ? { ...e, _tempState: undefined }
            : e
        ))
      }, 3000)
    } finally {
      setDraggedEvent(null)
    }
  }

  const handleEventClick = (event: CalendarEvent) => {
    console.log('🎯 Event clicked:', event.name, 'User role:', session?.user?.role)
    
    // Open event details modal for all users
    setSelectedEvent(event)
    setShowEventDetails(true)
    
    // Set edit capability based on role - only directors/pastors/associate directors can edit
    setIsEditingEvent(false) // Start in view mode, let the modal handle edit permissions
  }

  const handleDateClick = (day: number, e: React.MouseEvent) => {
    if (e.target && (e.target as Element).closest('[data-event="true"]')) {
      return // Don't handle date click if user clicked on an event
    }
    
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 10, 0)
    setShowCreateEvent(true)
  }

  const handleEditRootEvent = (rootEvent: RootRecurringEvent) => {
    console.log('📝 Starting edit of root event:', { 
      id: rootEvent.id, 
      name: rootEvent.name,
      isRecurring: rootEvent.isRecurring 
    })
    setEditingRootEvent(rootEvent)
    setShowEditScopeModal(true)
  }

  const handleDeleteRootEvent = async (rootEvent: RootRecurringEvent) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the recurring event series "${rootEvent.name}"?\n\nThis will permanently delete:\n• The root event template\n• All generated events in this series\n• All assignments and hymns for this series\n\nThis action cannot be undone.`
    )
    
    if (!confirmDelete) return
    
    try {
      const response = await fetch(`/api/events/${rootEvent.id}/series`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete recurring event series')
      }
      
      // Refresh the data after successful deletion
      if (session?.user?.id) {
        invalidateCache.events(session.user.id)
      }
      loadDataInParallel()
      
      // Show success message
      alert('Recurring event series deleted successfully!')
    } catch (error) {
      console.error('Error deleting recurring event series:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete recurring event series')
    }
  }

  const handleScopeSelected = (scope: 'future' | 'all') => {
    console.log('🎯 Scope selected for edit:', { 
      scope, 
      editingRootEvent: editingRootEvent ? { id: editingRootEvent.id, name: editingRootEvent.name } : null 
    })
    
    setEditScope(scope)
    setShowEditScopeModal(false) // Close scope modal first
    
    // Use setTimeout to ensure state updates are batched properly before opening modal
    setTimeout(() => {
      console.log('🎯 About to open edit modal with state:', {
        editingRootEvent: editingRootEvent ? { id: editingRootEvent.id, name: editingRootEvent.name } : null,
        editScope: scope,
        showEditRecurringEvent: false // about to be true
      })
      setShowEditRecurringEvent(true)
    }, 10) // Small delay to ensure state batching
  }

  const handleEditComplete = () => {
    // Invalidate cache and reload data
    if (session?.user?.id) {
      invalidateCache.events(session.user.id)
    }
    loadDataInParallel()
    setShowEditRecurringEvent(false)
    setEditingRootEvent(null)
    setEditScope(null)
  }



  const generatePDF = async () => {
    try {
      const pdf = new jsPDF()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      let yPosition = 20

      // Load and add Montserrat fonts
      try {
        // Load Montserrat font files
        const [regularFont, boldFont] = await Promise.all([
          fetch('/fonts/Montserrat-Regular.ttf').then(res => res.arrayBuffer()),
          fetch('/fonts/Montserrat-Bold.ttf').then(res => res.arrayBuffer())
        ])
        
        // Convert to base64 for jsPDF
        const regularBase64 = btoa(String.fromCharCode(...new Uint8Array(regularFont)))
        const boldBase64 = btoa(String.fromCharCode(...new Uint8Array(boldFont)))
        
        // Add fonts to PDF
        pdf.addFileToVFS('Montserrat-Regular.ttf', regularBase64)
        pdf.addFileToVFS('Montserrat-Bold.ttf', boldBase64)
        pdf.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal')
        pdf.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold')
      } catch (error) {
        console.warn('Could not load custom fonts, falling back to system fonts:', error)
      }

    // Header
    pdf.setFontSize(20)
    pdf.setFont('Montserrat', 'bold')
    const title = `${session?.user?.churchName || 'Church'} Music Schedule`
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 10
    pdf.setFontSize(14)
    pdf.setFont('Montserrat', 'normal')
    const dateRange = viewMode === 'calendar' 
      ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      : listFilter === 'upcoming' ? 'Upcoming Events' : 'Past Events'
    pdf.text(dateRange, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 25

    // Get events to display
    const now = new Date()
    let eventsToShow = events

    if (viewMode === 'list') {
      eventsToShow = events.filter(event => {
        const eventDate = new Date(event.startTime)
        return listFilter === 'upcoming' ? eventDate >= now : eventDate < now
      })
    }

    // Sort events by date
    eventsToShow = eventsToShow.sort((a, b) => {
      const dateA = new Date(a.startTime)
      const dateB = new Date(b.startTime)
      return dateA.getTime() - dateB.getTime()
    })

    if (eventsToShow.length === 0) {
      pdf.setFontSize(12)
      pdf.text('No events to display', pageWidth / 2, yPosition, { align: 'center' })
    } else {
      // Process each event and fetch hymns
      for (let eventIndex = 0; eventIndex < eventsToShow.length; eventIndex++) {
        const event = eventsToShow[eventIndex]
        
        // Start each event on a new page (except the first one)
        if (eventIndex > 0) {
          pdf.addPage()
          yPosition = 20
        }
        
        // Fetch hymns for this event
        let eventHymns = []
        try {
          const hymnsResponse = await fetch(`/api/events/${event.id}/hymns`)
          if (hymnsResponse.ok) {
            const hymnsData = await hymnsResponse.json()
            eventHymns = hymnsData.hymns || []
          }
        } catch (error) {
          console.error(`Error fetching hymns for event ${event.id}:`, error)
        }

        // Container setup
        const containerStartY = yPosition - 5
        const containerPadding = 8
        const containerWidth = pageWidth - 40
        
        // First, capture all content in memory to calculate container height
        let contentStartY = yPosition + 5
        let tempY = contentStartY
        
        const eventDate = new Date(event.startTime)
        const eventEndDate = event.endTime ? new Date(event.endTime) : null
        
        // Calculate height needed for content
        tempY += 12 // Event title (increased for larger font)
        tempY += 8  // Date/time (increased for larger font) 
        if (event.location) tempY += 8 // Location (increased for larger font)
        
        if (event.description && event.description.trim()) {
          tempY += 8 // Description header
          const lines = pdf.splitTextToSize(event.description, pageWidth - 60)
          tempY += lines.length * 6 + 5 // Description content + spacing (increased for larger font)
        }
        
        if (event.assignments && event.assignments.length > 0) {
          tempY += 8 // Musicians summary
          tempY += event.assignments.length * 6 // Assignment list (increased for larger font)
        }
        
        if (eventHymns && eventHymns.length > 0) {
          tempY += 9 // Music section header
          tempY += eventHymns.length * 6 // Hymns list (increased for larger font)
        }
        
        const containerHeight = tempY - containerStartY + 8
        
        // Convert event color to RGB for PDF styling
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : { r: 59, g: 130, b: 246 } // Default blue if parsing fails
        }
        
        const eventColor = hexToRgb(event.eventType.color)
        
        // Draw container background first with lighter hue (20% opacity equivalent)
        const bgR = Math.round(eventColor.r * 0.2 + 255 * 0.8)
        const bgG = Math.round(eventColor.g * 0.2 + 255 * 0.8) 
        const bgB = Math.round(eventColor.b * 0.2 + 255 * 0.8)
        pdf.setFillColor(bgR, bgG, bgB)
        
        // Draw border with darker hue (original color)
        pdf.setDrawColor(eventColor.r, eventColor.g, eventColor.b)
        pdf.setLineWidth(1.0)
        pdf.rect(20, containerStartY, containerWidth, containerHeight, 'FD') // Fill and Draw in one operation
        
        // Now add the text content on top of the background
        yPosition = contentStartY
        
        // Event title
        pdf.setFont('Montserrat', 'bold')
        pdf.setFontSize(16)
        pdf.setTextColor(0, 0, 0) // Ensure black text
        pdf.text(event.name, 25, yPosition)
        yPosition += 12

        // Combined date and time - "Thursday, July 20, 2025 @ 8:30 PM"
        pdf.setFont('Montserrat', 'normal')
        pdf.setFontSize(12)
        const dateStr = eventDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        const timeStr = eventDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }) + (eventEndDate ? ` - ${eventEndDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}` : '')
        
        pdf.text(`${dateStr} @ ${timeStr}`, 25, yPosition)
        yPosition += 8

        // Location
        if (event.location) {
          pdf.text(`Location: ${event.location}`, 25, yPosition)
          yPosition += 8
        }

        // Description (moved up to be more prominent)
        if (event.description && event.description.trim()) {
          pdf.setFont('Montserrat', 'normal')
          const descriptionText = `Description: ${event.description}`
          const lines = pdf.splitTextToSize(descriptionText, pageWidth - 60)
          lines.forEach((line: string) => {
            pdf.setFontSize(11)
            pdf.text(line, 25, yPosition)
            pdf.setFontSize(12)
            yPosition += 6
          })
          yPosition += 5
        }

        // Assignments summary
        if (event.assignments && event.assignments.length > 0) {
          const assignedCount = event.assignments.filter(a => a.user).length
          const openCount = event.assignments.filter(a => !a.user).length
          const totalSpots = event.assignments.length
          
          pdf.text(`Musicians: ${assignedCount}/${totalSpots} assigned (${openCount} open)`, 25, yPosition)
          yPosition += 5

          // List assignments with better formatting
          event.assignments.forEach((assignment) => {
            const assigneeText = assignment.user 
              ? `${assignment.user.firstName} ${assignment.user.lastName}`
              : assignment.group?.name || 'Open'
            
            pdf.setFontSize(11)
            pdf.text(`   • ${assignment.roleName}: ${assigneeText}`, 30, yPosition)
            pdf.setFontSize(12)
            yPosition += 6
          })
          yPosition += 2
        }

        // Service Parts / Music List
        if (eventHymns && eventHymns.length > 0) {
          pdf.text(`Music & Service Parts (${eventHymns.length} items):`, 25, yPosition)
          yPosition += 5

          eventHymns.forEach((hymn: any, index: number) => {
            const servicePartName = hymn.servicePart?.name || 'Other'
            const hymnText = `   ${index + 1}. ${servicePartName}: ${hymn.title}${hymn.notes ? ` (${hymn.notes})` : ''}`
            
            pdf.setFontSize(11)
            pdf.text(hymnText, 30, yPosition)
            pdf.setFontSize(12)
            yPosition += 6
          })
          yPosition += 3
        }



        yPosition = containerStartY + containerHeight + 10 // Space between events
      }
    }

    // Add logo and app name to bottom of each page
    const totalPages = pdf.getNumberOfPages()
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      pdf.setPage(pageNum)
      
      // Logo area at bottom
      const logoY = pageHeight - 25
      
      // Add app name centered at bottom
      pdf.setFontSize(12)
      pdf.setFont('Montserrat', 'bold')
      pdf.text('Church Music Pro', pageWidth / 2, logoY, { align: 'center' })
      
      // Add generation timestamp and page numbers
      const footerY = pageHeight - 15
      pdf.setFontSize(9)
      pdf.setFont('Montserrat', 'normal')
      pdf.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, footerY)
      pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 20, footerY, { align: 'right' })
    }

    // Save the PDF
    const filename = `${session?.user?.churchName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Church'}_Schedule_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(filename)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view calendar</h1>
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  const days = getDaysInMonth(currentDate)
  const today = new Date()
  const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear()

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
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
                <Calendar className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Calendar & Events</h1>
                  <p className="text-sm text-gray-600">{session.user?.churchName || 'Your Church'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {session?.user?.role !== 'MUSICIAN' && (
                <button
                  onClick={() => setShowPublicLinkModal(true)}
                  className="flex items-center px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Public Link
                </button>
              )}
              <Link
                href="/calendar-subscribe"
                className="flex items-center px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Subscribe
              </Link>
              <button
                onClick={() => generatePDF()}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileText className="h-4 w-4 mr-2" />
                Print PDF
              </button>
              <button
                onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
                className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {viewMode === 'calendar' ? <Eye className="h-4 w-4 mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                {viewMode === 'calendar' ? 'List View' : 'Calendar View'}
              </button>
            </div>
          </div>
        </div>
      </div>

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-8">
        <div className={`grid grid-cols-1 gap-8 min-h-[750px] ${
          session?.user?.role === 'MUSICIAN' ? 'lg:grid-cols-1' : 'lg:grid-cols-4'
        }`}>
          {/* Left Sidebar - Recurring Events & Open Events (30%) - Only show for directors/pastors */}
          {session?.user?.role !== 'MUSICIAN' && (
            <div className="lg:col-span-1 space-y-6">
              {/* Recurring Events Card */}
              <div className="bg-white rounded-xl shadow-sm border max-h-[400px] flex flex-col">
                <div className="p-6 border-b flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">Recurring Events</h2>
                  <button
                    onClick={() => setShowCreateRecurringEvent(true)}
                    className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Create new recurring event"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {rootEventsLoading && rootEvents.length === 0 ? (
                    // Show skeleton loading for recurring events
                    <>
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 rounded-lg border border-gray-200 animate-pulse">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full bg-gray-300 mr-2"></div>
                              <div className="h-4 bg-gray-300 rounded w-24"></div>
                            </div>
                            <div className="w-4 h-4 bg-gray-300 rounded"></div>
                          </div>
                          <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="flex items-center justify-between">
                            <div className="h-3 bg-gray-200 rounded w-16"></div>
                            <div className="h-3 bg-gray-200 rounded w-12"></div>
                          </div>
                          <div className="mt-2 h-5 bg-blue-100 rounded w-20"></div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {rootEvents.map((rootEvent) => (
                        <div
                          key={rootEvent.id}
                          className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                          style={{ borderLeftColor: rootEvent.eventType.color, borderLeftWidth: '4px' }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: rootEvent.eventType.color }}
                              />
                              <h3 className="font-medium text-gray-900 text-sm">{rootEvent.name}</h3>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditRootEvent(rootEvent)
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title="Edit recurring event"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteRootEvent(rootEvent)
                                }}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Delete recurring event series"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {rootEvent.description && (
                            <p className="text-xs text-gray-600 mb-2">{rootEvent.description}</p>
                          )}
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{rootEvent.location}</span>
                            <span>{rootEvent.assignments?.length || 0} roles</span>
                          </div>
                          {rootEvent.recurrencePattern && (
                            <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {(() => {
                                try {
                                  const pattern = JSON.parse(rootEvent.recurrencePattern);
                                  return pattern.type === 'weekly' ? 'Weekly' :
                                         pattern.type === 'biweekly' ? 'Biweekly' :
                                         pattern.type === 'monthly' ? 'Monthly' :
                                         'Custom';
                                } catch {
                                  return 'Recurring';
                                }
                              })()} pattern
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {rootEvents.length === 0 && !rootEventsLoading && (
                        <div className="text-center py-8">
                          <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">No recurring events yet</p>
                          <button
                            onClick={() => setShowCreateRecurringEvent(true)}
                            className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                          >
                            Create your first recurring event
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Open Events Card */}
              <OpenEventsCard
                onEventClick={handleEventClick}
                onViewAllClick={(events) => {
                  setOpenEventsData(events)
                  setShowViewAllOpenEvents(true)
                }}
              />

              {/* Plan Your Events Card */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Plan Your Events</h3>
                    <p className="text-sm text-gray-600">View all of your events in one seamless view. Save hours of scheduling.</p>
                  </div>
                </div>
                
                              <Link 
                href="/plan"
                className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Settings className="h-3 w-3" />
                Open Event Planner
              </Link>
              </div>
            </div>
          )}

          {/* Right Side - Calendar or List View (70% for directors, 100% for musicians) */}
          <div className={session?.user?.role === 'MUSICIAN' ? 'lg:col-span-1' : 'lg:col-span-3'}>
            {viewMode === 'calendar' ? (
              <div className="bg-white rounded-xl shadow-sm border flex flex-col" style={{ maxHeight: '868px' }}>
                {/* Calendar Header */}
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <h2 className="text-xl font-bold text-gray-900">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                      </h2>
                      {eventsLoading && (
                        <div className="ml-3 flex items-center text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-sm">Loading events...</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={eventsLoading}
                      >
                        <ChevronLeft className="h-5 w-5 text-gray-700" />
                      </button>
                      <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        disabled={eventsLoading}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={eventsLoading}
                      >
                        <ChevronRight className="h-5 w-5 text-gray-700" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Drag a recurring event to any date to create an instance, or click a date to start from scratch
                    {!eventsLoading && events.length > 0 && (
                      <span className="ml-2 text-blue-600">• {events.length} events loaded</span>
                    )}
                  </p>
                  {/* Event Visibility Information for Directors */}
                  {(session?.user?.role === 'DIRECTOR' || session?.user?.role === 'ASSOCIATE_DIRECTOR' || session?.user?.role === 'PASTOR') && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2"></div>
                        <div className="text-sm text-blue-800">
                          <span className="font-medium">Event Visibility:</span> Musicians can see events marked as{' '}
                          <span className="font-semibold text-green-700">Confirmed</span> and{' '}
                          <span className="font-semibold text-red-700">Cancelled</span> both in their Church Music Pro account and if they choose to subscribe to your calendar, but{' '}
                          <span className="font-semibold text-orange-700">Tentative</span> events remain private until you set them as confirmed.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Days of Week Header */}
                <div className="grid grid-cols-7 border-b">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                    <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 border-r last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 grid grid-cols-7 gap-0">
                  {days.map((day, index) => {
                    const dayEvents = day ? getEventsForDay(day) : []
                    const isToday = day === today.getDate() && isCurrentMonth
                    
                    return (
                      <div
                        key={index}
                        className={`border-r border-b last:border-r-0 min-h-[140px] p-2 cursor-pointer ${
                          day === null 
                            ? 'bg-gray-50' 
                            : isToday
                            ? 'bg-blue-50'
                            : 'bg-white hover:bg-gray-50'
                        } ${draggedEvent ? 'transition-colors' : ''} ${
                          draggedEvent && day ? 'hover:bg-blue-100 hover:border-blue-300' : ''
                        }`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (day) {
                            if (draggedEvent) {
                              handleEventDrag(day, draggedEvent)
                            }
                          }
                        }}
                        onClick={(e) => day && handleDateClick(day, e)}
                      >
                        {day && (
                          <>
                            <div className={`text-sm font-medium mb-1 ${
                              isToday ? 'text-blue-700' : 'text-gray-900'
                            }`}>
                              {day}
                            </div>
                            <div className="space-y-1">
                              {eventsLoading && dayEvents.length === 0 ? (
                                // Show skeleton loading for events
                                <>
                                  <div className="h-5 bg-gray-200 rounded animate-pulse"></div>
                                  <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4"></div>
                                </>
                              ) : (
                                <>
                                  {dayEvents.slice(0, 3).map((event) => {
                                    const eventDate = new Date(event.startTime)
                                    const timeString = formatEventTimeForDisplay(event.startTime)
                                    const hasRoles = event.assignments && event.assignments.length > 0
                                    const assignedCount = event.assignments?.filter(a => a.user).length || 0
                                    const totalRoles = event.assignments?.length || 0
                                    
                                    return (
                                      <div
                                        key={event.id}
                                        data-event="true"
                                        draggable
                                        onDragStart={(e) => {
                                          setDraggedEvent(event)
                                          setIsDragging(true)
                                          e.dataTransfer.effectAllowed = 'move'
                                          e.dataTransfer.setData('text/plain', event.id)
                                        }}
                                        onDragEnd={() => {
                                          setDraggedEvent(null)
                                          setIsDragging(false)
                                        }}
                                        className={`text-xs px-2 py-1 rounded cursor-move hover:opacity-80 transition-all duration-200 ${
                                          isDragging && draggedEvent?.id === event.id 
                                            ? 'opacity-50 scale-95 shadow-lg' 
                                            : 'hover:scale-105'
                                        } ${
                                          event._tempState === 'pending'
                                            ? 'animate-pulse'
                                            : event._tempState === 'error'
                                            ? 'border-red-500 border-2'
                                            : ''
                                        }`}
                                        style={{ 
                                          backgroundColor: event.eventType.color + '20',
                                          color: event.eventType.color,
                                          borderLeft: `3px solid ${event.eventType.color}`,
                                          transform: isDragging && draggedEvent?.id === event.id ? 'rotate(2deg)' : 'none'
                                        }}
                                        title={`${event.name} at ${timeString}${hasRoles ? `\n👥 ${assignedCount}/${totalRoles} roles filled` : ''} - Click to view details, drag to move`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleEventClick(event)
                                        }}
                                      >
                                        <div className="truncate overflow-hidden">
                                          <span className="font-medium">{timeString}</span> {event.name}
                                        </div>
                                        {event._tempState === 'pending' && (
                                          <div className="text-xs opacity-75 mt-1">(Saving...)</div>
                                        )}
                                        {event._tempState === 'error' && (
                                          <div className="text-xs text-red-600 mt-1">(Failed to save)</div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {dayEvents.length > 3 && (
                                    <div className="text-xs text-gray-500 text-center">
                                      +{dayEvents.length - 3} more
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              // List View
              <div className="bg-white rounded-xl shadow-sm border h-full flex flex-col">
                {/* List Header */}
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Events List</h2>
                    <div className="flex items-center space-x-3">
                      <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setListFilter('upcoming')}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            listFilter === 'upcoming'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Upcoming
                        </button>
                        <button
                          onClick={() => setListFilter('past')}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            listFilter === 'past'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Past
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search events..."
                          className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto">
                  {(() => {
                    const now = new Date()
                    
                    // Filter events based on upcoming/past
                    const filteredEvents = events.filter(event => {
                      const eventDate = new Date(event.startTime)
                      if (listFilter === 'upcoming') {
                        return eventDate >= now
                      } else {
                        return eventDate < now
                      }
                    })
                    
                    // Filter by search term
                    const searchFilteredEvents = filteredEvents.filter(event => {
                      if (!searchTerm) return true
                      const searchLower = searchTerm.toLowerCase()
                      return (
                        event.name.toLowerCase().includes(searchLower) ||
                        event.location?.toLowerCase().includes(searchLower) ||
                        event.description?.toLowerCase().includes(searchLower) ||
                        event.eventType.name.toLowerCase().includes(searchLower)
                      )
                    })
                    
                    // Sort events by date
                    const sortedEvents = searchFilteredEvents.sort((a, b) => {
                      const dateA = new Date(a.startTime)
                      const dateB = new Date(b.startTime)
                      return listFilter === 'upcoming' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime()
                    })
                    
                    if (sortedEvents.length === 0) {
                      return (
                        <div className="p-6 text-center">
                          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {searchTerm ? 'No events found' : `No ${listFilter} events`}
                          </h3>
                          <p className="text-gray-600">
                            {searchTerm 
                              ? 'Try adjusting your search terms or filters.'
                              : listFilter === 'upcoming' 
                                ? 'No upcoming events scheduled. Create an event to get started.'
                                : 'No past events to display.'
                            }
                          </p>
                        </div>
                      )
                    }
                    
                    return (
                      <div className="divide-y divide-gray-200">
                        {sortedEvents.map((event) => {
                          const eventDate = new Date(event.startTime)
                          const eventEndDate = event.endTime ? new Date(event.endTime) : null
                          const isToday = eventDate.toDateString() === now.toDateString()
                          const isPast = eventDate < now
                          
                          return (
                            <div
                              key={event.id}
                              className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => handleEventClick(event)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center mb-2">
                                    <div
                                      className="w-3 h-3 rounded-full mr-3"
                                      style={{ backgroundColor: event.eventType.color }}
                                    />
                                    <h3 className="text-lg font-medium text-gray-900">
                                      {event.name}
                                    </h3>
                                    {event.isRootEvent && (
                                      <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                        Recurring
                                      </span>
                                    )}
                                    {isToday && (
                                      <span className="ml-2 px-2 py-1 text-xs bg-success-100 text-success-700 rounded-full">
                                        Today
                                      </span>
                                    )}
                                    {isPast && listFilter === 'upcoming' && (
                                      <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                        Past
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center text-sm text-gray-600 mb-2">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <span>
                                      {eventDate.toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center text-sm text-gray-600 mb-2">
                                    <Clock className="h-4 w-4 mr-2" />
                                    <span>
                                      {formatEventTimeForDisplay(event.startTime)}
                                      {eventEndDate && (
                                        <span>
                                          {' - '}
                                          {formatEventTimeForDisplay(event.endTime!)}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  
                                  {event.location && (
                                    <div className="flex items-center text-sm text-gray-600 mb-2">
                                      <MapPin className="h-4 w-4 mr-2" />
                                      <span>{event.location}</span>
                                    </div>
                                  )}
                                  
                                  {event.description && (
                                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                      {event.description}
                                    </p>
                                  )}
                                  
                                  {event.assignments && event.assignments.length > 0 && (
                                    <div className="flex items-center text-sm text-gray-500 mt-3">
                                      <Users className="h-4 w-4 mr-2" />
                                      <span>
                                        {event.assignments.filter(a => a.user).length} assigned, {event.assignments.filter(a => !a.user).length} open
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="ml-4 flex flex-col items-end">
                                  <span
                                    className="px-3 py-1 text-xs font-medium rounded-full"
                                    style={{
                                      backgroundColor: event.eventType.color + '20',
                                      color: event.eventType.color
                                    }}
                                  >
                                    {event.eventType.name}
                                  </span>
                                  
                                  {event.status && (
                                    <span className={`mt-2 px-2 py-1 text-xs rounded-full ${
                                      event.status === 'confirmed' 
                                        ? 'bg-success-100 text-success-700'
                                        : event.status === 'tentative'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateEvent}
        onClose={() => {
          setShowCreateEvent(false)
        }}
        onEventCreated={() => {
          // Invalidate cache for faster updates
          if (session?.user?.id) {
            invalidateCache.events(session.user.id)
          }
          loadDataInParallel()
          setShowCreateEvent(false)
        }}
      />

      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={showEventDetails}
        onClose={() => {
          setShowEventDetails(false)
          setSelectedEvent(null)
          setIsEditingEvent(false)
        }}
        event={selectedEvent}
        onEventUpdated={() => {
          // Invalidate cache and refresh events without closing modal
          if (session?.user?.id) {
            invalidateCache.events(session.user.id)
          }
          fetchEvents()
        }}
        onEventDeleted={() => {
          // Invalidate cache and close modal when event is deleted
          if (session?.user?.id) {
            invalidateCache.events(session.user.id)
          }
          loadDataInParallel()
          setShowEventDetails(false)
          setSelectedEvent(null)
          setIsEditingEvent(false)
        }}
      />

      {/* Create Recurring Event Modal */}
      <CreateRecurringEventModal
        isOpen={showCreateRecurringEvent}
        onClose={() => {
          setShowCreateRecurringEvent(false)
        }}
        onEventCreated={() => {
          // Invalidate cache for faster updates
          if (session?.user?.id) {
            invalidateCache.events(session.user.id)
          }
          loadDataInParallel()
          setShowCreateRecurringEvent(false)
        }}
      />

      {/* Edit Scope Modal */}
      <EditScopeModal
        isOpen={showEditScopeModal}
        onClose={() => {
          setShowEditScopeModal(false)
          // Don't reset editingRootEvent here - let the edit modal handle that
          // setEditingRootEvent(null)  // <-- This was causing the bug!
          // setEditScope(null)         // <-- This too!
        }}
        rootEvent={editingRootEvent}
        onScopeSelected={handleScopeSelected}
      />

      {/* Edit Recurring Event Modal */}
      <CreateRecurringEventModal
        isOpen={showEditRecurringEvent}
        onClose={() => {
          setShowEditRecurringEvent(false)
          setEditingRootEvent(null)
          setEditScope(null)
        }}
        onEventCreated={handleEditComplete}
        editingEvent={(() => {
          console.log('🎯 Passing editingEvent to modal:', editingRootEvent ? { id: editingRootEvent.id, name: editingRootEvent.name } : null)
          return editingRootEvent
        })()}
        editScope={(() => {
          console.log('🎯 Passing editScope to modal:', editScope)
          return editScope
        })()}
      />

      {/* View All Open Events Modal */}
      <ViewAllOpenEventsModal
        isOpen={showViewAllOpenEvents}
        onClose={() => {
          setShowViewAllOpenEvents(false)
          setOpenEventsData([])
        }}
        events={openEventsData}
        onEventClick={handleEventClick}
      />

      {/* Generate Public Link Modal */}
      <GeneratePublicLinkModal
        isOpen={showPublicLinkModal}
        onClose={() => setShowPublicLinkModal(false)}
      />
    </div>
  )
} 