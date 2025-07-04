'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  Calendar, 
  UserPlus, 
  UserCheck, 
  Mail, 
  Activity as ActivityIcon,
  ArrowLeft,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'

interface Activity {
  id: string
  type: 'EVENT_CREATED' | 'MUSICIAN_INVITED' | 'MUSICIAN_SIGNED_UP' | 'MESSAGE_SENT'
  description: string
  createdAt: string
  metadata?: any
}

export default function ActivityPage() {
  const { data: session } = useSession()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/activities')
        if (response.ok) {
          const data = await response.json()
          setActivities(data)
          // For now, show all activities at once as requested
          setTotalPages(1)
        } else {
          console.error('Failed to fetch activities')
        }
      } catch (error) {
        console.error('Error fetching activities:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [])

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
        return { icon: ActivityIcon, color: 'text-gray-600', bgColor: 'bg-gray-100' }
    }
  }

  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (days === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (days < 7) {
      return `${days} days ago at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Link 
              href="/dashboard"
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Feed</h1>
          <p className="text-gray-600 mt-2">
            All recent activity at {session?.user?.churchName || 'your church'}
          </p>
        </div>

        {/* Activity List */}
        <div className="bg-white rounded-xl shadow-sm border">
          {activities.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {activities.map((activity, index) => {
                const { icon: Icon, color, bgColor } = getActivityIcon(activity.type)
                return (
                  <div key={activity.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start">
                      <div className={`flex-shrink-0 w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
                        <Icon className={`h-6 w-6 ${color}`} />
                      </div>
                      <div className="ml-4 flex-1">
                        <p className="text-sm font-medium text-gray-900 leading-6">
                          {activity.description}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDate(activity.createdAt)}
                        </p>
                        {activity.metadata && (
                          <div className="mt-2 text-xs text-gray-400">
                            {activity.type === 'EVENT_CREATED' && activity.metadata.eventDate && (
                              <span>Event Date: {new Date(activity.metadata.eventDate).toLocaleDateString()}</span>
                            )}
                            {activity.type === 'MESSAGE_SENT' && activity.metadata.recipientCount && (
                              <span>Sent to {activity.metadata.recipientCount} recipient{activity.metadata.recipientCount !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <ActivityIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No Activity Yet</h3>
              <p className="text-gray-600 mb-6">
                Activity will appear here as you create events, invite musicians, and send messages.
              </p>
              <div className="flex justify-center space-x-4">
                <Link 
                  href="/events"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Create Event
                </Link>
                <Link 
                  href="/musicians"
                  className="inline-flex items-center px-4 py-2 bg-success-600 text-white text-sm rounded-lg hover:bg-success-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Musicians
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 