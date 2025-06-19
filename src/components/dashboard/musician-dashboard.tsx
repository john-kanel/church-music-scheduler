'use client'

import { signOut } from 'next-auth/react'
import { 
  Music, 
  Calendar, 
  FileText, 
  Bell,
  LogOut,
  ChevronDown,
  Home,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useState } from 'react'

interface User {
  id: string
  email: string
  name: string
  role: string
  parishId: string
  parishName: string
}

interface MusicianDashboardProps {
  user: User
}

export function MusicianDashboard({ user }: MusicianDashboardProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                    <a href="/profile" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <Home className="h-4 w-4 mr-2" />
                      Profile
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {user.name.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 mt-2">
            Here are your upcoming assignments and available opportunities
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar & My Assignments */}
          <div className="lg:col-span-2 space-y-8">
            {/* Calendar Widget */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">My Calendar</h2>
              
              {/* Mini Calendar - This would be replaced with a real calendar component */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-center text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-2" />
                  <p>Calendar integration coming soon</p>
                  <p className="text-sm">View and manage your assignments</p>
                </div>
              </div>

              <div className="flex space-x-4">
                <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                  View Full Calendar
                </button>
                <button className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors">
                  Export Calendar
                </button>
              </div>
            </div>

            {/* My Assignments */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">My Assignments</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900">Sunday Mass - Vocalist</h3>
                      <p className="text-sm text-gray-600">This Sunday, 10:00 AM</p>
                      <p className="text-xs text-green-600">Confirmed</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-700 text-sm">
                      <FileText className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center">
                    <Clock className="h-6 w-6 text-yellow-600 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900">Christmas Eve Mass - Accompanist</h3>
                      <p className="text-sm text-gray-600">Dec 24, 6:00 PM</p>
                      <p className="text-xs text-yellow-600">Pending Response</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                      Accept
                    </button>
                    <button className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                      Decline
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center">
                    <CheckCircle className="h-6 w-6 text-blue-600 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900">Wedding Ceremony - Vocalist</h3>
                      <p className="text-sm text-gray-600">Jan 15, 2:00 PM</p>
                      <p className="text-xs text-blue-600">Confirmed</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-700 text-sm">
                      <FileText className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <a href="/my-assignments" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View all assignments →
                </a>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Available Events */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Events</h2>
              <p className="text-sm text-gray-600 mb-4">Events looking for musicians</p>
              
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">New Year's Day Mass</h3>
                      <p className="text-xs text-gray-600">Jan 1, 11:00 AM</p>
                      <p className="text-xs text-orange-600 font-medium">Need: Accompanist</p>
                    </div>
                    <AlertCircle className="h-4 w-4 text-orange-600 mt-1" />
                  </div>
                  <button className="w-full mt-2 bg-blue-600 text-white py-1 px-3 rounded text-xs hover:bg-blue-700">
                    Sign Up
                  </button>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">Ash Wednesday Service</h3>
                      <p className="text-xs text-gray-600">Feb 14, 7:00 PM</p>
                      <p className="text-xs text-purple-600 font-medium">Need: Vocalist</p>
                    </div>
                    <AlertCircle className="h-4 w-4 text-purple-600 mt-1" />
                  </div>
                  <button className="w-full mt-2 bg-blue-600 text-white py-1 px-3 rounded text-xs hover:bg-blue-700">
                    Sign Up
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <a href="/available-events" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View all opportunities →
                </a>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">My Stats</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="text-lg font-bold text-blue-600">3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Events</span>
                  <span className="text-lg font-bold text-green-600">28</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending</span>
                  <span className="text-lg font-bold text-yellow-600">1</span>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Notifications</h2>
              
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-900">New event assignment</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-900">Music files updated for Sunday Mass</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
                
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-900">Reminder: Rehearsal tomorrow</p>
                  <p className="text-xs text-gray-500">2 days ago</p>
                </div>
              </div>

              <div className="mt-4">
                <a href="/notifications" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View all notifications →
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 