import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's church info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user?.church) {
      return NextResponse.json({ error: 'No church found' }, { status: 404 })
    }

    // Fetch service parts in the order they're configured
    const serviceParts = await prisma.servicePart.findMany({
      where: { churchId: user.church.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true,
        isRequired: true
      }
    })

    // Fetch upcoming events (limit to first 20 as requested)
    const now = new Date()
    const events = await prisma.event.findMany({
      where: {
        churchId: user.church.id,
        startTime: {
          gte: now
        }
      },
      orderBy: { startTime: 'asc' },
      take: 20,
      include: {
        eventType: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        hymns: {
          select: {
            id: true,
            title: true,
            servicePartId: true,
            notes: true
          }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Transform the data for the frontend
    const plannerData = {
      serviceParts,
      events: events.map((event: any) => ({
        id: event.id,
        name: event.name,
        description: event.description,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime?.toISOString(),
        location: event.location || '',
        status: (event.status || 'CONFIRMED').toLowerCase(), // Include status field in lowercase
        eventType: event.eventType,
        hymns: event.hymns,
        assignments: event.assignments
      }))
    }

    return NextResponse.json(plannerData)

  } catch (error) {
    console.error('Error fetching planner data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch planner data' },
      { status: 500 }
    )
  }
} 