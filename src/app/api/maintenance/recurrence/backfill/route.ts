import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extendRecurringEvents } from '@/lib/recurrence'

export async function POST(request: NextRequest) {
  try {
    // Parse inputs
    const body = await request.json().catch(() => ({}))
    const targetMonths = Math.max(1, Math.min(12, Number(body?.targetMonths) || 6))
    const specificRootId: string | undefined = body?.rootEventId
    const requestedChurchId: string | undefined = body?.churchId

    const targetDate = new Date()
    targetDate.setMonth(targetDate.getMonth() + targetMonths)

    // Allow EITHER a valid secret header OR a logged-in session with proper role
    const secretHeader = request.headers.get('x-backfill-secret')
    const expectedSecret = process.env.BACKFILL_SECRET
    const hasValidSecret = Boolean(expectedSecret && secretHeader && secretHeader === expectedSecret)

    let churchIdsToProcess: string[] = []

    if (hasValidSecret) {
      // Secret-only mode: process specified churchId, else all churches
      if (requestedChurchId) {
        churchIdsToProcess = [requestedChurchId]
      } else {
        const churches = await prisma.church.findMany({ select: { id: true } })
        churchIdsToProcess = churches.map(c => c.id)
      }
    } else {
      // Fallback to session-based auth
      const session = await getServerSession(authOptions)
      if (!session?.user?.churchId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      churchIdsToProcess = [session.user.churchId]
    }

    const results: Array<{ rootEventId: string; name: string; created: number; churchId: string }> = []
    let processedRoots = 0

    for (const churchId of churchIdsToProcess) {
      // Fetch root events to process for this church
      const whereClause: any = {
        churchId,
        isRootEvent: true,
        isRecurring: true
      }
      if (specificRootId) whereClause.id = specificRootId

      const rootEvents = await prisma.event.findMany({
        where: whereClause,
        select: { id: true, name: true }
      })
      processedRoots += rootEvents.length

      // Process in small batches to avoid heavy load
      for (const root of rootEvents) {
        try {
          const created = await extendRecurringEvents(root.id, targetDate, prisma)
          results.push({ rootEventId: root.id, name: root.name, created: created.length, churchId })
        } catch (err) {
          results.push({ rootEventId: root.id, name: root.name, created: 0, churchId })
        }
      }
    }

    return NextResponse.json({ processed: processedRoots, results }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 })
  }
}


