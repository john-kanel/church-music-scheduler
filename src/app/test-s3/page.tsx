'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import FileUpload from '@/components/ui/file-upload'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface UploadedFile {
  key: string
  url: string
  fileName: string
  size: number
  contentType: string
}

export default function TestS3Page() {
  const { data: session } = useSession()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to test file upload</h1>
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  const handleFileUploaded = (file: UploadedFile) => {
    console.log('File uploaded:', file)
    setUploadedFiles(prev => [...prev, file])
  }

  const handleFileDeleted = (key: string) => {
    console.log('File deleted:', key)
    setUploadedFiles(prev => prev.filter(f => f.key !== key))
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/dashboard" 
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">S3 File Upload Test</h1>
          <p className="text-gray-600 mt-2">
            Test the AWS S3 file upload functionality. Upload music files, documents, and more.
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Upload Files</h2>
          
          <FileUpload
            onFileUploaded={handleFileUploaded}
            onFileDeleted={handleFileDeleted}
            folder="test-uploads"
            maxFiles={10}
            className="mb-6"
          />

          {/* Upload Summary */}
          {uploadedFiles.length > 0 && (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-lg font-medium text-green-900 mb-2">
                ✅ Upload Test Results
              </h3>
              <p className="text-green-700 mb-4">
                Successfully uploaded {uploadedFiles.length} file(s) to AWS S3!
              </p>
              
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={file.key} className="text-sm text-green-800">
                    <strong>File {index + 1}:</strong> {file.fileName} 
                    <span className="text-green-600 ml-2">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">How to Use S3 in Your App</h3>
          
          <div className="space-y-4 text-blue-800">
            <div>
              <h4 className="font-medium">1. Import the FileUpload component:</h4>
              <code className="block bg-blue-100 p-2 rounded text-sm mt-1">
                {`import FileUpload from '@/components/ui/file-upload'`}
              </code>
            </div>
            
            <div>
              <h4 className="font-medium">2. Use it in your components:</h4>
              <code className="block bg-blue-100 p-2 rounded text-sm mt-1 whitespace-pre">
{`<FileUpload
  onFileUploaded={(file) => console.log('Uploaded:', file)}
  folder="event-documents"
  maxFiles={5}
/>`}
              </code>
            </div>
            
            <div>
              <h4 className="font-medium">3. Common use cases in your church app:</h4>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li><strong>Music scores:</strong> Upload PDF sheet music for events</li>
                <li><strong>Audio files:</strong> Upload MP3 recordings for practice</li>
                <li><strong>Event documents:</strong> Upload programs, schedules, notes</li>
                <li><strong>Profile photos:</strong> User and church profile images</li>
                <li><strong>Reports:</strong> Generated PDFs and documents</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium">4. Environment Variables Required:</h4>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li>AWS_ACCESS_KEY_ID</li>
                <li>AWS_SECRET_ACCESS_KEY</li>
                <li>AWS_REGION</li>
                <li>AWS_S3_BUCKET_NAME</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Security Note */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-900 mb-2">🔒 Security Note</h4>
          <p className="text-yellow-800 text-sm">
            Files are uploaded to a private S3 bucket. Access is controlled through presigned URLs 
            that expire after 1 hour. Only authenticated users can upload files.
          </p>
        </div>
      </div>
    </div>
  )
} 