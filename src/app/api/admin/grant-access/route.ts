import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { churchId, months } = await request.json()

    if (!churchId || !months || months <= 0) {
      return NextResponse.json(
        { error: 'Church ID and valid months required' },
        { status: 400 }
      )
    }

    // Calculate the new subscription end date
    const currentDate = new Date()
    const subscriptionEnds = new Date(currentDate)
    subscriptionEnds.setMonth(currentDate.getMonth() + months)

    // Update the church
    const updatedChurch = await prisma.church.update({
      where: { id: churchId },
      data: {
        subscriptionStatus: 'active',
        subscriptionEnds: subscriptionEnds,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionEnds: true
      }
    })

    return NextResponse.json({
      message: `Successfully granted ${months} months of free access`,
      church: updatedChurch
    })

  } catch (error) {
    console.error('Grant access error:', error)
    return NextResponse.json(
      { error: 'Failed to grant access' },
      { status: 500 }
    )
  }
} 