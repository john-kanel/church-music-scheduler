import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🧹 Starting password reset token cleanup...')

    // Delete expired or used tokens
    const result = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } }, // Expired tokens
          { used: true }, // Used tokens
          { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // Tokens older than 7 days
        ]
      }
    })

    console.log(`🗑️ Cleaned up ${result.count} password reset tokens`)

    return NextResponse.json({
      message: 'Password reset tokens cleaned up successfully',
      deletedCount: result.count
    })

  } catch (error) {
    console.error('Error cleaning up password reset tokens:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 