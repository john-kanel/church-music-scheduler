'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, Calendar, Plus, Search, Filter, Users, Clock, MapPin, 
  ChevronLeft, ChevronRight, Settings, Trash2, Edit, Eye, EyeOff,
  Palette, Save, X, FileText
} from 'lucide-react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import { EventDetailsModal } from '@/components/events/event-details-modal'
import { CreateTemplateModal } from '@/components/events/create-template-modal'
import { CreateEventModal } from '@/components/events/create-event-modal'

interface EventTemplate {
  id: string
  name: string
  description?: string
  duration: number // in minutes
  color: string
  isRecurring: boolean
  recurrencePattern?: string
  roles: {
    name: string
    maxCount: number
    isRequired: boolean
  }[]
  hymns: {
    title: string
    composer?: string
    notes?: string
  }[]
  isActive: boolean
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
  status?: 'confirmed' | 'tentative' | 'cancelled'
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
  musicFiles?: any[]
  _tempState?: 'pending' | 'error' // Internal state for UI feedback
}

const TEMPLATE_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280'  // Gray
]

export default function CalendarPage() {
  const { data: session } = useSession()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [listFilter, setListFilter] = useState<'upcoming' | 'past'>('upcoming')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Template management
  const [templates, setTemplates] = useState<EventTemplate[]>([])
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EventTemplate | null>(null)
  
  // Calendar events
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  
  // Event details modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [isEditingEvent, setIsEditingEvent] = useState(false)
  
  // Create event modal
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  
  // Drag and drop
  const [draggedTemplate, setDraggedTemplate] = useState<EventTemplate | null>(null)
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  useEffect(() => {
    if (session) {
      fetchTemplates()
      fetchEvents()
    }
  }, [session, currentDate])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/event-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const month = currentDate.getMonth() + 1
      const year = currentDate.getFullYear()
      const response = await fetch(`/api/events?month=${month}&year=${year}`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
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
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }
    
    return days
  }

  const getEventsForDay = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    return events.filter(event => {
      const eventDate = new Date(event.startTime)
      return eventDate.getDate() === day && 
             eventDate.getMonth() === currentDate.getMonth() && 
             eventDate.getFullYear() === currentDate.getFullYear()
    })
  }

  const handleDrop = async (day: number, hour: number = 10) => {
    if (!draggedTemplate) return

    try {
      const dropDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, hour, 0)
      const endDate = new Date(dropDate.getTime() + draggedTemplate.duration * 60000)

      // Optimistic UI update
      const newEvent = {
        id: 'temp-' + Date.now(),
        name: draggedTemplate.name,
        description: draggedTemplate.description,
        location: 'TBD', // Default location
        startTime: dropDate.toISOString(),
        endTime: endDate.toISOString(),
        eventType: {
          id: 'temp',
          name: draggedTemplate.name,
          color: draggedTemplate.color
        },
        templateId: draggedTemplate.id
      }
      
      setEvents(prev => [...prev, newEvent])

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: draggedTemplate.name,
          description: draggedTemplate.description,
          location: 'TBD', // Default location required by API
          startDate: dropDate.toISOString().split('T')[0],
          startTime: dropDate.toTimeString().slice(0, 5),
          endTime: endDate.toTimeString().slice(0, 5),
          eventTypeId: null,
          templateId: draggedTemplate.id,
          templateColor: draggedTemplate.color,
          roles: draggedTemplate.roles,
          hymns: draggedTemplate.hymns,
          isRecurring: draggedTemplate.isRecurring,
          recurrencePattern: draggedTemplate.recurrencePattern
        }),
      })

      if (!response.ok) {
        // Remove optimistic update if failed
        setEvents(prev => prev.filter(e => e.id !== newEvent.id))
        throw new Error('Failed to create event')
      }

      // Refresh events to get the real data
      fetchEvents()
    } catch (error) {
      console.error('Error creating event from template:', error)
    }
  }

  const handleEventDrag = async (day: number, event: CalendarEvent) => {
    if (!draggedEvent || draggedEvent.id !== event.id) return

    try {
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      const eventDate = new Date(event.startTime)
      const timeDiff = eventDate.getTime() - new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime()
      
      // Preserve the original time
      newDate.setTime(newDate.getTime() + timeDiff)
      
      const endDate = event.endTime ? new Date(event.endTime) : null
      let newEndDate = null
      if (endDate) {
        const endTimeDiff = endDate.getTime() - eventDate.getTime()
        newEndDate = new Date(newDate.getTime() + endTimeDiff)
      }

      // Store original event for rollback
      const originalEvent = { ...event }

      // Optimistic UI update
      setEvents(prevEvents => prevEvents.map(ev =>
        ev.id === event.id
          ? { 
              ...ev, 
              startTime: newDate.toISOString(), 
              endTime: newEndDate ? newEndDate.toISOString() : undefined,
              _tempState: 'pending'
            }
          : ev
      ))

      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: event.name,
          description: event.description,
          location: event.location,
          startDate: newDate.toISOString().split('T')[0],
          startTime: newDate.toTimeString().slice(0, 5),
          endTime: newEndDate ? newEndDate.toTimeString().slice(0, 5) : null,
          eventTypeId: event.eventType.id,
          isPastEvent: newDate < new Date()
        }),
      })

      if (!response.ok) {
        // Revert optimistic update if failed
        setEvents(prevEvents => prevEvents.map(ev =>
          ev.id === event.id ? originalEvent : ev
        ))
        throw new Error('Failed to update event')
      }

      // Fetch fresh data to ensure consistency
      fetchEvents()
    } catch (error) {
      console.error('Error moving event:', error)
      // Show error state briefly
      setEvents(prevEvents => prevEvents.map(ev =>
        ev.id === event.id ? { ...event, _tempState: 'error' } : ev
      ))
      // Then revert to original after a short delay
      setTimeout(() => {
        setEvents(prevEvents => prevEvents.map(ev =>
          ev.id === event.id ? event : ev
        ))
      }, 2000)
    }
  }

  const handleEventClick = (event: CalendarEvent) => {
    // Show modal immediately with no API call - instant response
    setSelectedEvent(event)
    setShowEventDetails(true)
    setIsEditingEvent(false)
  }

  const handleDateClick = (day: number, e: React.MouseEvent) => {
    // Only show create event modal if not clicking on an event
    if ((e.target as HTMLElement).closest('[data-event]')) {
      return
    }
    
    setShowCreateEvent(true)
  }

  const generatePDF = () => {
    try {
      const pdf = new jsPDF()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      let yPosition = 20

    // Header
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    const title = `${session?.user?.churchName || 'Church'} Music Schedule`
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 10
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'normal')
    const dateRange = viewMode === 'calendar' 
      ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      : listFilter === 'upcoming' ? 'Upcoming Events' : 'Past Events'
    pdf.text(dateRange, pageWidth / 2, yPosition, { align: 'center' })
    
    yPosition += 20

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
      // Events list
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      
      eventsToShow.forEach((event, index) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          pdf.addPage()
          yPosition = 20
        }

        const eventDate = new Date(event.startTime)
        const eventEndDate = event.endTime ? new Date(event.endTime) : null
        
        // Event title
        pdf.setFont('helvetica', 'bold')
        pdf.text(event.name, 20, yPosition)
        yPosition += 7

        // Date and time
        pdf.setFont('helvetica', 'normal')
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
        
        pdf.text(`Date: ${dateStr}`, 25, yPosition)
        yPosition += 5
        pdf.text(`Time: ${timeStr}`, 25, yPosition)
        yPosition += 5

        // Location
        if (event.location) {
          pdf.text(`Location: ${event.location}`, 25, yPosition)
          yPosition += 5
        }

        // Event type
        pdf.text(`Type: ${event.eventType.name}`, 25, yPosition)
        yPosition += 5

        // Assignments summary
        if (event.assignments && event.assignments.length > 0) {
          const assignedCount = event.assignments.filter(a => a.user).length
          const openCount = event.assignments.filter(a => !a.user).length
          const totalSpots = event.assignments.length
          
          pdf.text(`Assignments: ${assignedCount}/${totalSpots} filled (${openCount} open)`, 25, yPosition)
          yPosition += 5

          // List assignments
          event.assignments.forEach((assignment) => {
            if (yPosition > pageHeight - 20) {
              pdf.addPage()
              yPosition = 20
            }
            
            const assigneeText = assignment.user 
              ? `${assignment.user.firstName} ${assignment.user.lastName}`
              : assignment.group?.name || 'Open'
            
            pdf.text(`  • ${assignment.roleName}: ${assigneeText}`, 30, yPosition)
            yPosition += 4
          })
        }

        // Description
        if (event.description) {
          yPosition += 2
          const lines = pdf.splitTextToSize(event.description, pageWidth - 50)
          pdf.text(`Description: ${lines[0]}`, 25, yPosition)
          if (lines.length > 1) {
            for (let i = 1; i < lines.length; i++) {
              yPosition += 4
              pdf.text(lines[i], 25, yPosition)
            }
          }
          yPosition += 5
        }

        yPosition += 10 // Space between events
      })
    }

    // Footer
    const footerY = pageHeight - 15
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, footerY)
    pdf.text(`Page 1 of ${pdf.getNumberOfPages()}`, pageWidth - 20, footerY, { align: 'right' })

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
              <button
                onClick={generatePDF}
                className="flex items-center px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[750px]">
          {/* Left Sidebar - Templates (30%) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border max-h-[850px] flex flex-col">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Event Templates</h2>
                <button
                  onClick={() => setShowCreateTemplate(true)}
                  className="flex items-center justify-center w-8 h-8 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
                  title="Create new template"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {templates.filter(t => t.isActive).map((template) => (
                  <div
                    key={template.id}
                    draggable
                    onDragStart={() => {
                      setDraggedTemplate(template)
                      setDraggedEvent(null)
                    }}
                    onDragEnd={() => setDraggedTemplate(null)}
                    className="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-300 cursor-move transition-colors"
                    style={{ borderColor: template.color + '40', backgroundColor: template.color + '10' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: template.color }}
                        />
                        <h3 className="font-medium text-gray-900 text-sm">{template.name}</h3>
                      </div>
                      <button
                        onClick={() => {
                          setEditingTemplate(template)
                          setShowCreateTemplate(true)
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Edit template"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                    </div>
                    {template.description && (
                      <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{template.duration} min</span>
                      <span>{template.roles.length} roles</span>
                    </div>
                  </div>
                ))}
                
                {templates.filter(t => t.isActive).length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No templates yet</p>
                    <button
                      onClick={() => setShowCreateTemplate(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      Create your first template
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Calendar or List View (70%) */}
          <div className="lg:col-span-3">
            {viewMode === 'calendar' ? (
              <div className="bg-white rounded-xl shadow-sm border flex flex-col" style={{ maxHeight: '868px' }}>
                {/* Calendar Header */}
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                      {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5 text-gray-700" />
                      </button>
                      <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-2 text-sm bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
                      >
                        Today
                      </button>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronRight className="h-5 w-5 text-gray-700" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Drag templates from the left to create events
                  </p>
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
                        } ${draggedTemplate || draggedEvent ? 'transition-colors' : ''} ${
                          draggedEvent && day ? 'hover:bg-blue-100 hover:border-blue-300' : ''
                        }`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (day) {
                            if (draggedTemplate) {
                              handleDrop(day)
                            } else if (draggedEvent) {
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
                              {dayEvents.slice(0, 3).map((event) => {
                                const eventDate = new Date(event.startTime)
                                const timeString = eventDate.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })
                                return (
                                  <div
                                    key={event.id}
                                    data-event="true"
                                    draggable
                                    onDragStart={(e) => {
                                      setDraggedEvent(event)
                                      setDraggedTemplate(null)
                                      setIsDragging(true)
                                      e.dataTransfer.effectAllowed = 'move'
                                      e.dataTransfer.setData('text/plain', event.id)
                                    }}
                                    onDragEnd={() => {
                                      setDraggedEvent(null)
                                      setIsDragging(false)
                                    }}
                                    className={`text-xs px-2 py-1 rounded truncate cursor-move hover:opacity-80 transition-all duration-200 ${
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
                                    title={`${event.name} at ${timeString} - Drag to move`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEventClick(event)
                                    }}
                                  >
                                    {timeString} {event.name}
                                    {event._tempState === 'pending' && ' (Saving...)'}
                                    {event._tempState === 'error' && ' (Failed to save)'}
                                  </div>
                                )
                              })}
                              {dayEvents.length > 3 && (
                                <div className="text-xs text-gray-500 text-center">
                                  +{dayEvents.length - 3} more
                                </div>
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
                                    {event.templateId && (
                                      <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                        Template
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
                                      {eventDate.toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      })}
                                      {eventEndDate && (
                                        <span>
                                          {' - '}
                                          {eventEndDate.toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true
                                          })}
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

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={showCreateTemplate}
        onClose={() => {
          setShowCreateTemplate(false)
          setEditingTemplate(null)
        }}
        editingTemplate={editingTemplate}
        onTemplateCreated={() => {
          fetchTemplates()
          setShowCreateTemplate(false)
          setEditingTemplate(null)
        }}
      />

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateEvent}
        onClose={() => {
          setShowCreateEvent(false)
        }}
        onEventCreated={() => {
          fetchEvents()
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
          // Just refresh the calendar events, don't close the modal
          fetchEvents()
        }}
        onEventDeleted={() => {
          // Only close modal when event is deleted
          fetchEvents()
          setShowEventDetails(false)
          setSelectedEvent(null)
          setIsEditingEvent(false)
        }}
      />
    </div>
  )
} 