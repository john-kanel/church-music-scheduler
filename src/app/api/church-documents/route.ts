import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadFileToS3, deleteFileFromS3, getContentType } from '@/lib/s3'

// GET - List all church documents
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const documents = await prisma.churchDocument.findMany({
      where: { churchId: session.user.churchId },
      orderBy: { order: 'asc' },
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

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching church documents:', error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

// POST - Upload new church document
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to upload documents (directors and pastors only)
    const canUpload = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)
    if (!canUpload) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string || ''

    if (!file || !title) {
      return NextResponse.json({ error: 'File and title are required' }, { status: 400 })
    }

    // Validate file type (documents only)
    const allowedTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx']
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX' 
      }, { status: 400 })
    }

    // File size warning for large files (10MB+)
    const fileSizeMB = file.size / (1024 * 1024)
    let sizeWarning = ''
    if (fileSizeMB > 10) {
      sizeWarning = `Large file (${fileSizeMB.toFixed(1)}MB) - may take time for musicians to download`
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Get content type
    const contentType = getContentType(file.name)

    // Upload to S3 in church-specific folder
    const result = await uploadFileToS3(buffer, file.name, contentType, `church-documents/${session.user.churchId}`)

    if (!result.success) {
      console.error('S3 upload failed:', result.error)
      return NextResponse.json({ error: result.error || 'Upload failed' }, { status: 500 })
    }

    // Get the next order number
    const lastDocument = await prisma.churchDocument.findFirst({
      where: { churchId: session.user.churchId },
      orderBy: { order: 'desc' }
    })
    const nextOrder = (lastDocument?.order || 0) + 1

    // Save document metadata to database
    const document = await prisma.churchDocument.create({
      data: {
        title,
        description,
        filename: result.key, // S3 key
        originalFilename: file.name,
        filePath: result.url || '', // S3 URL
        fileSize: file.size,
        mimeType: contentType,
        order: nextOrder,
        churchId: session.user.churchId,
        uploadedBy: session.user.id
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

    return NextResponse.json({
      success: true,
      document,
      sizeWarning
    })

  } catch (error) {
    console.error('Error uploading church document:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
} 