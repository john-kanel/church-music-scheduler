'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { GiftIcon, CopyIcon, CheckIcon, MailIcon, CalendarIcon, DollarSignIcon, ArrowLeft, Copy, Check, Send, Users, Plus, Upload, X, AlertCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface ReferralData {
  referralCode: string
  rewardsEarned: number
  rewardsSaved: number
  churchName: string
  referralHistory: Array<{
    id: string
    referredPersonName: string
    referredEmail: string
    status: 'PENDING' | 'COMPLETED' | 'EXPIRED'
    completedAt: string | null
    createdAt: string
  }>
}

interface BulkReferral {
  recipientName: string
  recipientEmail: string
}

export default function RewardsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailForm, setEmailForm] = useState({
    recipientName: '',
    recipientEmail: ''
  })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkReferrals, setBulkReferrals] = useState<BulkReferral[]>([{ recipientName: '', recipientEmail: '' }])
  const [bulkResults, setBulkResults] = useState<any>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
  }, [session, status, router])

  // Fetch referral data
  useEffect(() => {
    if (!session) return

    const fetchReferralData = async () => {
      try {
        const response = await fetch('/api/referrals')
        if (response.ok) {
          const data = await response.json()
          setReferralData(data)
        } else {
          console.error('Failed to fetch referral data')
        }
      } catch (error) {
        console.error('Error fetching referral data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReferralData()
  }, [session])

  const copyReferralCode = async () => {
    if (!referralData) return

    try {
      await navigator.clipboard.writeText(referralData.referralCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy referral code:', error)
    }
  }

  const sendReferralEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailForm.recipientName || !emailForm.recipientEmail) return

    setSendingEmail(true)
    try {
      const response = await fetch('/api/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientName: emailForm.recipientName,
          recipientEmail: emailForm.recipientEmail
        })
      })

      if (response.ok) {
        alert('Referral email sent successfully!')
        setEmailForm({ recipientName: '', recipientEmail: '' })
        setShowEmailForm(false)
        
        // Refresh referral data to show new referral in history
        const refreshResponse = await fetch('/api/referrals')
        if (refreshResponse.ok) {
          const data = await refreshResponse.json()
          setReferralData(data)
        }
      } else {
        const error = await response.json()
        alert(`Failed to send referral email: ${error.error}`)
      }
    } catch (error) {
      console.error('Error sending referral email:', error)
      alert('Failed to send referral email')
    } finally {
      setSendingEmail(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-success-600 bg-success-100'
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-100'
      case 'EXPIRED':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const addBulkReferral = () => {
    setBulkReferrals([...bulkReferrals, { recipientName: '', recipientEmail: '' }])
  }

  const removeBulkReferral = (index: number) => {
    if (bulkReferrals.length > 1) {
      setBulkReferrals(bulkReferrals.filter((_, i) => i !== index))
    }
  }

  const updateBulkReferral = (index: number, field: 'recipientName' | 'recipientEmail', value: string) => {
    const updated = [...bulkReferrals]
    updated[index][field] = value
    setBulkReferrals(updated)
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Filter out empty entries
    const validReferrals = bulkReferrals.filter(r => r.recipientName.trim() && r.recipientEmail.trim())
    
    if (validReferrals.length === 0) {
      alert('Please enter at least one complete referral (name and email)')
      return
    }

    setSendingEmail(true)
    setBulkResults(null)

    try {
      const response = await fetch('/api/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'bulk',
          referrals: validReferrals
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setBulkResults(data.results)
        // Reset form
        setBulkReferrals([{ recipientName: '', recipientEmail: '' }])
        // Refresh referral data to show new referral in history
        const refreshResponse = await fetch('/api/referrals')
        if (refreshResponse.ok) {
          const data = await refreshResponse.json()
          setReferralData(data)
        }
      } else {
        alert(data.error || 'Failed to send bulk referrals')
      }
    } catch (error) {
      console.error('Error sending bulk referrals:', error)
      alert('Error sending bulk referrals. Please try again.')
    } finally {
      setSendingEmail(false)
    }
  }

  const parseCsvData = (csvText: string): BulkReferral[] => {
    const lines = csvText.trim().split('\n')
    const referrals: BulkReferral[] = []
    
    // Skip header if it exists
    const startIndex = lines[0]?.toLowerCase().includes('name') || lines[0]?.toLowerCase().includes('email') ? 1 : 0
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Simple CSV parsing (handles basic cases)
      const parts = line.split(',').map(part => part.trim().replace(/^["']|["']$/g, ''))
      
      if (parts.length >= 2) {
        const [name, email] = parts
        if (name && email) {
          referrals.push({
            recipientName: name,
            recipientEmail: email
          })
        }
      }
    }
    
    return referrals
  }

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const csvText = e.target?.result as string
      try {
        const parsedReferrals = parseCsvData(csvText)
        if (parsedReferrals.length > 0) {
          setBulkReferrals(parsedReferrals)
        } else {
          alert('No valid referrals found in CSV. Please ensure the format is: Name, Email')
        }
      } catch (error) {
        alert('Error parsing CSV file. Please check the format.')
      }
    }
    reader.readAsText(file)
    
    // Reset the input
    event.target.value = ''
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rewards...</p>
        </div>
      </div>
    )
  }

  if (!referralData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load referral data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link 
                href="/dashboard" 
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </Link>
              <div className="flex items-center">
                <GiftIcon className="h-6 w-6 text-blue-600 mr-2" />
                <h1 className="text-xl font-bold text-gray-900">Referral Rewards</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-success-100 rounded-lg">
                <GiftIcon className="h-6 w-6 text-success-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Free Months Earned</p>
                <p className="text-2xl font-bold text-gray-900">{referralData?.rewardsEarned || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Referrals</p>
                <p className="text-2xl font-bold text-gray-900">{referralData?.referralHistory?.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center">
                              <div className="p-2 bg-secondary-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-secondary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Money Saved</p>
                <p className="text-2xl font-bold text-gray-900">${referralData?.rewardsSaved?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Code Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Referral Code</h2>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider">
                  {referralData?.referralCode || 'Loading...'}
                </p>
              </div>
            </div>
            <button
              onClick={copyReferralCode}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {copied ? <CheckIcon className="h-4 w-4 mr-2" /> : <CopyIcon className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Share this code with other churches. When they sign up and subscribe, you both get a free month!
          </p>
        </div>

        {/* Send Referrals Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Send Referral Invitations</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowBulkForm(!showBulkForm)}
                className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                  showBulkForm 
                    ? 'bg-gray-200 text-gray-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Users className="h-4 w-4 mr-2" />
                {showBulkForm ? 'Single' : 'Bulk Send'}
              </button>
            </div>
          </div>

          {!showBulkForm ? (
            // Single referral form
            <form onSubmit={sendReferralEmail} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    id="recipientName"
                    value={emailForm.recipientName}
                    onChange={(e) => setEmailForm({...emailForm, recipientName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Music Director's name"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="recipientEmail"
                    value={emailForm.recipientEmail}
                    onChange={(e) => setEmailForm({...emailForm, recipientEmail: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="director@church.org"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={sendingEmail}
                className="flex items-center px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendingEmail ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
          ) : (
            // Bulk referral form
            <div className="space-y-6">
              {/* CSV Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Upload CSV File</h3>
                  <p className="text-xs text-gray-600 mb-4">
                    Format: Name, Email (one per line)
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose CSV File
                  </label>
                </div>
              </div>

              {/* Manual Entry */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Manual Entry</h3>
                  <button
                    type="button"
                    onClick={addBulkReferral}
                    className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Another
                  </button>
                </div>

                <form onSubmit={handleBulkSubmit} className="space-y-4">
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {bulkReferrals.map((referral, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={referral.recipientName}
                            onChange={(e) => updateBulkReferral(index, 'recipientName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Name"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="email"
                            value={referral.recipientEmail}
                            onChange={(e) => updateBulkReferral(index, 'recipientEmail', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Email"
                          />
                        </div>
                        {bulkReferrals.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBulkReferral(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      {bulkReferrals.filter(r => r.recipientName.trim() && r.recipientEmail.trim()).length} valid referrals ready to send
                    </p>
                    <button
                      type="submit"
                      disabled={sendingEmail}
                      className="flex items-center px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors disabled:opacity-50"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sendingEmail ? 'Sending...' : 'Send All Invitations'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Results */}
        {bulkResults && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk Send Results</h3>
            
            {bulkResults.successful.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center mb-2">
                  <CheckCircle className="h-5 w-5 text-success-600 mr-2" />
                  <h4 className="font-medium text-success-800">Successfully Sent ({bulkResults.successful.length})</h4>
                </div>
                <div className="bg-success-50 rounded-lg p-3">
                  <ul className="text-sm text-success-800 space-y-1">
                    {bulkResults.successful.map((result: any, index: number) => (
                      <li key={index}>
                        {result.name} ({result.email})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {bulkResults.failed.length > 0 && (
              <div>
                <div className="flex items-center mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <h4 className="font-medium text-red-800">Failed to Send ({bulkResults.failed.length})</h4>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <ul className="text-sm text-red-800 space-y-1">
                    {bulkResults.failed.map((result: any, index: number) => (
                      <li key={index}>
                        {result.name} ({result.email}) - {result.error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Referral History */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Referral History</h2>
          {referralData?.referralHistory && referralData.referralHistory.length > 0 ? (
            <div className="space-y-3">
              {referralData.referralHistory.map((referral) => (
                <div key={referral.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{referral.referredPersonName}</p>
                    <p className="text-sm text-gray-600">{referral.referredEmail}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      referral.status === 'COMPLETED' 
                        ? 'bg-success-100 text-success-800'
                        : referral.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {referral.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {referral.status === 'COMPLETED' && referral.completedAt
                        ? `Completed ${new Date(referral.completedAt).toLocaleDateString()}`
                        : `Sent ${new Date(referral.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <p>No referrals sent yet</p>
              <p className="text-sm">Start inviting other churches to earn free months!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 