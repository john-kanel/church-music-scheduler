import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/pastor-invitations - List pastor invitations for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and associate directors can view pastor invitations
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden - Directors only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING, ACCEPTED, EXPIRED

    // Build filter - only show pastor invitations
    const whereClause: any = {
      churchId: session.user.churchId,
      role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] }
    }

    if (status) {
      whereClause.status = status
    }

    const pastorInvitations = await prisma.invitation.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        expiresAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Also get existing pastor users to show who's already signed up
    const existingPastors = await prisma.user.findMany({
      where: {
        churchId: session.user.churchId,
        role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ 
      invitations: pastorInvitations,
      existingPastors: existingPastors
    })
  } catch (error) {
    console.error('Error fetching pastor invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pastor invitations' },
      { status: 500 }
    )
  }
} 