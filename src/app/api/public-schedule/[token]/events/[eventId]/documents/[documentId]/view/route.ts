import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPresignedUrl, checkFileExists } from '@/lib/s3'

// Public document access via tokenized public schedule link
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string; eventId: string; documentId: string }> }
) {
  try {
    const { token, eventId, documentId } = await context.params

    // Validate the token exists and matches the event's church
    const publicLink = await prisma.publicScheduleLink.findUnique({ where: { token } })
    if (!publicLink) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    }

    // Verify the event belongs to the same church and within time range (optional)
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        churchId: publicLink.churchId
      }
    })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify document belongs to event
    const document = await prisma.eventDocument.findFirst({
      where: { id: documentId, eventId }
    })
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Generate presigned URL for S3 file access (read-only, time-limited)
    const s3Key = document.filename
    
    // Check if the file actually exists in S3 before generating presigned URL
    const fileExists = await checkFileExists(s3Key)
    if (!fileExists.exists) {
      console.error('File not found in S3:', s3Key, 'for event:', event.name)
      // Return a user-friendly HTML error page
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
            a { display: inline-block; margin-top: 20px; padding: 10px 24px; background: #e5e7eb; color: #374151; border-radius: 8px; text-decoration: none; font-weight: 500; }
            a:hover { background: #d1d5db; }
            .info { background: #fef3c7; border: 1px solid #fcd34d; padding: 12px 16px; border-radius: 8px; margin-top: 20px; font-size: 13px; color: #92400e; text-align: left; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>File Not Found</h1>
            <p>The document you're trying to access no longer exists in storage.</p>
            <div class="filename">${document.originalFilename}</div>
            <p>Event: <span class="event-name">${event.name}</span></p>
            <div class="info">
              <strong>What can you do?</strong><br>
              Please contact the schedule administrator to have this document re-uploaded.
            </div>
            <a href="javascript:history.back()">Go Back</a>
          </div>
        </body>
        </html>`,
        { 
          status: 404, 
          headers: { 'Content-Type': 'text/html' } 
        }
      )
    }
    
    // Using 7 days (604800 seconds) - the maximum AWS allows for presigned URLs
    const presigned = await getPresignedUrl(s3Key, 604800)
    if (!presigned.success || !presigned.url) {
      return NextResponse.json({ error: 'File not accessible' }, { status: 404 })
    }

    return NextResponse.redirect(presigned.url)
  } catch (error) {
    console.error('Public document view error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


