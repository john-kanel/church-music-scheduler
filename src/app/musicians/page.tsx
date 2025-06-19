'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Users, Plus, Search, Filter, Mail, UserPlus, Music } from 'lucide-react'
import Link from 'next/link'
import { InviteModal } from '../../components/musicians/invite-modal'

export default function MusiciansPage() {
  const { data: session } = useSession()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view musicians</h1>
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
                <Users className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Musicians</h1>
                  <p className="text-sm text-gray-600">{session.user?.parishName || 'Your Parish'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setShowInviteModal(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Musicians
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
                  placeholder="Search musicians..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="h-4 w-4 mr-2" />
                Filter by Role
              </button>
              <button 
                onClick={() => setShowInviteModal(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Musicians
              </button>
            </div>
          </div>
        </div>

        {/* Musicians List */}
        <div className="bg-white rounded-xl shadow-sm border">
          {/* Musicians Header */}
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Parish Musicians</h2>
          </div>

          {/* Empty State */}
          <div className="p-8 text-center">
            <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No Musicians Added Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start building your music ministry by inviting musicians to join your parish. You can add accompanists, vocalists, and other musicians.
            </p>
            <button 
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Invite Your First Musicians
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => setShowInviteModal(true)}
            className="bg-white rounded-xl shadow-sm border p-6 hover:border-green-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center mb-4">
              <UserPlus className="h-8 w-8 text-green-600 mr-3" />
              <h3 className="font-medium text-gray-900">Individual Invite</h3>
            </div>
            <p className="text-sm text-gray-600">Send a personal invitation to a specific musician</p>
          </button>

          <button 
            onClick={() => setShowInviteModal(true)}
            className="bg-white rounded-xl shadow-sm border p-6 hover:border-blue-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center mb-4">
              <Users className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="font-medium text-gray-900">Bulk Invites</h3>
            </div>
            <p className="text-sm text-gray-600">Import multiple musicians from a list or spreadsheet</p>
          </button>

          <Link 
            href="/groups"
            className="bg-white rounded-xl shadow-sm border p-6 hover:border-purple-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center mb-4">
              <Music className="h-8 w-8 text-purple-600 mr-3" />
              <h3 className="font-medium text-gray-900">Create Groups</h3>
            </div>
            <p className="text-sm text-gray-600">Organize musicians into choirs or ensembles</p>
          </Link>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvitesSent={() => {
          console.log('Invites sent - refresh musicians list')
        }}
      />
    </div>
  )
} 