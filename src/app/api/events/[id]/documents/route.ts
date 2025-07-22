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
    console.log('🔧 DOCUMENT UPLOAD: Starting upload process')
    
    const session = await getServerSession(authOptions)
    console.log('🔧 DOCUMENT UPLOAD: Session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      churchId: session?.user?.churchId,
      role: session?.user?.role
    })
    
    if (!session) {
      console.log('🚨 DOCUMENT UPLOAD: No session - unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId } = await params
    console.log('🔧 DOCUMENT UPLOAD: Event ID:', eventId)

    // Verify the event exists and user has access
    console.log('🔧 DOCUMENT UPLOAD: Checking event access...')
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        churchId: session.user.churchId
      }
    })
    console.log('🔧 DOCUMENT UPLOAD: Event found:', !!event)

    // Check if user has permission to upload documents (directors and pastors only)
    const canUpload = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)
    console.log('🔧 DOCUMENT UPLOAD: Can upload:', canUpload, 'Role:', session.user.role)

    if (!event || !canUpload) {
      console.log('🚨 DOCUMENT UPLOAD: Access denied - event exists:', !!event, 'can upload:', canUpload)
      return NextResponse.json({ error: 'Event not found or access denied' }, { status: 404 })
    }

    // Parse form data
    console.log('🔧 DOCUMENT UPLOAD: Parsing form data...')
    const formData = await request.formData()
    const file = formData.get('file') as File
    console.log('🔧 DOCUMENT UPLOAD: File received:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    })

    if (!file) {
      console.log('🚨 DOCUMENT UPLOAD: No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (10MB limit)
    console.log('🔧 DOCUMENT UPLOAD: Validating file size...')
    if (!validateFileSize(file.size, 10)) {
      console.log('🚨 DOCUMENT UPLOAD: File too large:', file.size)
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    // Validate file type (documents and music files)
    console.log('🔧 DOCUMENT UPLOAD: Validating file type...')
    const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'mp3', 'wav', 'mp4', 'jpg', 'jpeg', 'png']
    if (!validateFileType(file.name, allowedTypes)) {
      console.log('🚨 DOCUMENT UPLOAD: Invalid file type:', file.name)
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT, MP3, WAV, MP4, JPG, PNG' 
      }, { status: 400 })
    }

    // Convert file to buffer
    console.log('🔧 DOCUMENT UPLOAD: Converting file to buffer...')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    console.log('🔧 DOCUMENT UPLOAD: Buffer created, size:', buffer.length)

    // Get content type
    const contentType = getContentType(file.name)
    console.log('🔧 DOCUMENT UPLOAD: Content type:', contentType)

    // Upload to S3 in event-specific folder
    console.log('🔧 DOCUMENT UPLOAD: Starting S3 upload...')
    console.log('🔧 DOCUMENT UPLOAD: S3 config check:', {
      hasRegion: !!process.env.AWS_REGION,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      hasBucketName: !!process.env.AWS_S3_BUCKET_NAME,
      bucketName: process.env.AWS_S3_BUCKET_NAME
    })
    
    const result = await uploadFileToS3(buffer, file.name, contentType, `events/${eventId}`)
    console.log('🔧 DOCUMENT UPLOAD: S3 upload result:', {
      success: result.success,
      key: result.key,
      hasUrl: !!result.url,
      error: result.error
    })

    if (!result.success) {
      console.error('🚨 DOCUMENT UPLOAD: S3 upload failed:', result.error)
      return NextResponse.json({ error: result.error || 'Upload failed' }, { status: 500 })
    }

    // Save document metadata to database
    console.log('🔧 DOCUMENT UPLOAD: Saving to database...')
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
    console.log('🔧 DOCUMENT UPLOAD: Document saved to database:', document.id)

    console.log('🔧 DOCUMENT UPLOAD: Success! Returning response...')
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
    console.error('🚨 DOCUMENT UPLOAD: Caught error:', error)
    console.error('🚨 DOCUMENT UPLOAD: Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 