import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PrismaClient } from '@prisma/client'

// Force rebuild - TypeScript fixes applied
export async function GET() {
  try {
    const churches = await prisma.church.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        stripeCustomerId: true,
        subscriptionStatus: true,
        subscriptionEnds: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            events: true
          }
        },
        users: {
          take: 1,
          orderBy: {
            updatedAt: 'desc'
          },
          select: {
            updatedAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Format the response to include computed fields
    const formattedChurches = churches.map((church: any) => ({
      id: church.id,
      name: church.name,
      email: church.email,
      phone: church.phone || '',
      stripeCustomerId: church.stripeCustomerId,
      subscriptionStatus: church.subscriptionStatus,
      subscriptionEnds: church.subscriptionEnds,
      createdAt: church.createdAt,
      userCount: church._count.users,
      eventCount: church._count.events,
      lastActivity: church.users[0]?.updatedAt || null
    }))

    return NextResponse.json({ churches: formattedChurches })

  } catch (error) {
    console.error('Admin churches error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch churches' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { churchId } = await request.json()

    if (!churchId) {
      return NextResponse.json(
        { error: 'Church ID is required' },
        { status: 400 }
      )
    }

    // Check if church exists
    const church = await prisma.church.findUnique({
      where: { id: churchId },
      select: { 
        id: true, 
        name: true,
        _count: {
          select: {
            users: true,
            events: true
          }
        }
      }
    })

    if (!church) {
      return NextResponse.json(
        { error: 'Church not found' },
        { status: 404 }
      )
    }

    // Delete church and all related data in a transaction
    await prisma.$transaction(async (tx: PrismaClient) => {
      // Delete all event assignments for events belonging to this church
      await tx.eventAssignment.deleteMany({
        where: {
          event: {
            churchId: churchId
          }
        }
      })

      // Delete all events belonging to this church
      await tx.event.deleteMany({
        where: { churchId: churchId }
      })

      // Delete all event templates belonging to this church
      await tx.eventTemplate.deleteMany({
        where: { churchId: churchId }
      })

      // Delete all groups belonging to this church
      await tx.group.deleteMany({
        where: { churchId: churchId }
      })

      // Delete all communications belonging to this church
      await tx.communication.deleteMany({
        where: { churchId: churchId }
      })

      // Delete all invitations belonging to this church
      await tx.invitation.deleteMany({
        where: { churchId: churchId }
      })

      // Delete all activities belonging to this church
      await tx.activity.deleteMany({
        where: { churchId: churchId }
      })

      // Delete all users belonging to this church
      await tx.user.deleteMany({
        where: { churchId: churchId }
      })

      // Finally, delete the church itself
      await tx.church.delete({
        where: { id: churchId }
      })
    })

    return NextResponse.json({ 
      message: `Church "${church.name}" and all related data deleted successfully`,
      deletedChurch: {
        id: church.id,
        name: church.name,
        userCount: church._count.users,
        eventCount: church._count.events
      }
    })

  } catch (error) {
    console.error('Delete church error:', error)
    return NextResponse.json(
      { error: 'Failed to delete church' },
      { status: 500 }
    )
  }
} 