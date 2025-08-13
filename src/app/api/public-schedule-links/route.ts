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

    const baseUrl = process.env.NEXTAUTH_URL || 'https://churchmusicpro.com'
    
    // Add the full URL to each link
    const linksWithUrls = (links as any[]).map((link) => {
      const l = link as any
      return {
        id: l.id,
        token: l.token,
        url: `${baseUrl}/public-schedule/${l.token}`,
        startDate: l.startDate,
        endDate: l.endDate,
        createdAt: l.createdAt,
        name: l.name || null,
        filterType: l.filterType || 'ALL',
        groupIds: l.groupIds || [],
        eventTypeIds: l.eventTypeIds || []
      }
    })

    return NextResponse.json({ links: linksWithUrls })
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

    const { startDate, endDate, name, filterType = 'ALL', groupIds = [], eventTypeIds = [] } = await request.json()

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start >= end) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    // Validate filters
    const validFilterTypes = ['ALL', 'GROUPS', 'EVENT_TYPES']
    if (!validFilterTypes.includes(filterType)) {
      return NextResponse.json({ error: 'Invalid filter type' }, { status: 400 })
    }

    if (filterType === 'GROUPS' && (!Array.isArray(groupIds) || groupIds.length === 0)) {
      return NextResponse.json({ error: 'At least one group must be selected' }, { status: 400 })
    }

    if (filterType === 'EVENT_TYPES' && (!Array.isArray(eventTypeIds) || eventTypeIds.length === 0)) {
      return NextResponse.json({ error: 'At least one event type must be selected' }, { status: 400 })
    }

    const sanitizedName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : null
    const sanitizedGroupIds: string[] = Array.isArray(groupIds) ? groupIds.filter((id: any) => typeof id === 'string' && id.trim().length > 0) : []
    const sanitizedEventTypeIds: string[] = Array.isArray(eventTypeIds) ? eventTypeIds.filter((id: any) => typeof id === 'string' && id.trim().length > 0) : []

    // Create the public schedule link
    const publicLink = await prisma.publicScheduleLink.create({
      data: {
        churchId: session.user.churchId,
        startDate: start,
        endDate: end,
        name: sanitizedName,
        filterType: filterType as any,
        groupIds: filterType === 'GROUPS' ? sanitizedGroupIds : [],
        eventTypeIds: filterType === 'EVENT_TYPES' ? sanitizedEventTypeIds : []
      } as any
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
        createdAt: publicLink.createdAt,
        name: (publicLink as any).name,
        filterType: (publicLink as any).filterType,
        groupIds: (publicLink as any).groupIds,
        eventTypeIds: (publicLink as any).eventTypeIds
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