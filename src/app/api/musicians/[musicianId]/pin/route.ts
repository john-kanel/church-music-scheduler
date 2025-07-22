import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateMusicianPin } from '@/lib/utils'

// GET /api/musicians/[musicianId]/pin - Get musician's PIN (for directors)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ musicianId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { musicianId } = await params

    // Check if user is a director/pastor or the musician themselves
    const isDirector = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)
    const isOwnProfile = session.user.id === musicianId

    if (!isDirector && !isOwnProfile) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify the musician exists and belongs to the church
    const musician = await prisma.user.findFirst({
      where: {
        id: musicianId,
        churchId: session.user.churchId,
        role: 'MUSICIAN'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        pin: true
      }
    })

    if (!musician) {
      return NextResponse.json({ error: 'Musician not found' }, { status: 404 })
    }

    return NextResponse.json({
      musicianId: musician.id,
      name: `${musician.firstName} ${musician.lastName}`,
      pin: musician.pin
    })

  } catch (error) {
    console.error('Error fetching musician PIN:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/musicians/[musicianId]/pin - Update musician's PIN
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ musicianId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { musicianId } = await params
    const { pin } = await request.json()

    // Check if user is a director/pastor or the musician themselves
    const isDirector = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)
    const isOwnProfile = session.user.id === musicianId

    if (!isDirector && !isOwnProfile) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Validate PIN format (4 digits)
    if (pin && (!/^\d{4}$/.test(pin))) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
    }

    // Verify the musician exists and belongs to the church
    const musician = await prisma.user.findFirst({
      where: {
        id: musicianId,
        churchId: session.user.churchId,
        role: 'MUSICIAN'
      }
    })

    if (!musician) {
      return NextResponse.json({ error: 'Musician not found' }, { status: 404 })
    }

    // Update the PIN (or generate new one if not provided)
    const newPin = pin || generateMusicianPin()

    const updatedMusician = await prisma.user.update({
      where: { id: musicianId },
      data: { pin: newPin },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        pin: true
      }
    })

    return NextResponse.json({
      message: 'PIN updated successfully',
      musicianId: updatedMusician.id,
      name: `${updatedMusician.firstName} ${updatedMusician.lastName}`,
      pin: updatedMusician.pin
    })

  } catch (error) {
    console.error('Error updating musician PIN:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 