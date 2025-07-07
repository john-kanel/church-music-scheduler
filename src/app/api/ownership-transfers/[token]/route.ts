import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    const transfer = await prisma.ownershipTransfer.findUnique({
      where: { token },
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