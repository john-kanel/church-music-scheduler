// Simple request deduplication and caching utility
class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number; promise?: Promise<any> }>()
  private readonly cacheTimeout = 30000 // 30 seconds

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key)
    const now = Date.now()

    // Return cached data if it's still valid
    if (cached && now - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    // If there's already a request in progress, return that promise
    if (cached?.promise) {
      return cached.promise
    }

    // Start new request
    const promise = fetcher().then(data => {
      this.cache.set(key, { data, timestamp: now })
      return data
    }).catch(error => {
      // Remove failed request from cache
      this.cache.delete(key)
      throw error
    })

    // Store the promise to prevent duplicate requests
    this.cache.set(key, { 
      data: cached?.data, 
      timestamp: cached?.timestamp || 0,
      promise 
    })

    return promise
  }

  invalidate(key: string) {
    this.cache.delete(key)
  }

  invalidateAll() {
    this.cache.clear()
  }

  // Helper method to create cache keys
  createKey(endpoint: string, params?: Record<string, any>): string {
    if (!params) return endpoint
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    return `${endpoint}?${paramString}`
  }
}

export const requestCache = new RequestCache()

// API wrapper functions with caching
export async function fetchDashboardData(month: number, year: number) {
  const key = requestCache.createKey('/api/dashboard', { month, year })
  return requestCache.get(key, async () => {
    const response = await fetch(`/api/dashboard?month=${month}&year=${year}`)
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard data')
    }
    return response.json()
  })
}

export async function fetchActivities() {
  const key = '/api/activities'
  return requestCache.get(key, async () => {
    const response = await fetch('/api/activities')
    if (!response.ok) {
      throw new Error('Failed to fetch activities')
    }
    return response.json()
  })
}

export async function fetchSubscriptionStatus() {
  const key = '/api/subscription-status'
  return requestCache.get(key, async () => {
    const response = await fetch('/api/subscription-status')
    if (!response.ok) {
      throw new Error('Failed to fetch subscription status')
    }
    return response.json()
  })
}

export async function fetchEventDetails(eventId: string) {
  const key = `/api/events/${eventId}`
  return requestCache.get(key, async () => {
    const response = await fetch(`/api/events/${eventId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch event details')
    }
    return response.json()
  })
}

// Invalidation helpers
export function invalidateDashboardCache(month?: number, year?: number) {
  if (month && year) {
    requestCache.invalidate(requestCache.createKey('/api/dashboard', { month, year }))
  } else {
    // Invalidate all dashboard entries
    requestCache.invalidateAll()
  }
}

export function invalidateActivitiesCache() {
  requestCache.invalidate('/api/activities')
}

export function invalidateEventCache(eventId: string) {
  requestCache.invalidate(`/api/events/${eventId}`)
} 