import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Queue trial-ending reminders for directors of churches in trial
// IMPORTANT: This should run ONCE DAILY, not multiple times per hour
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[TRIAL-REMINDERS] Starting trial reminders cron job at', new Date().toISOString())

    const now = new Date()
    const startWindow = new Date(now)
    startWindow.setDate(startWindow.getDate() + 0)
    const endWindow = new Date(now)
    endWindow.setDate(endWindow.getDate() + 7)

    // Find churches in trial with upcoming subscriptionEnds within next 8 days (covers 7d and 1d and today)
    const churches = await prisma.church.findMany({
      where: {
        subscriptionStatus: { in: ['trial', 'trialing'] },
        subscriptionEnds: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), // start of today UTC
          lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7) // 7 days ahead
        }
      },
      include: {
        users: {
          where: { role: { in: ['DIRECTOR', 'ASSOCIATE_DIRECTOR'] } },
          orderBy: { createdAt: 'asc' },
          take: 1
        }
      }
    })

    let queued = 0
    let skipped = 0
    let errors = 0

    console.log(`[TRIAL-REMINDERS] Found ${churches.length} churches in trial`)

    for (const church of churches) {
      if (!church.subscriptionEnds || church.users.length === 0) {
        console.log(`[TRIAL-REMINDERS] Skipping church ${church.id} - no subscription end date or no director`)
        continue
      }
      const primaryUser = church.users[0]

      const daysLeft = Math.ceil((church.subscriptionEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`[TRIAL-REMINDERS] Processing church ${church.id} (${church.name}) - trial ends in ${daysLeft} days`)

      // We will schedule reminders at 7 days, 1 day, and day-of expiry
      const targetOffsets = [7, 1, 0]

      for (const offset of targetOffsets) {
        const scheduledFor = new Date(church.subscriptionEnds)
        scheduledFor.setDate(scheduledFor.getDate() - offset)

        // Normalize to 09:00 local time of user if possible (using stored timezone), else 09:00 UTC
        const timezone = (primaryUser as any).timezone || 'America/Chicago'
        const year = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric' }).format(scheduledFor)
        const month = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: '2-digit' }).format(scheduledFor)
        const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, day: '2-digit' }).format(scheduledFor)
        const localIso = `${year}-${month}-${day}T09:00:00`
        const scheduledLocal = new Date(localIso)

        // Skip scheduling in the past
        if (scheduledLocal.getTime() < now.getTime()) {
          console.log(`[TRIAL-REMINDERS] Skipping past date for church ${church.id}, offset ${offset} days`)
          continue
        }

        // CRITICAL: Check if reminder already exists (including sent ones)
        // This prevents re-creating reminders on subsequent cron runs
        const existing = await prisma.emailSchedule.findFirst({
          where: {
            churchId: church.id,
            userId: primaryUser.id,
            reminderType: 'TRIAL_ENDING_REMINDER',
            reminderOffset: offset
          }
        })

        if (existing) {
          console.log(`[TRIAL-REMINDERS] ✓ Reminder already exists for church ${church.id}, user ${primaryUser.id}, offset ${offset} days (ID: ${existing.id}, sentAt: ${existing.sentAt})`)
          skipped++
          continue
        }

        // Create the reminder with database-level duplicate protection
        try {
          const created = await prisma.emailSchedule.create({
            data: {
              churchId: church.id,
              userId: primaryUser.id,
              emailType: 'WELCOME',
              scheduledFor: scheduledLocal,
              reminderType: 'TRIAL_ENDING_REMINDER',
              reminderOffset: offset,
              metadata: {
                type: 'TRIAL_ENDING_REMINDER',
                offsetDays: offset,
                subscriptionEnds: church.subscriptionEnds.toISOString(),
                churchName: church.name
              }
            }
          })
          console.log(`[TRIAL-REMINDERS] ✓ Queued new reminder for church ${church.id}, offset ${offset} days (ID: ${created.id})`)
          queued++
        } catch (error: any) {
          // P2002 = Unique constraint violation (expected if concurrent runs happen)
          if (error.code === 'P2002' || error.message?.includes('unique constraint')) {
            console.log(`[TRIAL-REMINDERS] ⚠ Unique constraint caught duplicate for church ${church.id}, offset ${offset} days - safely skipping`)
            skipped++
            continue
          }
          // Unexpected error - log and continue with next church
          console.error(`[TRIAL-REMINDERS] ✗ Error creating reminder for church ${church.id}, offset ${offset}:`, error.message)
          errors++
        }
      }
    }

    console.log(`[TRIAL-REMINDERS] Completed: ${queued} queued, ${skipped} skipped, ${errors} errors`)
    return NextResponse.json({ queued, skipped, errors, churches: churches.length })
  } catch (error) {
    console.error('[TRIAL-REMINDERS] Fatal error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}


