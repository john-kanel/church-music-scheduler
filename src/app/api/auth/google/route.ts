import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GoogleCalendarService } from '@/lib/google-calendar'

/**
 * Initiate Google Calendar OAuth flow
 * GET /api/auth/google
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate Google OAuth URL
    const googleCalendar = new GoogleCalendarService()
    const authUrl = googleCalendar.getAuthUrl()

    console.log('🔗 Generated Google Calendar auth URL for user:', session.user.id)

    // Return the authorization URL
    return NextResponse.json({ 
      authUrl,
      message: 'Visit this URL to authorize Google Calendar access'
    })

  } catch (error) {
    console.error('Error generating Google Calendar auth URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}
