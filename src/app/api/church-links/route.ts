import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET - List all church links
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const links = await prisma.churchLink.findMany({
      where: { churchId: session.user.churchId },
      orderBy: { order: 'asc' },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    return NextResponse.json({ links })
  } catch (error) {
    console.error('Error fetching church links:', error)
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 })
  }
}

// POST - Create new church link
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create links (directors and pastors only)
    const canCreate = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)
    if (!canCreate) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { title, description, url } = await request.json()

    if (!title || !url) {
      return NextResponse.json({ error: 'Title and URL are required' }, { status: 400 })
    }

    // Validate URL format
    const urlPattern = /^https?:\/\/.+/i
    if (!urlPattern.test(url)) {
      return NextResponse.json({ 
        error: 'Invalid URL format. Please include http:// or https://' 
      }, { status: 400 })
    }

    // Get the next order number
    const lastLink = await prisma.churchLink.findFirst({
      where: { churchId: session.user.churchId },
      orderBy: { order: 'desc' }
    })
    const nextOrder = (lastLink?.order || 0) + 1

    // Create the link
    const link = await prisma.churchLink.create({
      data: {
        title,
        description: description || '',
        url,
        order: nextOrder,
        churchId: session.user.churchId,
        createdBy: session.user.id
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      link
    })

  } catch (error) {
    console.error('Error creating church link:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
} 