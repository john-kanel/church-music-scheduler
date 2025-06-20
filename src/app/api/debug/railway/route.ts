import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Check environment variables (without exposing sensitive data)
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'Set' : 'Missing',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'Set' : 'Missing',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'Set' : 'Missing',
    }

    // Test database connection
    let dbStatus = 'Unknown'
    let dbError = null
    try {
      await prisma.$connect()
      const userCount = await prisma.user.count()
      dbStatus = `Connected (${userCount} users)`
      await prisma.$disconnect()
    } catch (error) {
      dbStatus = 'Connection Failed'
      dbError = error instanceof Error ? error.message : 'Unknown error'
    }

    return NextResponse.json({
      status: 'Debug Info',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database: {
        status: dbStatus,
        error: dbError
      }
    })

  } catch (error) {
    return NextResponse.json({
      status: 'Error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 