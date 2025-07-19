'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, MessageSquare, Plus, Search, Filter, Mail, Send, Phone, Eye, X } from 'lucide-react'
import Link from 'next/link'
import { SendMessageModal } from '../../components/messages/send-message-modal'

interface Message {
  id: string
  subject: string
  content: string
  type: string
  sender: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  recipientCount: number
  recipients: string[]
  sentAt: string | null
  scheduledFor: string | null
  isScheduled: boolean
  status: 'sent' | 'scheduled' | 'draft'
}

export default function MessagesPage() {
  const { data: session } = useSession()
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [showMessageDetails, setShowMessageDetails] = useState(false)
  const [automationSettings, setAutomationSettings] = useState<any>(null)

  // Check if user can send messages
  const canSendMessages = (() => {
    if (!session?.user?.role) return false
    
    // Directors and pastors can always send messages
    if (['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)) {
      return true
    }
    
    // Musicians can send messages only if the setting is enabled
    if (session.user.role === 'MUSICIAN') {
      return automationSettings?.allowMusiciansToSendMessages === true
    }
    
    return false
  })()

  // Fetch messages
  const fetchMessages = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/messages')
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      } else {
        console.error('Failed to fetch messages')
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch automation settings to check musician messaging permissions
  const fetchAutomationSettings = async () => {
    try {
      const response = await fetch('/api/automation-settings')
      if (response.ok) {
        const data = await response.json()
        setAutomationSettings(data)
      }
    } catch (error) {
      console.error('Error fetching automation settings:', error)
    }
  }

  // Load messages and settings when component mounts
  useEffect(() => {
    if (session?.user) {
      fetchMessages()
      fetchAutomationSettings()
    }
  }, [session])

  // Handle viewing message details
  const handleViewMessage = (message: Message) => {
    setSelectedMessage(message)
    setShowMessageDetails(true)
  }

  // Filter messages based on search term
  const filteredMessages = messages.filter(message =>
    message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${message.sender.firstName} ${message.sender.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view messages</h1>
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
                <MessageSquare className="h-8 w-8 text-secondary-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                  <p className="text-sm text-gray-600">{session.user?.churchName || 'Your Church'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </button>
              <button 
                onClick={() => setShowMessageModal(true)}
                className="flex items-center px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </button>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="bg-white rounded-xl shadow-sm border">
          {/* Messages Header */}
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Message History</h2>
            <p className="text-sm text-gray-600 mt-1">
              {loading ? 'Loading...' : `${filteredMessages.length} message${filteredMessages.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Messages Content */}
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading messages...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            messages.length === 0 ? (
              /* Empty State - No messages at all */
              <div className="p-8 text-center">
                <MessageSquare className="h-16 w-16 mx-auto text-secondary-600 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No Messages Sent Yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Start communicating with your music ministry. Send emails, SMS messages, or both to keep everyone informed about events and updates.
                </p>
                <button 
                  onClick={() => setShowMessageModal(true)}
                  className="inline-flex items-center px-6 py-3 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
                >
                  <Send className="h-5 w-5 mr-2" />
                  Send Your First Message
                </button>
              </div>
            ) : (
              /* No search results */
              <div className="p-8 text-center">
                <Search className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No messages found</h3>
                <p className="text-gray-600">Try adjusting your search terms.</p>
              </div>
            )
          ) : (
            /* Messages List */
            <div className="divide-y divide-gray-200">
              {filteredMessages.map((message) => (
                <div 
                  key={message.id}
                  onClick={() => handleViewMessage(message)}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center mb-2">
                        <Mail className="h-4 w-4 text-blue-600 mr-2" />
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {message.subject || 'SMS Message'}
                        </h3>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          message.status === 'sent' 
                            ? 'bg-green-100 text-green-800' 
                            : message.status === 'scheduled'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {message.status === 'sent' ? 'Sent' : message.status === 'scheduled' ? 'Scheduled' : 'Draft'}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <span>Sent by {message.sender.firstName} {message.sender.lastName}</span>
                        <span className="mx-2">•</span>
                        <span>{message.recipientCount} recipient{message.recipientCount !== 1 ? 's' : ''}</span>
                        <span className="mx-2">•</span>
                        <span>
                          {message.status === 'scheduled' && message.scheduledFor
                            ? `Scheduled for ${new Date(message.scheduledFor).toLocaleDateString()} at ${new Date(message.scheduledFor).toLocaleTimeString()}`
                            : message.sentAt
                            ? `${new Date(message.sentAt).toLocaleDateString()} at ${new Date(message.sentAt).toLocaleTimeString()}`
                            : 'Draft'
                          }
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {message.content}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {canSendMessages && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => setShowMessageModal(true)}
              className="bg-white rounded-xl shadow-sm border p-6 hover:border-blue-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center mb-4">
                <Mail className="h-8 w-8 text-blue-600 mr-3" />
                <h3 className="font-medium text-gray-900">Email Message</h3>
              </div>
              <p className="text-sm text-gray-600">Send detailed emails to musicians and members</p>
            </button>

            <button 
              onClick={() => setShowMessageModal(true)}
              className="bg-white rounded-xl shadow-sm border p-6 hover:border-success-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center mb-4">
                <Phone className="h-8 w-8 text-success-600 mr-3" />
                <h3 className="font-medium text-gray-900">SMS Alert</h3>
              </div>
              <p className="text-sm text-gray-600">Send quick text messages for urgent updates</p>
            </button>

            <button 
              onClick={() => setShowMessageModal(true)}
              className="bg-white rounded-xl shadow-sm border p-6 hover:border-secondary-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center mb-4">
                <Send className="h-8 w-8 text-secondary-600 mr-3" />
                <h3 className="font-medium text-gray-900">Broadcast</h3>
              </div>
              <p className="text-sm text-gray-600">Send to everyone via email and SMS</p>
            </button>
          </div>
        )}
      </div>

      {/* Send Message Modal */}
      <SendMessageModal 
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        onMessageSent={() => {
          fetchMessages() // Refresh the message list
        }}
      />

      {/* Message Details Modal */}
      {showMessageDetails && selectedMessage && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Message Details</h2>
              <button
                onClick={() => setShowMessageDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-gray-900"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Message Header */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedMessage.subject || 'SMS Message'}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedMessage.status === 'sent' 
                      ? 'bg-green-100 text-green-800' 
                      : selectedMessage.status === 'scheduled'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedMessage.status === 'sent' ? 'Sent' : selectedMessage.status === 'scheduled' ? 'Scheduled' : 'Draft'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Sent by:</span>
                    <div className="font-medium text-gray-900">
                      {selectedMessage.sender.firstName} {selectedMessage.sender.lastName}
                    </div>
                    <div className="text-gray-600">{selectedMessage.sender.email}</div>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">
                      {selectedMessage.status === 'scheduled' ? 'Scheduled for:' : 'Date sent:'}
                    </span>
                    <div className="font-medium text-gray-900">
                      {selectedMessage.status === 'scheduled' && selectedMessage.scheduledFor
                        ? new Date(selectedMessage.scheduledFor).toLocaleDateString()
                        : selectedMessage.sentAt
                        ? new Date(selectedMessage.sentAt).toLocaleDateString()
                        : 'Draft'
                      }
                    </div>
                    <div className="text-gray-600">
                      {selectedMessage.status === 'scheduled' && selectedMessage.scheduledFor
                        ? new Date(selectedMessage.scheduledFor).toLocaleTimeString()
                        : selectedMessage.sentAt
                        ? new Date(selectedMessage.sentAt).toLocaleTimeString()
                        : '-'
                      }
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Recipients:</span>
                    <div className="font-medium text-gray-900">
                      {selectedMessage.recipientCount} recipient{selectedMessage.recipientCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Method:</span>
                    <div className="font-medium text-gray-900">Email</div>
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Message Content</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="whitespace-pre-wrap text-gray-900">
                    {selectedMessage.content}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-6 border-t">
              <button
                onClick={() => setShowMessageDetails(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 
