import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PUT /api/musicians/[musicianId] - Update a specific musician
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ musicianId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors, pastors, and associate pastors can update musician details
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ 
        error: `Insufficient permissions. Only directors, pastors, and associate pastors can edit musicians. Your role: ${session.user.role}` 
      }, { status: 403 })
    }

    const { musicianId } = await params
    const body = await request.json()
    const { firstName, lastName, email, phone, isVerified, status, instruments, privateNotes } = body

    // Validation
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
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

    // Check if email is being changed and if it's already in use
    if (email !== existingMusician.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: email,
          id: { not: musicianId }
        }
      })

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email address is already in use' },
          { status: 400 }
        )
      }
    }

    // Update the musician and invitation status
    const updatedMusician = await prisma.user.update({
      where: { id: musicianId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        ...(Array.isArray(instruments) && { instruments }),
        ...(typeof isVerified === 'boolean' && { isVerified }),
        ...(status && { 
          isVerified: status === 'active'
        }),
        ...(typeof privateNotes === 'string' && { privateNotes: privateNotes.trim() })
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        instruments: true,
        isVerified: true,
        createdAt: true,
        // privateNotes: true
      }
    })

    // Update invitation status if status was changed
    if (status) {
      const invitationStatus = status === 'active' ? 'ACCEPTED' : 'PENDING'
      await prisma.invitation.updateMany({
        where: {
          email: email.trim().toLowerCase(),
          churchId: session.user.churchId
        },
        data: {
          status: invitationStatus
        }
      })
    }

    return NextResponse.json({
      message: 'Musician updated successfully',
      musician: {
        ...updatedMusician,
        instruments: updatedMusician.instruments || [],
        status: status || (updatedMusician.isVerified ? 'active' : 'pending')
      }
    })

  } catch (error) {
    console.error('Error updating musician:', error)
    return NextResponse.json(
      { error: 'Failed to update musician' },
      { status: 500 }
    )
  }
}

// GET /api/musicians/[musicianId] - Get a specific musician
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

    // Find the musician
    const musician = await prisma.user.findFirst({
      where: {
        id: musicianId,
        churchId: session.user.churchId
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        instruments: true,
        isVerified: true,
        emailNotifications: true,
        smsNotifications: true,
        createdAt: true,
        // privateNotes: true,
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
          include: {
            event: {
              select: {
                id: true,
                name: true,
                startTime: true
              }
            }
          },
          orderBy: {
            event: {
              startTime: 'desc'
            }
          },
          take: 10
        }
      }
    })

    if (!musician) {
      return NextResponse.json({ error: 'Musician not found' }, { status: 404 })
    }

    // Get invitation status for this musician
    const invitation = await prisma.invitation.findFirst({
      where: {
        email: musician.email,
        churchId: session.user.churchId
      },
      select: {
        status: true
      }
    })

    // Determine status based on invitation acceptance
    let status = 'pending'
    if (invitation && invitation.status === 'ACCEPTED') {
      status = 'active'
    } else if (musician.isVerified) {
      // If no invitation found but user is verified, they're active
      // (this handles legacy users who were created before invitation system)
      status = 'active'
    }

    // Format the response
    const formattedMusician = {
      id: musician.id,
      firstName: musician.firstName,
      lastName: musician.lastName,
      name: `${musician.firstName} ${musician.lastName}`.trim(),
      email: musician.email,
      phone: musician.phone,
      role: musician.role,
      instruments: musician.instruments || [],
      isVerified: musician.isVerified,
      status: status,
      emailNotifications: musician.emailNotifications,
      smsNotifications: musician.smsNotifications,
      joinedAt: musician.createdAt,
      groups: musician.groupMemberships.map((gm: any) => gm.group),
      recentEvents: musician.eventAssignments.map((ea: any) => ({
        id: ea.event.id,
        name: ea.event.name,
        startTime: ea.event.startTime,
        status: ea.status,
        role: ea.roleName
      }))
    }

    return NextResponse.json({ musician: formattedMusician })

  } catch (error) {
    console.error('Error fetching musician:', error)
    return NextResponse.json(
      { error: 'Failed to fetch musician' },
      { status: 500 }
    )
  }
}

// DELETE /api/musicians/[musicianId] - Delete a specific musician
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ musicianId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors, pastors, and associate pastors can delete musicians
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ 
        error: `Insufficient permissions. Only directors, pastors, and associate pastors can delete musicians. Your role: ${session.user.role}` 
      }, { status: 403 })
    }

    const { musicianId } = await params

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

    // Use a transaction to ensure all related data is cleaned up
    await prisma.$transaction(async (tx) => {
      // Delete event assignments
      await tx.eventAssignment.deleteMany({
        where: { userId: musicianId }
      })

      // Delete group memberships
      await tx.groupMember.deleteMany({
        where: { userId: musicianId }
      })

      // Delete musician unavailability records
      await tx.musicianUnavailability.deleteMany({
        where: { userId: musicianId }
      })

      // Delete invitations (if any)
      await tx.invitation.deleteMany({
        where: { 
          email: existingMusician.email,
          churchId: session.user.churchId
        }
      })

      // Finally, delete the user
      await tx.user.delete({
        where: { id: musicianId }
      })
    })

    return NextResponse.json({
      message: 'Musician deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting musician:', error)
    return NextResponse.json(
      { error: 'Failed to delete musician' },
      { status: 500 }
    )
  }
} 