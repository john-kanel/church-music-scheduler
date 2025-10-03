import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Queue trial-ending reminders for directors of churches in trial
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    for (const church of churches) {
      if (!church.subscriptionEnds || church.users.length === 0) continue
      const primaryUser = church.users[0]

      const daysLeft = Math.ceil((church.subscriptionEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

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
        if (scheduledLocal.getTime() < now.getTime()) continue

        // Dedupe by churchId+userId+reminderType+reminderOffset - check for both unsent and sent emails
        const existing = await prisma.emailSchedule.findFirst({
          where: {
            churchId: church.id,
            userId: primaryUser.id,
            reminderType: 'TRIAL_ENDING_REMINDER',
            reminderOffset: offset
          }
        })

        if (existing) {
          console.log(`Skipping duplicate trial reminder for church ${church.id}, user ${primaryUser.id}, offset ${offset} days`)
          continue
        }

        await prisma.emailSchedule.create({
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
        queued++
      }
    }

    return NextResponse.json({ queued })
  } catch (error) {
    console.error('Failed to queue trial reminders', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}


