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

    // Fetch the document from database with event info
    const document = await prisma.eventDocument.findFirst({
      where: { 
        id: documentId,
        eventId: eventId
      },
      include: {
        event: {
          select: {
            name: true,
            churchId: true
          }
        }
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
      console.error('File not found in S3:', s3Key, 'for event:', document.event.name)
      
      // Check if user can delete (to show cleanup option)
      const canDelete = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)
      
      // Return a user-friendly HTML error page with cleanup option
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
        <head>
          <title>File Not Found</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; background: #fafafa; }
            .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #dc2626; margin-bottom: 16px; }
            p { color: #4b5563; line-height: 1.6; }
            .filename { background: #f3f4f6; padding: 12px 20px; border-radius: 8px; font-family: monospace; display: inline-block; margin: 16px 0; word-break: break-all; max-width: 100%; font-size: 14px; }
            .event-name { color: #7c3aed; font-weight: 500; }
            .actions { margin-top: 24px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
            a, button { padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 500; cursor: pointer; border: none; font-size: 14px; }
            .back-btn { background: #e5e7eb; color: #374151; }
            .back-btn:hover { background: #d1d5db; }
            .cleanup-btn { background: #fecaca; color: #991b1b; }
            .cleanup-btn:hover { background: #fca5a5; }
            .info { background: #fef3c7; border: 1px solid #fcd34d; padding: 12px 16px; border-radius: 8px; margin-top: 20px; font-size: 13px; color: #92400e; text-align: left; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>File Not Found</h1>
            <p>The document you're trying to access no longer exists in storage.</p>
            <div class="filename">${document.originalFilename}</div>
            <p>Event: <span class="event-name">${document.event.name}</span></p>
            
            <div class="info">
              <strong>Why did this happen?</strong><br>
              This can occur if the file was automatically cleaned up or if there was an upload error. 
              You'll need to re-upload this document to the event.
            </div>
            
            <div class="actions">
              <a href="javascript:history.back()" class="back-btn">Go Back</a>
              ${canDelete ? `<button onclick="cleanupDocument()" class="cleanup-btn">Remove Broken Link</button>` : ''}
            </div>
          </div>
          
          ${canDelete ? `
          <script>
            async function cleanupDocument() {
              if (!confirm('Remove this broken document link? You can re-upload the file afterwards.')) return;
              
              try {
                const response = await fetch('/api/events/${eventId}/documents/${documentId}', {
                  method: 'DELETE'
                });
                
                if (response.ok) {
                  alert('Broken link removed. You can now re-upload the document to this event.');
                  history.back();
                } else {
                  alert('Failed to remove the link. Please try again.');
                }
              } catch (error) {
                alert('An error occurred. Please try again.');
              }
            }
          </script>
          ` : ''}
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