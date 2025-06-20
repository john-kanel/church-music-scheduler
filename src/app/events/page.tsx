'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function EventsPage() {
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    // Redirect to calendar page after a short delay
    const timer = setTimeout(() => {
      router.push('/calendar')
    }, 2000)

    return () => clearTimeout(timer)
  }, [router])

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view events</h1>
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-4 text-center">
        <div className="mb-6">
          <Calendar className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Events Page Upgraded!</h1>
          <p className="text-gray-600">
            We've enhanced the events experience with templates, drag-and-drop calendar, and better organization.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4 text-left">
            <h3 className="font-medium text-blue-900 mb-2">✨ What's New:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Event templates for quick creation</li>
              <li>• Drag-and-drop calendar interface</li>
              <li>• Enhanced event management</li>
              <li>• List and calendar views</li>
            </ul>
          </div>
          
          <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
            <span>Redirecting to new calendar in</span>
            <div className="ml-2 animate-pulse">2 seconds...</div>
          </div>
          
          <Link 
            href="/calendar"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full justify-center"
          >
            Go to Calendar Now
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
          
          <Link 
            href="/dashboard"
            className="inline-flex items-center px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors w-full justify-center text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
} 