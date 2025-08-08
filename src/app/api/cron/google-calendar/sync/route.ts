import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { GoogleCalendarService, convertToGoogleCalendarEvent } from '@/lib/google-calendar'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!CRON_SECRET || token !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Batching controls from query params
    const url = new URL(request.url)
    const maxIntegrations = Math.max(
      1,
      Math.min(5, Number(url.searchParams.get('integrations') || '1'))
    )
    const maxEvents = Math.max(
      10,
      Math.min(200, Number(url.searchParams.get('events') || '60'))
    )
    const delayMs = Math.max(0, Math.min(1000, Number(url.searchParams.get('delayMs') || '400')))

    // Find a small batch of active integrations to avoid timeouts
    const integrations = await prisma.googleCalendarIntegration.findMany({
      where: { isActive: true },
      include: {
        user: {
          include: { church: true }
        }
      },
      orderBy: { updatedAt: 'asc' },
      take: maxIntegrations
    })

    let totalCreated = 0
    let totalUpdated = 0
    const errors: string[] = []

    const startTime = Date.now()
    for (const integration of integrations) {
      try {
        const google = new GoogleCalendarService()
        google.setTokens({
          access_token: integration.accessToken,
          refresh_token: integration.refreshToken,
          scope: integration.scope,
          token_type: integration.tokenType,
          expiry_date: integration.expiryDate?.getTime()
        })

        const churchName = integration.user.church?.name || 'Church'
        // Ensure writable calendar
        const calendarId = await google.ensureWritableCalendar(churchName, integration.calendarId || undefined)
        if (calendarId !== integration.calendarId) {
          await prisma.googleCalendarIntegration.update({
            where: { id: integration.id },
            data: { calendarId }
          })
        }

        // Get events to sync (future, confirmed/cancelled)
        const events = await prisma.event.findMany({
          where: {
            churchId: integration.user.churchId,
            startTime: { gte: new Date() },
            status: { in: ['CONFIRMED', 'CANCELLED'] }
          },
          include: {
            eventType: true,
            assignments: { include: { user: true, group: true } },
            hymns: {
              include: { servicePart: true },
              orderBy: [{ servicePart: { order: 'asc' } }, { createdAt: 'asc' }]
            }
          },
          orderBy: { startTime: 'asc' },
          take: maxEvents
        })

        const userTimezone = integration.user.timezone || 'America/Chicago'

        for (const e of events) {
          try {
            const gEvent = convertToGoogleCalendarEvent(e, userTimezone)

            // Check if we already synced this event for this integration
            const existing = await prisma.googleCalendarEvent.findFirst({
              where: { eventId: e.id, integrationId: integration.id }
            })

            if (existing) {
              await google.updateEvent(existing.googleEventId, gEvent, calendarId)
              await prisma.googleCalendarEvent.update({
                where: { id: existing.id },
                data: { lastSyncedAt: new Date() }
              })
              totalUpdated++
            } else {
              const googleEventId = await google.createEvent(gEvent, calendarId)
              await prisma.googleCalendarEvent.upsert({
                where: { eventId_integrationId: { eventId: e.id, integrationId: integration.id } },
                update: { googleEventId, lastSyncedAt: new Date() },
                create: { eventId: e.id, integrationId: integration.id, googleEventId }
              })
              totalCreated++
            }

            // Rate limit
            if (delayMs > 0) {
              await new Promise(r => setTimeout(r, delayMs))
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown Google error'
            errors.push(`Event ${e.name}: ${msg}`)
          }

          // Safety guard to avoid provider timeouts
          if (Date.now() - startTime > 45000) {
            break
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown integration error'
        errors.push(`Integration ${integration.id}: ${msg}`)
      }
    }

    return NextResponse.json({
      success: true,
      created: totalCreated,
      updated: totalUpdated,
      errorsCount: errors.length,
      errors: errors.slice(0, 5),
      meta: {
        processedIntegrations: integrations.length,
        maxIntegrations,
        maxEvents,
        delayMs,
        durationMs: Date.now() - startTime
      }
    })
  } catch (error) {
    console.error('Cron Google sync failed:', error)
    return NextResponse.json({ error: 'Cron Google sync failed' }, { status: 500 })
  }
}


