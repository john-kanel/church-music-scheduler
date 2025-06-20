import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
        churchId: true,
        church: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const invitations = await prisma.invitation.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        churchId: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      users: users.map(user => ({
        ...user,
        churchName: user.church?.name
      })),
      invitations,
      summary: {
        totalUsers: users.length,
        totalInvitations: invitations.length,
        verifiedUsers: users.filter(u => u.isVerified).length,
        unverifiedUsers: users.filter(u => !u.isVerified).length
      }
    })

  } catch (error) {
    console.error('Debug users error:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: error },
      { status: 500 }
    )
  }
} 