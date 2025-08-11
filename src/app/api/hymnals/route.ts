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

    const hymnals = await prisma.hymnal.findMany({
      where: {
        churchId: session.user.churchId
      },
      include: {
        uploader: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            hymns: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(hymnals)
  } catch (error) {
    console.error('Error fetching hymnals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hymnals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can upload hymnals
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { name, description } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Hymnal name is required' }, { status: 400 })
    }

    const hymnal = await prisma.hymnal.create({
      data: {
        name,
        description,
        churchId: session.user.churchId,
        uploadedBy: session.user.id
      },
      include: {
        uploader: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            hymns: true
          }
        }
      }
    })

    return NextResponse.json(hymnal)
  } catch (error) {
    console.error('Error creating hymnal:', error)
    return NextResponse.json(
      { error: 'Failed to create hymnal' },
      { status: 500 }
    )
  }
}
