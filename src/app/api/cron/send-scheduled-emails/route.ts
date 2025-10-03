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

          // Collect changes since last send (simplified: fetch current hymns, documents and basic event info)
          const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
              eventType: true,
              hymns: { include: { servicePart: true }, orderBy: [{ servicePart: { order: 'asc' } }, { createdAt: 'asc' }] },
              assignments: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true
                    }
                  },
                  group: {
                    select: {
                      id: true,
                      name: true,
                      members: true
                    }
                  }
                }
              }
            }
          })
          if (!event) {
            await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'Event not found' } })
            continue
          }

          // Fetch event documents
          const eventDocuments = await prisma.eventDocument.findMany({
            where: { eventId: event.id },
            orderBy: { uploadedAt: 'asc' }
          })

          const musicList = event.hymns.map((h, i) => `${i + 1}. ${h.servicePart?.name || 'Other'}: ${h.title}${h.notes ? ` (${h.notes})` : ''}`).join('\n')

          // Generate musicians and groups section
          let musiciansSection = ''
          if (event.assignments && event.assignments.length > 0) {
            // Get unique groups with member counts (no duplicates)
            const eventGroups = event.assignments.filter(a => a.group).map(a => a.group)
            const uniqueGroups = Array.from(new Set(eventGroups.map(g => g?.id))).map(id => 
              eventGroups.find(g => g?.id === id)
            ).filter(Boolean)
            
            if (uniqueGroups.length > 0) {
              musiciansSection = `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                  <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px;">👥 Musicians & Groups:</h4>
                  <div style="font-size: 14px; line-height: 1.6; color: #4b5563;">
                    <div>
                      <strong>Groups:</strong><br/>
                      ${uniqueGroups.map(g => {
                        const memberCount = (g as any).members?.length || 0
                        return `• ${g!.name} (${memberCount} members)`
                      }).join('<br/>')}
                    </div>
                  </div>
                </div>
              `
            }
          }

          // Generate document links if any
          let documentsSection = ''
          if (eventDocuments.length > 0) {
            const publicToken: string | null = (event as any)?.publicToken || null
            const documentLinks = eventDocuments.map((doc: any) => {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://churchmusicpro.com'
              const viewUrl = publicToken && event.id
                ? `${baseUrl}/api/public-schedule/${publicToken}/events/${event.id}/documents/${doc.id}/view`
                : event.id
                  ? `${baseUrl}/api/events/${event.id}/documents/${doc.id}/view`
                  : `${baseUrl}/sample-music-files`
              return `• <a href="${viewUrl}" style="color: #660033; text-decoration: none;">${doc.originalFilename}</a>`
            }).join('\n')

            documentsSection = `
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px;">📁 Music Files (${eventDocuments.length}):</h4>
                <div style="font-size: 14px; line-height: 1.6; color: #4b5563;">
${documentLinks}
                </div>
              </div>
            `
          }

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
                ${getEmailLogoHtml()}
                <h1 style="color: #333; margin: 0; font-size: 22px;">Daily Update Digest</h1>
              </div>
              <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <p>Hi ${user.firstName || ''},</p>
                <p>There were updates to the event <strong>${event.name}</strong> scheduled for ${new Date(event.startTime).toLocaleString()}.</p>
                <div style="background-color:#f8fafc; padding:20px; border-radius:8px; margin:20px 0;">
                  <h3 style="margin:0 0 15px 0; color:#1f2937;">🎵 Music for this Service</h3>
                  <div style="white-space: pre-line; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; color: #4b5563; line-height: 1.6; font-size: 14px;">${musicList}</div>
                  ${musiciansSection}
                  ${documentsSection}
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
        } else if (schedule.reminderType === 'TRIAL_ENDING_REMINDER' || (schedule.metadata && (schedule.metadata as any).type === 'TRIAL_ENDING_REMINDER')) {
          // Send trial ending reminder to primary contact
          const user = await prisma.user.findUnique({ where: { id: schedule.userId } })
          const church = await prisma.church.findUnique({ where: { id: schedule.churchId } })
          if (!user || !church || !user.emailNotifications) {
            await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'User/Church disabled or missing' } })
            continue
          }

          // Additional safety check: verify this is still a trial church
          if (!['trial', 'trialing'].includes(church.subscriptionStatus)) {
            await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'Church no longer in trial' } })
            console.log(`Skipping trial reminder for church ${church.id} - no longer in trial status: ${church.subscriptionStatus}`)
            continue
          }

          const offsetDays = schedule.reminderOffset || (schedule.metadata as any).offsetDays as number
          const subscriptionEndsIso = (schedule.metadata as any).subscriptionEnds as string
          const subscriptionEnds = subscriptionEndsIso ? new Date(subscriptionEndsIso) : church.subscriptionEnds
          const daysLeft = subscriptionEnds ? Math.ceil((subscriptionEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

          // Safety check: don't send if trial has already ended (more than 1 day past)
          if (daysLeft !== null && daysLeft < -1) {
            await prisma.emailSchedule.update({ where: { id: schedule.id }, data: { sentAt: now, errorReason: 'Trial already ended' } })
            console.log(`Skipping trial reminder for church ${church.id} - trial ended ${Math.abs(daysLeft)} days ago`)
            continue
          }

          const subject = daysLeft !== null && daysLeft <= 0
            ? 'Your free trial ends today'
            : daysLeft === 1
              ? 'Your free trial ends tomorrow'
              : `Your free trial ends in ${daysLeft} days`

          const billingUrl = `${process.env.NEXTAUTH_URL || 'https://churchmusicpro.com'}/billing`

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; border-bottom: 3px solid #660033;">
                ${getEmailLogoHtml()}
                <h1 style="color: #333; margin: 0; font-size: 22px;">Free Trial Reminder</h1>
              </div>
              <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <p>Hi ${user.firstName || ''},</p>
                <p>Your Church Music Pro free trial for <strong>${church.name}</strong> is ${daysLeft !== null && daysLeft <= 0 ? 'ending today' : daysLeft === 1 ? 'ending tomorrow' : `ending in ${daysLeft} days`}.</p>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #660033;">
                  <p style="margin: 0; color: #334155;">
                    Keep full access to scheduling, messaging, and file sharing by choosing a subscription plan.
                  </p>
                </div>
                <div style="text-align:center; margin: 20px 0;">
                  <a href="${billingUrl}" style="background: #660033; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Subscribe Now</a>
                </div>
                <p style="color:#64748b; font-size: 14px;">If you do nothing, access will pause after your trial ends. You can resume anytime by subscribing.</p>
              </div>
            </div>
          `

          if (process.env.RESEND_API_KEY) {
            await resend.emails.send({
              from: 'Church Music Pro <notifications@churchmusicpro.com>',
              to: user.email,
              subject,
              html
            })
          } else {
            console.log('[Trial reminder email simulated]', { to: user.email, subject })
          }

          await prisma.notificationLog.create({
            data: {
              type: 'AUTOMATED_NOTIFICATION_SENT' as any,
              churchId: schedule.churchId,
              recipientEmail: user.email,
              recipientName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              subject,
              metadata: { type: 'TRIAL_ENDING_REMINDER', offsetDays }
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