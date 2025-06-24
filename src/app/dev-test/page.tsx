'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export default function DevTestPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const testExpiry = async (action: string) => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/dev/test-expiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setMessage(`✅ ${data.message}`)
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            🧪 Subscription Test Panel
          </h1>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-yellow-800 font-medium">Development Only</span>
            </div>
            <p className="text-yellow-700 mt-1">
              This page only works in development mode to test subscription expiry scenarios.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Test Scenarios</h2>
              
              <div className="grid gap-3">
                <button
                  onClick={() => testExpiry('expire')}
                  disabled={loading}
                  className="flex items-center justify-center bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  {loading ? 'Processing...' : 'Set Subscription to Expired'}
                </button>

                <button
                  onClick={() => testExpiry('expire-soon')}
                  disabled={loading}
                  className="flex items-center justify-center bg-yellow-600 text-white px-4 py-3 rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                >
                  <Clock className="h-5 w-5 mr-2" />
                  {loading ? 'Processing...' : 'Set to Expire in 2 Days (Test Warning)'}
                </button>

                <button
                  onClick={() => testExpiry('restore')}
                  disabled={loading}
                  className="flex items-center justify-center bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {loading ? 'Processing...' : 'Restore to Active Trial (30 days)'}
                </button>
              </div>
            </div>

            {message && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Result:</h3>
                <p className="text-gray-700">{message}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Testing Instructions:</h3>
              <ol className="text-blue-800 text-sm space-y-1 list-decimal list-inside">
                <li>Click "Set Subscription to Expired" to test the middleware blocking</li>
                <li>Try to navigate to /dashboard or /events - you should be redirected to /trial-expired</li>
                <li>API calls should return 403 errors</li>
                <li>Click "Set to Expire in 2 Days" to test the warning banner</li>
                <li>Click "Restore to Active Trial" to restore normal access</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 