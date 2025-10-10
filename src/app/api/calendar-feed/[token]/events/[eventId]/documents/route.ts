import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPresignedUrl } from '@/lib/s3'

// GET /api/calendar-feed/[token]/events/[eventId]/documents
// Serves a simple HTML page listing event documents with public, time-limited links
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string; eventId: string }> }
) {
  try {
    const { token, eventId } = await context.params

    // Validate subscription exists and is active
    const subscription = await prisma.calendarSubscription.findUnique({
      where: { subscriptionToken: token },
      include: { user: true }
    })

    if (!subscription || !subscription.isActive) {
      return new NextResponse('Not found', { status: 404 })
    }

    // Verify event belongs to the same church as subscriber
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        churchId: subscription.user.churchId
      }
    })
    if (!event) {
      return new NextResponse('Event not found', { status: 404 })
    }

    // Fetch documents
    const documents = await prisma.eventDocument.findMany({
      where: { eventId },
      orderBy: { uploadedAt: 'asc' }
    })

    // If exactly one document, redirect straight to file
    if (documents.length === 1) {
      const single = documents[0]
      // Using 7 days (604800 seconds) - the maximum AWS allows for presigned URLs
      const presigned = await getPresignedUrl(single.filename, 604800)
      if (presigned.success && presigned.url) {
        return NextResponse.redirect(presigned.url)
      }
    }

    // Build HTML with presigned links
    let listHtml = ''
    if (documents.length === 0) {
      listHtml = '<p style="color:#666">No documents for this event.</p>'
    } else {
      const items = await Promise.all(documents.map(async (doc) => {
        // Using 7 days (604800 seconds) - the maximum AWS allows for presigned URLs
        const presigned = await getPresignedUrl(doc.filename, 604800)
        const href = presigned.success && presigned.url ? presigned.url : '#'
        return `<li style="margin:8px 0"><a href="${href}" target="_blank" rel="noopener" style="color:#1d4ed8;text-decoration:none">${escapeHtml(doc.originalFilename)}</a></li>`
      }))
      listHtml = `<ul style="padding-left:18px">${items.join('')}</ul>`
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Event Documents</title>
  <style>body{font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 24px; color:#111827; background:#f9fafb}</style>
  <link rel="icon" href="/favicon.ico" />
  <meta name="robots" content="noindex" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src * data: blob:; style-src 'self' 'unsafe-inline'; script-src 'none'; connect-src *; frame-ancestors 'none';" />
  <meta http-equiv="Referrer-Policy" content="no-referrer" />
</head>
<body>
  <h1 style="margin:0 0 12px 0; font-size:20px">Event Documents</h1>
  <p style="margin:0 0 16px 0; color:#374151">Click a file to open.</p>
  ${listHtml}
</body>
</html>`

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  } catch (error) {
    console.error('Calendar-feed document page error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}


