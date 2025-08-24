import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/db'

export async function middleware(request: NextRequest) {
  // Handle admin routes first
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
    
    return NextResponse.next()
  }

  // Define paths that should always be accessible (even for expired accounts)
  const alwaysAccessiblePaths = [
    '/',
    '/auth/signin',
    '/auth/signup', 
    '/auth/trial-success',
    '/trial-expired',
    '/billing',
    '/settings',
    '/support',
    '/api/auth',
    '/api/stripe',
    '/api/support'
  ]

  // Check if current path should always be accessible
  const isAlwaysAccessible = alwaysAccessiblePaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (isAlwaysAccessible) {
    return NextResponse.next()
  }

  // Get the user's session
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  })

  // If no session, redirect to sign in
  if (!token || !token.churchId) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  // Check subscription status
  try {
    const church = await prisma.church.findUnique({
      where: { id: token.churchId as string },
      select: {
        subscriptionStatus: true,
        subscriptionEnds: true
      }
    })

    if (!church) {
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    // Check if subscription is expired - align with API subscription check
    const now = new Date()
    const isExpired = church.subscriptionEnds ? now > church.subscriptionEnds : false
    const isInactive = !['active', 'trialing', 'trial'].includes(church.subscriptionStatus)
    
    console.log('🔍 Middleware subscription check:', {
      churchId: token.churchId,
      subscriptionStatus: church.subscriptionStatus,
      subscriptionEnds: church.subscriptionEnds,
      isExpired,
      isInactive,
      shouldRedirect: isExpired || isInactive
    })

    if (isExpired || isInactive) {
      console.log('🚨 Redirecting to trial-expired page')
      // Redirect to trial expired page
      return NextResponse.redirect(new URL('/trial-expired', request.url))
    }

  } catch (error) {
    console.error('Middleware subscription check error:', error)
    // On subscription check error, redirect to trial expired to be safe
    return NextResponse.redirect(new URL('/trial-expired', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes that should be excluded
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ]
} 