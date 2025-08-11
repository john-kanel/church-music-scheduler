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
      .trim()
      .toLowerCase()

    // Search for hymns in this church's hymnals
    const hymns = await prisma.hymnalHymn.findMany({
      where: {
        hymnal: {
          churchId: session.user.churchId
        },
        OR: [
          // Exact match
          {
            title: {
              equals: cleanTitle,
              mode: 'insensitive'
            }
          },
          // Partial match
          {
            title: {
              contains: cleanTitle,
              mode: 'insensitive'
            }
          },
          // Match without articles
          {
            title: {
              contains: cleanTitle.replace(/^(the|a|an)\s+/i, ''),
              mode: 'insensitive'
            }
          }
        ]
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

    // Score the results to prioritize better matches
    const scoredResults = hymns.map(hymn => {
      const hymnTitle = hymn.title.toLowerCase()
      let score = 0
      
      // Exact match gets highest score
      if (hymnTitle === cleanTitle) {
        score = 100
      }
      // Starts with gets high score
      else if (hymnTitle.startsWith(cleanTitle)) {
        score = 80
      }
      // Contains gets medium score
      else if (hymnTitle.includes(cleanTitle)) {
        score = 60
      }
      // Partial word match gets lower score
      else {
        score = 30
      }

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
