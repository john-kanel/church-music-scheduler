import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/resend'
import { getEmailLogoHtml } from '@/components/emails/email-logo'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const eventId = resolvedParams.id

    // Fetch event hymns ordered by creation time
    const hymns = await prisma.eventHymn.findMany({
      where: { eventId },
      include: {
        servicePart: true
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({ hymns })
  } catch (error) {
    console.error('Error fetching event hymns:', error)
    return NextResponse.json({ error: 'Failed to fetch hymns' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user?.role !== 'DIRECTOR' && session.user?.role !== 'PASTOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const eventId = resolvedParams.id
    const { hymns } = await request.json()

    // Get original hymns to compare for changes
    const originalHymns = await prisma.eventHymn.findMany({
      where: { eventId },
      include: { servicePart: true }
    })

    // Delete all existing hymns for this event
    await prisma.eventHymn.deleteMany({
      where: { eventId }
    })

    // Create new hymns with proper ordering
    const createdHymns = []
    for (let i = 0; i < hymns.length; i++) {
      const hymn = hymns[i]
      
      // Skip empty hymns
      if (!hymn.title?.trim()) continue

      const createdHymn = await prisma.eventHymn.create({
        data: {
          eventId,
          title: hymn.title.trim(),
          notes: hymn.notes?.trim() || null,
          servicePartId: hymn.servicePartId === 'custom' || !hymn.servicePartId ? null : hymn.servicePartId
        },
        include: {
          servicePart: true
        }
      })
      createdHymns.push(createdHymn)
    }

    // Check if changes were made
    const hymnsChanged = JSON.stringify(originalHymns.map((h: any) => ({
      name: h.name,
      composer: h.composer,
      pageNumber: h.pageNumber
    }))) !== JSON.stringify(createdHymns.map((h: any) => ({
      name: h.name,
      composer: h.composer,
      pageNumber: h.pageNumber
    })))

    // Send notifications if changes were made
    if (hymnsChanged) {
      // Get event details
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          eventType: true,
          assignments: {
            include: {
              user: true
            }
          }
        }
      })

      if (event) {
        // Get all assigned musicians
        const assignedMusicians = event.assignments
          .filter((assignment: any) => assignment.user)
          .map((assignment: any) => assignment.user!)

        // Check if this is a past event
        const eventDateTime = new Date(event.startTime)
        const now = new Date()
        const isPastEvent = eventDateTime < now

        // Only send notifications for future events
        if (!isPastEvent && assignedMusicians.length > 0) {
          // Send notification emails (implement this based on your email service)
          try {
            await sendMusicChangeNotifications(event, assignedMusicians, createdHymns)
          } catch (emailError) {
            console.error('Failed to send notification emails:', emailError)
            // Don't fail the request if email fails
          }
        }
      }
    }

    return NextResponse.json({ 
      hymns: createdHymns,
      message: hymnsChanged ? 'Music updated successfully' : 'No changes detected'
    })
  } catch (error) {
    console.error('Error updating event hymns:', error)
    return NextResponse.json({ error: 'Failed to update hymns' }, { status: 500 })
  }
}

// Helper function to send notification emails
async function sendMusicChangeNotifications(event: any, musicians: any[], hymns: any[]) {
  const eventDate = new Date(event.startTime).toLocaleDateString()
  const eventTime = new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  
  const musicList = hymns.map((hymn: any, index: number) => 
    `${index + 1}. ${hymn.servicePart?.name || 'Other'}: ${hymn.title}${hymn.notes ? ` (${hymn.notes})` : ''}`
  ).join('\n')

  const subject = `🎵 Music Updated: ${event.name} - ${eventDate}`
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <!-- Logo Section -->
      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
        ${getEmailLogoHtml()}
        <h1 style="color: #333; margin: 0; font-size: 24px;">🎵 Music List Updated</h1>
      </div>
      
      <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
        
        <p>Hello!</p>
        
        <p>The music for <strong>"${event.name}"</strong> on <strong>${eventDate} at ${eventTime}</strong> has been updated by your music director.</p>
        
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #856404; margin: 0 0 8px 0;">📝 Changes Summary</h4>
          <p style="color: #856404; margin: 0;">The service music has been modified. Please review the complete list below.</p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #1f2937;">📋 Complete Music List</h3>
          <div style="white-space: pre-line; font-family: monospace; color: #4b5563; line-height: 1.6;">
${musicList}
          </div>
        </div>
        
        <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #065f46;"><strong>Event Details:</strong></p>
          <p style="margin: 5px 0; color: #065f46;">📍 Location: ${event.location || 'TBD'}</p>
          <p style="margin: 5px 0; color: #065f46;">🎭 Event Type: ${event.eventType.name}</p>
        </div>
        
        <p>Please review this updated music list and prepare accordingly for the service.</p>
        
        <p>If you have any questions about these music changes, please contact your music director.</p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          This is an automated notification sent when music changes are made to an event.
        </p>
      </div>
    </div>
  `

  // Send email to each musician
  const emailPromises = musicians.map(async (musician: any) => {
    try {
      await resend.emails.send({
        from: 'Church Music Pro <notifications@churchmusicpro.com>',
        to: musician.email,
        subject,
        html: htmlContent
      })
      
      console.log(`✅ Music change notification sent to ${musician.email}`)
      
      // Log the notification in database
      await prisma.notificationLog.create({
        data: {
          type: 'EVENT_UPDATED',
          churchId: event.churchId || musician.churchId,
          eventId: event.id,
          recipientEmail: musician.email,
          recipientName: `${musician.firstName} ${musician.lastName}`,
          subject,
          content: htmlContent,
          metadata: {
            eventName: event.name,
            eventDate: event.startTime,
            musicCount: hymns.length,
            updateType: 'MUSIC_CHANGED'
          }
        }
      })
      
    } catch (error) {
      console.error(`❌ Failed to send music change notification to ${musician.email}:`, error)
    }
  })

  // Wait for all emails to be sent
  await Promise.allSettled(emailPromises)
  
  console.log(`📧 Music change notifications sent for "${event.name}" to ${musicians.length} musicians`)
} 