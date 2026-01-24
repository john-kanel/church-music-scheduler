import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPresignedUrl, checkFileExists } from '@/lib/s3'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get the document from database
    const document = await prisma.churchDocument.findFirst({
      where: {
        id,
        churchId: session.user.churchId
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Debug: Log document info to help identify local file path issues
    console.log('🔧 Church Document View:', {
      documentId: document.id,
      filename: document.filename,
      filePath: document.filePath,
      originalFilename: document.originalFilename,
      isLocalPath: document.filePath?.includes('/Users/') || document.filePath?.includes('Downloads') || document.filePath?.startsWith('file://'),
      churchId: document.churchId
    })

    // Check if this document has a local file path (legacy data)
    if (document.filePath && (document.filePath.includes('/Users/') || document.filePath.includes('Downloads') || document.filePath.startsWith('file://'))) {
      console.error('⚠️  WARNING: Document has local file path:', document.filePath)
      return NextResponse.json({ 
        error: 'Document has invalid file path. Please re-upload this document.',
        details: 'This document was uploaded before cloud storage was properly configured.'
      }, { status: 400 })
    }

    // Generate presigned URL for S3 file access WITHOUT forcing download (for inline viewing)
    const s3Key = document.filename
    
    // Check if the file actually exists in S3 before generating presigned URL
    const fileExists = await checkFileExists(s3Key)
    if (!fileExists.exists) {
      console.error('File not found in S3:', s3Key)
      // Return a user-friendly HTML error page
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
        <head>
          <title>File Not Found</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            h1 { color: #dc2626; }
            p { color: #4b5563; }
            .filename { background: #f3f4f6; padding: 8px 16px; border-radius: 8px; font-family: monospace; display: inline-block; margin: 10px 0; }
            a { color: #2563eb; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>File Not Found</h1>
          <p>The document you're trying to access no longer exists or has been removed.</p>
          <div class="filename">${document.originalFilename}</div>
          <p>This may happen if the file was deleted or if there was an upload error.</p>
          <p><a href="javascript:history.back()">Go back</a></p>
        </body>
        </html>`,
        { 
          status: 404, 
          headers: { 'Content-Type': 'text/html' } 
        }
      )
    }
    
    // Using 7 days (604800 seconds) - the maximum AWS allows for presigned URLs
    const presignedResult = await getPresignedUrl(s3Key, 604800, false) // 7 days expiry, NO force download
    
    if (!presignedResult.success || !presignedResult.url) {
      console.error('Failed to generate presigned URL:', presignedResult.error)
      return NextResponse.json({ error: 'File not accessible' }, { status: 404 })
    }

    // Debug: Log successful S3 URL generation
    console.log('✅ Generated S3 URL for document viewing:', {
      documentId: document.id,
      s3Key: s3Key,
      presignedUrlGenerated: !!presignedResult.url
    })

    // Redirect to the presigned URL for direct S3 access (inline viewing)
    return NextResponse.redirect(presignedResult.url)
  } catch (error) {
    console.error('Error serving document for viewing:', error)
    return NextResponse.json({ error: 'Failed to serve document' }, { status: 500 })
  }
}
