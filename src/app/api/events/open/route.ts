import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and associate directors can view open events
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Calculate date range
    const now = new Date()
    const endDate = new Date()
    endDate.setDate(now.getDate() + days)

    // Find events with open positions (assignments where userId is null)
    const openEvents = await prisma.event.findMany({
      where: {
        churchId: session.user.churchId,
        startTime: {
          gte: now,
          lte: endDate
        },
        assignments: {
          some: {
            userId: null,
            status: 'PENDING'
          }
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
          where: {
            userId: null,
            status: 'PENDING'
          },
          select: {
            id: true,
            roleName: true,
            status: true,
            maxMusicians: true
          }
        },
        _count: {
          select: {
            assignments: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      },
      take: limit
    })

    // Get total assignment counts for each event
    const eventsWithCounts = await Promise.all(
      openEvents.map(async (event) => {
        const totalAssignments = await prisma.eventAssignment.count({
          where: { eventId: event.id }
        })
        
        const filledAssignments = await prisma.eventAssignment.count({
          where: { 
            eventId: event.id,
            userId: { not: null }
          }
        })

        return {
          ...event,
          openPositions: event.assignments.length,
          totalPositions: totalAssignments,
          filledPositions: filledAssignments
        }
      })
    )

    return NextResponse.json({
      openEvents: eventsWithCounts,
      totalCount: eventsWithCounts.length
    })

  } catch (error) {
    console.error('Error fetching open events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/events/open - Auto-assign musicians to selected events
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and associate directors can auto-assign
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { eventIds, preview = false, groupFilter } = await request.json()

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({ error: 'Event IDs are required' }, { status: 400 })
    }

    // Get all open assignments for the selected events
    const openAssignments = await prisma.eventAssignment.findMany({
      where: {
        eventId: { in: eventIds },
        userId: null,
        status: 'PENDING',
        event: {
          churchId: session.user.churchId
        }
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true
          }
        }
      }
    })

    // Build musician query with optional group filtering
    const musicianWhere: any = {
      churchId: session.user.churchId,
      role: 'MUSICIAN',
      isVerified: true
    }

    // Add group filter if specified
    if (groupFilter && Array.isArray(groupFilter) && groupFilter.length > 0) {
      musicianWhere.groupMemberships = {
        some: {
          groupId: {
            in: groupFilter
          }
        }
      }
    }

    // Get all available musicians (verified and active, optionally filtered by groups)
    const musicians = await prisma.user.findMany({
      where: musicianWhere,
      include: {
        eventAssignments: {
          where: {
            event: {
              startTime: {
                gte: new Date()
              }
            },
            status: { in: ['PENDING', 'ACCEPTED'] }
          },
          include: {
            event: {
              select: {
                startTime: true,
                endTime: true
              }
            }
          }
        },
        unavailabilities: true,
        groupMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Function to check if musician is available for event
    const isMusicianAvailable = (musician: any, eventStart: Date, eventEnd: Date | null) => {
      // First check existing assignment conflicts
      const hasAssignmentConflict = musician.eventAssignments.some((assignment: any) => {
        const assignmentStart = new Date(assignment.event.startTime)
        const assignmentEnd = assignment.event.endTime ? new Date(assignment.event.endTime) : null
        
        // Check for time conflicts
        if (eventEnd && assignmentEnd) {
          return (eventStart < assignmentEnd && eventEnd > assignmentStart)
        } else {
          // If no end time, check if events are on same day
          return eventStart.toDateString() === assignmentStart.toDateString()
        }
      })

      if (hasAssignmentConflict) {
        return false
      }

      // Check unavailability records
      const hasUnavailabilityConflict = musician.unavailabilities.some((unavailability: any) => {
        // Check day-of-week unavailability
        if (unavailability.dayOfWeek !== null) {
          return eventStart.getDay() === unavailability.dayOfWeek
        }
        
        // Check date-based unavailability
        if (unavailability.startDate) {
          const unavailStart = new Date(unavailability.startDate)
          const unavailEnd = unavailability.endDate ? new Date(unavailability.endDate) : unavailStart
          
          // Set times to beginning/end of day for date comparison
          unavailStart.setHours(0, 0, 0, 0)
          unavailEnd.setHours(23, 59, 59, 999)
          
          const eventStartDate = new Date(eventStart)
          eventStartDate.setHours(0, 0, 0, 0)
          
          return eventStartDate >= unavailStart && eventStartDate <= unavailEnd
        }
        
        return false
      })

      return !hasUnavailabilityConflict
    }

    // Function to check if musician is qualified for role
    const isMusicianQualified = (musician: any, roleName: string) => {
      if (!musician.instruments || musician.instruments.length === 0) {
        return false // Don't auto-assign if no instruments specified
      }
      
      const roleNameLower = roleName.toLowerCase()
      const musicianInstruments = musician.instruments.map((i: string) => i.toLowerCase())
      
      // Define role-to-instrument mappings
      const roleInstrumentMap: { [key: string]: string[] } = {
        'accompanist': ['accompanist', 'pianist', 'organist'],
        'pianist': ['pianist', 'accompanist'],
        'organist': ['organist', 'accompanist'],
        'vocalist': ['vocalist', 'cantor'],
        'cantor': ['cantor', 'vocalist'],
        'guitarist': ['guitarist'],
        'drummer': ['drummer'],
        'bassist': ['bassist'],
        'violinist': ['violinist'],
        'musician': ['musician', 'accompanist', 'pianist', 'organist', 'vocalist', 'cantor', 'guitarist', 'drummer', 'bassist', 'violinist']
      }
      
      // Check for direct role match in mappings
      for (const [role, validInstruments] of Object.entries(roleInstrumentMap)) {
        if (roleNameLower.includes(role)) {
          return musicianInstruments.some((instrument: string) => 
            validInstruments.includes(instrument)
          )
        }
      }
      
      // Fallback: check if role name matches any instrument
      return musicianInstruments.some((instrument: string) => 
        instrument.includes(roleNameLower) || 
        roleNameLower.includes(instrument)
      )
    }

    // Generate assignment proposals
    const proposals: any[] = []
    const usedMusicians = new Set<string>()

    for (const assignment of openAssignments) {
      const eventStart = new Date(assignment.event.startTime)
      const eventEnd = assignment.event.endTime ? new Date(assignment.event.endTime as any) : null
      
      // Find qualified and available musicians
      const qualifiedMusicians = musicians.filter(musician => {
        if (usedMusicians.has(musician.id)) return false
        
        const isQualified = isMusicianQualified(musician, assignment.roleName || '')
        const isAvailable = isMusicianAvailable(musician, eventStart, eventEnd)
        
        // Debug logging for troubleshooting
        if (!isQualified) {
          console.log(`Musician ${musician.firstName} ${musician.lastName} not qualified for ${assignment.roleName}. Instruments: [${musician.instruments?.join(', ') || 'none'}]`)
        }
        
        return isQualified && isAvailable
      })

      if (qualifiedMusicians.length > 0) {
        // Randomly select from qualified musicians
        const selectedMusician = qualifiedMusicians[Math.floor(Math.random() * qualifiedMusicians.length)]
        
        proposals.push({
          assignmentId: assignment.id,
          eventId: assignment.event.id,
          eventName: assignment.event.name,
          eventStartTime: assignment.event.startTime,
          roleName: assignment.roleName,
          musicianId: selectedMusician.id,
          musicianName: `${selectedMusician.firstName} ${selectedMusician.lastName}`,
          musicianEmail: selectedMusician.email
        })
        
        usedMusicians.add(selectedMusician.id)
      } else {
        // No qualified musicians available
        proposals.push({
          assignmentId: assignment.id,
          eventId: assignment.event.id,
          eventName: assignment.event.name,
          eventStartTime: assignment.event.startTime,
          roleName: assignment.roleName,
          musicianId: null,
          musicianName: null,
          musicianEmail: null,
          reason: 'No qualified musicians available'
        })
      }
    }

    // If this is just a preview, return the proposals
    if (preview) {
      return NextResponse.json({
        proposals,
        totalAssignments: proposals.length,
        successfulAssignments: proposals.filter(p => p.musicianId).length
      })
    }

    // If not preview, execute the assignments
    const successfulAssignments = []
    const failedAssignments = []

    for (const proposal of proposals) {
      if (proposal.musicianId) {
        try {
          await prisma.eventAssignment.update({
            where: { id: proposal.assignmentId },
            data: {
              user: {
                connect: { id: proposal.musicianId }
              },
              status: 'PENDING' // Musician still needs to accept
            }
          })
          
          // Update the isAutoAssigned field separately if needed
          if (proposal.assignmentId) {
            await prisma.$executeRaw`
              UPDATE "EventAssignment" 
              SET "isAutoAssigned" = true 
              WHERE id = ${proposal.assignmentId}
            `
          }
          successfulAssignments.push(proposal)
        } catch (error) {
          console.error(`Failed to assign ${proposal.musicianName} to ${proposal.roleName}:`, error)
          failedAssignments.push({
            ...proposal,
            error: 'Database error during assignment'
          })
        }
      } else {
        failedAssignments.push(proposal)
      }
    }

    return NextResponse.json({
      success: true,
      successfulAssignments,
      failedAssignments,
      totalProcessed: proposals.length
    })

  } catch (error) {
    console.error('Error auto-assigning musicians:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 