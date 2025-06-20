import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Not available in production' },
        { status: 403 }
      );
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.churchId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create sample activities
    const sampleActivities = [
      {
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6), // 6 days ago
        type: 'EVENT_CREATED' as const,
        description: 'Created event: Sunday Morning Service',
        churchId: session.user.churchId,
        userId: session.user.id,
        metadata: {
          eventName: 'Sunday Morning Service',
          eventDate: new Date().toISOString()
        }
      },
      {
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
        type: 'MUSICIAN_INVITED' as const,
        description: 'Invited musician: John Smith',
        churchId: session.user.churchId,
        userId: session.user.id,
        metadata: {
          musicianName: 'John Smith',
          musicianEmail: 'john@example.com'
        }
      },
      {
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4), // 4 days ago
        type: 'MUSICIAN_SIGNED_UP' as const,
        description: 'John Smith signed up for Sunday Morning Service',
        churchId: session.user.churchId,
        userId: session.user.id,
        metadata: {
          musicianName: 'John Smith',
          eventName: 'Sunday Morning Service'
        }
      },
      {
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
        type: 'MESSAGE_SENT' as const,
        description: 'Sent message to all musicians: "Rehearsal this Thursday"',
        churchId: session.user.churchId,
        userId: session.user.id,
        metadata: {
          subject: 'Rehearsal this Thursday',
          recipientCount: 5,
          messageType: 'BROADCAST'
        }
      }
    ];

    // Create all activities
    await prisma.activity.createMany({
      data: sampleActivities
    });

    return NextResponse.json({
      message: `Created ${sampleActivities.length} sample activities`,
      activities: sampleActivities
    });

  } catch (error) {
    console.error('Error seeding activities:', error);
    return NextResponse.json(
      { error: 'Failed to seed activities' },
      { status: 500 }
    );
  }
} 