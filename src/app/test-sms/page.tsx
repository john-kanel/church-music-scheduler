'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface SMSStatus {
  available: boolean
  configured: boolean
  message: string
  balance?: {
    amount: number
    currency: string
  }
  balanceError?: string
  requiredEnvVars?: string[]
  optionalEnvVars?: string[]
}

export default function TestSMSPage() {
  const { data: session, status } = useSession()
  const [smsStatus, setSmsStatus] = useState<SMSStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testLoading, setTestLoading] = useState(false)
  const [testResults, setTestResults] = useState<any[]>([])
  const [testForm, setTestForm] = useState({
    to: '',
    message: 'This is a test message from Church Music Pro! 🎵'
  })

  // Redirect if not authenticated or not authorized
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirect('/login')
    }
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      redirect('/dashboard')
    }
  }, [session, status])

  // Check SMS status on mount
  useEffect(() => {
    checkSMSStatus()
  }, [])

  const checkSMSStatus = async () => {
    try {
      const response = await fetch('/api/test-sms')
      const data = await response.json()
      setSmsStatus(data)
    } catch (error) {
      console.error('Failed to check SMS status:', error)
      setSmsStatus({
        available: false,
        configured: false,
        message: 'Failed to check SMS status'
      })
    } finally {
      setLoading(false)
    }
  }

  const sendTestSMS = async (e: React.FormEvent) => {
    e.preventDefault()
    setTestLoading(true)

    try {
      const response = await fetch('/api/test-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testForm)
      })

      const result = await response.json()
      
      setTestResults(prev => [{
        timestamp: new Date().toISOString(),
        ...result,
        status: response.ok ? 'success' : 'error'
      }, ...prev])

      if (response.ok) {
        setTestForm({ ...testForm, to: '' })
      }
    } catch (error) {
      setTestResults(prev => [{
        timestamp: new Date().toISOString(),
        error: 'Network error',
        status: 'error'
      }, ...prev])
    } finally {
      setTestLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SMS test interface...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">SMS Testing Interface</h1>
          
          {/* SMS Status */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">SMS Service Status</h2>
            <div className={`p-4 rounded-lg ${
              smsStatus?.available && smsStatus?.configured
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center mb-2">
                <span className={`inline-block w-3 h-3 rounded-full mr-3 ${
                  smsStatus?.available && smsStatus?.configured ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className="font-medium">{smsStatus?.message}</span>
              </div>
              
              {smsStatus?.balance && (
                <p className="text-sm text-gray-600 mt-2">
                  Account Balance: {smsStatus.balance.amount} {smsStatus.balance.currency}
                </p>
              )}
              
              {smsStatus?.balanceError && (
                <p className="text-sm text-red-600 mt-2">
                  Balance Check Error: {smsStatus.balanceError}
                </p>
              )}
              
              {!smsStatus?.configured && smsStatus?.requiredEnvVars && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700">Required Environment Variables:</p>
                  <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                    {smsStatus.requiredEnvVars.map(envVar => (
                      <li key={envVar}><code className="bg-gray-100 px-1 rounded">{envVar}</code></li>
                    ))}
                  </ul>
                  {smsStatus.optionalEnvVars && (
                    <>
                      <p className="text-sm font-medium text-gray-700 mt-2">Optional Environment Variables:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                        {smsStatus.optionalEnvVars.map(envVar => (
                          <li key={envVar}><code className="bg-gray-100 px-1 rounded">{envVar}</code></li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Test Form */}
          {smsStatus?.available && smsStatus?.configured && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Test SMS</h2>
              <form onSubmit={sendTestSMS} className="space-y-4">
                <div>
                  <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="to"
                    value={testForm.to}
                    onChange={(e) => setTestForm({ ...testForm, to: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use full international format: +1 for US numbers
                  </p>
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={testForm.message}
                    onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    maxLength={160}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {testForm.message.length}/160 characters
                  </p>
                </div>
                
                <button
                  type="submit"
                  disabled={testLoading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                >
                  {testLoading ? 'Sending...' : 'Send Test SMS'}
                </button>
              </form>
            </div>
          )}

          {/* Test Results */}
          {testResults.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h2>
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-medium ${
                        result.status === 'success' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {result.status === 'success' ? '✅ Success' : '❌ Failed'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(result.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    {result.success && (
                      <div className="text-sm text-gray-700">
                        <p><strong>To:</strong> {result.to}</p>
                        <p><strong>Message ID:</strong> {result.messageId}</p>
                        <p><strong>Text:</strong> {result.text}</p>
                      </div>
                    )}
                    
                    {result.error && (
                      <div className="text-sm text-red-700">
                        <p><strong>Error:</strong> {result.error}</p>
                        {result.details && <p><strong>Details:</strong> {result.details}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <button
                onClick={() => setTestResults([])}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700"
              >
                Clear Results
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}