import { prisma } from '@/lib/db'

interface UnavailabilityCheck {
  isAvailable: boolean
  reason?: string
}

// Helper function to create dates in local timezone for consistent date handling
function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day) // month is 0-indexed in JavaScript
}

/**
 * Check if a musician is available for a specific event date and time
 */
export async function isMusicianAvailable(
  musicianId: string, 
  eventDate: Date
): Promise<UnavailabilityCheck> {
  try {
    // Get all active unavailabilities for the musician
    const unavailabilities = await prisma.musicianUnavailability.findMany({
      where: {
        userId: musicianId,
        OR: [
          // Date range unavailabilities
          {
            AND: [
              { startDate: { lte: eventDate } },
              { endDate: { gte: eventDate } }
            ]
          },
          // Single day unavailabilities (where startDate = endDate)
          {
            AND: [
              { startDate: { lte: eventDate } },
              { endDate: null },
              { startDate: { gte: new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()) } }
            ]
          },
          // Day of week recurring unavailabilities
          {
            dayOfWeek: eventDate.getDay()
          }
        ]
      }
    })

    // If any unavailability matches, the musician is not available
    if (unavailabilities.length > 0) {
      const matchingUnavailability = unavailabilities[0]
      let reason = 'Not available'
      
      if (matchingUnavailability.dayOfWeek !== null) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        reason = `Not available on ${dayNames[matchingUnavailability.dayOfWeek]}s`
      } else if (matchingUnavailability.startDate && matchingUnavailability.endDate) {
        reason = `Not available ${matchingUnavailability.startDate.toLocaleDateString()} - ${matchingUnavailability.endDate.toLocaleDateString()}`
      } else if (matchingUnavailability.startDate) {
        reason = `Not available on ${matchingUnavailability.startDate.toLocaleDateString()}`
      }
      
      if (matchingUnavailability.reason) {
        reason += ` (${matchingUnavailability.reason})`
      }

      return {
        isAvailable: false,
        reason
      }
    }

    return { isAvailable: true }
  } catch (error) {
    console.error('Error checking musician availability:', error)
    // Default to available if there's an error
    return { isAvailable: true }
  }
}

/**
 * Check availability for multiple musicians at once
 */
export async function checkMultipleMusicianAvailability(
  musicianIds: string[],
  eventDate: Date
): Promise<Record<string, UnavailabilityCheck>> {
  const results: Record<string, UnavailabilityCheck> = {}
  
  const checks = musicianIds.map(async (musicianId) => {
    const availability = await isMusicianAvailable(musicianId, eventDate)
    results[musicianId] = availability
  })

  await Promise.all(checks)
  return results
}

/**
 * Filter musicians by availability for a specific event date
 */
export async function filterAvailableMusicians(
  musicianIds: string[],
  eventDate: Date
): Promise<string[]> {
  const availabilityChecks = await checkMultipleMusicianAvailability(musicianIds, eventDate)
  
  return musicianIds.filter(musicianId => 
    availabilityChecks[musicianId]?.isAvailable === true
  )
}

/**
 * Get unavailable musicians with reasons for a specific event date
 */
export async function getUnavailableMusiciansWithReasons(
  musicianIds: string[],
  eventDate: Date
): Promise<Array<{ musicianId: string; reason: string }>> {
  const availabilityChecks = await checkMultipleMusicianAvailability(musicianIds, eventDate)
  
  return musicianIds
    .filter(musicianId => availabilityChecks[musicianId]?.isAvailable === false)
    .map(musicianId => ({
      musicianId,
      reason: availabilityChecks[musicianId].reason || 'Not available'
    }))
}

/**
 * Clean up expired unavailabilities (can be called periodically)
 */
export async function cleanupExpiredUnavailabilities(): Promise<number> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    
    const result = await prisma.musicianUnavailability.deleteMany({
      where: {
        AND: [
          { endDate: { lt: today } }, // End date is before today
          { dayOfWeek: null } // Not a recurring availability
        ]
      }
    })

    return result.count
  } catch (error) {
    console.error('Error cleaning up expired unavailabilities:', error)
    return 0
  }
}

/**
 * Get availability summary for a musician
 */
export async function getMusicianAvailabilitySummary(musicianId: string) {
  try {
    const unavailabilities = await prisma.musicianUnavailability.findMany({
      where: {
        userId: musicianId,
        OR: [
          {
            endDate: {
              gte: new Date()
            }
          },
          {
            startDate: {
              gte: new Date()
            },
            endDate: null
          },
          {
            dayOfWeek: {
              not: null
            }
          }
        ]
      },
      orderBy: [
        { startDate: 'asc' },
        { dayOfWeek: 'asc' }
      ]
    })

    const dateRanges = unavailabilities.filter(u => u.dayOfWeek === null)
    const recurringDays = unavailabilities.filter(u => u.dayOfWeek !== null)

    return {
      totalUnavailabilities: unavailabilities.length,
      dateRanges: dateRanges.length,
      recurringDays: recurringDays.length,
      upcomingUnavailabilities: dateRanges.filter(u => 
        u.startDate && u.startDate > new Date()
      ).length
    }
  } catch (error) {
    console.error('Error getting availability summary:', error)
    return {
      totalUnavailabilities: 0,
      dateRanges: 0,
      recurringDays: 0,
      upcomingUnavailabilities: 0
    }
  }
} 