import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        churchId: true,
        church: {
          select: {
            name: true,
            subscriptionStatus: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Format the response
    const formattedUsers = users.map((user: any) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.updatedAt, // Using updatedAt as proxy for last login
      churchId: user.churchId,
      churchName: user.church.name,
      subscriptionStatus: user.church.subscriptionStatus
    }))

    return NextResponse.json({ users: formattedUsers })

  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Delete user and all related data in a transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete related data first (foreign key constraints)
      await tx.eventAssignment.deleteMany({
        where: { userId }
      })
      
      await tx.invitation.deleteMany({
        where: { invitedBy: userId }
      })
      
      await tx.communication.deleteMany({
        where: { sentBy: userId }
      })
      
      await tx.activity.deleteMany({
        where: { userId }
      })
      
      // Finally delete the user
      await tx.user.delete({
        where: { id: userId }
      })
    })

    return NextResponse.json({ 
      success: true, 
      message: 'User and all related data deleted successfully' 
    })

  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
} 