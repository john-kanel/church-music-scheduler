import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFileFromS3 } from '@/lib/s3'

// PUT - Update document metadata
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
    const { title, description, order } = await request.json()

    // Check if user has permission (directors and pastors only)
    const canEdit = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)
    if (!canEdit) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify document exists and belongs to user's church
    const existingDocument = await prisma.churchDocument.findFirst({
      where: {
        id,
        churchId: session.user.churchId
      }
    })

    if (!existingDocument) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const document = await prisma.churchDocument.update({
      where: { id },
      data: {
        title,
        description,
        ...(order !== undefined && { order })
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Error updating church document:', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

// DELETE - Delete document
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

    // Get document to delete from S3
    const document = await prisma.churchDocument.findFirst({
      where: {
        id,
        churchId: session.user.churchId
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete from S3
    const s3Result = await deleteFileFromS3(document.filename)
    if (!s3Result.success) {
      console.warn('Failed to delete file from S3:', s3Result.error)
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await prisma.churchDocument.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting church document:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
} 