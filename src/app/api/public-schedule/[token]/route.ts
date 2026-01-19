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

    // Links should stay active forever as per user requirements
    // No expiration check needed

    // Build event query using link filters, excluding tentative events
    const baseWhere: any = {
      churchId: publicLink.churchId,
      startTime: {
        gte: publicLink.startDate,
        lte: publicLink.endDate
      },
      // Exclude tentative events as specified in requirements
      NOT: {
        status: 'TENTATIVE'
      }
    }

    if ((publicLink as any).filterType === 'GROUPS') {
      const gids: string[] = ((publicLink as any).groupIds || []) as any
      if (gids.length > 0) {
        baseWhere.assignments = {
          some: {
            groupId: {
              in: gids
            }
          }
        }
      } else {
        // Ensure no events when no groups selected
        baseWhere.id = 'no-events'
      }
    } else if ((publicLink as any).filterType === 'EVENT_TYPES') {
      const eids: string[] = ((publicLink as any).eventTypeIds || []) as any
      if (eids.length > 0) {
        baseWhere.eventTypeId = {
          in: eids
        }
      } else {
        baseWhere.id = 'no-events'
      }
    } else if ((publicLink as any).filterType === 'OPEN_POSITIONS') {
      // Only show events that have at least one unfilled assignment (userId is null)
      baseWhere.assignments = {
        some: {
          userId: null
        }
      }
    }

    // Fetch events within the date range using filters
    const events = await prisma.event.findMany({
      where: baseWhere,
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
            },
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        hymns: {
          include: {
            servicePart: {
              select: {
                id: true,
                name: true,
                order: true
              }
            }
          },
          orderBy: [
            { servicePart: { order: 'asc' } },
            { createdAt: 'asc' }
          ]
        },
        documents: {
          select: {
            id: true,
            originalFilename: true,
            uploadedAt: true
          },
          orderBy: { uploadedAt: 'asc' }
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
          user: assignment.user,
          group: assignment.group
        })),
        hymns: event.hymns.map(hymn => ({
          id: hymn.id,
          title: hymn.title,
          notes: hymn.notes,
          servicePart: hymn.servicePart
        })),
        documents: event.documents.map(doc => ({
          id: doc.id,
          originalFilename: doc.originalFilename,
          url: `/api/public-schedule/${token}/events/${event.id}/documents/${doc.id}/view`
        }))
      })),
      musicians,
      timeRange: {
        startDate: publicLink.startDate.toISOString(),
        endDate: publicLink.endDate.toISOString()
      },
      name: (publicLink as any).name || null,
      filter: {
        filterType: (publicLink as any).filterType || 'ALL',
        groupIds: (publicLink as any).groupIds || [],
        eventTypeIds: (publicLink as any).eventTypeIds || []
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching public schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 