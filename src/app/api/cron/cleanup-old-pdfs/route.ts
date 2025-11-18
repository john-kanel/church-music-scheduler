import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { deleteFileFromS3 } from '@/lib/s3';

export async function GET(request: NextRequest) {
  try {
    // Verify this is being called by the cron service
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate 18 months ago from today
    const eighteenMonthsAgo = new Date();
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);

    console.log(`Looking for documents attached to events older than ${eighteenMonthsAgo.toISOString()}`);

    // Find event documents where the EVENT DATE is older than 18 months
    // This way, documents for future events or recurring events are preserved
    const oldDocuments = await prisma.eventDocument.findMany({
      where: {
        event: {
          startTime: {
            lt: eighteenMonthsAgo
          }
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
      }
    });

    console.log(`Found ${oldDocuments.length} documents for events older than 18 months`);

    let deletedCount = 0;
    let errorCount = 0;

    // Delete each old document
    for (const document of oldDocuments) {
      try {
        // Delete from file system if file exists (for legacy local files)
        if (document.filePath && fs.existsSync(document.filePath)) {
          fs.unlinkSync(document.filePath);
          console.log(`Deleted file: ${document.filePath}`);
        }
        // Delete from S3 if it's an S3 file
        if (document.filename && document.filename.includes('/')) {
          // The filename field often contains the S3 key
          const s3Key = document.filename;
          const s3Result = await deleteFileFromS3(s3Key);
          if (s3Result.success) {
            console.log(`Deleted S3 file: ${s3Key}`);
          } else {
            console.error(`Failed to delete S3 file ${s3Key}:`, s3Result.error);
          }
        }

        // Delete from database
        await prisma.eventDocument.delete({
          where: { id: document.id }
        });

        deletedCount++;
        console.log(`Deleted document ${document.id} from event ${document.eventId} (event date: ${document.event.startTime.toISOString()})`);
      } catch (error) {
        errorCount++;
        console.error(`Failed to delete document ${document.id}:`, error);
      }
    }

    // Log cleanup summary
    const summary = {
      totalFound: oldDocuments.length,
      deletedCount,
      errorCount,
      cutoffDate: eighteenMonthsAgo.toISOString(),
      note: 'Only documents from events older than 18 months are deleted'
    };

    console.log('PDF cleanup completed:', summary);

    return NextResponse.json({
      success: true,
      message: `PDF cleanup completed. Deleted ${deletedCount} old documents, ${errorCount} errors.`,
      summary
    });

  } catch (error) {
    console.error('PDF cleanup cron job failed:', error);
    return NextResponse.json({
      error: 'PDF cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also allow POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
} 