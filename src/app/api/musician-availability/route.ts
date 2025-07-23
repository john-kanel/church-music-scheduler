import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || session.user.id

    // If requesting another user's availability, ensure proper permissions
    if (userId !== session.user.id && !['DIRECTOR', 'PASTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const unavailabilities = await prisma.musicianUnavailability.findMany({
      where: {
        userId: userId,
        // Only return future unavailabilities or current ones
        OR: [
          {
            endDate: {
              gte: new Date()
            }
          },
          {
            // For single day events where startDate = endDate
            startDate: {
              gte: new Date()
            },
            endDate: null
          },
          {
            // For recurring day-of-week unavailabilities
            dayOfWeek: {
              not: null
            }
          }
        ]
      },
      orderBy: [
        { startDate: 'asc' },
        { dayOfWeek: 'asc' }
      ]
    })

    return NextResponse.json({ unavailabilities })
  } catch (error) {
    console.error('Error fetching unavailabilities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unavailabilities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { startDate, endDate, dayOfWeek, reason } = await request.json()

    // Validation
    if (!startDate && !dayOfWeek) {
      return NextResponse.json(
        { error: 'Either date range or day of week is required' },
        { status: 400 }
      )
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: 'Start date cannot be after end date' },
        { status: 400 }
      )
    }

    if (dayOfWeek !== null && (dayOfWeek < 0 || dayOfWeek > 6)) {
      return NextResponse.json(
        { error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' },
        { status: 400 }
      )
    }

    // Check for overlapping unavailabilities
    if (startDate && endDate) {
      const overlapping = await prisma.musicianUnavailability.findFirst({
        where: {
          userId: session.user.id,
          OR: [
            {
              AND: [
                { startDate: { lte: new Date(endDate) } },
                { endDate: { gte: new Date(startDate) } }
              ]
            }
          ]
        }
      })

      if (overlapping) {
        return NextResponse.json(
          { error: 'This date range overlaps with an existing unavailability period' },
          { status: 400 }
        )
      }
    }

    const unavailability = await prisma.musicianUnavailability.create({
      data: {
        userId: session.user.id,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        dayOfWeek: dayOfWeek,
        reason: reason || null
      }
    })

    return NextResponse.json({ 
      message: 'Unavailability created successfully',
      unavailability 
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating unavailability:', error)
    return NextResponse.json(
      { error: 'Failed to create unavailability' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, startDate, endDate, dayOfWeek, reason } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Unavailability ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existing = await prisma.musicianUnavailability.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Unavailability not found' },
        { status: 404 }
      )
    }

    if (existing.userId !== session.user.id && !['DIRECTOR', 'PASTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Validation
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: 'Start date cannot be after end date' },
        { status: 400 }
      )
    }

    const unavailability = await prisma.musicianUnavailability.update({
      where: { id },
      data: {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        dayOfWeek: dayOfWeek,
        reason: reason || null
      }
    })

    return NextResponse.json({ 
      message: 'Unavailability updated successfully',
      unavailability 
    })

  } catch (error) {
    console.error('Error updating unavailability:', error)
    return NextResponse.json(
      { error: 'Failed to update unavailability' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Unavailability ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existing = await prisma.musicianUnavailability.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Unavailability not found' },
        { status: 404 }
      )
    }

    if (existing.userId !== session.user.id && !['DIRECTOR', 'PASTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    await prisma.musicianUnavailability.delete({
      where: { id }
    })

    return NextResponse.json({ 
      message: 'Unavailability deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting unavailability:', error)
    return NextResponse.json(
      { error: 'Failed to delete unavailability' },
      { status: 500 }
    )
  }
} 