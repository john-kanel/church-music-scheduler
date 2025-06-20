import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Calculate all stats in parallel
    const [
      totalChurches,
      totalUsers,
      activeSubscriptions,
      trialAccounts,
      newUsersThisMonth
    ] = await Promise.all([
      // Total churches
      prisma.church.count(),
      
      // Total users
      prisma.user.count(),
      
      // Active subscriptions
      prisma.church.count({
        where: {
          subscriptionStatus: 'active'
        }
      }),
      
      // Trial accounts
      prisma.church.count({
        where: {
          subscriptionStatus: 'trial'
        }
      }),
      
      // New users this month
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ])

    // Calculate estimated monthly revenue
    // Assume $35 per active subscription for now
    // In production, you'd get this from Stripe
    const totalRevenue = activeSubscriptions * 35

    return NextResponse.json({
      totalChurches,
      totalUsers,
      activeSubscriptions,
      trialAccounts,
      totalRevenue,
      newUsersThisMonth
    })

  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin stats' },
      { status: 500 }
    )
  }
} 