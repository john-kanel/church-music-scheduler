import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPresignedUrl } from '@/lib/s3'

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


