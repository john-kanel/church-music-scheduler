import { prisma } from '@/lib/db'
import { sendEventCancellationEmail } from '@/lib/resend'

/**
 * Sends cancellation emails to all assigned musicians when an event is cancelled
 */
export async function handleEventCancellation(eventId: string) {
  try {
    console.log('🚨 Processing event cancellation for event:', eventId)
    
    // Get the event with assigned musicians
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        church: {
          select: {
            name: true
          }
        },
        assignments: {
          where: {
            userId: {
              not: null
            }
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                emailNotifications: true
              }
            }
          }
        }
      }
    })

    if (!event) {
      console.log('❌ Event not found:', eventId)
      return
    }

    if (event.status !== 'CANCELLED') {
      console.log('⚠️ Event is not cancelled, skipping email notifications')
      return
    }

    // Get assigned musicians who have email notifications enabled
    const assignedMusicians = event.assignments.filter(assignment => 
      assignment.user && assignment.user.emailNotifications
    )

    if (assignedMusicians.length === 0) {
      console.log('📭 No assigned musicians with email notifications enabled')
      return
    }

    console.log(`📧 Sending cancellation emails to ${assignedMusicians.length} musicians`)

    // Send emails to all assigned musicians
    const emailPromises = assignedMusicians.map(async (assignment) => {
      if (!assignment.user) return

      try {
        await sendEventCancellationEmail(
          assignment.user.email,
          `${assignment.user.firstName} ${assignment.user.lastName}`,
          event.church.name,
          event.name,
          event.startTime,
          event.location || '',
          assignment.roleName || 'Musician'
        )
        console.log(`✅ Cancellation email sent to: ${assignment.user.email}`)
      } catch (error) {
        console.error(`❌ Failed to send cancellation email to ${assignment.user.email}:`, error)
        // Don't throw - continue sending to other musicians
      }
    })

    // Wait for all emails to be sent
    await Promise.all(emailPromises)
    
    console.log('🎉 All cancellation emails processed successfully')

  } catch (error) {
    console.error('❌ Error handling event cancellation:', error)
    // Don't throw error - this shouldn't prevent the event update from succeeding
  }
}

/**
 * Checks if an event status has changed to cancelled and triggers email notifications
 */
export async function checkForEventCancellation(eventId: string, previousStatus?: string, newStatus?: string) {
  // Only send emails if the event is newly cancelled (wasn't cancelled before)
  if (newStatus === 'CANCELLED' && previousStatus !== 'CANCELLED') {
    console.log('🚨 Event newly cancelled, sending notifications')
    await handleEventCancellation(eventId)
  }
} 