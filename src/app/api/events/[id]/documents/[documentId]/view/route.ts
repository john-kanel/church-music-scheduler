import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPresignedUrl, checkFileExists } from '@/lib/s3'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId, documentId } = await params

    // Fetch the document from database
    const document = await prisma.eventDocument.findFirst({
      where: { 
        id: documentId,
        eventId: eventId
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Generate presigned URL for S3 file access
    // The filename field now contains the S3 key
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
    const presignedResult = await getPresignedUrl(s3Key, 604800) // 7 days expiry
    
    if (!presignedResult.success || !presignedResult.url) {
      console.error('Failed to generate presigned URL:', presignedResult.error)
      return NextResponse.json({ error: 'File not accessible' }, { status: 404 })
    }

    // Redirect to the presigned URL for direct S3 access
    return NextResponse.redirect(presignedResult.url)
  } catch (error) {
    console.error('Error serving document:', error)
    return NextResponse.json({ error: 'Failed to serve document' }, { status: 500 })
  }
} 