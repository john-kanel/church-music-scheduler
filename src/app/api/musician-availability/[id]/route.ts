import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PUT /api/musician-availability/[id] - Update unavailability
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only musicians can manage their own availability
    if (session.user.role !== 'MUSICIAN') {
      return NextResponse.json({ error: 'Only musicians can manage availability' }, { status: 403 })
    }

    // Check if the record exists and belongs to the user
    const existing = await prisma.musicianUnavailability.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Unavailability record not found' }, { status: 404 })
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

    // Check for overlapping date ranges (excluding current record)
    if (startDate) {
      const checkStart = new Date(startDate)
      const checkEnd = endDate ? new Date(endDate) : checkStart

      const overlapping = await prisma.musicianUnavailability.findFirst({
        where: {
          userId: session.user.id,
          id: { not: id }, // Exclude current record
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

    // Check for duplicate day-of-week entries (excluding current record)
    if (dayOfWeek !== undefined) {
      const duplicate = await prisma.musicianUnavailability.findFirst({
        where: {
          userId: session.user.id,
          id: { not: id }, // Exclude current record
          dayOfWeek: dayOfWeek
        }
      })

      if (duplicate) {
        return NextResponse.json({ 
          error: `You already have unavailability set for this day of the week` 
        }, { status: 400 })
      }
    }

    const updatedUnavailability = await prisma.musicianUnavailability.update({
      where: { id },
      data: {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        reason: reason || null
      }
    })

    return NextResponse.json({ unavailability: updatedUnavailability })
  } catch (error) {
    console.error('Error updating musician availability:', error)
    return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 })
  }
}

// DELETE /api/musician-availability/[id] - Delete unavailability
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only musicians can manage their own availability
    if (session.user.role !== 'MUSICIAN') {
      return NextResponse.json({ error: 'Only musicians can manage availability' }, { status: 403 })
    }

    // Check if the record exists and belongs to the user
    const existing = await prisma.musicianUnavailability.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Unavailability record not found' }, { status: 404 })
    }

    await prisma.musicianUnavailability.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Unavailability deleted successfully' })
  } catch (error) {
    console.error('Error deleting musician availability:', error)
    return NextResponse.json({ error: 'Failed to delete availability' }, { status: 500 })
  }
} 