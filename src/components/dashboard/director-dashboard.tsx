'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { 
  Calendar, Clock, Users, Plus, Bell, Settings, ChevronDown, ChevronUp,
  MapPin, User, Music, MessageCircle, ExternalLink, BookOpen, Eye,
  Trash2, Edit, ArrowUpRight, UserPlus, Send, Share2, UserCheck, Mail, Activity,
  Gift as GiftIcon, CreditCard, Heart as HandHeart, LifeBuoy, Lightbulb, 
  MessageSquare, TrendingUp, ChevronLeft, ChevronRight
} from 'lucide-react'
import { OnboardingFlow } from './onboarding-flow'
import { CreateEventModal } from '@/components/events/create-event-modal'
import { EventDetailsModal } from '@/components/events/event-details-modal'
import InvitationModal from '@/components/musicians/invitation-modal'
import { SendMessageModal } from '@/components/messages/send-message-modal'
import { GeneratePublicLinkModal } from '@/components/events/generate-public-link-modal'
import { OpenEventsCard } from '@/components/events/open-events-card'
import ImportantDocsCard from './important-docs-card'
import { fetchWithCache, invalidateCache } from '@/lib/performance-cache'
import { formatEventTimeForDisplay } from '@/lib/timezone-utils'
import { Logo } from '@/components/ui/logo'
import { InviteModal } from '@/components/musicians/invite-modal'

interface User {
  id: string
  name: string
  email: string
  role: 'DIRECTOR' | 'ASSOCIATE_DIRECTOR' | 'MUSICIAN' | 'PASTOR' | 'ASSOCIATE_PASTOR'
  churchId: string
  churchName: string
  hasCompletedOnboarding?: boolean
  avatar?: string
}

interface DashboardData {
  userRole: string
  stats: {
    totalMusicians: number
    upcomingEvents: number
    pendingInvitations: number
  }
  upcomingEvents: any[]
  activities: Activity[]
  events: EventSnippet[]
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

interface Activity {
  id: string
  type: 'EVENT_CREATED' | 'MUSICIAN_INVITED' | 'MUSICIAN_SIGNED_UP' | 'MESSAGE_SENT'
  description: string
  createdAt: string
  metadata?: any
}

interface DirectorDashboardProps {
  user: User
}

export function DirectorDashboard({ user }: DirectorDashboardProps) {
  const { data: session } = useSession()
  const [showTour, setShowTour] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showCreateEventModal, setShowCreateEventModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showPublicLinkModal, setShowPublicLinkModal] = useState(false)

  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSeedModal, setShowSeedModal] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  
  // Dropdown states for new navigation
  const [showEventsDropdown, setShowEventsDropdown] = useState(false)
  const [showMusiciansDropdown, setShowMusiciansDropdown] = useState(false)
  const [showMessagesDropdown, setShowMessagesDropdown] = useState(false)

  // Fetch dashboard data using cached functions
  useEffect(() => {
    const loadData = async () => {
      try {
        const month = currentDate.getMonth() + 1 // JavaScript months are 0-indexed
        const year = currentDate.getFullYear()
        
        // Use Promise.all to fetch both data sets simultaneously with caching
        const [dashboardData, activitiesData] = await Promise.all([
          fetchWithCache(`/api/dashboard?month=${month}&year=${year}`),
          fetchWithCache('/api/activities')
        ])
        
        setDashboardData(dashboardData as DashboardData)
        setActivities(activitiesData as Activity[])
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setLoading(false)
        setActivitiesLoading(false)
      }
    }

    loadData()
  }, [currentDate])

  // Show tour and onboarding for new directors
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenDirectorTour')
    if (!hasSeenTour && (user.role === 'DIRECTOR' || user.role === 'PASTOR')) {
      setShowTour(true)
    }
  }, [user.role])

  // Check for onboarding on component mount (for users who have seen tour but not completed onboarding)
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenDirectorTour')
    if (hasSeenTour && (user.role === 'DIRECTOR' || user.role === 'PASTOR') && !user.hasCompletedOnboarding) {
      console.log('🎯 Triggering onboarding for user who has seen tour but not completed onboarding:', {
        hasSeenTour: !!hasSeenTour,
        role: user.role,
        hasCompletedOnboarding: user.hasCompletedOnboarding
      })
      setShowOnboarding(true)
    }
  }, [user.role, user.hasCompletedOnboarding])

  const completeTour = () => {
    localStorage.setItem('hasSeenDirectorTour', 'true')
    setShowTour(false)
    
    console.log('🎯 Tour completed, checking onboarding eligibility:', {
      role: user.role,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      shouldShowOnboarding: (user.role === 'DIRECTOR' || user.role === 'PASTOR') && !user.hasCompletedOnboarding
    })
    
    // Check if user needs onboarding (directors/pastors only)
    if ((user.role === 'DIRECTOR' || user.role === 'PASTOR') && !user.hasCompletedOnboarding) {
      setShowOnboarding(true)
    }
  }

  const completeOnboarding = () => {
    setShowOnboarding(false)
    // Refresh the page or update user data to reflect completion
    window.location.reload()
  }

  const refreshDashboardData = async (date?: Date) => {
    try {
      const targetDate = date || currentDate
      const month = targetDate.getMonth() + 1 // JavaScript months are 0-indexed
      const year = targetDate.getFullYear()
      
      // Invalidate cache first, then fetch fresh data
      if (session?.user?.id) {
        invalidateCache.dashboard(session.user.id)
        invalidateCache.activities(session.user.id)
      }
      
      const [dashboardData, activitiesData] = await Promise.all([
        fetchWithCache(`/api/dashboard?month=${month}&year=${year}`),
        fetchWithCache('/api/activities')
      ])
      
              setDashboardData(dashboardData as DashboardData)
        setActivities(activitiesData as Activity[])
    } catch (error) {
      console.error('Error refreshing dashboard data:', error)
    }
  }

  const handleInvitesSent = () => {
    // Refresh dashboard data to show updated pending invitation count
    refreshDashboardData()
  }

  const handleEventCreated = () => {
    // Refresh dashboard data to show new event
    refreshDashboardData()
  }

  const handleMessageSent = () => {
    // Refresh dashboard data to show updated communication history
    refreshDashboardData()
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Don't close if clicking on dropdown buttons or dropdown content
      if (target.closest('[data-dropdown]')) {
        return
      }
      
      setShowEventsDropdown(false)
      setShowMusiciansDropdown(false)
      setShowMessagesDropdown(false)
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Calendar helpers
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
    // Remove the immediate call to refreshDashboardData() - useEffect will handle it
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

  // Helper function to get activity icon and color
  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'EVENT_CREATED':
        return { icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-100' }
      case 'MUSICIAN_INVITED':
        return { icon: UserPlus, color: 'text-yellow-600', bgColor: 'bg-yellow-100' }
      case 'MUSICIAN_SIGNED_UP':
        return { icon: UserCheck, color: 'text-success-600', bgColor: 'bg-success-100' }
      case 'MESSAGE_SENT':
        return { icon: Mail, color: 'text-pink-600', bgColor: 'bg-pink-100' }
      default:
        return { icon: Activity, color: 'text-gray-600', bgColor: 'bg-gray-100' }
    }
  }

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) {
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`
    } else if (hours < 24) {
      return `${hours}h ago`
    } else {
      return `${days}d ago`
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
      {/* Tour Overlay */}
      {showTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl border">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Welcome to Church Music Pro!</h2>
            <p className="text-gray-700 mb-6 text-base">
              Let's get you started with creating your first event and inviting musicians to your church.
            </p>
            <button
              onClick={completeTour}
              className="w-full bg-[#660033] text-white py-3 px-4 rounded-lg hover:bg-[#550028] transition-colors font-medium"
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Onboarding Flow */}
      <OnboardingFlow 
        isVisible={showOnboarding}
        onComplete={completeOnboarding}
      />

      {/* Main Content - Grayed out when tour, onboarding, or modal is open */}
      <div className={showTour || showOnboarding || showCreateEventModal ? 'opacity-30 pointer-events-none' : ''}>
        {/* Top Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo and App Name */}
              <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
                <Logo />
              </Link>

              {/* Church Name and Actions */}
              <div className="flex items-center space-x-4">
                {/* Church Name */}
                <div className="hidden md:block">
                  <h2 className="text-lg font-medium text-gray-700">{user.churchName}</h2>
                </div>



                {/* Profile Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="h-8 w-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium">
                      {user.name.charAt(0)}
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-600" />
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-20">
                      <Link href="/rewards" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <GiftIcon className="h-4 w-4 inline mr-2" />
                        Rewards
                      </Link>
                      <Link href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <Settings className="h-4 w-4 inline mr-2" />
                        Settings
                      </Link>
                      <Link href="/billing" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <CreditCard className="h-4 w-4 inline mr-2" />
                        Billing
                      </Link>
                      {(user.role === 'DIRECTOR' || user.role === 'PASTOR') && (
                        <Link href="/transfer-ownership" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                          <HandHeart className="h-4 w-4 inline mr-2" />
                          Transfer Ownership
                        </Link>
                      )}
                                                              <Link href="/support" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <LifeBuoy className="h-4 w-4 inline mr-2" />
                        Support
                      </Link>
                      <Link href="/featurerequest" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <Lightbulb className="h-4 w-4 inline mr-2" />
                        Feature Request
                      </Link>
                      <button
                        onClick={() => signOut()}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <main>
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Welcome back, {session?.user?.name}!</h1>
                  <p className="text-gray-600 mt-1">Here's what's happening at {session?.user?.churchName || 'your church'}</p>
                </div>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  {/* Events Navigation Button */}
                  <div className="relative" data-dropdown>
                    <div className="flex">
                      <Link 
                        href="/calendar"
                        className="flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-l-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                      >
                        <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Events</span>
                        <span className="sm:hidden">Events</span>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowMusiciansDropdown(false)
                          setShowMessagesDropdown(false)
                          setShowEventsDropdown(!showEventsDropdown)
                        }}
                        className="px-2 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    {showEventsDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-20">
                        <button
                          onClick={() => {
                            setShowCreateEventModal(true)
                            setShowEventsDropdown(false)
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Plus className="h-4 w-4 inline mr-2" />
                          Create Event
                        </button>
                        <button
                          onClick={() => {
                            setShowPublicLinkModal(true)
                            setShowEventsDropdown(false)
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <ExternalLink className="h-4 w-4 inline mr-2" />
                          Generate Public Link
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Musicians Navigation Button */}
                  <div className="relative" data-dropdown>
                    <div className="flex">
                      <Link 
                        href="/musicians"
                        className="flex items-center px-3 sm:px-4 py-2 bg-success-600 text-white rounded-l-lg hover:bg-success-700 transition-colors text-sm sm:text-base"
                      >
                        <Users className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Musicians</span>
                        <span className="sm:hidden">Musicians</span>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowEventsDropdown(false)
                          setShowMessagesDropdown(false)
                          setShowMusiciansDropdown(!showMusiciansDropdown)
                        }}
                        className="px-2 py-2 bg-success-600 text-white rounded-r-lg hover:bg-success-700 transition-colors"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    {showMusiciansDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-20">
                        <button
                          onClick={() => {
                            setShowInviteModal(true)
                            setShowMusiciansDropdown(false)
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <UserPlus className="h-4 w-4 inline mr-2" />
                          Invite Musician
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Messages Navigation Button */}
                  <div className="relative" data-dropdown>
                    <div className="flex">
                      <Link 
                        href="/messages"
                        className="flex items-center px-3 sm:px-4 py-2 bg-secondary-600 text-white rounded-l-lg hover:bg-secondary-700 transition-colors text-sm sm:text-base"
                      >
                        <MessageSquare className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Messages</span>
                        <span className="sm:hidden">Messages</span>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowEventsDropdown(false)
                          setShowMusiciansDropdown(false)
                          setShowMessagesDropdown(!showMessagesDropdown)
                        }}
                        className="px-2 py-2 bg-secondary-600 text-white rounded-r-lg hover:bg-secondary-700 transition-colors"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    {showMessagesDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-20">
                        <button
                          onClick={() => {
                            setShowMessageModal(true)
                            setShowMessagesDropdown(false)
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Mail className="h-4 w-4 inline mr-2" />
                          Send Message
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Development seed button - only show in development */}
                  {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                    <>
                      <button 
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/dev/seed', { method: 'POST' })
                            if (response.ok) {
                              alert('Sample data created! Refresh to see the changes.')
                              refreshDashboardData()
                            }
                          } catch (error) {
                            alert('Error creating sample data')
                          }
                        }}
                        className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        🛠️ Add Sample Data
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/dev/seed-activities', { method: 'POST' })
                            if (response.ok) {
                              alert('Sample activities created!')
                              refreshDashboardData()
                            }
                          } catch (error) {
                            alert('Error creating sample activities')
                          }
                        }}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        📊 Add Sample Activities
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-6 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Musicians</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {dashboardData.stats.totalMusicians}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-success-100 rounded-lg flex items-center justify-center">
                      <Users className="h-6 w-6 text-success-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <UserCheck className="h-4 w-4 text-blue-500 mr-1" />
                    <span className="text-blue-600 font-medium">
                      {(dashboardData.stats.totalMusicians === 0) 
                        ? 'Start by inviting musicians' 
                        : 'Active musicians'
                      }
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Upcoming Events</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {dashboardData.stats.upcomingEvents}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <TrendingUp className="h-4 w-4 text-success-500 mr-1" />
                    <span className="text-success-600 font-medium">
                      {(dashboardData.stats.upcomingEvents === 0) 
                        ? 'Ready to create your first event' 
                        : 'Events scheduled'
                      }
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Invitations</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {dashboardData.stats.pendingInvitations}
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Mail className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <Clock className="h-4 w-4 text-gray-500 mr-1" />
                    <span className="text-gray-600">
                      {(dashboardData.stats.pendingInvitations === 0) 
                        ? 'No pending invites' 
                        : 'Awaiting responses'
                      }
                    </span>
                  </div>
                </div>

              </div>

              {/* Calendar & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Monthly Calendar */}
                <div className="bg-white rounded-xl shadow-sm p-6 border">
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
                          onClick={() => day && setShowCreateEventModal(true)}
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

                  <div className="mt-4 text-center">
                    <button 
                      onClick={() => setShowCreateEventModal(true)}
                      className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Event
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
                    <Link 
                      href="/activity"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View All →
                    </Link>
                  </div>
                  
                  <div className="flex-1 min-h-0 p-6">
                    <div className="h-full max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      {activitiesLoading ? (
                        <div className="flex items-center justify-center h-40">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                        </div>
                      ) : activities.length > 0 ? (
                        <div className="space-y-3 pr-2">
                          {activities.filter(activity => {
                            const activityDate = new Date(activity.createdAt);
                            const thirtyDaysAgo = new Date();
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            return activityDate >= thirtyDaysAgo;
                          }).map((activity) => {
                            const { icon: Icon, color, bgColor } = getActivityIcon(activity.type)
                            return (
                              <div key={activity.id} className="flex items-start p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                                <div className={`flex-shrink-0 w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center`}>
                                  <Icon className={`h-5 w-5 ${color}`} />
                                </div>
                                <div className="ml-3 flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 leading-5">
                                    {activity.description}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatRelativeTime(activity.createdAt)}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-center">
                          <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Activity</h3>
                          <p className="text-gray-600 text-sm">
                            Activity will appear here as you create events, invite musicians, and send messages.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>


            </div>
          </main>
        </div>
      </div>

      {/* Modals */}
      <CreateEventModal 
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        onEventCreated={handleEventCreated}
      />

      <InviteModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvitesSent={handleInvitesSent}
      />

      <SendMessageModal 
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        onMessageSent={handleMessageSent}
      />

      <EventDetailsModal
        isOpen={showEventDetails}
        onClose={() => {
          setShowEventDetails(false)
          setSelectedEvent(null)
        }}
        event={selectedEvent}
        onEventUpdated={() => {
          // Just refresh the data, don't close the modal so user can continue editing
          refreshDashboardData()
        }}
        onEventDeleted={() => {
          refreshDashboardData()
          setShowEventDetails(false)
          setSelectedEvent(null)
        }}
      />

      <GeneratePublicLinkModal
        isOpen={showPublicLinkModal}
        onClose={() => setShowPublicLinkModal(false)}
      />
    </div>
  )
} 