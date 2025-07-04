import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId } = await params

    // Fetch event documents ordered by upload date
    const documents = await prisma.eventDocument.findMany({
      where: { eventId },
      orderBy: { uploadedAt: 'desc' }
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching event documents:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
} 