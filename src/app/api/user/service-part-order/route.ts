import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { eventServicePartOrder: true }
    })

    return NextResponse.json({ 
      eventServicePartOrder: user?.eventServicePartOrder || {} 
    })
  } catch (error) {
    console.error('Error fetching service part order:', error)
    return NextResponse.json({ error: 'Failed to fetch service part order' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventServicePartOrder } = await request.json()

    await prisma.user.update({
      where: { id: session.user.id },
      data: { eventServicePartOrder }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving service part order:', error)
    return NextResponse.json({ error: 'Failed to save service part order' }, { status: 500 })
  }
} 