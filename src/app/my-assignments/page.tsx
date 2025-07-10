'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, Calendar, Clock, MapPin, User, CheckCircle, AlertCircle, 
  Search, Filter, ChevronDown, X 
} from 'lucide-react'
import Link from 'next/link'

interface Assignment {
  id: string
  roleName: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  assignedAt: string
  respondedAt?: string
  event: {
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
  }
}

export default function MyAssignmentsPage() {
  const { data: session } = useSession()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all')

  // Fetch assignments
  useEffect(() => {
    if (session?.user?.id) {
      fetchAssignments()
    }
  }, [session])

  // Filter assignments when search term or filters change
  useEffect(() => {
    let filtered = assignments

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(assignment => 
        assignment.event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.event.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.roleName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(assignment => assignment.status === selectedStatus)
    }

    // Filter by timeframe
    if (selectedTimeframe !== 'all') {
      const now = new Date()
      if (selectedTimeframe === 'upcoming') {
        filtered = filtered.filter(assignment => new Date(assignment.event.startTime) >= now)
      } else if (selectedTimeframe === 'past') {
        filtered = filtered.filter(assignment => new Date(assignment.event.startTime) < now)
      }
    }

    // Sort by event date (upcoming first, then past)
    filtered.sort((a, b) => {
      const dateA = new Date(a.event.startTime)
      const dateB = new Date(b.event.startTime)
      const now = new Date()
      
      // If both are upcoming or both are past, sort by date
      if ((dateA >= now && dateB >= now) || (dateA < now && dateB < now)) {
        return dateA.getTime() - dateB.getTime()
      }
      
      // Upcoming events come first
      return dateA >= now ? -1 : 1
    })

    setFilteredAssignments(filtered)
  }, [assignments, searchTerm, selectedStatus, selectedTimeframe])

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/assignments/my-assignments')
      if (response.ok) {
        const data = await response.json()
        setAssignments(data.assignments || [])
      } else {
        console.error('Failed to fetch assignments')
      }
    } catch (error) {
      console.error('Error fetching assignments:', error)
    } finally {
      setLoading(false)
    }
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
        fetchAssignments() // Refresh assignments list
      } else {
        console.error('Failed to update assignment')
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
    }
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'DECLINED':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircle className="h-4 w-4" />
      case 'DECLINED':
        return <X className="h-4 w-4" />
      case 'PENDING':
        return <AlertCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const isPastEvent = (eventDate: string) => {
    return new Date(eventDate) < new Date()
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view your assignments</h1>
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

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
                <User className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
                  <p className="text-gray-600">All your event assignments</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="DECLINED">Declined</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Timeframe Filter */}
            <div className="relative">
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Assignments List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments Found</h3>
            <p className="text-gray-600">
              {assignments.length === 0 
                ? "You don't have any assignments yet."
                : "No assignments match your search criteria."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all p-6 ${
                  isPastEvent(assignment.event.startTime) ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Event Type Indicator */}
                    <div className="flex items-center mb-3">
                      <div
                        className="w-4 h-4 rounded-full mr-3"
                        style={{ backgroundColor: assignment.event.eventType.color }}
                      />
                      <span className="text-sm text-gray-600">{assignment.event.eventType.name}</span>
                      {isPastEvent(assignment.event.startTime) && (
                        <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          Past Event
                        </span>
                      )}
                    </div>

                    {/* Event Title and Role */}
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{assignment.event.name}</h3>
                      <p className="text-sm text-blue-600 font-medium">Role: {assignment.roleName}</p>
                    </div>

                    {/* Date and Time */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span className="text-sm">{formatEventDate(assignment.event.startTime)}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        <span className="text-sm">
                          {formatEventTime(assignment.event.startTime)}
                          {assignment.event.endTime && ` - ${formatEventTime(assignment.event.endTime)}`}
                        </span>
                      </div>
                      {assignment.event.location && (
                        <div className="flex items-center text-gray-600">
                          <MapPin className="h-4 w-4 mr-2" />
                          <span className="text-sm">{assignment.event.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {assignment.event.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {assignment.event.description}
                      </p>
                    )}
                  </div>

                  {/* Status and Actions */}
                  <div className="flex flex-col items-end space-y-3">
                    {/* Status Badge */}
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(assignment.status)}`}>
                      {getStatusIcon(assignment.status)}
                      <span className="ml-1">
                        {assignment.status === 'PENDING' ? 'Pending Response' : assignment.status}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    {!isPastEvent(assignment.event.startTime) && (
                      <div className="flex space-x-2">
                        {assignment.status === 'PENDING' ? (
                          <>
                            <button 
                              onClick={() => handleAssignmentAction(assignment.id, 'accept')}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleAssignmentAction(assignment.id, 'decline')}
                              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                            >
                              Decline
                            </button>
                          </>
                        ) : assignment.status === 'ACCEPTED' ? (
                          <button 
                            onClick={() => handleAssignmentAction(assignment.id, 'decline')}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                          >
                            Remove
                          </button>
                        ) : assignment.status === 'DECLINED' ? (
                          <button 
                            onClick={() => handleAssignmentAction(assignment.id, 'accept')}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                          >
                            Accept
                          </button>
                        ) : null}
                      </div>
                    )}

                    {/* Response Time */}
                    {assignment.respondedAt && (
                      <p className="text-xs text-gray-500">
                        Responded {new Date(assignment.respondedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 