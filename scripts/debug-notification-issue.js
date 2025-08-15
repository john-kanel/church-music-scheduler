#!/usr/bin/env node

/**
 * Debug script to investigate why a specific musician isn't receiving event reminder emails
 * Usage: node scripts/debug-notification-issue.js [eventId] [musicianEmail]
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debugNotificationIssue(eventId, musicianEmail) {
  console.log(`🔍 Debugging notification issue for musician: ${musicianEmail}`)
  console.log(`📅 Event ID: ${eventId}\n`)

  try {
    // 1. Check if the event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        eventType: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isVerified: true,
                emailNotifications: true,
                smsNotifications: true,
                role: true
              }
            }
          }
        }
      }
    })

    if (!event) {
      console.error(`❌ Event with ID ${eventId} not found`)
      return
    }

    console.log(`✅ Event found: "${event.name}"`)
    console.log(`📅 Event date: ${event.startTime}`)
    console.log(`🏛️ Church ID: ${event.churchId}`)
    console.log(`📊 Total assignments: ${event.assignments.length}\n`)

    // 2. Check if the musician exists and their settings
    const musician = await prisma.user.findFirst({
      where: { email: musicianEmail },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isVerified: true,
        emailNotifications: true,
        smsNotifications: true,
        role: true,
        churchId: true
      }
    })

    if (!musician) {
      console.error(`❌ Musician with email ${musicianEmail} not found`)
      return
    }

    console.log(`👤 Musician found: ${musician.firstName} ${musician.lastName}`)
    console.log(`📧 Email: ${musician.email}`)
    console.log(`✅ Verified: ${musician.isVerified}`)
    console.log(`📬 Email notifications: ${musician.emailNotifications}`)
    console.log(`💬 SMS notifications: ${musician.smsNotifications}`)
    console.log(`👔 Role: ${musician.role}`)
    console.log(`🏛️ Church ID: ${musician.churchId}\n`)

    // 3. Check if musician is assigned to this event
    const musicianAssignment = event.assignments.find(a => a.user?.email === musicianEmail)
    
    if (!musicianAssignment) {
      console.log(`❌ Musician is NOT assigned to this event`)
      console.log(`📋 Assigned musicians:`)
      event.assignments.forEach((assignment, index) => {
        if (assignment.user) {
          console.log(`   ${index + 1}. ${assignment.user.firstName} ${assignment.user.lastName} (${assignment.user.email}) - Verified: ${assignment.user.isVerified}, Email: ${assignment.user.emailNotifications}`)
        } else {
          console.log(`   ${index + 1}. [Unassigned] - Role: ${assignment.roleName}`)
        }
      })
      return
    }

    console.log(`✅ Musician IS assigned to this event`)
    console.log(`🎼 Role: ${musicianAssignment.roleName}`)
    console.log(`📊 Status: ${musicianAssignment.status}\n`)

    // 4. Check church automation settings
    const automationSettings = await prisma.automationSettings.findUnique({
      where: { churchId: event.churchId },
      include: {
        musicianNotifications: {
          orderBy: { hoursBeforeEvent: 'desc' }
        }
      }
    })

    if (!automationSettings) {
      console.log(`❌ No automation settings found for church`)
      return
    }

    console.log(`🤖 Automation settings found:`)
    console.log(`📬 Enabled notifications: ${automationSettings.musicianNotifications.filter(n => n.isEnabled).length}`)
    automationSettings.musicianNotifications.forEach(notification => {
      console.log(`   - ${notification.hoursBeforeEvent}h before: ${notification.isEnabled ? '✅ Enabled' : '❌ Disabled'}`)
    })
    console.log()

    // 5. Check notification logs for this musician and event
    const notificationLogs = await prisma.notificationLog.findMany({
      where: {
        eventId: eventId,
        recipientEmail: musicianEmail
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`📝 Notification logs for this musician and event: ${notificationLogs.length}`)
    notificationLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log.type} - ${log.createdAt} - ${log.subject}`)
      if (log.metadata) {
        console.log(`      Metadata: ${JSON.stringify(log.metadata)}`)
      }
    })
    console.log()

    // 6. Check if there are any general notification logs for this event
    const eventNotificationLogs = await prisma.notificationLog.findMany({
      where: {
        eventId: eventId,
        type: 'MUSICIAN_EVENT_REMINDER'
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`📊 All reminder notification logs for this event: ${eventNotificationLogs.length}`)
    const recipients = [...new Set(eventNotificationLogs.map(log => log.recipientEmail))]
    console.log(`👥 Unique recipients: ${recipients.length}`)
    recipients.forEach((email, index) => {
      const count = eventNotificationLogs.filter(log => log.recipientEmail === email).length
      console.log(`   ${index + 1}. ${email} (${count} notifications)`)
    })
    console.log()

    // 7. Diagnostic summary and recommendations
    console.log(`🔧 DIAGNOSTIC SUMMARY:`)
    
    const issues = []
    const checks = []

    if (!musician.isVerified) {
      checks.push(`⚠️  Musician is not verified (but this should no longer block notifications)`)
    } else {
      checks.push(`✅ Musician is verified`)
    }

    if (!musician.emailNotifications) {
      issues.push(`❌ Musician has email notifications DISABLED`)
    } else {
      checks.push(`✅ Musician has email notifications enabled`)
    }

    if (musician.churchId !== event.churchId) {
      issues.push(`❌ Musician belongs to different church (${musician.churchId} vs ${event.churchId})`)
    } else {
      checks.push(`✅ Musician belongs to same church as event`)
    }

    if (musician.role !== 'MUSICIAN') {
      issues.push(`❌ User role is ${musician.role}, not MUSICIAN`)
    } else {
      checks.push(`✅ User has MUSICIAN role`)
    }

    if (!musicianAssignment) {
      issues.push(`❌ Musician is not assigned to this event`)
    } else {
      checks.push(`✅ Musician is assigned to event`)
    }

    if (automationSettings.musicianNotifications.filter(n => n.isEnabled).length === 0) {
      issues.push(`❌ No enabled notification settings for this church`)
    } else {
      checks.push(`✅ Church has enabled notification settings`)
    }

    console.log(`\n✅ PASSING CHECKS:`)
    checks.forEach(check => console.log(`   ${check}`))

    if (issues.length > 0) {
      console.log(`\n❌ ISSUES FOUND:`)
      issues.forEach(issue => console.log(`   ${issue}`))
    } else {
      console.log(`\n🎯 No obvious issues found. The musician should be receiving notifications.`)
      console.log(`   - Check Resend dashboard for delivery status`)
      console.log(`   - Verify musician's email address is correct`)
      console.log(`   - Check spam folder`)
      console.log(`   - Review notification timing settings`)
    }

  } catch (error) {
    console.error('Error debugging notification issue:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Parse command line arguments
const eventId = process.argv[2]
const musicianEmail = process.argv[3]

if (!eventId || !musicianEmail) {
  console.log('Usage: node scripts/debug-notification-issue.js [eventId] [musicianEmail]')
  console.log('Example: node scripts/debug-notification-issue.js clx123abc musician@church.com')
  process.exit(1)
}

debugNotificationIssue(eventId, musicianEmail)
