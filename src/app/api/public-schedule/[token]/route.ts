import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/public-schedule/[token] - Fetch public schedule data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find the public schedule link
    const publicLink = await prisma.publicScheduleLink.findUnique({
      where: { token },
      include: {
        church: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!publicLink) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    // Check if the link is still valid (within date range)
    const now = new Date()
    if (now < publicLink.startDate || now > publicLink.endDate) {
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
    }

    // Fetch events within the date range, excluding tentative events
    const events = await prisma.event.findMany({
      where: {
        churchId: publicLink.churchId,
        startTime: {
          gte: publicLink.startDate,
          lte: publicLink.endDate
        },
        // Exclude tentative events as specified in requirements
        NOT: {
          status: 'TENTATIVE'
        }
      },
      include: {
        eventType: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        hymns: {
          include: {
            servicePart: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { startTime: 'asc' }
    })

    // Get all musicians from this church for the signup dropdown
    const musicians = await prisma.user.findMany({
      where: {
        churchId: publicLink.churchId,
        role: 'MUSICIAN',
        isVerified: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    // Format the response
    const response = {
      church: publicLink.church,
      events: events.map(event => ({
        id: event.id,
        name: event.name,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime?.toISOString(),
        location: event.location || '',
        description: event.description || '',
        eventType: event.eventType,
        assignments: event.assignments.map(assignment => ({
          id: assignment.id,
          roleName: assignment.roleName || 'Musician',
          status: assignment.status,
          user: assignment.user
        })),
        hymns: event.hymns.map(hymn => ({
          id: hymn.id,
          title: hymn.title,
          notes: hymn.notes,
          servicePart: hymn.servicePart
        }))
      })),
      musicians,
      timeRange: {
        startDate: publicLink.startDate.toISOString(),
        endDate: publicLink.endDate.toISOString()
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching public schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 