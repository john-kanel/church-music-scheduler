import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFileFromS3 } from '@/lib/s3'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId, documentId } = await params

    // Verify the event exists and user has access
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        churchId: session.user.churchId
      }
    })

    // Check if user has permission to delete documents (directors and pastors only)
    const canDelete = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)

    if (!event || !canDelete) {
      return NextResponse.json({ error: 'Event not found or access denied' }, { status: 404 })
    }

    // Fetch the document to get S3 key for deletion
    const document = await prisma.eventDocument.findFirst({
      where: { 
        id: documentId,
        eventId: eventId
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    try {
      // Delete file from S3
      const s3Key = document.filename
      await deleteFileFromS3(s3Key)
    } catch (s3Error) {
      console.error('Error deleting file from S3:', s3Error)
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete document record from database
    await prisma.eventDocument.delete({
      where: { id: documentId }
    })

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
} 