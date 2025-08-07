import { google, calendar_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

// Types for our calendar integration
export interface GoogleCalendarTokens {
  access_token: string
  refresh_token: string
  scope: string
  token_type: string
  expiry_date?: number
}

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  location?: string
  start: Date
  end: Date
  status?: 'confirmed' | 'tentative' | 'cancelled'
}

/**
 * Google Calendar API Service
 * Handles all Google Calendar operations with proper error handling
 */
export class GoogleCalendarService {
  private oauth2Client: OAuth2Client
  private calendar: calendar_v3.Calendar

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
    )

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client })
  }

  /**
   * Get the authorization URL for OAuth flow
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ]

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<GoogleCalendarTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code)
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to get required tokens from Google')
      }

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token!,
        scope: tokens.scope || '',
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || undefined
      }
    } catch (error) {
      console.error('Error exchanging code for tokens:', error)
      throw new Error('Failed to authenticate with Google Calendar')
    }
  }

  /**
   * Set tokens for API calls
   */
  setTokens(tokens: GoogleCalendarTokens): void {
    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date
    })
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(): Promise<GoogleCalendarTokens> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken()
      
      return {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token!,
        scope: credentials.scope || '',
        token_type: credentials.token_type || 'Bearer',
        expiry_date: credentials.expiry_date || undefined
      }
    } catch (error) {
      console.error('Error refreshing tokens:', error)
      throw new Error('Failed to refresh Google Calendar tokens')
    }
  }

  /**
   * Create an event in Google Calendar
   */
  async createEvent(event: CalendarEvent): Promise<string> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: {
            dateTime: event.start.toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: event.end.toISOString(),
            timeZone: 'UTC'
          },
          status: event.status || 'confirmed',
          // Add source to identify events created by our app
          source: {
            title: 'Church Music Scheduler',
            url: process.env.NEXTAUTH_URL
          }
        }
      })

      if (!response.data.id) {
        throw new Error('Event created but no ID returned')
      }

      console.log(`✅ Created Google Calendar event: ${response.data.id}`)
      return response.data.id
    } catch (error) {
      console.error('Error creating Google Calendar event:', error)
      throw new Error(`Failed to create calendar event: ${event.summary}`)
    }
  }

  /**
   * Update an existing event in Google Calendar
   */
  async updateEvent(googleEventId: string, event: CalendarEvent): Promise<void> {
    try {
      await this.calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody: {
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: {
            dateTime: event.start.toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: event.end.toISOString(),
            timeZone: 'UTC'
          },
          status: event.status || 'confirmed',
          source: {
            title: 'Church Music Scheduler',
            url: process.env.NEXTAUTH_URL
          }
        }
      })

      console.log(`✅ Updated Google Calendar event: ${googleEventId}`)
    } catch (error) {
      console.error('Error updating Google Calendar event:', error)
      throw new Error(`Failed to update calendar event: ${event.summary}`)
    }
  }

  /**
   * Delete an event from Google Calendar
   */
  async deleteEvent(googleEventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId
      })

      console.log(`✅ Deleted Google Calendar event: ${googleEventId}`)
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error)
      throw new Error(`Failed to delete calendar event: ${googleEventId}`)
    }
  }

  /**
   * Test the connection to Google Calendar
   */
  async testConnection(): Promise<{ success: boolean; userEmail?: string; error?: string }> {
    try {
      // Try to get calendar list to test the connection
      const response = await this.calendar.calendarList.list({
        maxResults: 1
      })

      // Also get user info
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
      const userInfo = await oauth2.userinfo.get()

      return {
        success: true,
        userEmail: userInfo.data.email || undefined
      }
    } catch (error) {
      console.error('Google Calendar connection test failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * Convert our database event to Google Calendar format
 */
export function convertToGoogleCalendarEvent(event: any): CalendarEvent {
  // Calculate end time - default to 1 hour if not specified
  const endTime = event.endTime || new Date(event.startTime.getTime() + 60 * 60 * 1000)

  // Build description with assignments and music
  const descriptionParts: string[] = []
  
  // Add event description if exists
  if (event.description) {
    descriptionParts.push(event.description)
    descriptionParts.push('')
  }

  // Add musician assignments
  const acceptedAssignments = event.assignments?.filter((a: any) => a.user && a.status === 'ACCEPTED') || []
  if (acceptedAssignments.length > 0) {
    descriptionParts.push('MUSICIANS:')
    acceptedAssignments.forEach((assignment: any) => {
      if (assignment.user) {
        const role = assignment.roleName || 'Musician'
        const name = `${assignment.user.firstName} ${assignment.user.lastName}`
        descriptionParts.push(`${role}: ${name}`)
      }
    })
    descriptionParts.push('')
  }

  // Add music/hymns
  const hymns = event.hymns?.filter((h: any) => h.title && h.title.trim()) || []
  if (hymns.length > 0) {
    descriptionParts.push('MUSIC:')
    
    // Group by service part
    const partGroups = new Map<string, any[]>()
    hymns.forEach((hymn: any) => {
      const partName = hymn.servicePart?.name || 'General Music'
      if (!partGroups.has(partName)) {
        partGroups.set(partName, [])
      }
      partGroups.get(partName)!.push(hymn)
    })

    // Output each service part
    partGroups.forEach((partHymns, partName) => {
      descriptionParts.push(`${partName}:`)
      partHymns.forEach((hymn: any) => {
        let musicLine = `- ${hymn.title}`
        if (hymn.notes) {
          musicLine += ` (${hymn.notes})`
        }
        descriptionParts.push(musicLine)
      })
    })
    descriptionParts.push('')
  }

  // Add event type
  if (event.eventType?.name) {
    descriptionParts.push(`Event Type: ${event.eventType.name}`)
  }

  return {
    id: event.id,
    summary: event.name,
    description: descriptionParts.join('\n').trim(),
    location: event.location || undefined,
    start: new Date(event.startTime),
    end: endTime,
    status: event.status === 'CANCELLED' ? 'cancelled' : 'confirmed'
  }
}
