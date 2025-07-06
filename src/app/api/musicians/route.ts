import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkSubscriptionStatus, createSubscriptionErrorResponse } from '@/lib/subscription-check'

// GET /api/musicians - List musicians for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription status
    const subscriptionStatus = await checkSubscriptionStatus(session.user.churchId)
    if (!subscriptionStatus.isActive) {
      return createSubscriptionErrorResponse()
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const verified = searchParams.get('verified')

    // Build search filter
    const whereClause: any = {
      churchId: session.user.churchId,
      role: 'MUSICIAN' // Only return musicians, not directors/pastors
    }

    // Filter by verified status if requested
    if (verified === 'true') {
      whereClause.isVerified = true
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    const musicians = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        emailNotifications: true,
        smsNotifications: true,
        createdAt: true,
        groupMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        eventAssignments: {
          where: {
            event: {
              startTime: {
                gte: new Date() // Only upcoming events
              }
            }
          },
          include: {
            event: {
              select: {
                id: true,
                name: true,
                startTime: true
              }
            }
          },
          take: 5 // Limit to next 5 events
        },
        _count: {
          select: {
            eventAssignments: {
              where: {
                status: 'ACCEPTED'
              }
            }
          }
        }
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    // Get invitation status for each musician
    const musicianEmails = musicians.map(m => m.email)
    const invitations = await prisma.invitation.findMany({
      where: {
        email: { in: musicianEmails },
        churchId: session.user.churchId
      },
      select: {
        email: true,
        status: true
      }
    })

    // Format the response
    const formattedMusicians = musicians.map(musician => {
      // Find the invitation for this musician
      const invitation = invitations.find(inv => inv.email === musician.email)
      
      // Determine status based on invitation acceptance
      let status = 'pending'
      if (invitation && invitation.status === 'ACCEPTED') {
        status = 'active'
      } else if (musician.isVerified) {
        // If no invitation found but user is verified, they're active
        // (this handles legacy users who were created before invitation system)
        status = 'active'
      }
      
      return {
        id: musician.id,
        firstName: musician.firstName,
        lastName: musician.lastName,
        name: `${musician.firstName} ${musician.lastName}`.trim(),
        email: musician.email,
        phone: musician.phone,
        isVerified: musician.isVerified,
        status: status,
        emailNotifications: musician.emailNotifications,
        smsNotifications: musician.smsNotifications,
        createdAt: musician.createdAt.toISOString(), // Convert Date to ISO string
        instrument: 'Musician', // Placeholder - we can add proper instrument field later
        groups: musician.groupMemberships.map(gm => gm.group),
        upcomingEvents: musician.eventAssignments.map(ea => ({
          id: ea.event.id,
          name: ea.event.name,
          startTime: ea.event.startTime,
          status: ea.status,
          role: ea.roleName
        })),
        totalAcceptedAssignments: musician._count.eventAssignments
      }
    })

    return NextResponse.json({ musicians: formattedMusicians })
  } catch (error) {
    console.error('Error fetching musicians:', error)
    return NextResponse.json(
      { error: 'Failed to fetch musicians' },
      { status: 500 }
    )
  }
}

// PUT /api/musicians - Bulk update musician roles or settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can update musician settings
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { musicianId, updates } = body

    // Validation
    if (!musicianId || !updates) {
      return NextResponse.json(
        { error: 'Musician ID and updates are required' },
        { status: 400 }
      )
    }

    // Verify musician belongs to church
    const existingMusician = await prisma.user.findFirst({
      where: {
        id: musicianId,
        churchId: session.user.churchId
      }
    })

    if (!existingMusician) {
      return NextResponse.json({ error: 'Musician not found' }, { status: 404 })
    }

    // Update the musician
    const updatedMusician = await prisma.user.update({
      where: { id: musicianId },
      data: {
        ...updates,
        // Prevent updating sensitive fields
        email: undefined,
        password: undefined,
        churchId: undefined,
        role: undefined
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        emailNotifications: true,
        smsNotifications: true
      }
    })

    return NextResponse.json({
      message: 'Musician updated successfully',
      musician: updatedMusician
    })

  } catch (error) {
    console.error('Error updating musician:', error)
    return NextResponse.json(
      { error: 'Failed to update musician' },
      { status: 500 }
    )
  }
} 