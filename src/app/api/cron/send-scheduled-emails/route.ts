import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/resend'
import { getEmailLogoHtml } from '@/components/emails/email-logo'

export async function POST(request: NextRequest) {
  try {
    // Optional: simple bearer token check for cron
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    // Pull due, unsent emails (limit batch size)
    const schedules = await prisma.emailSchedule.findMany({
      where: {
        sentAt: null,
        scheduledFor: { lte: now }
      },
      take: 200,
      orderBy: { scheduledFor: 'asc' }
    })

    for (const schedule of schedules) {
      try {
        // Handle event update digest
        if (schedule.metadata && (schedule.metadata as any).type === 'EVENT_UPDATE_DIGEST') {
          const eventId = (schedule.metadata as any).eventId as string
          const user = await prisma.user.findUnique({ where: { id: schedule.userId } })
          if (!user || !user.emailNotifications) {
            await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'User disabled or missing' } })
            continue
          }

          // Collect changes since last send (simplified: fetch current hymns and basic event info)
          const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
              eventType: true,
              hymns: { include: { servicePart: true }, orderBy: [{ servicePart: { order: 'asc' } }, { createdAt: 'asc' }] }
            }
          })
          if (!event) {
            await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'Event not found' } })
            continue
          }

          const musicList = event.hymns.map((h, i) => `${i + 1}. ${h.servicePart?.name || 'Other'}: ${h.title}${h.notes ? ` (${h.notes})` : ''}`).join('\n')

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
                ${getEmailLogoHtml()}
                <h1 style="color: #333; margin: 0; font-size: 22px;">Daily Update Digest</h1>
              </div>
              <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <p>Hi ${user.firstName || ''},</p>
                <p>There were updates to the event <strong>${event.name}</strong> scheduled for ${new Date(event.startTime).toLocaleString()}.</p>
                <div style="background-color:#f8fafc; padding:16px; border-radius:8px; margin-top:12px;">
                  <h3 style="margin:0 0 8px 0;">Music & Service Parts</h3>
                  <div style="white-space: pre-line; font-family: monospace; color:#374151;">${musicList}</div>
                </div>
              </div>
            </div>
          `

          if (process.env.RESEND_API_KEY) {
            await resend.emails.send({
              from: 'Church Music Pro <notifications@churchmusicpro.com>',
              to: user.email,
              subject: `Daily Digest: Updates to ${event.name}`,
              html
            })
          } else {
            console.log('[Digest email simulated]', { to: user.email })
          }

          await prisma.notificationLog.create({
            data: {
              type: 'EVENT_UPDATED',
              churchId: schedule.churchId,
              eventId: event.id,
              recipientEmail: user.email,
              recipientName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              subject: `Daily Digest: Updates to ${event.name}`,
              metadata: { type: 'EVENT_UPDATE_DIGEST' }
            }
          })

          await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: new Date() } })
        } else {
          // Unknown email - mark as processed to avoid blocking
          await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'Unhandled type' } })
        }
      } catch (err: any) {
        await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { attempts: schedule.attempts + 1, lastAttemptAt: new Date(), errorReason: err?.message?.slice(0, 200) || 'send error' } })
      }
    }

    return NextResponse.json({ processed: schedules.length })
  } catch (error) {
    console.error('Failed to process scheduled emails', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Note: Legacy implementation removed to avoid duplicate exports/imports