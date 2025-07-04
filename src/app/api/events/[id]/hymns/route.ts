import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = params.id

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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user?.role !== 'DIRECTOR' && session.user?.role !== 'PASTOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = params.id
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
    const hymnsChanged = JSON.stringify(originalHymns.map(h => ({ 
      title: h.title, 
      notes: h.notes, 
      servicePartId: h.servicePartId
    }))) !== JSON.stringify(createdHymns.map(h => ({ 
      title: h.title, 
      notes: h.notes, 
      servicePartId: h.servicePartId
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
          .filter(assignment => assignment.user)
          .map(assignment => assignment.user!)

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
  // Implementation depends on your email service
  // This is a placeholder for the email notification logic
  
  const eventDate = new Date(event.startTime).toLocaleDateString()
  const eventTime = new Date(event.startTime).toLocaleTimeString()
  
  const musicList = hymns.map((hymn, index) => 
    `${index + 1}. ${hymn.servicePart?.name || 'Other'}: ${hymn.title}${hymn.notes ? ` (${hymn.notes})` : ''}`
  ).join('\n')

  const subject = `Music Updated: ${event.name} - ${eventDate}`
  const message = `
The music for "${event.name}" on ${eventDate} at ${eventTime} has been updated.

CHANGES SUMMARY:
The service music has been modified by the director.

COMPLETE MUSIC LIST:
${musicList}

Please review the updated music list and prepare accordingly.

Location: ${event.location || 'TBD'}
Event Type: ${event.eventType.name}

If you have any questions about the music changes, please contact the music director.
  `.trim()

  // Here you would integrate with your email service (SendGrid, AWS SES, etc.)
  console.log('Would send notification emails to:', musicians.map(m => m.email))
  console.log('Subject:', subject)
  console.log('Message:', message)
} 