import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const songTitle = searchParams.get('title')
    const excludeEventId = searchParams.get('excludeEventId')
    
    if (!songTitle) {
      return NextResponse.json({ error: 'Song title is required' }, { status: 400 })
    }

    // Get the excluded event's date first (needed for proper 60-day calculation)
    let excludeDate: Date | null = null
    let referenceDate = new Date() // Default to today
    
    if (excludeEventId) {
      const excludedEvent = await prisma.event.findUnique({
        where: { id: excludeEventId },
        select: { startTime: true }
      })
      if (excludedEvent?.startTime) {
        referenceDate = new Date(excludedEvent.startTime) // Use event's date as reference
        excludeDate = new Date(excludedEvent.startTime)
        // Set to start of day for comparison
        excludeDate.setHours(0, 0, 0, 0)
        console.log('🎵 Using event date as reference:', referenceDate.toISOString().split('T')[0])
        console.log('🎵 Excluding events from date:', excludeDate.toISOString().split('T')[0])
      }
    }

    // Calculate 60-day window around the reference date (±60 days)
    const windowStart = new Date(referenceDate)
    windowStart.setDate(windowStart.getDate() - 60)
    const windowEnd = new Date(referenceDate)
    windowEnd.setDate(windowEnd.getDate() + 60)

    // Search for similar song titles within ±60 days of the event
    // Use fuzzy matching by searching for songs that contain similar words
    const words = songTitle.toLowerCase().split(' ').filter(word => word.length > 2)

    console.log('🎵 Song history search:', {
      songTitle,
      churchId: session.user.churchId,
      referenceDate: referenceDate.toISOString().split('T')[0],
      searchWindow: `${windowStart.toISOString().split('T')[0]} to ${windowEnd.toISOString().split('T')[0]}`,
      excludeEventId,
      searchWords: words
    })
    
    let songHistory: any[] = []
    
    if (words.length > 0) {
      // Create a search pattern that allows for variations
      // We'll search for songs that contain most of the significant words
      const searchConditions = words.map(word => ({
        title: {
          contains: word,
          mode: 'insensitive' as const
        }
      }))

      songHistory = await prisma.eventHymn.findMany({
        where: {
          event: {
            churchId: session.user.churchId,
            startTime: {
              gte: windowStart,
              lte: windowEnd
            }
          },
          OR: searchConditions
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              startTime: true
            }
          },
          servicePart: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          event: {
            startTime: 'desc'
          }
        },
        take: 50 // Increase limit to catch more potential matches before filtering
      })

      console.log(`🎵 Initial database search found ${songHistory.length} potential matches`)

      // Filter out same-day events if we have an exclude date
      if (excludeDate) {
        const beforeFilter = songHistory.length
        songHistory = songHistory.filter(hymn => {
          if (!hymn.event?.startTime) return true
          const eventDate = new Date(hymn.event.startTime)
          eventDate.setHours(0, 0, 0, 0)
          const isSameDay = eventDate.getTime() === excludeDate!.getTime()
          if (isSameDay) {
            console.log(`🎵 Excluding same-day event: "${hymn.title}" from ${eventDate.toISOString().split('T')[0]}`)
          }
          return !isSameDay
        })
        console.log(`🎵 After filtering same-day events: ${beforeFilter} -> ${songHistory.length}`)
      }

      // Filter results by similarity score
      // Calculate how similar each result is to the original title
      const scoredResults = songHistory.map(hymn => {
        const similarity = calculateSimilarity(songTitle.toLowerCase(), hymn.title?.toLowerCase() || '')
        return {
          ...hymn,
          similarityScore: similarity
        }
      })

      // Filter results by similarity - be more lenient for song matching
      // Use a lower threshold (40%) and also check if significant words match
      const beforeSimilarityFilter = scoredResults.length
      songHistory = scoredResults
        .filter(result => {
          // Allow if similarity is decent OR if all major words are present
          const hasMajorWords = words.every(word => 
            result.title?.toLowerCase().includes(word.toLowerCase())
          )
          const hasDecentSimilarity = result.similarityScore > 0.4
          const hasGoodSimilarity = result.similarityScore > 0.6
          
          const shouldInclude = hasGoodSimilarity || (hasDecentSimilarity && hasMajorWords) || hasMajorWords
          
          console.log(`🎵 Similarity check for "${result.title}": score=${result.similarityScore.toFixed(2)}, majorWords=${hasMajorWords}, include=${shouldInclude}`)
          
          return shouldInclude
        })
        .sort((a, b) => b.similarityScore - a.similarityScore) // Sort by similarity

      console.log(`🎵 After similarity filtering: ${beforeSimilarityFilter} -> ${songHistory.length}`)
    }

    console.log('🎵 Song history results:', {
      searchTitle: songTitle,
      resultsCount: songHistory.length,
      results: songHistory.map(h => ({
        title: h.title,
        similarity: h.similarityScore,
        eventName: h.event?.name,
        startTime: h.event?.startTime
      }))
    })

    return NextResponse.json({ 
      songHistory: songHistory.map(hymn => ({
        id: hymn.id,
        title: hymn.title,
        similarityScore: hymn.similarityScore,
        event: {
          id: hymn.event?.id,
          name: hymn.event?.name,
          startTime: hymn.event?.startTime
        },
        servicePart: hymn.servicePart ? {
          id: hymn.servicePart.id,
          name: hymn.servicePart.name
        } : null
      }))
    })

  } catch (error) {
    console.error('Error searching song history:', error)
    return NextResponse.json(
      { error: 'Failed to search song history' },
      { status: 500 }
    )
  }
}

// Calculate similarity between two strings using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0
  
  const maxLength = Math.max(str1.length, str2.length)
  if (maxLength === 0) return 1
  
  const distance = levenshteinDistance(str1, str2)
  return (maxLength - distance) / maxLength
}

// Levenshtein distance algorithm
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
} 