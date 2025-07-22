'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Copy, Check, ExternalLink, Trash2 } from 'lucide-react'

interface PublicLink {
  id: string
  token: string
  url: string
  startDate: string
  endDate: string
  createdAt: string
}

interface GeneratePublicLinkModalProps {
  isOpen: boolean
  onClose: () => void
}

export function GeneratePublicLinkModal({ isOpen, onClose }: GeneratePublicLinkModalProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<PublicLink | null>(null)
  const [existingLinks, setExistingLinks] = useState<PublicLink[]>([])
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
  const [showExistingLinks, setShowExistingLinks] = useState(false)

  // Load existing links when modal opens
  useEffect(() => {
    if (isOpen) {
      loadExistingLinks()
    }
  }, [isOpen])

  const loadExistingLinks = async () => {
    try {
      const response = await fetch('/api/public-schedule-links')
      if (response.ok) {
        const data = await response.json()
        setExistingLinks(data.links || [])
      }
    } catch (error) {
      console.error('Error loading existing links:', error)
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/public-schedule-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedLink(data.link)
        setStartDate('')
        setEndDate('')
        // Refresh existing links
        await loadExistingLinks()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to generate link')
      }
    } catch (error) {
      console.error('Error generating link:', error)
      alert('Failed to generate link')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async (url: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLinkId(linkId)
      setTimeout(() => setCopiedLinkId(null), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
      alert('Failed to copy link to clipboard')
    }
  }

  const handleRevokeLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to revoke this public link? Musicians will no longer be able to access it.')) {
      return
    }

    try {
      const response = await fetch(`/api/public-schedule-links?id=${linkId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove from existing links
        setExistingLinks(prev => prev.filter(link => link.id !== linkId))
        // Clear generated link if it was the one deleted
        if (generatedLink?.id === linkId) {
          setGeneratedLink(null)
        }
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to revoke link')
      }
    } catch (error) {
      console.error('Error revoking link:', error)
      alert('Failed to revoke link')
    }
  }

  const handleClose = () => {
    setGeneratedLink(null)
    setStartDate('')
    setEndDate('')
    setShowExistingLinks(false)
    onClose()
  }

  if (!isOpen) return null

  // Get today's date for minimum date validation
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Generate Public Link</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Generated Link Display */}
        {generatedLink && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">✅ Link Generated Successfully!</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-green-700 mb-1">
                Public Schedule Link:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={generatedLink.url}
                  readOnly
                  className="flex-1 p-2 text-sm border border-green-300 rounded bg-white"
                />
                <button
                  onClick={() => handleCopyLink(generatedLink.url, generatedLink.id)}
                  className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  title="Copy link"
                >
                  {copiedLinkId === generatedLink.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <a
                  href={generatedLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Preview link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
            <p className="text-sm text-green-700">
              Valid from {new Date(generatedLink.startDate).toLocaleDateString()} to {new Date(generatedLink.endDate).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Generate New Link Form */}
        <form onSubmit={handleGenerate} className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Schedule Time Period
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={today}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || today}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Musicians will be able to sign up for events in this date range
            </p>
          </div>

          <button
            type="submit"
            disabled={!startDate || !endDate || isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Public Link'}
          </button>
        </form>

        {/* Existing Links */}
        {existingLinks.length > 0 && (
          <div>
            <button
              onClick={() => setShowExistingLinks(!showExistingLinks)}
              className="w-full flex items-center justify-between p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors mb-3"
            >
              <span className="font-medium text-gray-700">
                Existing Links ({existingLinks.length})
              </span>
              <X className={`w-4 h-4 transform transition-transform ${showExistingLinks ? 'rotate-45' : 'rotate-0'}`} />
            </button>

            {showExistingLinks && (
              <div className="space-y-3">
                {existingLinks.map((link) => (
                  <div key={link.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {new Date(link.startDate).toLocaleDateString()} - {new Date(link.endDate).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyLink(link.url, link.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Copy link"
                        >
                          {copiedLinkId === link.id ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Preview link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleRevokeLink(link.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Revoke link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Created {new Date(link.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            💡 <strong>How it works:</strong> Musicians can use this public link to sign up for events without logging in. They'll need their 4-digit PIN to confirm signup.
          </p>
        </div>
      </div>
    </div>
  )
} 