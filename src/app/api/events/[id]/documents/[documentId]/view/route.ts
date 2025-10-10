import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPresignedUrl } from '@/lib/s3'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId, documentId } = await params

    // Fetch the document from database
    const document = await prisma.eventDocument.findFirst({
      where: { 
        id: documentId,
        eventId: eventId
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Generate presigned URL for S3 file access
    // The filename field now contains the S3 key
    const s3Key = document.filename
    
    // Using 7 days (604800 seconds) - the maximum AWS allows for presigned URLs
    const presignedResult = await getPresignedUrl(s3Key, 604800) // 7 days expiry
    
    if (!presignedResult.success || !presignedResult.url) {
      console.error('Failed to generate presigned URL:', presignedResult.error)
      return NextResponse.json({ error: 'File not accessible' }, { status: 404 })
    }

    // Redirect to the presigned URL for direct S3 access
    return NextResponse.redirect(presignedResult.url)
  } catch (error) {
    console.error('Error serving document:', error)
    return NextResponse.json({ error: 'Failed to serve document' }, { status: 500 })
  }
} 