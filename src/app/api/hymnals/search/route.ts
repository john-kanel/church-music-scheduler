import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title')

    if (!title) {
      return NextResponse.json({ error: 'Title parameter is required' }, { status: 400 })
    }

    // Clean the title for searching - remove common prefixes/suffixes and normalize
    const cleanTitle = title
      .replace(/^(the|a|an)\s+/i, '') // Remove articles
      .replace(/\s*#\d+\s*$/, '') // Remove existing hymn numbers
      .replace(/\s*\(.*?\)\s*$/, '') // Remove parenthetical info
      .replace(/['"''""]/g, '') // Remove quotes
      .replace(/[,;:]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .toLowerCase()

    // Create multiple search variations
    const searchVariations = [
      cleanTitle, // Original cleaned
      cleanTitle.replace(/^(the|a|an)\s+/i, ''), // Without articles
      cleanTitle.replace(/\s+(and|&)\s+/g, ' '), // Normalize "and"
      cleanTitle.replace(/\s+/g, ''), // No spaces (for matching issues)
      cleanTitle.split(' ').slice(0, 3).join(' '), // First 3 words
      cleanTitle.split(' ').slice(0, 2).join(' '), // First 2 words
    ].filter(v => v.length > 2) // Only meaningful variations

    console.log('🔍 Searching for hymn with variations:', searchVariations)

    // Search for hymns in this church's hymnals with comprehensive matching
    const hymns = await prisma.hymnalHymn.findMany({
      where: {
        hymnal: {
          churchId: session.user.churchId
        },
        OR: searchVariations.flatMap(variation => [
          // Exact match
          {
            title: {
              equals: variation,
              mode: 'insensitive'
            }
          },
          // Contains match
          {
            title: {
              contains: variation,
              mode: 'insensitive'
            }
          },
          // Reverse contains (variation contains part of stored title)
          {
            title: {
              contains: variation.split(' ')[0], // First word
              mode: 'insensitive'
            }
          }
        ])
      },
      include: {
        hymnal: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        // Prioritize exact matches
        {
          title: 'asc'
        }
      ]
    })

    console.log(`🎵 Found ${hymns.length} potential matches from database`)

    // Enhanced scoring algorithm
    const scoredResults = hymns.map(hymn => {
      const hymnTitle = hymn.title.toLowerCase()
        .replace(/['"''""]/g, '') // Remove quotes
        .replace(/[,;:]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim()
      
      let score = 0
      
      // Perfect exact match
      if (hymnTitle === cleanTitle) {
        score = 100
      }
      // Perfect match without articles
      else if (hymnTitle === cleanTitle.replace(/^(the|a|an)\s+/i, '')) {
        score = 95
      }
      // Exact match of first few words
      else if (hymnTitle.startsWith(cleanTitle)) {
        score = 85
      }
      // Title contains all the search words
      else if (cleanTitle.split(' ').every(word => hymnTitle.includes(word))) {
        score = 75
      }
      // Title contains most search words
      else if (cleanTitle.split(' ').filter(word => hymnTitle.includes(word)).length >= Math.ceil(cleanTitle.split(' ').length * 0.7)) {
        score = 65
      }
      // General contains
      else if (hymnTitle.includes(cleanTitle)) {
        score = 55
      }
      // Contains first word
      else if (hymnTitle.includes(cleanTitle.split(' ')[0])) {
        score = 45
      }
      // Fuzzy match for similar length
      else if (Math.abs(hymnTitle.length - cleanTitle.length) <= 5) {
        score = 35
      }
      else {
        score = 20
      }

      // Bonus points for exact word count match
      if (hymnTitle.split(' ').length === cleanTitle.split(' ').length) {
        score += 10
      }

      console.log(`🎼 "${hymn.title}" scored ${score} (searched: "${cleanTitle}")`)

      return {
        ...hymn,
        score
      }
    })

    // Sort by score and return top matches
    const sortedResults = scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Limit to top 10 results

    return NextResponse.json(sortedResults)
  } catch (error) {
    console.error('Error searching hymns:', error)
    return NextResponse.json(
      { error: 'Failed to search hymns' },
      { status: 500 }
    )
  }
}
