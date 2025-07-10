import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadFileToS3, getContentType, validateFileSize, validateFileType } from '@/lib/s3'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId } = await params

    // Verify the event exists and user has access
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        churchId: session.user.churchId
      }
    })

    // Check if user has permission to upload documents (directors and pastors only)
    const canUpload = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)

    if (!event || !canUpload) {
      return NextResponse.json({ error: 'Event not found or access denied' }, { status: 404 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (10MB limit)
    if (!validateFileSize(file.size, 10)) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    // Validate file type (documents and music files)
    const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'mp3', 'wav', 'mp4', 'jpg', 'jpeg', 'png']
    if (!validateFileType(file.name, allowedTypes)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT, MP3, WAV, MP4, JPG, PNG' 
      }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Get content type
    const contentType = getContentType(file.name)

    // Upload to S3 in event-specific folder
    const result = await uploadFileToS3(buffer, file.name, contentType, `events/${eventId}`)

    if (!result.success) {
      console.error('S3 upload failed:', result.error)
      return NextResponse.json({ error: result.error || 'Upload failed' }, { status: 500 })
    }

    // Save document metadata to database
    const document = await prisma.eventDocument.create({
      data: {
        eventId,
        filename: result.key, // S3 key stored in filename field
        originalFilename: file.name,
        filePath: result.url || '', // S3 URL
        fileSize: file.size,
        mimeType: contentType,
        uploadedBy: session.user.id,
        uploadedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        originalFilename: document.originalFilename,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        uploadedAt: document.uploadedAt
      }
    })

  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
} 