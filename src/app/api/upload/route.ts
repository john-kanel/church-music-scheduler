import { NextRequest, NextResponse } from 'next/server'
import { uploadFileToS3, getContentType, validateFileSize, validateFileType } from '@/lib/s3'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'uploads'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (10MB limit)
    if (!validateFileSize(file.size, 10)) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    // Validate file type (music documents and audio files)
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

    // Upload to S3
    const result = await uploadFileToS3(buffer, file.name, contentType, folder)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      key: result.key,
      url: result.url,
      fileName: file.name,
      size: file.size,
      contentType,
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// Handle file deletion
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'No file key provided' }, { status: 400 })
    }

    const { deleteFileFromS3 } = await import('@/lib/s3')
    const result = await deleteFileFromS3(key)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
} 