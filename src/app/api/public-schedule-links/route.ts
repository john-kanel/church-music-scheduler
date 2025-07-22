import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/public-schedule-links - List public links for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can view public links
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const links = await prisma.publicScheduleLink.findMany({
      where: { churchId: session.user.churchId },
      orderBy: { createdAt: 'desc' },
      take: 10 // Limit to last 10 links
    })

    return NextResponse.json({ links })
  } catch (error) {
    console.error('Error fetching public schedule links:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/public-schedule-links - Create new public link
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can create public links
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { startDate, endDate } = await request.json()

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start >= end) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    // Create the public schedule link
    const publicLink = await prisma.publicScheduleLink.create({
      data: {
        churchId: session.user.churchId,
        startDate: start,
        endDate: end
      }
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://churchmusicpro.com'
    const fullUrl = `${baseUrl}/public-schedule/${publicLink.token}`

    return NextResponse.json({
      message: 'Public schedule link created successfully',
      link: {
        id: publicLink.id,
        token: publicLink.token,
        url: fullUrl,
        startDate: publicLink.startDate,
        endDate: publicLink.endDate,
        createdAt: publicLink.createdAt
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating public schedule link:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/public-schedule-links - Revoke/delete public link
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can delete public links
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get('id')

    if (!linkId) {
      return NextResponse.json({ error: 'Link ID is required' }, { status: 400 })
    }

    // Verify the link belongs to the church
    const link = await prisma.publicScheduleLink.findFirst({
      where: {
        id: linkId,
        churchId: session.user.churchId
      }
    })

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    await prisma.publicScheduleLink.delete({
      where: { id: linkId }
    })

    return NextResponse.json({ message: 'Public schedule link revoked successfully' })

  } catch (error) {
    console.error('Error deleting public schedule link:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 