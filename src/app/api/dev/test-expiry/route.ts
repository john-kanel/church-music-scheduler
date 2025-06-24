import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await request.json()

    if (action === 'expire') {
      // Set subscription to expired
      await prisma.church.update({
        where: { id: session.user.churchId },
        data: {
          subscriptionStatus: 'canceled',
          subscriptionEnds: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        }
      })

      return NextResponse.json({ message: 'Subscription set to expired' })
    }

    if (action === 'restore') {
      // Restore to active trial
      await prisma.church.update({
        where: { id: session.user.churchId },
        data: {
          subscriptionStatus: 'trialing',
          subscriptionEnds: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }
      })

      return NextResponse.json({ message: 'Subscription restored to active trial' })
    }

    if (action === 'expire-soon') {
      // Set to expire in 2 days (for testing warning)
      await prisma.church.update({
        where: { id: session.user.churchId },
        data: {
          subscriptionStatus: 'trialing',
          subscriptionEnds: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
        }
      })

      return NextResponse.json({ message: 'Subscription set to expire in 2 days' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in test-expiry:', error)
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    )
  }
} 