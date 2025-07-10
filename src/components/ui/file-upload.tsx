'use client'

import { useState, useRef } from 'react'
import { Upload, X, File, AlertCircle, CheckCircle } from 'lucide-react'

interface FileUploadProps {
  onFileUploaded?: (file: UploadedFile) => void
  onFileDeleted?: (key: string) => void
  folder?: string
  maxFiles?: number
  existingFiles?: UploadedFile[]
  className?: string
}

interface UploadedFile {
  key: string
  url: string
  fileName: string
  size: number
  contentType: string
}

export default function FileUpload({
  onFileUploaded,
  onFileDeleted,
  folder = 'uploads',
  maxFiles = 5,
  existingFiles = [],
  className = ''
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (fileList: FileList) => {
    if (files.length + fileList.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    setError(null)
    setUploading(true)

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', folder)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          console.error('Upload failed:', {
            status: response.status,
            statusText: response.statusText,
            error: result.error,
            result
          })
          throw new Error(result.error || `Upload failed: ${response.status} ${response.statusText}`)
        }

        const uploadedFile: UploadedFile = {
          key: result.key,
          url: result.url,
          fileName: result.fileName,
          size: result.size,
          contentType: result.contentType,
        }

        setFiles(prev => [...prev, uploadedFile])
        onFileUploaded?.(uploadedFile)

      } catch (error) {
        console.error('Upload error:', error)
        setError(error instanceof Error ? error.message : 'Upload failed')
      }
    }

    setUploading(false)
  }

  const handleDeleteFile = async (key: string) => {
    try {
      const response = await fetch(`/api/upload?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Delete failed')
      }

      setFiles(prev => prev.filter(file => file.key !== key))
      onFileDeleted?.(key)

    } catch (error) {
      console.error('Delete error:', error)
      setError(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return '🖼️'
    if (contentType.startsWith('audio/')) return '🎵'
    if (contentType.startsWith('video/')) return '🎥'
    if (contentType.includes('pdf')) return '📄'
    return '📎'
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium text-gray-900 mb-2">
          {uploading ? 'Uploading...' : 'Upload Files'}
        </p>
        <p className="text-sm text-gray-600">
          Drag and drop files here, or click to select
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Supported: PDF, DOC, DOCX, TXT, MP3, WAV, MP4, JPG, PNG (Max 10MB each)
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.mp4,.jpg,.jpeg,.png"
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files)
            }
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Uploaded Files</h4>
          {files.map((file) => (
            <div
              key={file.key}
              className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">{getFileIcon(file.contentType)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <button
                  onClick={() => handleDeleteFile(file.key)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Count */}
      <div className="text-xs text-gray-500 text-center">
        {files.length}/{maxFiles} files uploaded
      </div>
    </div>
  )
} 