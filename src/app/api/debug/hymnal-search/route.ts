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
    const searchTerm = searchParams.get('search') || ''

    // Get all hymns from all hymnals for this church
    const allHymns = await prisma.hymnalHymn.findMany({
      where: {
        hymnal: {
          churchId: session.user.churchId
        }
      },
      include: {
        hymnal: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { hymnal: { name: 'asc' } },
        { number: 'asc' }
      ]
    })

    // If search term provided, filter results
    const filteredHymns = searchTerm 
      ? allHymns.filter(hymn => 
          hymn.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          hymn.number?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : allHymns

    return NextResponse.json({
      totalHymns: allHymns.length,
      searchTerm,
      results: filteredHymns.map(h => ({
        title: h.title,
        number: h.number,
        hymnal: h.hymnal.name,
        id: h.id
      })),
      hymnalSummary: allHymns.reduce((acc, hymn) => {
        const hymnalName = hymn.hymnal.name
        if (!acc[hymnalName]) {
          acc[hymnalName] = 0
        }
        acc[hymnalName]++
        return acc
      }, {} as Record<string, number>)
    })
  } catch (error) {
    console.error('Error in debug hymnal search:', error)
    return NextResponse.json(
      { error: 'Failed to search hymns' },
      { status: 500 }
    )
  }
}
