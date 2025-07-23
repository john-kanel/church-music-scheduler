import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendSignupConfirmationEmail } from '@/lib/resend'
import { generateSingleEventICalFile } from '@/lib/ical-generator'

// POST /api/public-signup - Handle public musician signup with PIN verification
export async function POST(request: NextRequest) {
  try {
    const { token, assignmentId, musicianId, pin } = await request.json()

    if (!token || !assignmentId || !musicianId || !pin) {
      return NextResponse.json({ 
        error: 'Missing required fields: token, assignmentId, musicianId, pin' 
      }, { status: 400 })
    }

    // Validate PIN format
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
    }

    // Find and validate the public schedule link
    const publicLink = await prisma.publicScheduleLink.findUnique({
      where: { token },
      include: {
        church: {
          select: { id: true, name: true }
        }
      }
    })

    if (!publicLink) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    // Links should stay active forever as per user requirements
    // No expiration check needed
    const now = new Date()

    // Verify the musician exists and belongs to the church
    const musician = await prisma.user.findFirst({
      where: {
        id: musicianId,
        churchId: publicLink.churchId,
        role: 'MUSICIAN',
        // Remove isVerified check - we want to allow unverified users to sign up
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        pin: true,
        isVerified: true
      }
    })

    if (!musician) {
      return NextResponse.json({ error: 'Musician not found' }, { status: 404 })
    }

    // Verify the PIN
    if (musician.pin !== pin) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    // FEATURE 2: Mark account as verified on first PIN use
    if (!musician.isVerified) {
      await prisma.user.update({
        where: { id: musicianId },
        data: { isVerified: true }
      })
      console.log(`✅ Activated account for ${musician.firstName} ${musician.lastName} on first PIN use`)
    }

    // Verify the assignment exists and is available - with full event details for email
    const assignment = await prisma.eventAssignment.findFirst({
      where: {
        id: assignmentId,
        userId: null, // Must be unassigned
        event: {
          churchId: publicLink.churchId,
          startTime: {
            gte: publicLink.startDate,
            lte: publicLink.endDate
          }
        }
      },
      include: {
        event: {
          include: {
            eventType: true,
            assignments: {
              include: {
                user: true,
                group: true
              }
            },
            hymns: {
              include: {
                servicePart: true
              },
              orderBy: [
                { servicePart: { order: 'asc' } },
                { createdAt: 'asc' }
              ]
            }
          }
        }
      }
    })

    if (!assignment) {
      return NextResponse.json({ 
        error: 'Assignment not found or no longer available' 
      }, { status: 404 })
    }

    // Check if the event is in the future
    const eventDate = new Date(assignment.event.startTime)
    if (eventDate <= now) {
      return NextResponse.json({ 
        error: 'Cannot sign up for past events' 
      }, { status: 400 })
    }

    // Assign the musician to the role
    const updatedAssignment = await prisma.eventAssignment.update({
      where: { id: assignmentId },
      data: {
        userId: musicianId,
        status: 'ACCEPTED' // Automatically accepted as specified
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        event: {
          select: {
            id: true,
            name: true,
            startTime: true
          }
        }
      }
    })

    // FEATURE 1: Send confirmation email with ICS attachment
    try {
      // Generate ICS file for the single event
      const icsContent = generateSingleEventICalFile(
        assignment.event, 
        publicLink.church.name, 
        'America/Chicago' // Default timezone - could be made configurable
      )

      // Send confirmation email
      await sendSignupConfirmationEmail(
        musician.email,
        `${musician.firstName} ${musician.lastName}`,
        publicLink.church.name,
        assignment.event.name,
        assignment.event.startTime,
        assignment.event.location || '',
        assignment.roleName || 'Musician',
        icsContent
      )

      console.log(`📧 Sent confirmation email to ${musician.email} for ${assignment.event.name}`)
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError)
      // Don't fail the signup if email fails - the assignment is still successful
    }

    // TODO: Send notification emails to directors/pastors about the new assignment
    // This would use the existing notification system

    return NextResponse.json({
      message: 'Successfully signed up for the event',
      assignment: {
        id: updatedAssignment.id,
        roleName: updatedAssignment.roleName,
        event: updatedAssignment.event,
        musician: updatedAssignment.user
      }
    })

  } catch (error) {
    console.error('Error processing public signup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 