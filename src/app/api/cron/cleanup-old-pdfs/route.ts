import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Verify this is being called by the cron service
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate 18 months ago
    const eighteenMonthsAgo = new Date();
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);

    console.log(`Looking for PDF documents older than ${eighteenMonthsAgo.toISOString()}`);

    // Find event documents older than 18 months
    const oldDocuments = await prisma.eventDocument.findMany({
      where: {
        uploadedAt: {
          lt: eighteenMonthsAgo
        }
      }
    });

    console.log(`Found ${oldDocuments.length} old PDF documents to delete`);

    let deletedCount = 0;
    let errorCount = 0;

    // Delete each old document
    for (const document of oldDocuments) {
      try {
        // Delete from file system if file exists
        if (document.filePath && fs.existsSync(document.filePath)) {
          fs.unlinkSync(document.filePath);
          console.log(`Deleted file: ${document.filePath}`);
        }

        // Delete from database
        await prisma.eventDocument.delete({
          where: { id: document.id }
        });

        deletedCount++;
        console.log(`Deleted document ${document.id} from event ${document.eventId}`);
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
      cutoffDate: eighteenMonthsAgo.toISOString()
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