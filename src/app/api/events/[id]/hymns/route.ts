import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/resend'
import { getEmailLogoHtml } from '@/components/emails/email-logo'
import { markEventForCalendarUpdate } from '@/lib/calendar-updates'

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
    const { hymns, isAutoPopulate = false } = await request.json()

    // Get original hymns to compare for changes (only if not auto-populate)
    let originalHymns: any[] = []
    if (!isAutoPopulate) {
      originalHymns = await prisma.eventHymn.findMany({
        where: { eventId },
        select: { title: true, notes: true, servicePartId: true }
      })
    }

    // Delete all existing hymns for this event
    await prisma.eventHymn.deleteMany({
      where: { eventId }
    })

    // Prepare data for bulk insert (keep empty titles to preserve service part placeholders)
    const validHymns = hymns
      .map((hymn: any, index: number) => {
        // Calculate creation time with small offsets to preserve order
        const baseTime = new Date()
        const orderOffset = hymn.orderIndex !== undefined ? hymn.orderIndex : index
        const createdAt = new Date(baseTime.getTime() + orderOffset * 1000) // 1 second intervals
        
        return {
          eventId,
          title: hymn.title?.trim() || '', // Allow empty titles
          notes: hymn.notes?.trim() || null,
          servicePartId: hymn.servicePartId === 'custom' || !hymn.servicePartId ? null : hymn.servicePartId,
          createdAt
        }
      })

    // Create hymns individually to preserve custom timestamps and order
    let createdHymns: any[] = []
    if (validHymns.length > 0) {
      for (const hymnData of validHymns) {
        await prisma.eventHymn.create({
          data: hymnData
        })
      }

      // Mark event for calendar update (hymns are part of event details)
      await markEventForCalendarUpdate(eventId)

      // Fetch the created hymns with service parts (only if we need them for notifications)
      if (!isAutoPopulate) {
        createdHymns = await prisma.eventHymn.findMany({
          where: { eventId },
          include: { servicePart: true },
          orderBy: { createdAt: 'asc' }
        })
      }
    }

    // Check if changes were made (only for manual updates, not auto-populate)
    let hymnsChanged = false
    if (!isAutoPopulate && originalHymns.length > 0) {
      // Compare the actual hymn data
      const originalData = originalHymns.map((h: any) => ({
        title: h.title,
        notes: h.notes,
        servicePartId: h.servicePartId
      }))
      
      const newData = validHymns.map((h: any) => ({
        title: h.title,
        notes: h.notes,
        servicePartId: h.servicePartId
      }))
      
      hymnsChanged = JSON.stringify(originalData) !== JSON.stringify(newData)
    }

    // Send notifications only for manual changes (not auto-populate) to future events
    if (!isAutoPopulate && hymnsChanged && createdHymns.length > 0) {
      try {
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

          // Only send notifications for future events with assigned musicians
          if (!isPastEvent && assignedMusicians.length > 0) {
            // Send notifications in background to avoid blocking the response
            setImmediate(() => {
              sendMusicChangeNotifications(event, assignedMusicians, createdHymns)
                .catch(error => console.error('Failed to send notification emails:', error))
            })
          }
        }
      } catch (error) {
        console.error('Error preparing notifications:', error)
        // Don't fail the request if notification preparation fails
      }
    }

    const message = isAutoPopulate 
      ? `Auto-populated ${validHymns.length} songs successfully`
      : hymnsChanged 
        ? 'Music updated successfully' 
        : 'No changes detected'

    return NextResponse.json({ 
      hymns: createdHymns.length > 0 ? createdHymns : validHymns,
      message
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
          <p style="margin: 5px 0; color: #065f46;">Event Type: ${event.eventType.name}</p>
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