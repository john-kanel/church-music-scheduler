import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
    const formattedChurches = churches.map(church => ({
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