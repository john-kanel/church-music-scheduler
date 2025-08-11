import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get the hymnal and all its hymns
    const hymnal = await prisma.hymnal.findFirst({
      where: {
        id,
        churchId: session.user.churchId
      },
      include: {
        hymns: {
          orderBy: {
            number: 'asc'
          }
        }
      }
    })

    if (!hymnal) {
      return NextResponse.json({ error: 'Hymnal not found' }, { status: 404 })
    }

    return NextResponse.json({
      hymnal: {
        name: hymnal.name,
        description: hymnal.description,
        createdAt: hymnal.createdAt,
        hymnCount: hymnal.hymns.length
      },
      hymns: hymnal.hymns.map(h => ({
        title: h.title,
        number: h.number,
        pageNumber: h.pageNumber
      }))
    })
  } catch (error) {
    console.error('Error fetching hymnal debug info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hymnal debug info' },
      { status: 500 }
    )
  }
}
