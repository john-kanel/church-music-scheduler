import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extendRecurringEvents } from '@/lib/recurrence'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Simple shared-secret guard to allow cron access when needed
    const secretHeader = request.headers.get('x-backfill-secret')
    const expected = process.env.BACKFILL_SECRET
    if (!expected || secretHeader !== expected) {
      return NextResponse.json({ error: 'Invalid or missing secret' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const targetMonths = Math.max(1, Math.min(12, Number(body?.targetMonths) || 6))
    const specificRootId: string | undefined = body?.rootEventId

    const targetDate = new Date()
    targetDate.setMonth(targetDate.getMonth() + targetMonths)

    // Fetch root events to process
    const whereClause: any = {
      churchId: session.user.churchId,
      isRootEvent: true,
      isRecurring: true
    }
    if (specificRootId) whereClause.id = specificRootId

    const rootEvents = await prisma.event.findMany({
      where: whereClause,
      select: { id: true, name: true }
    })

    const results: Array<{ rootEventId: string; name: string; created: number }> = []

    // Process in small batches to avoid heavy load
    for (const root of rootEvents) {
      try {
        const created = await extendRecurringEvents(root.id, targetDate, prisma)
        results.push({ rootEventId: root.id, name: root.name, created: created.length })
      } catch (err) {
        results.push({ rootEventId: root.id, name: root.name, created: 0 })
      }
    }

    return NextResponse.json({ processed: rootEvents.length, results }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 })
  }
}


