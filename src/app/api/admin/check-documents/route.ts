import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkFileExists } from '@/lib/s3'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

// Initialize S3 client for listing
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// Check which documents are missing from S3 and diagnose mismatches
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can run this diagnostic
    const canAccess = ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(session.user.role)
    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const url = new URL(request.url)
    const eventId = url.searchParams.get('eventId')
    const listS3 = url.searchParams.get('listS3') === 'true'

    // Get all documents for this church (or specific event)
    const documents = await prisma.eventDocument.findMany({
      where: {
        event: {
          churchId: session.user.churchId,
          ...(eventId ? { id: eventId } : {})
        }
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startTime: true
          }
        }
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    })

    // Check each document exists in S3
    const results = {
      total: documents.length,
      existing: 0,
      missing: 0,
      missingDocuments: [] as Array<{
        id: string
        originalFilename: string
        eventId: string
        eventName: string
        eventDate: string
        s3KeyInDatabase: string
        uploadedAt: string
        s3FilesInEventFolder?: string[]
      }>,
      existingDocuments: [] as Array<{
        id: string
        originalFilename: string
        eventName: string
        eventDate: string
        s3Key: string
      }>,
      s3BucketInfo: null as { bucket: string; region: string } | null
    }

    // Add S3 bucket info for reference
    results.s3BucketInfo = {
      bucket: process.env.AWS_S3_BUCKET_NAME || 'not set',
      region: process.env.AWS_REGION || 'not set'
    }

    for (const doc of documents) {
      const { exists, error } = await checkFileExists(doc.filename)
      
      if (exists) {
        results.existing++
        results.existingDocuments.push({
          id: doc.id,
          originalFilename: doc.originalFilename,
          eventName: doc.event.name,
          eventDate: doc.event.startTime.toISOString(),
          s3Key: doc.filename
        })
      } else {
        results.missing++
        
        const missingDoc: typeof results.missingDocuments[0] = {
          id: doc.id,
          originalFilename: doc.originalFilename,
          eventId: doc.eventId,
          eventName: doc.event.name,
          eventDate: doc.event.startTime.toISOString(),
          s3KeyInDatabase: doc.filename,
          uploadedAt: doc.uploadedAt.toISOString()
        }

        // If listS3 is true, also list what files ARE in S3 for this event's folder
        if (listS3) {
          try {
            const prefix = `events/${doc.eventId}/`
            const listCommand = new ListObjectsV2Command({
              Bucket: process.env.AWS_S3_BUCKET_NAME!,
              Prefix: prefix,
              MaxKeys: 50
            })
            const listResult = await s3Client.send(listCommand)
            missingDoc.s3FilesInEventFolder = listResult.Contents?.map(obj => obj.Key || '') || []
          } catch (listError) {
            console.error('Error listing S3 folder:', listError)
          }
        }
        
        results.missingDocuments.push(missingDoc)
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: results.total,
        existing: results.existing,
        missing: results.missing
      },
      s3BucketInfo: results.s3BucketInfo,
      missingDocuments: results.missingDocuments,
      existingDocuments: results.existingDocuments,
      hint: results.missing > 0 
        ? 'Add ?listS3=true to see what files actually exist in S3 for missing documents (helps diagnose key mismatches)'
        : undefined
    })

  } catch (error) {
    console.error('Error checking documents:', error)
    return NextResponse.json(
      { error: 'Failed to check documents', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// Delete orphaned document records (documents where file is missing from S3)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors can clean up
    const canAccess = ['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)
    if (!canAccess) {
      return NextResponse.json({ error: 'Only directors can clean up documents' }, { status: 403 })
    }

    // Get the document IDs to delete from the request body
    const body = await request.json()
    const { documentIds } = body as { documentIds?: string[] }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'No document IDs provided' }, { status: 400 })
    }

    // Delete the orphaned records from database (files are already gone from S3)
    const deleteResult = await prisma.eventDocument.deleteMany({
      where: {
        id: { in: documentIds },
        event: {
          churchId: session.user.churchId
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deleteResult.count} orphaned document records`,
      deletedCount: deleteResult.count
    })

  } catch (error) {
    console.error('Error cleaning up documents:', error)
    return NextResponse.json(
      { error: 'Failed to clean up documents' },
      { status: 500 }
    )
  }
}

// Fix document records by updating S3 key to match actual file in S3
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors can fix documents
    const canAccess = ['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)
    if (!canAccess) {
      return NextResponse.json({ error: 'Only directors can fix documents' }, { status: 403 })
    }

    const body = await request.json()
    const { documentId, newS3Key } = body as { documentId: string; newS3Key: string }

    if (!documentId || !newS3Key) {
      return NextResponse.json({ error: 'documentId and newS3Key are required' }, { status: 400 })
    }

    // Verify the new key actually exists in S3
    const { exists } = await checkFileExists(newS3Key)
    if (!exists) {
      return NextResponse.json({ error: 'The new S3 key does not exist in S3' }, { status: 400 })
    }

    // Update the document record
    const updated = await prisma.eventDocument.updateMany({
      where: {
        id: documentId,
        event: {
          churchId: session.user.churchId
        }
      },
      data: {
        filename: newS3Key,
        filePath: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${newS3Key}`
      }
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Document S3 key updated successfully'
    })

  } catch (error) {
    console.error('Error fixing document:', error)
    return NextResponse.json(
      { error: 'Failed to fix document' },
      { status: 500 }
    )
  }
}
