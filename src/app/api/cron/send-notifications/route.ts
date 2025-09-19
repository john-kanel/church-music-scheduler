import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendMusicianEventNotification, sendPastorMonthlyReport, sendPastorDailyDigest, sendPastorWeeklyReport } from '@/lib/automation-emails'
import { resolveEventAssignments } from '@/lib/dynamic-assignments'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = new Date()
    const currentHour = now.getHours()
    const currentDate = now.getDate()
    
    console.log(`Running notification cron job at ${now.toISOString()}`)

    // Get all churches with automation settings
    const churches = await prisma.church.findMany({
      include: {
        automationSettings: {
          include: {
            musicianNotifications: true
          }
        },
        events: {
          where: {
            startTime: {
              gte: now,
              lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
            }
          },
          include: {
            assignments: {
              include: {
                user: true,
                group: true,
                customRole: true
              }
            },
            eventType: true
          }
        },
        users: {
          where: {
            role: {
              in: ['PASTOR', 'ASSOCIATE_PASTOR']
            }
          }
        }
      }
    })

    let notificationsSent = 0
    let errors = 0

    for (const church of churches) {
      try {
        // Skip if no automation settings
        if (!church.automationSettings) continue

        // Send musician notifications
        if (church.automationSettings.musicianNotifications.length > 0) {
          // Resolve dynamic assignments for all events
          const eventsWithDynamicAssignments = await resolveEventAssignments(church.events)
          const churchWithResolvedEvents = { ...church, events: eventsWithDynamicAssignments }
          
          await processMusicianNotifications(churchWithResolvedEvents, now)
          notificationsSent++
        }

        // Send pastor monthly reports (on the specified day at 8 AM)
        if (
          church.automationSettings.pastorEmailEnabled &&
          currentDate === church.automationSettings.pastorMonthlyReportDay &&
          currentHour === 8
        ) {
          await sendPastorMonthlyReports(church)
          notificationsSent++
        }

        // Send pastor weekly reports (on the specified day at 8 AM)
        if (
          church.automationSettings.pastorWeeklyReportEnabled &&
          now.getDay() === church.automationSettings.pastorWeeklyReportDay &&
          currentHour === 8
        ) {
          await sendPastorWeeklyReports(church)
          notificationsSent++
        }

        // Send pastor daily digests (at specified time)
        if (
          church.automationSettings.pastorDailyDigestEnabled &&
          currentHour === parseInt(church.automationSettings.pastorDailyDigestTime.split(':')[0])
        ) {
          await sendPastorDailyDigests(church)
          notificationsSent++
        }

      } catch (error) {
        console.error(`Error processing notifications for church ${church.id}:`, error)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent,
      errors,
      processedAt: now.toISOString()
    })

  } catch (error) {
    console.error('Error in notification cron job:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processMusicianNotifications(church: any, now: Date) {
  const { automationSettings, events } = church

  for (const event of events) {
    const eventDateTime = new Date(event.startTime)
    const hoursUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    for (const notificationSetting of automationSettings.musicianNotifications) {
      if (!notificationSetting.isEnabled) continue

      // Only send notifications that make sense given the actual time until the event
      // Don't send a "7-day" reminder for an event that's only 1 day away
      if (notificationSetting.hoursBeforeEvent > hoursUntilEvent) {
        console.log(`Skipping ${notificationSetting.hoursBeforeEvent}-hour reminder for event "${event.name}" - only ${Math.round(hoursUntilEvent)} hours until event`)
        continue
      }

      const notificationTime = new Date(event.startTime.getTime() - notificationSetting.hoursBeforeEvent * 60 * 60 * 1000)
      
      // Check if we should send this notification now (within 1 hour window)
      const timeDiff = Math.abs(now.getTime() - notificationTime.getTime())
      if (timeDiff > 60 * 60 * 1000) continue // More than 1 hour difference

      // Check if we already sent this notification
      const existingLog = await prisma.notificationLog.findFirst({
        where: {
          eventId: event.id,
          type: 'MUSICIAN_EVENT_REMINDER',
          metadata: {
            path: ['hoursBeforeEvent'],
            equals: notificationSetting.hoursBeforeEvent
          }
        }
      })

      if (existingLog) continue

      // Send notifications to all assigned musicians with email notifications enabled
      for (const assignment of event.assignments) {
        // Skip if no user or user doesn't want email notifications
        if (!assignment.userId || !assignment.user?.emailNotifications) continue

        try {
          await sendMusicianEventNotification(
            assignment.user.email,
            assignment.user.firstName,
            event,
            notificationSetting.hoursBeforeEvent
          )

          // Log the notification
          await prisma.notificationLog.create({
            data: {
              type: 'MUSICIAN_EVENT_REMINDER',
              churchId: church.id,
              eventId: event.id,
              recipientEmail: assignment.user.email,
              recipientName: `${assignment.user.firstName} ${assignment.user.lastName}`,
              subject: `Reminder: ${event.name}`,
              sentAt: now,
              metadata: {
                hoursBeforeEvent: notificationSetting.hoursBeforeEvent,
                eventName: event.name
              }
            }
          })

          // Log activity
          await prisma.activity.create({
            data: {
              type: 'AUTOMATED_NOTIFICATION_SENT',
              description: `Automated reminder sent to ${assignment.user.firstName} for "${event.name}"`,
              churchId: church.id,
              metadata: {
                eventId: event.id,
                userId: assignment.user.id,
                hoursBeforeEvent: notificationSetting.hoursBeforeEvent,
                eventName: event.name,
                eventDate: event.startTime
              }
            }
          })

        } catch (error) {
          console.error(`Error sending notification to ${assignment.user.email}:`, error)
        }
      }
    }
  }
}

async function sendPastorMonthlyReports(church: any) {
  try {
    // Get pastor users for this church
    const pastors = await prisma.user.findMany({
      where: {
        churchId: church.id,
        role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] },
        isVerified: true
      },
      include: {
        pastorSettings: true
      }
    })

    // Also get invited pastors who haven't created accounts yet
    const invitedPastors = await prisma.invitation.findMany({
      where: {
        churchId: church.id,
        role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] },
        status: { in: ['PENDING', 'ACCEPTED'] }
      }
    })

    if (pastors.length === 0 && invitedPastors.length === 0) return

    // Get events for next month
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const endNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0)

    const events = await prisma.event.findMany({
      where: {
        churchId: church.id,
        startTime: {
          gte: nextMonth,
          lte: endNextMonth
        }
      },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    // Send report to each pastor (existing users)
    for (const pastor of pastors) {
      if (pastor.pastorSettings?.monthlyReportEnabled !== false) {
        try {
          await sendPastorMonthlyReport(
            pastor.email,
            pastor.firstName,
            church.name,
            events,
            nextMonth
          )

          // Log the notification
          await prisma.notificationLog.create({
            data: {
              type: 'PASTOR_MONTHLY_REPORT',
              churchId: church.id,
              recipientEmail: pastor.email,
              recipientName: `${pastor.firstName} ${pastor.lastName}`,
              subject: `Monthly Music Schedule Report - ${nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
              metadata: {
                eventsCount: events.length,
                month: nextMonth.toISOString()
              }
            }
          })
        } catch (error) {
          console.error(`Error sending monthly report to ${pastor.email}:`, error)
        }
      }
    }

    // Send report to each invited pastor (not yet users)
    for (const invitedPastor of invitedPastors) {
      try {
        const pastorName = invitedPastor.firstName || invitedPastor.email.split('@')[0]
        await sendPastorMonthlyReport(
          invitedPastor.email,
          pastorName,
          church.name,
          events,
          nextMonth
        )

        // Log the notification
        await prisma.notificationLog.create({
          data: {
            type: 'PASTOR_MONTHLY_REPORT',
            churchId: church.id,
            recipientEmail: invitedPastor.email,
            recipientName: `${invitedPastor.firstName || pastorName} ${invitedPastor.lastName || ''}`.trim(),
            subject: `Monthly Music Schedule Report - ${nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            metadata: {
              eventsCount: events.length,
              month: nextMonth.toISOString(),
              isInvitedPastor: true
            }
          }
        })
      } catch (error) {
        console.error(`Error sending monthly report to invited pastor ${invitedPastor.email}:`, error)
      }
    }
  } catch (error) {
    console.error('Error sending pastor monthly reports:', error)
  }
}

async function sendPastorWeeklyReports(church: any) {
  try {
    // Get pastor users for this church
    const pastors = await prisma.user.findMany({
      where: {
        churchId: church.id,
        role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] },
        isVerified: true
      },
      include: {
        pastorSettings: true
      }
    })

    // Also get invited pastors who haven't created accounts yet
    const invitedPastors = await prisma.invitation.findMany({
      where: {
        churchId: church.id,
        role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] },
        status: { in: ['PENDING', 'ACCEPTED'] }
      }
    })

    if (pastors.length === 0 && invitedPastors.length === 0) return

    // Determine the correct week based on the logic:
    // Sunday = current week (Sunday-Saturday)
    // Monday-Saturday = next week (Monday-Sunday)
    const now = new Date()
    const currentDay = now.getDay()
    const selectedDay = church.automationSettings.pastorWeeklyReportDay

    let weekStartDate: Date
    
    if (selectedDay === 0) {
      // Sunday - show current week (Sunday-Saturday)
      weekStartDate = new Date(now)
      weekStartDate.setDate(now.getDate() - currentDay)
    } else {
      // Monday-Saturday - show next week (Monday-Sunday)
      const daysUntilMonday = (8 - currentDay) % 7
      weekStartDate = new Date(now)
      weekStartDate.setDate(now.getDate() + daysUntilMonday)
    }

    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekStartDate.getDate() + 6)

    // Get events for the determined week
    const events = await prisma.event.findMany({
      where: {
        churchId: church.id,
        startTime: {
          gte: weekStartDate,
          lte: weekEndDate
        }
      },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        eventType: true
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    // Send report to each pastor (existing users)
    for (const pastor of pastors) {
      if (pastor.pastorSettings?.monthlyReportEnabled !== false) {
        try {
          await sendPastorWeeklyReport(
            pastor.email,
            pastor.firstName,
            church.name,
            events,
            weekStartDate
          )

          // Log the notification
          await prisma.notificationLog.create({
            data: {
              type: 'PASTOR_WEEKLY_REPORT',
              churchId: church.id,
              recipientEmail: pastor.email,
              recipientName: `${pastor.firstName} ${pastor.lastName}`,
              subject: `Weekly Music Schedule Report - ${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`,
              metadata: {
                eventsCount: events.length,
                weekStartDate: weekStartDate.toISOString(),
                weekEndDate: weekEndDate.toISOString()
              }
            }
          })
        } catch (error) {
          console.error(`Error sending weekly report to ${pastor.email}:`, error)
        }
      }
    }

    // Send report to each invited pastor (not yet users)
    for (const invitedPastor of invitedPastors) {
      try {
        const pastorName = invitedPastor.firstName || invitedPastor.email.split('@')[0]
        await sendPastorWeeklyReport(
          invitedPastor.email,
          pastorName,
          church.name,
          events,
          weekStartDate
        )

        // Log the notification
        await prisma.notificationLog.create({
          data: {
            type: 'PASTOR_WEEKLY_REPORT',
            churchId: church.id,
            recipientEmail: invitedPastor.email,
            recipientName: `${invitedPastor.firstName || pastorName} ${invitedPastor.lastName || ''}`.trim(),
            subject: `Weekly Music Schedule Report - ${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`,
            metadata: {
              eventsCount: events.length,
              weekStartDate: weekStartDate.toISOString(),
              weekEndDate: weekEndDate.toISOString(),
              isInvitedPastor: true
            }
          }
        })
      } catch (error) {
        console.error(`Error sending weekly report to invited pastor ${invitedPastor.email}:`, error)
      }
    }
  } catch (error) {
    console.error('Error sending pastor weekly reports:', error)
  }
}

async function sendPastorDailyDigests(church: any) {
  try {
    // Get pastor users for this church
    const pastors = await prisma.user.findMany({
      where: {
        churchId: church.id,
        role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] }
        // Removed isVerified requirement to send notifications to unverified pastors
      },
      include: {
        pastorSettings: true
      }
    })

    // Also get invited pastors who haven't created accounts yet
    const invitedPastors = await prisma.invitation.findMany({
      where: {
        churchId: church.id,
        role: { in: ['PASTOR', 'ASSOCIATE_PASTOR'] },
        status: { in: ['PENDING', 'ACCEPTED'] }
      }
    })

    if (pastors.length === 0 && invitedPastors.length === 0) return

    // Get activities from yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    
    const endYesterday = new Date()
    endYesterday.setDate(endYesterday.getDate() - 1)
    endYesterday.setHours(23, 59, 59, 999)

    const activities = await prisma.activity.findMany({
      where: {
        churchId: church.id,
        createdAt: {
          gte: yesterday,
          lte: endYesterday
        },
        type: {
          in: ['EVENT_CREATED', 'MUSICIAN_INVITED', 'MUSICIAN_SIGNED_UP', 'AUTOMATED_NOTIFICATION_SENT']
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Only send if there were activities
    if (activities.length === 0) return

    // Send digest to each pastor (existing users)
    for (const pastor of pastors) {
      if (pastor.pastorSettings?.dailyDigestEnabled !== false) {
        try {
          await sendPastorDailyDigest(
            pastor.email,
            pastor.firstName,
            church.name,
            activities,
            yesterday
          )

          // Log the notification
          await prisma.notificationLog.create({
            data: {
              type: 'PASTOR_DAILY_DIGEST',
              churchId: church.id,
              recipientEmail: pastor.email,
              recipientName: `${pastor.firstName} ${pastor.lastName}`,
              subject: `Daily Music Ministry Update - ${yesterday.toLocaleDateString()}`,
              metadata: {
                activitiesCount: activities.length,
                date: yesterday.toISOString()
              }
            }
          })
        } catch (error) {
          console.error(`Error sending daily digest to ${pastor.email}:`, error)
        }
      }
    }

    // Send digest to each invited pastor (not yet users)
    for (const invitedPastor of invitedPastors) {
      try {
        const pastorName = invitedPastor.firstName || invitedPastor.email.split('@')[0]
        await sendPastorDailyDigest(
          invitedPastor.email,
          pastorName,
          church.name,
          activities,
          yesterday
        )

        // Log the notification
        await prisma.notificationLog.create({
          data: {
            type: 'PASTOR_DAILY_DIGEST',
            churchId: church.id,
            recipientEmail: invitedPastor.email,
            recipientName: `${invitedPastor.firstName || pastorName} ${invitedPastor.lastName || ''}`.trim(),
            subject: `Daily Music Ministry Update - ${yesterday.toLocaleDateString()}`,
            metadata: {
              activitiesCount: activities.length,
              date: yesterday.toISOString(),
              isInvitedPastor: true
            }
          }
        })
      } catch (error) {
        console.error(`Error sending daily digest to invited pastor ${invitedPastor.email}:`, error)
      }
    }
  } catch (error) {
    console.error('Error sending pastor daily digests:', error)
  }
} 