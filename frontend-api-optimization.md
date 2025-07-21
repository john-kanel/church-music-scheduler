# 🎨 Frontend & API Optimization for 200K Launch Day

## Current Analysis
- **Framework**: Next.js 15 with React 19
- **Bundle Size**: Likely optimized but needs verification
- **API Caching**: Basic implementation exists
- **Frontend Caching**: Limited browser caching

## FRONTEND PERFORMANCE OPTIMIZATION

### 1. **Bundle Size Optimization** 📦 CRITICAL

#### Dynamic Imports for Large Components:
```typescript
// Update src/app/plan/page.tsx - already using dynamic imports, enhance further
import dynamic from 'next/dynamic'

// Lazy load heavy components
const ServicePartEditModal = dynamic(() => import('@/components/events/service-part-edit-modal'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-64 rounded"></div>,
  ssr: false // Client-side only for modals
})

const AutoAssignModal = dynamic(() => import('@/components/events/auto-assign-modal'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-32 rounded"></div>,
  ssr: false
})

const CalendarView = dynamic(() => import('@/components/calendar/calendar-view'), {
  loading: () => <div>Loading calendar...</div>,
  ssr: false // Heavy calendar component
})

// Split PDF processing into separate chunk
const PDFProcessor = dynamic(() => import('@/components/pdf/pdf-processor'), {
  loading: () => <div>Loading PDF processor...</div>,
  ssr: false
})
```

#### Next.js Configuration for Performance:
```javascript
// Update next.config.ts
const nextConfig = {
  // PERFORMANCE OPTIMIZATIONS
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  // EXPERIMENTAL FEATURES FOR BETTER PERFORMANCE
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-select'],
    turbotrace: {
      logLevel: 'error'
    }
  },
  
  // COMPILER OPTIMIZATIONS
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  
  // IMAGE OPTIMIZATION
  images: {
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },
  
  // HEADERS FOR CACHING
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }
        ]
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' }
        ]
      }
    ]
  }
}

module.exports = nextConfig
```

### 2. **Client-Side Caching Strategy** 🔄 ESSENTIAL

#### React Query Implementation:
```typescript
// src/lib/react-query.ts - Implement for better caching
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // AGGRESSIVE CACHING FOR LAUNCH DAY
      staleTime: 5 * 60 * 1000,      // 5 minutes (data considered fresh)
      cacheTime: 30 * 60 * 1000,     // 30 minutes (keep in cache)
      retry: 3,                       // Retry failed requests
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Background refetching for better UX
      refetchOnWindowFocus: false,    // Don't refetch on tab focus
      refetchOnReconnect: true,       // Refetch on network reconnect
      refetchOnMount: true            // Refetch on component mount
    },
    mutations: {
      retry: 2,
      retryDelay: 1000
    }
  }
})

// Custom hooks for common queries
export const useEvents = (churchId: string) => {
  return useQuery({
    queryKey: ['events', churchId],
    queryFn: () => fetchEvents(churchId),
    staleTime: 2 * 60 * 1000,       // 2 minutes for event data
    cacheTime: 15 * 60 * 1000       // 15 minutes cache
  })
}

export const useMusicians = (churchId: string) => {
  return useQuery({
    queryKey: ['musicians', churchId],
    queryFn: () => fetchMusicians(churchId),
    staleTime: 10 * 60 * 1000,      // 10 minutes for musician data
    cacheTime: 60 * 60 * 1000       // 1 hour cache
  })
}
```

### 3. **Image & Asset Optimization** 🖼️ IMPORTANT

#### Next.js Image Component Usage:
```typescript
// Optimize church logos and profile images
import Image from 'next/image'

const ChurchLogo = ({ logoUrl, churchName }: { logoUrl?: string, churchName: string }) => {
  if (!logoUrl) return <div className="w-16 h-16 bg-gray-200 rounded-full" />
  
  return (
    <Image
      src={logoUrl}
      alt={`${churchName} logo`}
      width={64}
      height={64}
      className="rounded-full object-cover"
      priority={false}  // Don't prioritize logos
      placeholder="blur" // Blur placeholder while loading
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..." // Base64 blur
      sizes="(max-width: 768px) 48px, 64px"
    />
  )
}

// Optimize static assets
const HeroImage = () => (
  <Image
    src="/images/church-music-hero.jpg"
    alt="Church Music Pro"
    width={1200}
    height={600}
    priority={true}    // Prioritize hero images
    className="w-full h-auto"
    sizes="(max-width: 768px) 100vw, 1200px"
  />
)
```

### 4. **Progressive Loading Strategy** ⚡ ESSENTIAL

#### Skeleton Loading Components:
```typescript
// src/components/ui/skeleton.tsx - Create reusable skeletons
export const EventSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 rounded"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  </div>
)

export const DashboardSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {[1, 2, 3].map(i => (
      <div key={i} className="animate-pulse">
        <div className="h-24 bg-gray-200 rounded-lg"></div>
      </div>
    ))}
  </div>
)

// Use in components
const DashboardPage = () => {
  const { data: events, isLoading } = useEvents(churchId)
  
  if (isLoading) return <DashboardSkeleton />
  
  return <EventsList events={events} />
}
```

## API PERFORMANCE OPTIMIZATION

### 1. **Rate Limiting & Request Management** 🛡️ CRITICAL

#### API Rate Limiting Implementation:
```typescript
// src/lib/rate-limit.ts - Implement rate limiting
interface RateLimitConfig {
  interval: number    // Time window in milliseconds
  uniqueTokenPerInterval: number  // Max requests per window
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  
  constructor(private config: RateLimitConfig) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []
    
    // Remove expired requests
    const validRequests = requests.filter(
      time => now - time < this.config.interval
    )
    
    // Check if under limit
    if (validRequests.length >= this.config.uniqueTokenPerInterval) {
      return false
    }
    
    // Add current request
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    
    return true
  }
  
  getTimeUntilReset(identifier: string): number {
    const requests = this.requests.get(identifier) || []
    if (requests.length === 0) return 0
    
    const oldestRequest = Math.min(...requests)
    return Math.max(0, this.config.interval - (Date.now() - oldestRequest))
  }
}

// Different limits for different endpoints
export const apiLimiter = new RateLimiter({ interval: 60000, uniqueTokenPerInterval: 100 }) // 100/minute
export const authLimiter = new RateLimiter({ interval: 60000, uniqueTokenPerInterval: 20 })  // 20/minute
export const uploadLimiter = new RateLimiter({ interval: 60000, uniqueTokenPerInterval: 10 }) // 10/minute
```

#### Apply Rate Limiting to API Routes:
```typescript
// src/lib/api-middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { apiLimiter, authLimiter } from './rate-limit'

export async function withRateLimit(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
  limiter = apiLimiter
) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const session = await getServerSession()
  const identifier = session?.user?.id || ip
  
  if (!limiter.isAllowed(identifier)) {
    const resetTime = limiter.getTimeUntilReset(identifier)
    
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded', 
        resetIn: Math.ceil(resetTime / 1000) 
      },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil(resetTime / 1000).toString(),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + resetTime).toISOString()
        }
      }
    )
  }
  
  return handler(request)
}

// Usage in API routes
// src/app/api/events/route.ts
export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req) => {
    // Your existing handler code
    const events = await getEvents()
    return NextResponse.json({ events })
  })
}
```

### 2. **API Response Optimization** 🚀 ESSENTIAL

#### Pagination for Large Datasets:
```typescript
// Update API routes to support pagination
// src/app/api/events/route.ts
export async function GET(request: NextRequest) {
  return withRateLimit(request, async (req) => {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 per page
    const skip = (page - 1) * limit
    
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where: { churchId: session.user.churchId },
        skip,
        take: limit,
        orderBy: { startTime: 'asc' },
        select: {
          // Only select needed fields for performance
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          location: true,
          eventType: { select: { name: true, color: true } },
          _count: { select: { assignments: true, hymns: true } }
        }
      }),
      prisma.event.count({
        where: { churchId: session.user.churchId }
      })
    ])
    
    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    })
  })
}
```

#### Response Compression:
```typescript
// src/lib/compression.ts
import { NextResponse } from 'next/server'

export function compressResponse(data: any): NextResponse {
  const response = NextResponse.json(data)
  
  // Add compression headers
  response.headers.set('Content-Encoding', 'gzip')
  response.headers.set('Vary', 'Accept-Encoding')
  
  // Cache headers for better performance
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  response.headers.set('ETag', `"${Buffer.from(JSON.stringify(data)).toString('base64')}"`)
  
  return response
}
```

### 3. **Database Query Optimization** 🗄️ CRITICAL

#### Optimized Queries for High Traffic:
```typescript
// src/lib/optimized-queries.ts
export class OptimizedQueries {
  // Dashboard data - most frequently called
  static async getDashboardData(churchId: string) {
    const cacheKey = `dashboard:${churchId}`
    const cached = cache.get(cacheKey)
    if (cached) return cached
    
    // Parallel queries for dashboard
    const [upcomingEvents, recentActivity, stats] = await Promise.all([
      // Only next 5 events with minimal data
      prisma.event.findMany({
        where: { 
          churchId,
          startTime: { gte: new Date() }
        },
        take: 5,
        orderBy: { startTime: 'asc' },
        select: {
          id: true,
          name: true,
          startTime: true,
          eventType: { select: { name: true, color: true } },
          _count: { select: { assignments: true } }
        }
      }),
      
      // Recent activity (cached longer)
      prisma.activity.findMany({
        where: { churchId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          description: true,
          createdAt: true
        }
      }),
      
      // Quick stats
      this.getChurchStats(churchId)
    ])
    
    const data = { upcomingEvents, recentActivity, stats }
    cache.set(cacheKey, data, 5 * 60 * 1000) // 5 minute cache
    return data
  }
  
  // Optimized church stats
  static async getChurchStats(churchId: string) {
    const cacheKey = `stats:${churchId}`
    const cached = cache.get(cacheKey)
    if (cached) return cached
    
    // Single query with aggregations
    const stats = await prisma.church.findUnique({
      where: { id: churchId },
      select: {
        _count: {
          select: {
            users: true,
            events: { where: { startTime: { gte: new Date() } } },
            groups: true
          }
        }
      }
    })
    
    cache.set(cacheKey, stats, 15 * 60 * 1000) // 15 minute cache
    return stats
  }
}
```

## LAUNCH DAY FRONTEND CHECKLIST

### **Pre-Launch Optimization:**
- [ ] Enable dynamic imports for all heavy components
- [ ] Implement React Query for aggressive caching
- [ ] Set up skeleton loading states
- [ ] Optimize all images with Next.js Image component
- [ ] Configure rate limiting on all API routes
- [ ] Test pagination on large datasets
- [ ] Compress API responses

### **Performance Targets:**
- ✅ **First Contentful Paint**: <1.5 seconds
- ✅ **Largest Contentful Paint**: <2.5 seconds
- ✅ **Cumulative Layout Shift**: <0.1
- ✅ **Time to Interactive**: <3 seconds
- ✅ **Bundle Size**: <500KB gzipped

### **Monitoring During Launch:**
- [ ] Track Core Web Vitals in real-time
- [ ] Monitor API response times (<200ms average)
- [ ] Watch for rate limit triggers
- [ ] Check cache hit rates (>80%)
- [ ] Monitor bundle loading times

Your frontend will be lightning-fast and API will handle the traffic surge! ⚡ 