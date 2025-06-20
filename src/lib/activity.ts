import { prisma } from './db';

export type ActivityType = 'EVENT_CREATED' | 'MUSICIAN_INVITED' | 'MUSICIAN_SIGNED_UP' | 'MESSAGE_SENT';

interface ActivityData {
  type: ActivityType;
  description: string;
  parishId: string;
  userId?: string;
  metadata?: any;
}

export async function logActivity(data: ActivityData) {
  try {
    await prisma.activity.create({
      data: {
        type: data.type,
        description: data.description,
        parishId: data.parishId,
        userId: data.userId,
        metadata: data.metadata
      }
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error to avoid breaking the main flow
  }
} 