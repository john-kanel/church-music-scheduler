'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, MessageSquare, Plus, Search, Filter, Mail, Send, Phone } from 'lucide-react'
import Link from 'next/link'
import { SendMessageModal } from '../../components/messages/send-message-modal'

export default function MessagesPage() {
  const { data: session } = useSession()
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

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
                <MessageSquare className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
                  <p className="text-sm text-gray-600">{session.user?.parishName || 'Your Parish'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setShowMessageModal(true)}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </button>
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
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
            <h2 className="text-xl font-bold text-gray-900">Communication Center</h2>
          </div>

          {/* Empty State */}
          <div className="p-8 text-center">
            <MessageSquare className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Messages Sent Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start communicating with your music ministry. Send emails, SMS messages, or both to keep everyone informed about events and updates.
            </p>
            <button 
              onClick={() => setShowMessageModal(true)}
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Send className="h-5 w-5 mr-2" />
              Send Your First Message
            </button>
          </div>
        </div>

        {/* Quick Actions */}
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
            className="bg-white rounded-xl shadow-sm border p-6 hover:border-green-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center mb-4">
              <Phone className="h-8 w-8 text-green-600 mr-3" />
              <h3 className="font-medium text-gray-900">SMS Alert</h3>
            </div>
            <p className="text-sm text-gray-600">Send quick text messages for urgent updates</p>
          </button>

          <button 
            onClick={() => setShowMessageModal(true)}
            className="bg-white rounded-xl shadow-sm border p-6 hover:border-purple-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center mb-4">
              <Send className="h-8 w-8 text-purple-600 mr-3" />
              <h3 className="font-medium text-gray-900">Broadcast</h3>
            </div>
            <p className="text-sm text-gray-600">Send to everyone via email and SMS</p>
          </button>
        </div>
      </div>

      {/* Send Message Modal */}
      <SendMessageModal 
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        onMessageSent={() => {
          console.log('Message sent - refresh messages list')
        }}
      />
    </div>
  )
} 