// Enhanced performance caching system
class PerformanceCache {
  private cache = new Map<string, { 
    data: any; 
    timestamp: number; 
    promise?: Promise<any>;
    ttl: number;
  }>()
  
  // Different cache durations for different types of data
  private readonly cacheDurations = {
    subscription: 10 * 60 * 1000,     // 10 minutes - subscription status
    dashboard: 2 * 60 * 1000,         // 2 minutes - dashboard data
    musicians: 5 * 60 * 1000,         // 5 minutes - musicians list
    events: 3 * 60 * 1000,            // 3 minutes - events data
    activities: 5 * 60 * 1000,        // 5 minutes - activities
    profile: 10 * 60 * 1000,          // 10 minutes - user profile
    groups: 10 * 60 * 1000,           // 10 minutes - groups
    default: 60 * 1000                // 1 minute default
  }

  async get<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    cacheType: keyof typeof this.cacheDurations = 'default'
  ): Promise<T> {
    const cached = this.cache.get(key)
    const now = Date.now()
    const ttl = this.cacheDurations[cacheType]

    // Return cached data if it's still valid
    if (cached && now - cached.timestamp < cached.ttl) {
      return cached.data
    }

    // If there's already a request in progress, return that promise
    if (cached?.promise) {
      try {
        return await cached.promise
      } catch (error) {
        // If the promise failed, remove it and try again
        this.cache.delete(key)
      }
    }

    // Start new request
    const promise = fetcher()
      .then(data => {
        this.cache.set(key, { 
          data, 
          timestamp: now, 
          ttl,
        })
        return data
      })
      .catch(error => {
        // Remove failed request from cache
        this.cache.delete(key)
        throw error
      })

    // Store the promise to prevent duplicate requests
    this.cache.set(key, { 
      data: cached?.data, 
      timestamp: cached?.timestamp || 0,
      ttl,
      promise 
    })

    return promise
  }

  invalidate(key: string) {
    this.cache.delete(key)
  }

  invalidatePattern(pattern: string) {
    const regex = new RegExp(pattern)
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  invalidateAll() {
    this.cache.clear()
  }

  // Helper method to create cache keys
  createKey(endpoint: string, params?: Record<string, any>, userId?: string): string {
    let key = endpoint
    
    if (userId) {
      key += `::user:${userId}`
    }
    
    if (params) {
      const paramString = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
      key += `?${paramString}`
    }
    
    return key
  }

  // Clean up expired cache entries
  cleanup() {
    const now = Date.now()
    for (const [key, value] of this.cache) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache stats
  getStats() {
    const now = Date.now()
    let activeEntries = 0
    let expiredEntries = 0
    
    for (const [, value] of this.cache) {
      if (now - value.timestamp < value.ttl) {
        activeEntries++
      } else {
        expiredEntries++
      }
    }
    
    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries
    }
  }
}

// Global cache instance
export const performanceCache = new PerformanceCache()

// Clean up expired entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    performanceCache.cleanup()
  }, 5 * 60 * 1000)
}

// Enhanced fetch wrappers with caching
export async function fetchWithCache<T>(
  endpoint: string,
  options: RequestInit = {},
  cacheType: keyof typeof performanceCache['cacheDurations'] = 'default',
  userId?: string,
  params?: Record<string, any>
): Promise<T> {
  const key = performanceCache.createKey(endpoint, params, userId)
  
  return performanceCache.get(key, async () => {
    const url = params ? `${endpoint}?${new URLSearchParams(params).toString()}` : endpoint
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as any
      error.status = response.status
      throw error
    }
    
    return response.json()
  }, cacheType)
}

// Specific API wrappers with optimized caching
export const apiCache = {
  // Subscription status - cache for 10 minutes
  subscriptionStatus: (userId?: string) =>
    fetchWithCache('/api/subscription-status', {}, 'subscription', userId),
  
  // Dashboard data - cache for 2 minutes
  dashboard: (month: number, year: number, userId?: string) =>
    fetchWithCache('/api/dashboard', {}, 'dashboard', userId, { month: month.toString(), year: year.toString() }),
  
  // Musicians list - cache for 5 minutes
  musicians: (userId?: string) =>
    fetchWithCache('/api/musicians', {}, 'musicians', userId),
  
  // Activities - cache for 5 minutes
  activities: (userId?: string) =>
    fetchWithCache('/api/activities', {}, 'activities', userId),
  
  // User profile - cache for 10 minutes
  profile: (userId?: string) =>
    fetchWithCache('/api/profile', {}, 'profile', userId),
  
  // Groups - cache for 10 minutes
  groups: (userId?: string) =>
    fetchWithCache('/api/groups', {}, 'groups', userId),
  
  // Events for a specific month - cache for 3 minutes
  events: (month: number, year: number, userId?: string) =>
    fetchWithCache('/api/events', {}, 'events', userId, { month: month.toString(), year: year.toString() })
}

// Cache invalidation helpers
export const invalidateCache = {
  all: () => performanceCache.invalidateAll(),
  
  user: (userId: string) => {
    performanceCache.invalidatePattern(`::user:${userId}`)
  },
  
  subscription: (userId: string) => {
    performanceCache.invalidate(performanceCache.createKey('/api/subscription-status', undefined, userId))
  },
  
  dashboard: (userId: string) => {
    performanceCache.invalidatePattern(`/api/dashboard.*::user:${userId}`)
  },
  
  musicians: (userId: string) => {
    performanceCache.invalidate(performanceCache.createKey('/api/musicians', undefined, userId))
  },
  
  events: (userId: string) => {
    performanceCache.invalidatePattern(`/api/events.*::user:${userId}`)
  },
  
  activities: (userId: string) => {
    performanceCache.invalidate(performanceCache.createKey('/api/activities', undefined, userId))
  }
} 