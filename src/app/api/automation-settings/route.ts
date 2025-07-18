import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is director or associate director
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user || !['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Directors only' },
        { status: 403 }
      )
    }

    // Get automation settings for the church
    const settings = await prisma.automationSettings.findUnique({
      where: { churchId: user.churchId },
      include: {
        musicianNotifications: {
          orderBy: { hoursBeforeEvent: 'desc' }
        }
      }
    })

    return NextResponse.json(settings)

  } catch (error) {
    console.error('Error fetching automation settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is director or associate director
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { church: true }
    })

    if (!user || !['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Directors only' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      musicianNotifications,
      pastorEmailEnabled,
      pastorMonthlyReportDay,
      pastorWeeklyReportEnabled,
      pastorWeeklyReportDay,
      pastorDailyDigestEnabled,
      pastorDailyDigestTime
    } = body

    // Upsert automation settings
    const settings = await prisma.automationSettings.upsert({
      where: { churchId: user.churchId },
      create: {
        churchId: user.churchId,
        pastorEmailEnabled,
        pastorMonthlyReportDay,
        pastorWeeklyReportEnabled,
        pastorWeeklyReportDay,
        pastorDailyDigestEnabled,
        pastorDailyDigestTime,
        musicianNotifications: {
          create: (musicianNotifications || []).map((notification: any) => ({
            hoursBeforeEvent: notification.hoursBeforeEvent,
            isEnabled: notification.isEnabled
          }))
        }
      },
      update: {
        pastorEmailEnabled,
        pastorMonthlyReportDay,
        pastorWeeklyReportEnabled,
        pastorWeeklyReportDay,
        pastorDailyDigestEnabled,
        pastorDailyDigestTime,
        musicianNotifications: {
          deleteMany: {},
          create: (musicianNotifications || []).map((notification: any) => ({
            hoursBeforeEvent: notification.hoursBeforeEvent,
            isEnabled: notification.isEnabled
          }))
        }
      },
      include: {
        musicianNotifications: {
          orderBy: { hoursBeforeEvent: 'desc' }
        }
      }
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'AUTOMATION_SETTINGS_UPDATED',
        description: 'Automation settings updated',
        churchId: user.churchId,
        userId: user.id,
        metadata: {
          musicianNotificationsCount: musicianNotifications.length,
          pastorEmailEnabled,
          pastorWeeklyReportEnabled,
          pastorDailyDigestEnabled
        }
      }
    })

    return NextResponse.json(settings)

  } catch (error) {
    console.error('Error saving automation settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 