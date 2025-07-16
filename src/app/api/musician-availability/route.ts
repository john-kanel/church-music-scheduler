import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/musician-availability - Fetch musician's unavailabilities
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only musicians can manage their own availability
    if (session.user.role !== 'MUSICIAN') {
      return NextResponse.json({ error: 'Only musicians can manage availability' }, { status: 403 })
    }

    const unavailabilities = await prisma.musicianUnavailability.findMany({
      where: { userId: session.user.id },
      orderBy: [
        { startDate: 'asc' },
        { dayOfWeek: 'asc' }
      ]
    })

    return NextResponse.json({ unavailabilities })
  } catch (error) {
    console.error('Error fetching musician availability:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }
}

// POST /api/musician-availability - Create new unavailability
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only musicians can manage their own availability
    if (session.user.role !== 'MUSICIAN') {
      return NextResponse.json({ error: 'Only musicians can manage availability' }, { status: 403 })
    }

    const body = await request.json()
    const { startDate, endDate, dayOfWeek, reason } = body

    // Validation
    if (!startDate && dayOfWeek === undefined) {
      return NextResponse.json({ 
        error: 'Either startDate or dayOfWeek must be provided' 
      }, { status: 400 })
    }

    if (dayOfWeek !== undefined && (dayOfWeek < 0 || dayOfWeek > 6)) {
      return NextResponse.json({ 
        error: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' 
      }, { status: 400 })
    }

    // For date ranges, ensure endDate is after startDate
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ 
        error: 'End date must be after start date' 
      }, { status: 400 })
    }

    // Prevent overlapping date ranges (basic check)
    if (startDate) {
      const checkStart = new Date(startDate)
      const checkEnd = endDate ? new Date(endDate) : checkStart

      const overlapping = await prisma.musicianUnavailability.findFirst({
        where: {
          userId: session.user.id,
          startDate: { not: null },
          OR: [
            {
              AND: [
                { startDate: { lte: checkEnd } },
                { endDate: { gte: checkStart } }
              ]
            },
            {
              AND: [
                { startDate: { lte: checkEnd } },
                { endDate: null },
                { startDate: { gte: checkStart } }
              ]
            }
          ]
        }
      })

      if (overlapping) {
        return NextResponse.json({ 
          error: 'This date range overlaps with an existing unavailability' 
        }, { status: 400 })
      }
    }

    // Check for duplicate day-of-week entries
    if (dayOfWeek !== undefined) {
      const existing = await prisma.musicianUnavailability.findFirst({
        where: {
          userId: session.user.id,
          dayOfWeek: dayOfWeek
        }
      })

      if (existing) {
        return NextResponse.json({ 
          error: `You already have unavailability set for this day of the week` 
        }, { status: 400 })
      }
    }

    const unavailability = await prisma.musicianUnavailability.create({
      data: {
        userId: session.user.id,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        reason: reason || null
      }
    })

    return NextResponse.json({ unavailability }, { status: 201 })
  } catch (error) {
    console.error('Error creating musician availability:', error)
    return NextResponse.json({ error: 'Failed to create availability' }, { status: 500 })
  }
} 