import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId, documentId } = params

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

    // Check if the file exists on disk
    const filePath = path.join(process.cwd(), 'uploads', document.filePath)
    
    if (!fs.existsSync(filePath)) {
      console.error('File not found on disk:', filePath)
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath)

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': document.mimeType || 'application/pdf',
        'Content-Disposition': `inline; filename="${document.originalFilename}"`,
        'Content-Length': document.fileSize.toString(),
        'Cache-Control': 'private, max-age=3600' // Cache for 1 hour
      }
    })
  } catch (error) {
    console.error('Error serving document:', error)
    return NextResponse.json({ error: 'Failed to serve document' }, { status: 500 })
  }
} 