import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const transfer = await prisma.ownershipTransfer.findUnique({
      where: { token: params.token },
      include: {
        church: {
          select: { name: true }
        }
      }
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    // Get inviter details
    const inviter = await prisma.user.findUnique({
      where: { id: transfer.invitedBy },
      select: { firstName: true, lastName: true }
    })

    return NextResponse.json({
      transfer: {
        ...transfer,
        inviter
      }
    })
  } catch (error) {
    console.error('Error fetching ownership transfer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 