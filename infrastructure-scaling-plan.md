# 🏗️ Infrastructure Scaling Plan for 200K Launch Day

## Current Setup Analysis
- **Hosting**: Railway (Next.js deployment)
- **Database**: PostgreSQL on Railway 
- **CDN**: Basic Railway CDN
- **File Storage**: UploadThing + AWS S3

## IMMEDIATE INFRASTRUCTURE UPGRADES

### 1. **Railway Application Scaling** ⚡ CRITICAL

#### Current vs Required:
```bash
# Current Railway Plan (likely Starter):
- 512MB RAM, 1 vCPU
- $5/month
- Limited concurrent connections

# REQUIRED for 200K visitors:
- Pro Plan: 8GB RAM, 4 vCPU
- $20/month
- Horizontal scaling enabled
```

#### Auto-Scaling Configuration:
```yaml
# Add to railway.toml (create in project root)
[build]
  builder = "nixpacks"
  buildCommand = "npm run build"

[deploy]
  startCommand = "npm start"
  healthcheckPath = "/api/health"
  healthcheckTimeout = 30
  
  # SCALING CONFIGURATION
  replicas = 3              # Start with 3 instances
  maxReplicas = 10          # Scale up to 10 instances
  minReplicas = 2           # Minimum 2 instances always running
  
  # Resource limits per instance
  resources.memory = "2GB"
  resources.cpu = "2"
  
  # Auto-scaling triggers
  scaling.cpu.target = 70         # Scale up at 70% CPU
  scaling.memory.target = 80      # Scale up at 80% memory
  scaling.requests.target = 1000  # Scale up at 1000 requests/minute
```

### 2. **CDN & Static Asset Optimization** 🚀 ESSENTIAL

#### Implement Cloudflare (Free Tier):
```bash
# Benefits for launch day:
✅ Global edge caching
✅ DDoS protection  
✅ Image optimization
✅ Bandwidth savings (90%+ for static assets)
✅ Page rules for caching
```

#### Setup Steps:
1. **Sign up for Cloudflare** (Free plan sufficient for launch)
2. **Add your domain** to Cloudflare
3. **Configure DNS** to point to Railway
4. **Enable caching rules**:

```javascript
// Cloudflare Page Rules for optimal caching:
// Rule 1: Cache static assets aggressively
/* 
Pattern: yoursite.com/*.js, *.css, *.png, *.jpg, *.ico
Settings: 
- Cache Level: Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 week
*/

// Rule 2: Cache API responses (careful with dynamic content)
/*
Pattern: yoursite.com/api/events*
Settings:
- Cache Level: Cache Everything  
- Edge Cache TTL: 5 minutes
- Browser Cache TTL: 1 minute
*/
```

### 3. **Database Connection Optimization** 🗄️ CRITICAL

#### Connection Pooling Enhancement:
```typescript
// Update src/lib/db.ts for production load
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // PRODUCTION CONNECTION POOLING
  __internal: {
    engine: {
      // Increased connection limits for high traffic
      maxConnections: process.env.NODE_ENV === 'production' ? 30 : 10,
      connectionTimeout: 60000,      // 60 seconds
      maxIdleConnections: 10,
      idleTimeout: 300000,           // 5 minutes
      
      // Query optimization
      statementCacheSize: 1000,
      preparedStatementCacheSize: 500
    }
  }
})

// Connection health monitoring
prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    console.warn(`Slow query detected: ${e.duration}ms - ${e.query}`)
  }
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### 4. **Load Balancing & Health Checks** ⚖️ ESSENTIAL

#### Health Check Endpoint:
```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const start = Date.now()
    
    // Test database connection
    await prisma.$queryRaw`SELECT 1`
    const dbTime = Date.now() - start
    
    // Check critical services
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbTime < 100 ? 'healthy' : 'slow',
        responseTime: `${dbTime}ms`
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    }
    
    return NextResponse.json(health)
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 503 })
  }
}
```

### 5. **File Storage Optimization** 📁 IMPORTANT

#### UploadThing Configuration for High Traffic:
```typescript
// Update uploadthing configuration
import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing({
  // Optimize for high traffic
  maxFileCount: 5,
  maxFileSize: "16MB",
  
  // Enable CDN caching
  config: {
    cdnCaching: true,
    compressionLevel: 8,
    imageOptimization: true
  }
});

export const ourFileRouter = {
  // Separate routes for different file types
  musicFiles: f({ pdf: { maxFileSize: "16MB", maxFileCount: 3 } })
    .middleware(async ({ req }) => {
      // Rate limiting for uploads
      const userId = await getUserId(req)
      if (!userId) throw new Error("Unauthorized")
      
      // Check upload quota (prevent abuse)
      const todayUploads = await getUploadCount(userId)
      if (todayUploads > 50) throw new Error("Upload limit exceeded")
      
      return { userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Async processing to not block response
      processFileAsync(file.url, metadata.userId)
    }),
    
  churchDocuments: f({ pdf: { maxFileSize: "10MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      // Stricter limits for documents
      const userId = await getUserId(req)
      if (!userId) throw new Error("Unauthorized")
      return { userId }
    })
} satisfies FileRouter;
```

## MONITORING & ALERTING

### 1. **Real-Time Monitoring Setup**
```typescript
// src/lib/monitoring.ts
export class LaunchDayMonitoring {
  private static metrics: Map<string, number> = new Map()
  
  static async recordMetric(name: string, value: number) {
    this.metrics.set(`${name}_${Date.now()}`, value)
    
    // Critical alerts
    if (name === 'database_response_time' && value > 1000) {
      await this.sendAlert('CRITICAL: Database slow', `${value}ms response time`)
    }
    
    if (name === 'active_connections' && value > 80) {
      await this.sendAlert('WARNING: High database connections', `${value}% utilized`)
    }
  }
  
  private static async sendAlert(title: string, message: string) {
    // Send to your alerting system (email, Slack, etc.)
    console.error(`🚨 ALERT: ${title} - ${message}`)
    
    // Optional: Send to external monitoring service
    // await fetch('YOUR_WEBHOOK_URL', {
    //   method: 'POST',
    //   body: JSON.stringify({ title, message, timestamp: new Date() })
    // })
  }
  
  static getMetrics() {
    return Object.fromEntries(this.metrics)
  }
}
```

### 2. **Performance Tracking**
```typescript
// Add to middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const start = Date.now()
  
  // Continue with request
  const response = NextResponse.next()
  
  // Add performance headers
  const duration = Date.now() - start
  response.headers.set('X-Response-Time', `${duration}ms`)
  response.headers.set('X-Server-Instance', process.env.RAILWAY_REPLICA_ID || 'unknown')
  
  // Log slow requests
  if (duration > 2000) {
    console.warn(`Slow request: ${request.nextUrl.pathname} took ${duration}ms`)
  }
  
  return response
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/plan/:path*']
}
```

## LAUNCH DAY CHECKLIST

### **24 Hours Before Launch:**
- [ ] Upgrade Railway to Pro plan ($20/month)
- [ ] Enable Railway auto-scaling (2-10 replicas)
- [ ] Set up Cloudflare CDN (free tier)
- [ ] Configure database connection pooling
- [ ] Test health check endpoints
- [ ] Set up monitoring alerts
- [ ] Take full database backup

### **6 Hours Before Launch:**
- [ ] Warm up Railway instances (pre-scale to 3 replicas)
- [ ] Clear all caches to ensure fresh start
- [ ] Test database performance under load
- [ ] Verify CDN configuration
- [ ] Check all monitoring systems

### **1 Hour Before Launch:**
- [ ] Scale to 5 Railway replicas manually
- [ ] Enable aggressive caching rules
- [ ] Monitor dashboard ready
- [ ] Team on standby for issues

### **During Launch (First 4 Hours):**
- [ ] Monitor Railway metrics every 15 minutes
- [ ] Watch database connection usage
- [ ] Check response times (<2 seconds)
- [ ] Monitor error rates (<0.1%)
- [ ] Scale up if CPU >70% or memory >80%

## ESTIMATED COSTS

### Launch Day (200K visitors):
```
Railway Pro App: $20/month
Railway Pro Database: $90/month  
Cloudflare: $0/month (free tier)
UploadThing: ~$50/month (file uploads)
Monitoring: $0/month (built-in)

Total: ~$160/month for launch month
```

### Post-Launch (steady 10K users):
```
Railway Developer App: $8/month
Railway Developer Database: $20/month
Cloudflare: $0/month
UploadThing: ~$15/month

Total: ~$43/month normal operation
```

## SUCCESS METRICS

### Launch Day Targets:
- ✅ **Uptime**: >99.9%
- ✅ **Response Time**: <2 seconds average
- ✅ **Error Rate**: <0.1%
- ✅ **Database Connections**: <80% utilized
- ✅ **CDN Cache Hit Rate**: >85%

### Scaling Triggers:
- **Scale UP**: CPU >70%, Memory >80%, Response time >3s
- **Scale DOWN**: CPU <30%, Memory <50% for 30+ minutes

Your infrastructure will be rock-solid for launch day! 🚀 