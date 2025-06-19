'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { 
  Music, 
  Calendar, 
  Users, 
  Settings, 
  Plus, 
  Bell,
  LogOut,
  ChevronDown,
  Home,
  UserPlus,
  MessageSquare,
  CreditCard,
  BarChart3
} from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  role: string
  parishId: string
  parishName: string
}

interface DirectorDashboardProps {
  user: User
}

export function DirectorDashboard({ user }: DirectorDashboardProps) {
  const [showTour, setShowTour] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // Show tour for new directors
  useEffect(() => {
    const hasSeenTour = localStorage.getItem(`tour-seen-${user.id}`)
    if (!hasSeenTour) {
      setShowTour(true)
    }
  }, [user.id])

  const completeTour = () => {
    localStorage.setItem(`tour-seen-${user.id}`, 'true')
    setShowTour(false)
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tour Modal */}
      {showTour && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <Music className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Welcome to Church Music Scheduler!
              </h2>
              <p className="text-gray-600 mb-6">
                Let's get you started with organizing your music ministry. Here's what you can do:
              </p>
              <div className="space-y-3 text-left mb-6">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-gray-700">Create and manage events</span>
                </div>
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-gray-700">Invite and organize musicians</span>
                </div>
                <div className="flex items-center">
                  <Music className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-gray-700">Share music files</span>
                </div>
                <div className="flex items-center">
                  <MessageSquare className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-gray-700">Send notifications to your team</span>
                </div>
              </div>
              <button
                onClick={completeTour}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Music className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                {user.parishName}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-gray-400 hover:text-gray-600">
                <Bell className="h-6 w-6" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>

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
                    <a href="/settings" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </a>
                    <a href="/billing" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Billing
                    </a>
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

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm h-screen sticky top-0">
          <nav className="mt-8">
            <div className="px-4">
              <a
                href="/dashboard"
                className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg"
              >
                <Home className="h-5 w-5 mr-3" />
                Dashboard
              </a>
            </div>

            <div className="mt-6 px-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Scheduling
              </h3>
              <div className="mt-2 space-y-1">
                <a
                  href="/calendar"
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <Calendar className="h-5 w-5 mr-3" />
                  Calendar
                </a>
                <a
                  href="/events"
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <Music className="h-5 w-5 mr-3" />
                  Events
                </a>
              </div>
            </div>

            <div className="mt-6 px-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                People
              </h3>
              <div className="mt-2 space-y-1">
                <a
                  href="/musicians"
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <Users className="h-5 w-5 mr-3" />
                  Musicians
                </a>
                <a
                  href="/groups"
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <Users className="h-5 w-5 mr-3" />
                  Groups
                </a>
                <a
                  href="/invitations"
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <UserPlus className="h-5 w-5 mr-3" />
                  Invitations
                </a>
              </div>
            </div>

            <div className="mt-6 px-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Communication
              </h3>
              <div className="mt-2 space-y-1">
                <a
                  href="/messages"
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <MessageSquare className="h-5 w-5 mr-3" />
                  Messages
                </a>
              </div>
            </div>

            <div className="mt-6 px-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Analytics
              </h3>
              <div className="mt-2 space-y-1">
                <a
                  href="/reports"
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <BarChart3 className="h-5 w-5 mr-3" />
                  Reports
                </a>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user.name.split(' ')[0]}!
              </h1>
              <p className="text-gray-600 mt-2">
                Here's what's happening with your music ministry
              </p>
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
              <div className="flex space-x-4">
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </button>
                <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Musicians
                </button>
                <button className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">This Month</p>
                    <p className="text-2xl font-bold text-gray-900">12</p>
                    <p className="text-xs text-gray-500">Events</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Active</p>
                    <p className="text-2xl font-bold text-gray-900">24</p>
                    <p className="text-xs text-gray-500">Musicians</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <UserPlus className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-gray-900">3</p>
                    <p className="text-xs text-gray-500">Invitations</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Music className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Upcoming</p>
                    <p className="text-2xl font-bold text-gray-900">5</p>
                    <p className="text-xs text-gray-500">This Week</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity & Upcoming Events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upcoming Events */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Sunday Mass</h3>
                      <p className="text-sm text-gray-600">This Sunday, 10:00 AM</p>
                      <p className="text-xs text-blue-600">5 musicians assigned</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Ready
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Christmas Eve Mass</h3>
                      <p className="text-sm text-gray-600">Dec 24, 6:00 PM</p>
                      <p className="text-xs text-yellow-600">2 more musicians needed</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Needs Attention
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <a href="/calendar" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View all events →
                  </a>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <p className="text-sm text-gray-900">Sarah Johnson accepted assignment for Sunday Mass</p>
                      <p className="text-xs text-gray-500">2 hours ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <p className="text-sm text-gray-900">New event "Christmas Eve Mass" created</p>
                      <p className="text-xs text-gray-500">1 day ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                    <div>
                      <p className="text-sm text-gray-900">Invitation sent to mike@email.com</p>
                      <p className="text-xs text-gray-500">2 days ago</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <a href="/activity" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View all activity →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
} 