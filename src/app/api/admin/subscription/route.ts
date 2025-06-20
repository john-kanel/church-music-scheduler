import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(request: NextRequest) {
  try {
    const { churchId, status } = await request.json()

    if (!churchId || !status) {
      return NextResponse.json(
        { error: 'Church ID and status required' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['trial', 'active', 'suspended', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid subscription status' },
        { status: 400 }
      )
    }

    // Update subscription status
    const updatedChurch = await prisma.church.update({
      where: { id: churchId },
      data: {
        subscriptionStatus: status,
        updatedAt: new Date(),
        // If setting to suspended or cancelled, don't extend the subscription
        ...(status === 'suspended' || status === 'cancelled' ? {} : {})
      },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionEnds: true
      }
    })

    return NextResponse.json({
      message: 'Subscription status updated successfully',
      church: updatedChurch
    })

  } catch (error) {
    console.error('Update subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to update subscription status' },
      { status: 500 }
    )
  }
} 