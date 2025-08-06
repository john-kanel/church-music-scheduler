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

    // Calculate date 60 days ago
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    console.log('🎵 Song history search:', {
      songTitle,
      churchId: session.user.churchId,
      searchFrom: sixtyDaysAgo.toISOString(),
      excludeEventId
    })

    // Get the excluded event's date if provided (to exclude same-day events)
    let excludeDate: Date | null = null
    if (excludeEventId) {
      const excludedEvent = await prisma.event.findUnique({
        where: { id: excludeEventId },
        select: { startTime: true }
      })
      if (excludedEvent?.startTime) {
        excludeDate = new Date(excludedEvent.startTime)
        // Set to start of day for comparison
        excludeDate.setHours(0, 0, 0, 0)
        console.log('🎵 Excluding events from date:', excludeDate.toISOString().split('T')[0])
      }
    }

    // Search for similar song titles in the last 60 days
    // Use fuzzy matching by searching for songs that contain similar words
    const words = songTitle.toLowerCase().split(' ').filter(word => word.length > 2)
    
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
              gte: sixtyDaysAgo
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
        take: 10 // Limit to most recent 10 matches
      })

      // Filter out same-day events if we have an exclude date
      if (excludeDate) {
        const beforeFilter = songHistory.length
        songHistory = songHistory.filter(hymn => {
          if (!hymn.event?.startTime) return true
          const eventDate = new Date(hymn.event.startTime)
          eventDate.setHours(0, 0, 0, 0)
          return eventDate.getTime() !== excludeDate!.getTime()
        })
        console.log(`🎵 Filtered out same-day events: ${beforeFilter} -> ${songHistory.length}`)
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

      // Only return results with similarity > 0.6 (60% similar)
      songHistory = scoredResults
        .filter(result => result.similarityScore > 0.6)
        .sort((a, b) => b.similarityScore - a.similarityScore) // Sort by similarity
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