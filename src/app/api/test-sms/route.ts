import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendSMS, isSMSAvailable, textMagicService } from '@/lib/textmagic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can test SMS
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { to, message } = body

    // Validation
    if (!to || !message) {
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400 }
      )
    }

    // Check if SMS is available
    if (!isSMSAvailable()) {
      return NextResponse.json({
        error: 'SMS service not configured',
        available: false,
        needsConfiguration: true,
        requiredEnvVars: ['TEXTMAGIC_USERNAME', 'TEXTMAGIC_API_KEY']
      }, { status: 400 })
    }

    // Send test SMS
    console.log(`📱 Sending test SMS to ${to}: ${message}`)
    
    const result = await sendSMS(to, message)

    if (result.success) {
      return NextResponse.json({
        message: 'SMS sent successfully',
        success: true,
        messageId: result.messageId,
        to: to,
        text: message,
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        error: 'Failed to send SMS',
        success: false,
        details: result.error,
        to: to
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in test SMS endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send test SMS',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can check SMS status
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const available = isSMSAvailable()
    
    if (!available) {
      return NextResponse.json({
        available: false,
        configured: false,
        message: 'SMS service not configured',
        requiredEnvVars: [
          'TEXTMAGIC_USERNAME',
          'TEXTMAGIC_API_KEY'
        ],
        optionalEnvVars: [
          'TEXTMAGIC_SENDER_ID'
        ]
      })
    }

    // Try to check balance to verify configuration
    try {
      const balanceResult = await textMagicService.checkBalance()
      
      return NextResponse.json({
        available: true,
        configured: true,
        message: 'SMS service is configured and ready',
        balance: balanceResult.success ? {
          amount: balanceResult.balance,
          currency: balanceResult.currency
        } : null,
        balanceError: balanceResult.success ? null : balanceResult.error
      })
    } catch (balanceError) {
      return NextResponse.json({
        available: true,
        configured: true,
        message: 'SMS service configured but unable to check balance',
        balanceError: balanceError instanceof Error ? balanceError.message : 'Unknown error'
      })
    }

  } catch (error) {
    console.error('Error checking SMS status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to check SMS status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}