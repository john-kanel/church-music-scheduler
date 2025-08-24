'use client'

import { signOut, useSession } from 'next-auth/react'
import { 
  Calendar, 
  FileText, 
  LogOut,
  ChevronDown,
  Home,
  Clock,
  CheckCircle,
  AlertCircle,
  MapPin,
  X,
  GiftIcon,
  LifeBuoy,
  Users,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
  UserCheck,
  Phone,
  Mail,
  User,
  Lightbulb
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { EventDetailsModal } from '../events/event-details-modal'
import { MusicianSignupModal } from '../events/musician-signup-modal'
import ImportantDocsCard from './important-docs-card'
import { formatEventTimeForDisplay, formatEventTimeCompact } from '@/lib/timezone-utils'

interface User {
  id: string
  email: string
  name: string
  role: string
  churchId: string
  churchName: string
}

interface MusicianDashboardProps {
  user: User
}

interface DashboardData {
  userRole: string
  stats: {
    upcomingAssignments: number
    pendingResponses: number
    acceptedAssignments: number
    thisMonthAssignments: number
  }
  upcomingAssignments: any[]
  events: EventSnippet[]
  musicDirector?: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string
    calendarLink?: string
  }
}

interface EventSnippet {
  id: string
  name: string
  startTime: string
  eventType: {
    name: string
    color: string
  }
}

export function MusicianDashboard({ user }: MusicianDashboardProps) {
  const { data: session } = useSession()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  
  // Separate state for available events (independent of calendar month)
  const [availableEvents, setAvailableEvents] = useState<any[]>([])
  const [availableEventsLoading, setAvailableEventsLoading] = useState(true)

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const month = currentDate.getMonth() + 1 // JavaScript months are 0-indexed
        const year = currentDate.getFullYear()
        const response = await fetch(`/api/dashboard?month=${month}&year=${year}`)
        if (response.ok) {
          const data = await response.json()
          setDashboardData(data)
        } else if (response.status === 403) {
          console.log('🚨 Dashboard API returned 403, redirecting to trial-expired')
          window.location.href = '/trial-expired'
          return
        } else {
          console.error('Failed to fetch dashboard data')
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [currentDate])

  // Fetch available events independently (not tied to calendar month)
  useEffect(() => {
    const fetchAvailableEvents = async () => {
      try {
        // Fetch events for the next 3 months regardless of calendar view
        const startDate = new Date().toISOString()
        const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        
        const response = await fetch(`/api/events?startDate=${startDate}&endDate=${endDate}`)
        if (response.ok) {
          const data = await response.json()
          // Filter for events with open positions
          const eventsWithOpenings = (data.events || []).filter((event: any) => {
            return event.assignments?.some((assignment: any) => !assignment.user)
          })
          setAvailableEvents(eventsWithOpenings)
        } else {
          console.error('Failed to fetch available events')
        }
      } catch (error) {
        console.error('Error fetching available events:', error)
      } finally {
        setAvailableEventsLoading(false)
      }
    }

    if (session?.user?.churchId) {
      fetchAvailableEvents()
    }
  }, [session])

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  const handleAssignmentAction = async (assignmentId: string, action: 'accept' | 'decline') => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      })

      if (response.ok) {
        // Refresh both dashboard data and available events
        await Promise.all([
          refreshDashboardData(),
          refreshAvailableEvents()
        ])
      } else {
        console.error('Failed to update assignment')
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
    }
  }

  const handleEventClick = async (event: any) => {
    try {
      // Fetch complete event details
      const response = await fetch(`/api/events/${event.id}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedEvent(data.event)
        setShowEventDetails(true)
      }
    } catch (error) {
      console.error('Error fetching event details:', error)
    }
  }

  const handleSignupClick = async (event: any) => {
    try {
      // Fetch complete event details for signup
      const response = await fetch(`/api/events/${event.id}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedEvent(data.event)
        setShowSignupModal(true)
      }
    } catch (error) {
      console.error('Error fetching event details:', error)
    }
  }

  // Calendar helper functions
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

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

  const days = getDaysInMonth(currentDate)
  const today = new Date()
  const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear()

  // Get events for current calendar month
  const getEventsForDay = (day: number) => {
    if (!dashboardData?.events) return []
    
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    return dashboardData.events.filter(event => {
      const eventDate = new Date(event.startTime)
      return eventDate.getDate() === day && 
             eventDate.getMonth() === currentDate.getMonth() && 
             eventDate.getFullYear() === currentDate.getFullYear()
    })
  }

  const refreshDashboardData = async () => {
    try {
      const month = currentDate.getMonth() + 1
      const year = currentDate.getFullYear()
      const response = await fetch(`/api/dashboard?month=${month}&year=${year}`)
      if (response.ok) {
        const data = await response.json()
        setDashboardData(data)
      }
    } catch (error) {
      console.error('Error refreshing dashboard data:', error)
    }
  }

  const refreshAvailableEvents = async () => {
    try {
      const startDate = new Date().toISOString()
      const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      
      const response = await fetch(`/api/events?startDate=${startDate}&endDate=${endDate}`)
      if (response.ok) {
        const data = await response.json()
        const eventsWithOpenings = (data.events || []).filter((event: any) => {
          return event.assignments?.some((assignment: any) => !assignment.user)
        })
        setAvailableEvents(eventsWithOpenings)
      }
    } catch (error) {
      console.error('Error refreshing available events:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Unable to load dashboard data</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
              <Logo />
            </Link>

            <div className="flex items-center space-x-4">
              {/* Church Name */}
              <div className="hidden md:block">
                <h2 className="text-lg font-medium text-gray-700">{user.churchName}</h2>
              </div>



              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{user.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-10">
                    <Link href="/rewards" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <GiftIcon className="h-4 w-4 mr-2" />
                      Rewards
                    </Link>
                    <Link href="/profile" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <Home className="h-4 w-4 mr-2" />
                      Profile
                    </Link>
                                  <Link href="/support" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <LifeBuoy className="h-4 w-4 mr-2" />
                Support
              </Link>
              <Link href="/featurerequest" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <Lightbulb className="h-4 w-4 mr-2" />
                Feature Request
              </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-8 space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {user.name.split(' ')[0]}!
            </h1>
            <p className="text-gray-600 mt-2">
              Here are your upcoming assignments and available opportunities
            </p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            {/* Events Navigation Button */}
            <Link 
              href="/calendar"
              className="flex items-center justify-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
            >
              <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
              Events
            </Link>

            {/* Musicians Navigation Button */}
            <Link 
              href="/musicians"
              className="flex items-center justify-center px-3 sm:px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors text-sm sm:text-base"
            >
              <Users className="h-4 w-4 mr-1 sm:mr-2" />
              Musicians
            </Link>

            {/* Messages Navigation Button */}
            <Link 
              href="/messages"
              className="flex items-center justify-center px-3 sm:px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors text-sm sm:text-base"
            >
              <MessageSquare className="h-4 w-4 mr-1 sm:mr-2" />
              Messages
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar & My Assignments */}
          <div className="lg:col-span-2 space-y-8">
            {/* Calendar Widget */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Calendar</h2>
                <Link 
                  href="/calendar"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View Full Calendar →
                </Link>
              </div>
              
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-700" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-700" />
                  </button>
                </div>
              </div>

              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <div key={`day-${index}`} className="text-center text-xs font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  const dayEvents = day ? getEventsForDay(day) : []
                  return (
                    <div
                      key={index}
                      className={`h-20 p-1 cursor-pointer rounded transition-colors border ${
                        day === null 
                          ? 'text-gray-300 border-transparent' 
                          : day === today.getDate() && isCurrentMonth
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      {day && (
                        <div className="h-full flex flex-col">
                          <div className={`text-xs font-medium mb-1 ${
                            day === today.getDate() && isCurrentMonth
                              ? 'text-blue-700'
                              : 'text-gray-900'
                          }`}>
                            {day}
                          </div>
                          <div className="flex-1 overflow-hidden space-y-0.5">
                            {dayEvents.length > 0 ? (
                              dayEvents.slice(0, 2).map((event, eventIndex) => {
                                const eventTime = new Date(event.startTime)
                                                    const timeString = formatEventTimeForDisplay(event.startTime)
                                return (
                                  <div
                                    key={event.id}
                                    className="text-xs px-1 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                                    style={{
                                      backgroundColor: event.eventType.color + '20',
                                      color: event.eventType.color,
                                      borderLeft: `3px solid ${event.eventType.color}`
                                    }}
                                    title={`${event.name} at ${timeString}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEventClick(event)
                                    }}
                                  >
                                    <div className="truncate">
                                      {timeString} {event.name}
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              day === today.getDate() && isCurrentMonth && (
                                <div className="text-xs text-gray-400 text-center">
                                  No events
                                </div>
                              )
                            )}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* My Assignments */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">My Assignments</h2>
              
              <div className="space-y-4">
                {dashboardData?.upcomingAssignments?.length > 0 ? (
                  dashboardData.upcomingAssignments.map((assignment: any) => (
                    <div 
                      key={assignment.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        assignment.status === 'ACCEPTED' 
                          ? 'bg-success-50 border-success-200' 
                          : assignment.status === 'PENDING'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center">
                        {assignment.status === 'ACCEPTED' ? (
                          <CheckCircle className="h-6 w-6 text-success-600 mr-3" />
                        ) : assignment.status === 'PENDING' ? (
                          <Clock className="h-6 w-6 text-yellow-600 mr-3" />
                        ) : (
                          <X className="h-6 w-6 text-gray-600 mr-3" />
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {assignment.event.name} - {assignment.roleName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {new Date(assignment.event.startTime).toLocaleDateString()} at {' '}
                            {formatEventTimeCompact(assignment.event.startTime)}
                          </p>
                          <div className="flex items-center mt-1">
                            <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                            <span className="text-xs text-gray-500">{assignment.event.location}</span>
                          </div>
                          <p className={`text-xs font-medium ${
                            assignment.status === 'ACCEPTED' 
                              ? 'text-success-600' 
                              : assignment.status === 'PENDING'
                              ? 'text-yellow-600'
                              : 'text-gray-600'
                          }`}>
                            {assignment.status === 'PENDING' ? 'Pending Response' : assignment.status}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {assignment.status === 'PENDING' ? (
                          <>
                            <button 
                              onClick={() => handleAssignmentAction(assignment.id, 'accept')}
                              className="bg-success-600 text-white px-3 py-1 rounded text-sm hover:bg-success-700"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleAssignmentAction(assignment.id, 'decline')}
                              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                            >
                              Decline
                            </button>
                          </>
                        ) : assignment.status === 'ACCEPTED' ? (
                          <button 
                            onClick={() => handleAssignmentAction(assignment.id, 'decline')}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                          >
                            Remove
                          </button>
                        ) : (
                          <button className="text-blue-600 hover:text-blue-700 text-sm">
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments</h3>
                    <p className="text-gray-600">
                      You don't have any upcoming assignments yet.
                    </p>
                  </div>
                )}
              </div>

              {dashboardData?.upcomingAssignments?.length > 0 && (
                <div className="mt-4">
                  <Link href="/my-assignments" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View all assignments →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Music Director Contact */}
            {dashboardData?.musicDirector && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Music Director</h2>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">
                      {dashboardData.musicDirector.firstName} {dashboardData.musicDirector.lastName}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 text-gray-400 mr-2" />
                    <a 
                      href={`mailto:${dashboardData.musicDirector.email}`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {dashboardData.musicDirector.email}
                    </a>
                  </div>
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 text-gray-400 mr-2" />
                    {dashboardData.musicDirector.phone ? (
                      <a 
                        href={`tel:${dashboardData.musicDirector.phone}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {dashboardData.musicDirector.phone}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-500">No phone number provided</span>
                    )}
                    </div>
                  {dashboardData.musicDirector.calendarLink && (
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                      <a 
                        href={dashboardData.musicDirector.calendarLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Schedule a meeting
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Available Events */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Events</h2>
              <p className="text-sm text-gray-600 mb-4">Events looking for musicians</p>
              
              {availableEventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableEvents.slice(0, 3).map((event: any) => {
                    const vacancies = event.assignments?.filter((assignment: any) => !assignment.user) || []
                    return (
                      <div key={event.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 text-sm truncate">{event.name}</h3>
                            <p className="text-xs text-gray-600">
                              {new Date(event.startTime).toLocaleDateString()} at {' '}
                              {formatEventTimeCompact(event.startTime)}
                            </p>
                            <p className="text-xs text-orange-600 font-medium">
                              Need: {vacancies.map((v: any) => v.roleName).join(', ')}
                            </p>
                          </div>
                          <AlertCircle className="h-4 w-4 text-orange-600 mt-1" />
                        </div>
                        <button 
                          onClick={() => handleSignupClick(event)}
                          className="w-full mt-2 bg-secondary-600 text-white py-1 px-3 rounded text-xs hover:bg-secondary-700"
                        >
                          Sign Up
                        </button>
                      </div>
                    )
                  })}
                  
                  {availableEvents.length === 0 && (
                    <div className="text-center py-6">
                      <AlertCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">No available events at this time</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4">
                <Link href="/available-events" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View all opportunities →
                </Link>
              </div>
            </div>

            {/* Important Docs and Links */}
            <ImportantDocsCard />

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">My Stats</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Upcoming Assignments</span>
                  <span className="text-lg font-bold text-blue-600">
                    {dashboardData?.stats?.upcomingAssignments || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accepted Total</span>
                  <span className="text-lg font-bold text-success-600">
                    {dashboardData?.stats?.acceptedAssignments || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending Responses</span>
                  <span className="text-lg font-bold text-yellow-600">
                    {dashboardData?.stats?.pendingResponses || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="text-lg font-bold text-secondary-600">
                    {dashboardData?.stats?.thisMonthAssignments || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={showEventDetails}
        onClose={() => {
          setShowEventDetails(false)
          setSelectedEvent(null)
        }}
        event={selectedEvent}
        onEventUpdated={() => {
          refreshDashboardData()
          refreshAvailableEvents()
        }}
        onEventDeleted={() => {
          refreshDashboardData()
          refreshAvailableEvents()
          setShowEventDetails(false)
          setSelectedEvent(null)
        }}
      />

      {/* Musician Signup Modal */}
      <MusicianSignupModal
        isOpen={showSignupModal}
        onClose={() => {
          setShowSignupModal(false)
          setSelectedEvent(null)
        }}
        event={selectedEvent}
        onSignupSuccess={() => {
          refreshDashboardData()
          refreshAvailableEvents()
        }}
      />
    </div>
  )
} 