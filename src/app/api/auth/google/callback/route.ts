import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { prisma } from '@/lib/db'

/**
 * Handle Google Calendar OAuth callback
 * GET /api/auth/google/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/signin?error=Please log in first`)
    }

    // Get authorization code from query params
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('Google OAuth error:', error)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/calendar-subscribe?error=Google authorization failed: ${error}`
      )
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/calendar-subscribe?error=No authorization code received`
      )
    }

    console.log('🔑 Processing Google Calendar authorization for user:', session.user.id)

    // Exchange code for tokens
    const googleCalendar = new GoogleCalendarService()
    const tokens = await googleCalendar.getTokensFromCode(code)

    // Set tokens and test the connection
    googleCalendar.setTokens(tokens)
    const connectionTest = await googleCalendar.testConnection()

    if (!connectionTest.success) {
      throw new Error(`Connection test failed: ${connectionTest.error}`)
    }

    // Get church information for calendar creation
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user?.church) {
      throw new Error('User church not found')
    }

    // Create dedicated calendar for the church
    const calendarId = await googleCalendar.createDedicatedCalendar(user.church.name)

    // Save integration to database
    await prisma.googleCalendarIntegration.upsert({
      where: { userId: session.user.id },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        userEmail: connectionTest.userEmail,
        calendarId: calendarId,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        userId: session.user.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        userEmail: connectionTest.userEmail,
        calendarId: calendarId,
        isActive: true
      }
    })

    console.log('✅ Google Calendar integration saved successfully for user:', session.user.id)
    console.log('📧 Connected Google account:', connectionTest.userEmail)

    // Redirect back to calendar subscribe page with success
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/calendar-subscribe?success=Google Calendar connected successfully`
    )

  } catch (error) {
    console.error('Error processing Google Calendar callback:', error)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/calendar-subscribe?error=Failed to connect Google Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
