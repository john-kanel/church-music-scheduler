import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can delete hymnals
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params

    // Verify the hymnal exists and belongs to the user's church
    const hymnal = await prisma.hymnal.findFirst({
      where: {
        id,
        churchId: session.user.churchId
      }
    })

    if (!hymnal) {
      return NextResponse.json({ error: 'Hymnal not found' }, { status: 404 })
    }

    // Delete the hymnal (hymns will be cascade deleted)
    await prisma.hymnal.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting hymnal:', error)
    return NextResponse.json(
      { error: 'Failed to delete hymnal' },
      { status: 500 }
    )
  }
}
