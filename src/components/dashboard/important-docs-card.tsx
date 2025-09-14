'use client'

import { useState, useEffect } from 'react'
import { FileText, ExternalLink, Download } from 'lucide-react'

interface ChurchDocument {
  id: string
  title: string
  description?: string
  originalFilename: string
  fileSize: number
  filePath: string
  order: number
  uploadedAt: string
  uploader: {
    firstName: string
    lastName: string
  }
}

interface ChurchLink {
  id: string
  title: string
  description?: string
  url: string
  order: number
  createdAt: string
  creator: {
    firstName: string
    lastName: string
  }
}

export default function ImportantDocsCard() {
  const [churchDocuments, setChurchDocuments] = useState<ChurchDocument[]>([])
  const [churchLinks, setChurchLinks] = useState<ChurchLink[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchChurchDocuments()
    fetchChurchLinks()
  }, [])

  const fetchChurchDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/church-documents')
      if (response.ok) {
        const data = await response.json()
        setChurchDocuments(data.documents)
      }
    } catch (error) {
      console.error('Error fetching church documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChurchLinks = async () => {
    try {
      const response = await fetch('/api/church-links')
      if (response.ok) {
        const data = await response.json()
        setChurchLinks(data.links)
      }
    } catch (error) {
      console.error('Error fetching church links:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDocumentDownload = async (docId: string, filename: string) => {
    try {
      // Instead of fetching as blob, let the browser handle the redirect directly
      // This avoids CORS issues with S3 direct access
      const downloadUrl = `/api/church-documents/${docId}/download`
      
      // Create a temporary link and click it to trigger download
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      a.target = '_blank' // Open in new tab as fallback
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading document:', error)
    }
  }

  // Don't show the card if there are no documents or links
  if (!loading && churchDocuments.length === 0 && churchLinks.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <FileText className="h-5 w-5 mr-2 text-blue-600" />
        Important Docs and Links
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Important documents and resources from your church
      </p>

      {loading ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 text-sm mt-2">Loading...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Documents Section */}
          {churchDocuments.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-800 mb-3 text-sm">Documents</h3>
              <div className="space-y-2">
                {churchDocuments.slice(0, 3).map((doc) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-gray-500 mr-3 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{doc.title}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(doc.fileSize)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDocumentDownload(doc.id, doc.originalFilename)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors flex-shrink-0"
                      title="Download document"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {churchDocuments.length > 3 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    +{churchDocuments.length - 3} more documents
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Links Section */}
          {churchLinks.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-800 mb-3 text-sm">Links</h3>
              <div className="space-y-2">
                {churchLinks.slice(0, 3).map((link) => (
                  <div 
                    key={link.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <ExternalLink className="h-4 w-4 text-gray-500 mr-3 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{link.title}</p>
                        <p className="text-xs text-gray-500 truncate">{link.url}</p>
                      </div>
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors flex-shrink-0"
                      title="Open link in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))}
                {churchLinks.length > 3 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    +{churchLinks.length - 3} more links
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Show all link */}
          {(churchDocuments.length > 3 || churchLinks.length > 3) && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View all resources →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 