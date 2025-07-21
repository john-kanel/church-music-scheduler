import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const start = Date.now()
  
  try {
    // Test critical systems in parallel
    const [dbHealth, memoryUsage] = await Promise.all([
      testDatabaseHealth(),
      getMemoryUsage()
    ])
    
    const totalResponseTime = Date.now() - start
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${totalResponseTime}ms`,
      
      // System metrics
      system: {
        uptime: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'unknown'
      },
      
      // Memory usage
      memory: memoryUsage,
      
      // Service health
      services: {
        database: dbHealth,
        environment: {
          status: process.env.DATABASE_URL ? 'configured' : 'missing',
          nextauth: process.env.NEXTAUTH_SECRET ? 'configured' : 'missing'
        }
      }
    }
    
    // Determine overall status
    const isHealthy = dbHealth.status === 'healthy' && 
                     totalResponseTime < 5000 && 
                     memoryUsage.percentage < 90
    
    if (!isHealthy) {
      health.status = 'degraded'
    }
    
    return NextResponse.json(health, { 
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      }
    })
    
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - start}ms`
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      }
    })
  }
}

async function testDatabaseHealth() {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const responseTime = Date.now() - start
    
    return {
      status: responseTime < 500 ? 'healthy' : 'slow',
      responseTime: `${responseTime}ms`,
      connectionPool: 'active'
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Connection failed',
      responseTime: `${Date.now() - start}ms`
    }
  }
}

function getMemoryUsage() {
  const memUsage = process.memoryUsage()
  const used = Math.round(memUsage.heapUsed / 1024 / 1024)
  const total = Math.round(memUsage.heapTotal / 1024 / 1024)
  const external = Math.round(memUsage.external / 1024 / 1024)
  
  return {
    used: `${used}MB`,
    total: `${total}MB`,
    external: `${external}MB`,
    percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
  }
}

function formatUptime(uptimeSeconds: number): string {
  const hours = Math.floor(uptimeSeconds / 3600)
  const minutes = Math.floor((uptimeSeconds % 3600) / 60)
  const seconds = Math.floor(uptimeSeconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
} 