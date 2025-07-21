# 🗄️ Database Scaling Plan for 200K Launch Day

## Current Setup Analysis
- **Database**: PostgreSQL on Railway
- **Current Optimization**: Good indexing already in place
- **Bottleneck Risk**: Database connections and query performance

## IMMEDIATE ACTIONS (Pre-Launch)

### 1. **Connection Pooling** ⚡ CRITICAL
```typescript
// Update src/lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // CONNECTION POOLING FOR HIGH TRAFFIC
  __internal: {
    engine: {
      maxConnections: 20, // Increase from default 5
      connectionTimeout: 60,
      maxIdleConnections: 5,
      idleTimeout: 600
    }
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 2. **Railway Database Upgrade** 💰 REQUIRED
```env
# Upgrade Railway PostgreSQL to handle traffic:
# - Starter: 1GB RAM, 10GB storage → $10/month
# - Developer: 8GB RAM, 100GB storage → $20/month
# - Pro: 32GB RAM, 500GB storage → $90/month

# For 200K visitors, recommend PRO plan
```

### 3. **Query Optimization** 🎯 ESSENTIAL
```sql
-- Add these indexes for your most common queries:

-- Calendar/Dashboard queries (most frequent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_church_start_end 
ON events(churchId, startTime, endTime) 
WHERE startTime >= CURRENT_DATE;

-- User authentication queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified 
ON users(email, isVerified) 
WHERE isVerified = true;

-- Assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_event_status 
ON event_assignments(eventId, status) 
WHERE status IN ('PENDING', 'ACCEPTED');

-- Subscription queries (frequent during signup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_church_subscription_active 
ON parishes(subscriptionStatus, subscriptionEnds) 
WHERE subscriptionStatus = 'active';
```

## DATABASE CONFIGURATION

### Environment Variables for Production:
```env
# Railway PostgreSQL optimized for high traffic
DATABASE_URL="postgresql://user:pass@host:port/db?connection_limit=20&pool_timeout=60"

# Enable query monitoring
PRISMA_LOG_LEVEL="info"
DATABASE_POOL_SIZE=20
DATABASE_CONNECTION_TIMEOUT=60000
```

### Railway Database Settings:
- **Plan**: Pro ($90/month) - 32GB RAM, 500GB storage
- **Connections**: Set max connections to 100 in Railway dashboard
- **Backup**: Enable automatic backups
- **Monitoring**: Enable performance insights

## CACHING STRATEGY

### 1. **API Response Caching** (Already implemented but needs tuning)
```typescript
// Update cache durations for launch traffic
const CACHE_DURATIONS = {
  SUBSCRIPTION_STATUS: 10 * 60 * 1000, // 10 minutes (was 5)
  DASHBOARD_DATA: 5 * 60 * 1000,       // 5 minutes (was 2)
  MUSICIANS_LIST: 15 * 60 * 1000,      // 15 minutes (was 5)
  EVENTS_LIST: 3 * 60 * 1000,          // 3 minutes
  STATIC_DATA: 60 * 60 * 1000          // 1 hour for service parts, etc.
}
```

### 2. **Database Query Caching**
```typescript
// Add to frequently called functions
export async function getCachedChurchData(churchId: string) {
  const cacheKey = `church:${churchId}`
  const cached = await getFromCache(cacheKey)
  
  if (cached) return cached
  
  const data = await prisma.church.findUnique({
    where: { id: churchId },
    include: {
      users: { select: { id: true, role: true } },
      eventTypes: true,
      serviceParts: { orderBy: { order: 'asc' } }
    }
  })
  
  await setCache(cacheKey, data, 10 * 60 * 1000) // 10 minutes
  return data
}
```

## MONITORING & ALERTS

### Database Performance Monitoring:
```typescript
// Add to src/lib/monitoring.ts
export async function monitorDatabaseHealth() {
  const start = Date.now()
  
  try {
    await prisma.$queryRaw`SELECT 1`
    const responseTime = Date.now() - start
    
    // Log slow queries
    if (responseTime > 1000) {
      console.warn(`Slow database query: ${responseTime}ms`)
    }
    
    return { healthy: true, responseTime }
  } catch (error) {
    console.error('Database health check failed:', error)
    return { healthy: false, error: error.message }
  }
}
```

## LAUNCH DAY PREPARATION

### 1. **Connection Monitoring**
- Monitor Railway dashboard for connection usage
- Set up alerts for >80% connection usage
- Have database scaling plan ready

### 2. **Query Performance**
- Enable slow query logging
- Monitor for N+1 query problems
- Have query optimization scripts ready

### 3. **Backup Strategy**
- Take full backup before launch
- Enable point-in-time recovery
- Test restore procedures

## SCALING TRIGGERS

**Scale UP if you see:**
- Database connections >80% of limit
- Average query time >500ms
- Connection timeouts in logs
- Memory usage >90%

**Scale DOWN after traffic decreases:**
- Connections <20% for 24 hours
- No slow queries for 48 hours
- Memory usage <50% for 24 hours

## ESTIMATED COSTS

### Launch Day (200K visitors):
- **Railway Pro Database**: $90/month
- **Connection pooling**: Included
- **Performance monitoring**: Included

### Post-Launch (10K active users):
- **Railway Developer**: $20/month
- **Regular monitoring**: Included

## SUCCESS METRICS

- ✅ Database response time <200ms average
- ✅ Zero connection timeouts
- ✅ Query success rate >99.9%
- ✅ Backup completion within 5 minutes 