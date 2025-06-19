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
  AlertCircle,
  MapPin,
  X
} from 'lucide-react'
import { useState, useEffect } from 'react'

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
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard')
        if (response.ok) {
          const data = await response.json()
          setDashboardData(data)
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
  }, [])

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
        // Refresh dashboard data
        const dashboardResponse = await fetch('/api/dashboard')
        if (dashboardResponse.ok) {
          const data = await dashboardResponse.json()
          setDashboardData(data)
        }
      } else {
        console.error('Failed to update assignment')
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
    }
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
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse bg-gray-200 h-20 rounded"></div>
                    ))}
                  </div>
                ) : dashboardData?.upcomingAssignments?.length > 0 ? (
                  dashboardData.upcomingAssignments.map((assignment: any) => (
                    <div 
                      key={assignment.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        assignment.status === 'ACCEPTED' 
                          ? 'bg-green-50 border-green-200' 
                          : assignment.status === 'PENDING'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center">
                        {assignment.status === 'ACCEPTED' ? (
                          <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
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
                            {new Date(assignment.event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <div className="flex items-center mt-1">
                            <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                            <span className="text-xs text-gray-500">{assignment.event.location}</span>
                          </div>
                          <p className={`text-xs font-medium ${
                            assignment.status === 'ACCEPTED' 
                              ? 'text-green-600' 
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
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
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
                  <a href="/my-assignments" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View all assignments →
                  </a>
                </div>
              )}
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
                  <span className="text-sm text-gray-600">Upcoming Assignments</span>
                  <span className="text-lg font-bold text-blue-600">
                    {loading ? '...' : dashboardData?.stats?.upcomingAssignments || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accepted Total</span>
                  <span className="text-lg font-bold text-green-600">
                    {loading ? '...' : dashboardData?.stats?.acceptedAssignments || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending Responses</span>
                  <span className="text-lg font-bold text-yellow-600">
                    {loading ? '...' : dashboardData?.stats?.pendingResponses || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="text-lg font-bold text-purple-600">
                    {loading ? '...' : dashboardData?.stats?.thisMonthAssignments || 0}
                  </span>
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