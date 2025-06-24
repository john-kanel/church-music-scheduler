import { prisma } from '@/lib/db'

export interface SubscriptionStatus {
  isActive: boolean
  isExpired: boolean
  subscriptionEnds: Date | null
  subscriptionStatus: string
}

export async function checkSubscriptionStatus(churchId: string): Promise<SubscriptionStatus> {
  try {
    const church = await prisma.church.findUnique({
      where: { id: churchId },
      select: {
        subscriptionStatus: true,
        subscriptionEnds: true
      }
    })

    if (!church) {
      return {
        isActive: false,
        isExpired: true,
        subscriptionEnds: null,
        subscriptionStatus: 'not_found'
      }
    }

    const now = new Date()
    const isExpired = church.subscriptionEnds ? now > church.subscriptionEnds : false
    const isInactive = !['active', 'trialing'].includes(church.subscriptionStatus)
    const isActive = !isExpired && !isInactive

    return {
      isActive,
      isExpired: isExpired || isInactive,
      subscriptionEnds: church.subscriptionEnds,
      subscriptionStatus: church.subscriptionStatus
    }
  } catch (error) {
    console.error('Error checking subscription status:', error)
    // On error, assume expired for safety
    return {
      isActive: false,
      isExpired: true,
      subscriptionEnds: null,
      subscriptionStatus: 'error'
    }
  }
}

export function createSubscriptionErrorResponse() {
  return Response.json(
    { 
      error: 'Subscription expired. Please update your billing to continue using this service.',
      code: 'SUBSCRIPTION_EXPIRED'
    },
    { status: 403 }
  )
} 