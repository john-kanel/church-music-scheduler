import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { isMusicianAvailable, checkMultipleMusicianAvailability } from '@/lib/availability-utils'

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
            status: 'PENDING',
            // Exclude group-level assignments - only consider actual open individual roles
            NOT: {
              groupId: { not: null }
            }
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
            status: 'PENDING',
            // Exclude group-level assignments - only include actual open individual roles
            NOT: {
              groupId: { not: null }
            }
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
        // Count only meaningful assignments (exclude group-level assignments that have no individual user)
        const totalAssignments = await prisma.eventAssignment.count({
          where: { 
            eventId: event.id,
            NOT: {
              AND: [
                { groupId: { not: null } },
                { userId: null }
              ]
            }
          }
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
      role: 'MUSICIAN'
      // Removed isVerified requirement to include unverified musicians in auto-assignment
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

    console.log(`🎯 Auto-assignment starting with ${musicians.length} musicians for ${openAssignments.length} assignments`)

    // Function to check if musician is available for event (checking existing assignments)
    const hasExistingAssignmentConflict = (musician: any, eventStart: Date, eventEnd: Date | null) => {
      return musician.eventAssignments.some((assignment: any) => {
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
    }

    // Function to check if musician is qualified for role
    const isMusicianQualified = (musician: any, roleName: string) => {
      if (!musician.instruments || musician.instruments.length === 0) {
        return false // Don't auto-assign if no instruments specified
      }
      
      const roleNameLower = roleName.toLowerCase()
      const musicianInstruments = musician.instruments.map((i: string) => i.toLowerCase())
      
      // Define role-to-instrument mappings (updated to match join page instruments)
      const roleInstrumentMap: { [key: string]: string[] } = {
        'accompanist': ['piano', 'organ'],
        'pianist': ['piano'],
        'organist': ['organ'],
        'vocalist': ['vocals'],
        'cantor': ['vocals', 'cantor'],
        'guitarist': ['guitar'],
        'drummer': ['drums', 'percussion'],
        'bassist': ['bass'],
        'violinist': ['violin'],
        'director': ['director'],
        'musician': ['piano', 'guitar', 'violin', 'cello', 'flute', 'clarinet', 'saxophone', 'trumpet', 'trombone', 'drums', 'bass', 'organ', 'harp', 'vocals', 'oboe', 'french horn', 'tuba', 'percussion', 'director', 'cantor', 'other']
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
      
      // Pre-check availability for all musicians for this event using our utility
      const musicianIds = musicians.map(m => m.id)
      const availabilityChecks = await checkMultipleMusicianAvailability(musicianIds, eventStart)
      
      console.log(`📅 Checking availability for event "${assignment.event.name}" on ${eventStart.toLocaleDateString()}`)
      console.log(`🔍 Availability results: ${Object.entries(availabilityChecks).filter(([_, check]) => !check.isAvailable).length} musicians unavailable`)
      
      // Find qualified and available musicians
      const qualifiedMusicians = musicians.filter(musician => {
        if (usedMusicians.has(musician.id)) {
          console.log(`⏭️ Musician ${musician.firstName} ${musician.lastName} already used in this batch`)
          return false
        }
        
        const isQualified = isMusicianQualified(musician, assignment.roleName || '')
        const hasExistingConflict = hasExistingAssignmentConflict(musician, eventStart, eventEnd)
        const isAvailablePerSchedule = availabilityChecks[musician.id]?.isAvailable === true
        
        // Debug logging for troubleshooting
        if (!isQualified) {
          console.log(`❌ Musician ${musician.firstName} ${musician.lastName} not qualified for ${assignment.roleName}. Instruments: [${musician.instruments?.join(', ') || 'none'}]`)
        }
        if (hasExistingConflict) {
          console.log(`⏰ Musician ${musician.firstName} ${musician.lastName} has existing assignment conflict for ${assignment.event.name}`)
        }
        if (!isAvailablePerSchedule) {
          console.log(`🚫 Musician ${musician.firstName} ${musician.lastName} is not available per schedule: ${availabilityChecks[musician.id]?.reason || 'No reason specified'}`)
        }
        
        const isEligible = isQualified && !hasExistingConflict && isAvailablePerSchedule
        if (isEligible) {
          console.log(`✅ Musician ${musician.firstName} ${musician.lastName} is eligible for ${assignment.roleName}`)
        }
        
        return isEligible
      })
      
      console.log(`🎯 Found ${qualifiedMusicians.length} qualified and available musicians for ${assignment.roleName} in "${assignment.event.name}"`)

      if (qualifiedMusicians.length > 0) {
        // Randomly select from qualified musicians
        const selectedMusician = qualifiedMusicians[Math.floor(Math.random() * qualifiedMusicians.length)]
        
        console.log(`🎉 Successfully matched ${selectedMusician.firstName} ${selectedMusician.lastName} to ${assignment.roleName} for "${assignment.event.name}"`)
        
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
        // No qualified musicians available - let's determine why
        const qualifiedCount = musicians.filter(m => isMusicianQualified(m, assignment.roleName || '')).length
        const availableCount = musicians.filter(m => availabilityChecks[m.id]?.isAvailable === true).length
        const conflictFreeCount = musicians.filter(m => !hasExistingAssignmentConflict(m, eventStart, eventEnd)).length
        
        let reason = 'No qualified musicians available'
        if (qualifiedCount === 0) {
          reason = 'No musicians qualified for this role'
        } else if (availableCount === 0) {
          reason = 'All qualified musicians are unavailable per their schedule settings'
        } else if (conflictFreeCount === 0) {
          reason = 'All qualified musicians have existing assignment conflicts'
        } else {
          reason = 'No musicians meet all criteria (qualified, available, and conflict-free)'
        }
        
        proposals.push({
          assignmentId: assignment.id,
          eventId: assignment.event.id,
          eventName: assignment.event.name,
          eventStartTime: assignment.event.startTime,
          roleName: assignment.roleName,
          musicianId: null,
          musicianName: null,
          musicianEmail: null,
          reason
        })
      }
    }

    // Log summary of assignment results
    const successfulCount = proposals.filter(p => p.musicianId).length
    const failedCount = proposals.length - successfulCount
    console.log(`📊 Auto-assignment summary: ${successfulCount} successful, ${failedCount} failed out of ${proposals.length} total assignments`)
    
    if (failedCount > 0) {
      console.log(`❌ Failed assignments breakdown:`)
      proposals.filter(p => !p.musicianId).forEach(p => {
        console.log(`   - ${p.roleName} for "${p.eventName}": ${p.reason}`)
      })
    }

    // If this is just a preview, return the proposals
    if (preview) {
      console.log(`👀 Returning preview results to user`)
      return NextResponse.json({
        proposals,
        totalAssignments: proposals.length,
        successfulAssignments: successfulCount,
        availabilitySystemActive: true // Confirm availability system is working
      })
    }

    // If not preview, execute the assignments
    console.log(`🚀 Executing auto-assignments (not preview mode)`)
    const successfulAssignments = []
    const failedAssignments = []

    for (const proposal of proposals) {
      if (proposal.musicianId) {
        try {
          console.log(`💾 Saving assignment: ${proposal.musicianName} -> ${proposal.roleName} for "${proposal.eventName}"`)
          
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
          
          console.log(`✅ Successfully saved assignment for ${proposal.musicianName}`)
          successfulAssignments.push(proposal)
        } catch (error) {
          console.error(`❌ Failed to assign ${proposal.musicianName} to ${proposal.roleName}:`, error)
          failedAssignments.push({
            ...proposal,
            error: 'Database error during assignment'
          })
        }
      } else {
        failedAssignments.push(proposal)
      }
    }
    
    console.log(`🎯 Final execution results: ${successfulAssignments.length} successful, ${failedAssignments.length} failed`)

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