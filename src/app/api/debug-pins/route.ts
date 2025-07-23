import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow directors to access this debug route
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get all musicians with their PINs
    const musicians = await prisma.user.findMany({
      where: {
        churchId: session.user.churchId,
        role: 'MUSICIAN'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        pin: true
      }
    })

    return NextResponse.json({
      message: 'Debug PIN data',
      count: musicians.length,
      musicians: musicians.map(m => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        email: m.email,
        pin: m.pin,
        pinType: typeof m.pin,
        pinLength: m.pin ? m.pin.length : 0
      }))
    })

  } catch (error) {
    console.error('Error in debug-pins:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 