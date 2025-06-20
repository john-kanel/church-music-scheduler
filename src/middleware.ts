import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Only apply middleware to admin routes
  if (request.nextUrl.pathname.startsWith('/admin') || 
      request.nextUrl.pathname.startsWith('/api/admin')) {
    
    // Allow access to login page and auth API without authentication
    if (request.nextUrl.pathname === '/admin/login' || 
        request.nextUrl.pathname === '/api/admin/auth') {
      return NextResponse.next()
    }
    
    // Check for admin authentication
    const adminAuth = request.cookies.get('admin-auth')?.value
    
    // If not authenticated, redirect to admin login
    if (!adminAuth || adminAuth !== 'authenticated') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
} 