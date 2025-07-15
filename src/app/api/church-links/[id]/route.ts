import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// PUT - Update link
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { title, description, url, order } = await request.json()

    // Check if user has permission (directors and pastors only)
    const canEdit = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)
    if (!canEdit) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate URL format if provided
    if (url) {
      const urlPattern = /^https?:\/\/.+/i
      if (!urlPattern.test(url)) {
        return NextResponse.json({ 
          error: 'Invalid URL format. Please include http:// or https://' 
        }, { status: 400 })
      }
    }

    // Verify link exists and belongs to user's church
    const existingLink = await prisma.churchLink.findFirst({
      where: {
        id,
        churchId: session.user.churchId
      }
    })

    if (!existingLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    const link = await prisma.churchLink.update({
      where: { id },
      data: {
        title,
        description,
        url,
        ...(order !== undefined && { order })
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    return NextResponse.json({ link })
  } catch (error) {
    console.error('Error updating church link:', error)
    return NextResponse.json({ error: 'Failed to update link' }, { status: 500 })
  }
}

// DELETE - Delete link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if user has permission (directors and pastors only)
    const canDelete = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)
    if (!canDelete) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify link exists and belongs to user's church
    const link = await prisma.churchLink.findFirst({
      where: {
        id,
        churchId: session.user.churchId
      }
    })

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    // Delete from database
    await prisma.churchLink.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting church link:', error)
    return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 })
  }
} 