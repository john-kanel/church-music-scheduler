'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Download, FileText, RefreshCw, Users, Eye, QrCode, Check } from 'lucide-react'

interface InvitationLink {
  id: string
  slug: string
  url: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  stats: {
    pageViews: number
    signups: number
  }
}

interface InvitationModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function InvitationModal({ isOpen, onClose }: InvitationModalProps) {
  const [inviteLink, setInviteLink] = useState<InvitationLink | null>(null)
  const [loading, setLoading] = useState(false)
  const [copying, setCopying] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load invitation link data
  useEffect(() => {
    if (isOpen) {
      loadInvitationLink()
    }
  }, [isOpen])

  const loadInvitationLink = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/musician-invites')
      if (!response.ok) {
        throw new Error('Failed to load invitation link')
      }
      
      const data = await response.json()
      setInviteLink(data.inviteLink)
      
      // Generate QR code if link exists
      if (data.inviteLink) {
        generateQRCode(data.inviteLink.url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitation link')
    } finally {
      setLoading(false)
    }
  }

  const generateQRCode = async (url: string) => {
    try {
      const QRCode = await import('qrcode')
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#660033',
          light: '#FFFFFF'
        }
      })
      setQrCode(qrCodeDataUrl)
    } catch (err) {
      console.error('Error generating QR code:', err)
    }
  }

  const createInvitationLink = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/musician-invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'create' })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create invitation link')
      }
      
      await loadInvitationLink()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation link')
    } finally {
      setLoading(false)
    }
  }

  const regenerateInvitationLink = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/musician-invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'regenerate' })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to regenerate invitation link')
      }
      
      await loadInvitationLink()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate invitation link')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopying(true)
      setTimeout(() => setCopying(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const downloadQRCode = () => {
    if (!qrCode) return
    
    const link = document.createElement('a')
    link.download = 'musician-invitation-qr.png'
    link.href = qrCode
    link.click()
  }

  const generateFlyer = () => {
    if (!inviteLink || !qrCode) return
    
    // Create a new window with the flyer
    const flyerWindow = window.open('', '_blank', 'width=800,height=600')
    if (!flyerWindow) return
    
    const flyerHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Musician Invitation - ${inviteLink.slug}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 40px;
              background: white;
              color: #333;
            }
            .flyer {
              max-width: 600px;
              margin: 0 auto;
              text-align: center;
              border: 2px solid #660033;
              padding: 40px;
              border-radius: 10px;
            }
            .header {
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #660033;
              margin-bottom: 10px;
            }
            .title {
              font-size: 36px;
              font-weight: bold;
              color: #660033;
              margin-bottom: 20px;
            }
            .subtitle {
              font-size: 18px;
              color: #666;
              margin-bottom: 30px;
            }
            .qr-section {
              margin: 40px 0;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 10px;
            }
            .qr-code {
              margin: 20px 0;
            }
            .url {
              font-size: 16px;
              color: #660033;
              font-weight: bold;
              margin: 20px 0;
              word-break: break-all;
            }
            .instructions {
              font-size: 14px;
              color: #666;
              margin-top: 20px;
              line-height: 1.5;
            }
            .footer {
              margin-top: 30px;
              font-size: 12px;
              color: #999;
            }
            @media print {
              body { margin: 0; padding: 20px; }
              .flyer { border: 1px solid #660033; }
            }
          </style>
        </head>
        <body>
          <div class="flyer">
            <div class="header">
              <div class="logo">Church Music Scheduler</div>
              <div class="title">Join Our Music Ministry!</div>
              <div class="subtitle">Scan the QR code or visit the link below to sign up</div>
            </div>
            
            <div class="qr-section">
              <div class="qr-code">
                <img src="${qrCode}" alt="QR Code" style="width: 200px; height: 200px;" />
              </div>
              <div class="url">${inviteLink.url}</div>
            </div>
            
            <div class="instructions">
              <p><strong>How to join:</strong></p>
              <p>1. Scan the QR code with your phone camera</p>
              <p>2. Or visit the website link above</p>
              <p>3. Fill out the signup form</p>
              <p>4. Start participating in our music ministry!</p>
            </div>
            
            <div class="footer">
              <p>Questions? Contact your music director</p>
              <p>Generated on ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </body>
      </html>
    `
    
    flyerWindow.document.write(flyerHTML)
    flyerWindow.document.close()
    
    // Print the flyer
    flyerWindow.onload = () => {
      flyerWindow.print()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Musician Invitation Link</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {!loading && !inviteLink && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Create Your Musician Invitation Link
              </h3>
              <p className="text-gray-600 mb-6">
                Generate a custom link that musicians can use to join your church's music ministry.
              </p>
              <button
                onClick={createInvitationLink}
                disabled={loading}
                className="bg-brand-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                Create Invitation Link
              </button>
            </div>
          )}

          {!loading && inviteLink && (
            <div className="space-y-8">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-6 text-center">
                  <Eye className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-900">{inviteLink.stats.pageViews}</div>
                  <div className="text-sm text-blue-700">Page Views</div>
                </div>
                <div className="bg-green-50 rounded-lg p-6 text-center">
                  <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-900">{inviteLink.stats.signups}</div>
                  <div className="text-sm text-green-700">New Signups</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-6 text-center">
                  <QrCode className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-900">Active</div>
                  <div className="text-sm text-purple-700">Link Status</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Link Section */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Invitation Link</h3>
                    <div className="space-y-3">
                      <div className="flex">
                        <input
                          type="text"
                          value={inviteLink.url}
                          readOnly
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg bg-gray-50 text-gray-700 font-mono text-sm"
                        />
                        <button
                          onClick={() => copyToClipboard(inviteLink.url)}
                          className="px-4 py-3 bg-brand-600 text-white rounded-r-lg hover:bg-brand-700 transition-colors flex items-center"
                        >
                          {copying ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
                    <div className="space-y-3">
                      <button
                        onClick={regenerateInvitationLink}
                        disabled={loading}
                        className="w-full flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Regenerate Link
                      </button>
                      <p className="text-sm text-gray-600">
                        Regenerating will deactivate the current link and create a new one.
                      </p>
                    </div>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code</h3>
                    {qrCode ? (
                      <div className="text-center">
                        <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg">
                          <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
                        <div className="text-gray-500">Generating QR code...</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Download Options</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={downloadQRCode}
                        disabled={!qrCode}
                        className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download QR
                      </button>
                      <button
                        onClick={generateFlyer}
                        disabled={!qrCode}
                        className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Print Flyer
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">How to Share</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• <strong>Copy the link</strong> and share it via email, text, or social media</p>
                  <p>• <strong>Download the QR code</strong> and add it to bulletins or announcements</p>
                  <p>• <strong>Print the flyer</strong> and post it on bulletin boards or hand out after service</p>
                  <p>• Musicians can scan the QR code with their phone camera to sign up instantly</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 