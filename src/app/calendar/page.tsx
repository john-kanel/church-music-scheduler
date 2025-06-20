'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, Calendar, Plus, Search, Filter, Users, Clock, MapPin, 
  ChevronLeft, ChevronRight, Settings, Trash2, Edit, Eye, EyeOff,
  Palette, Save, X
} from 'lucide-react'
import Link from 'next/link'

interface EventTemplate {
  id: string
  name: string
  description?: string
  duration: number // in minutes
  color: string
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
  startTime: string
  endTime?: string
  eventType: {
    name: string
    color: string
  }
  templateId?: string
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
  
  // Drag and drop
  const [draggedTemplate, setDraggedTemplate] = useState<EventTemplate | null>(null)

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

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draggedTemplate.name,
          description: draggedTemplate.description,
          location: 'Church', // Default location
          startDate: dropDate.toISOString().split('T')[0],
          startTime: dropDate.toTimeString().slice(0, 5),
          endTime: endDate.toTimeString().slice(0, 5),
          templateId: draggedTemplate.id,
          roles: draggedTemplate.roles,
          hymns: draggedTemplate.hymns
        })
      })

      if (response.ok) {
        fetchEvents() // Refresh events
      }
    } catch (error) {
      console.error('Error creating event from template:', error)
    }

    setDraggedTemplate(null)
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
    <div className="min-h-screen bg-gray-50">
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
                  <p className="text-sm text-gray-600">{session.user?.parishName || 'Your Parish'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-12rem)]">
          {/* Left Sidebar - Templates (30%) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border h-full flex flex-col">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Event Templates</h2>
                <button
                  onClick={() => setShowCreateTemplate(true)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {templates.filter(t => t.isActive).map((template) => (
                  <div
                    key={template.id}
                    draggable
                    onDragStart={() => setDraggedTemplate(template)}
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
                        onClick={() => setEditingTemplate(template)}
                        className="p-1 text-gray-400 hover:text-gray-600"
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
              <div className="bg-white rounded-xl shadow-sm border h-full flex flex-col">
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
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                        className={`border-r border-b last:border-r-0 min-h-[120px] p-2 ${
                          day === null 
                            ? 'bg-gray-50' 
                            : isToday
                            ? 'bg-blue-50'
                            : 'bg-white hover:bg-gray-50'
                        } ${draggedTemplate ? 'transition-colors' : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => day && handleDrop(day)}
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
                                const eventTime = new Date(event.startTime)
                                const timeString = eventTime.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })
                                return (
                                  <div
                                    key={event.id}
                                    className="text-xs px-2 py-1 rounded truncate cursor-pointer"
                                    style={{
                                      backgroundColor: event.eventType.color + '20',
                                      color: event.eventType.color,
                                      borderLeft: `3px solid ${event.eventType.color}`
                                    }}
                                    title={`${event.name} at ${timeString}`}
                                  >
                                    {timeString} {event.name}
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
                  <div className="p-6 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
                    <p className="text-gray-600">
                      Event list view is being built. Use the calendar view to see and manage your events.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Template Modal - Coming Soon */}
      {showCreateTemplate && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create Template</h3>
              <button
                onClick={() => setShowCreateTemplate(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-700" />
              </button>
            </div>
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Template Builder Coming Soon</h4>
              <p className="text-gray-600 text-sm">
                We're building an advanced template system. For now, you can create events directly using the "Create Event" button on the dashboard.
              </p>
              <button
                onClick={() => setShowCreateTemplate(false)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 