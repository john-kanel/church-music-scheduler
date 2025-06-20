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
    
    if (!session?.user?.parishId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create sample activities
    const sampleActivities = [
      {
        type: 'EVENT_CREATED' as const,
        description: 'Created event: Sunday Morning Mass',
        parishId: session.user.parishId,
        userId: session.user.id,
        metadata: {
          eventName: 'Sunday Morning Mass',
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        type: 'MUSICIAN_INVITED' as const,
        description: 'Invited musician: Sarah Johnson',
        parishId: session.user.parishId,
        userId: session.user.id,
        metadata: {
          musicianName: 'Sarah Johnson',
          musicianEmail: 'sarah@example.com'
        }
      },
      {
        type: 'MUSICIAN_SIGNED_UP' as const,
        description: 'John Smith completed account setup',
        parishId: session.user.parishId,
        metadata: {
          musicianName: 'John Smith',
          musicianEmail: 'john@example.com'
        }
      },
      {
        type: 'MESSAGE_SENT' as const,
        description: 'Sent message "Rehearsal Reminder" to 5 musicians',
        parishId: session.user.parishId,
        userId: session.user.id,
        metadata: {
          subject: 'Rehearsal Reminder',
          recipientCount: 5,
          messageType: 'EMAIL'
        }
      },
      {
        type: 'EVENT_CREATED' as const,
        description: 'Created event: Christmas Eve Service',
        parishId: session.user.parishId,
        userId: session.user.id,
        metadata: {
          eventName: 'Christmas Eve Service',
          eventDate: new Date('2024-12-24').toISOString()
        }
      }
    ];

    // Insert activities with different timestamps
    for (let i = 0; i < sampleActivities.length; i++) {
      const activity = sampleActivities[i];
      const createdAt = new Date(Date.now() - (i * 2 * 60 * 60 * 1000)); // Each activity 2 hours apart

      await prisma.activity.create({
        data: {
          ...activity,
          createdAt
        }
      });
    }

    return NextResponse.json({
      message: 'Sample activities created successfully',
      count: sampleActivities.length
    });

  } catch (error) {
    console.error('Error creating sample activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 