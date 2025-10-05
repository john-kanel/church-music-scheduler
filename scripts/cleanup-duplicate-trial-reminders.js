#!/usr/bin/env node

/**
 * EMERGENCY CLEANUP SCRIPT
 * This script removes duplicate trial reminder emails from the database
 * Run this IMMEDIATELY to stop the duplicate emails
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanupDuplicates() {
  console.log('🔧 Starting cleanup of duplicate trial reminders...\n')

  try {
    // Step 1: Find all trial reminder emails
    const allReminders = await prisma.emailSchedule.findMany({
      where: {
        reminderType: 'TRIAL_ENDING_REMINDER'
      },
      orderBy: {
        createdAt: 'asc' // Keep the oldest one
      }
    })

    console.log(`📊 Found ${allReminders.length} total trial reminder records\n`)

    // Step 2: Group by unique combination
    const groups = new Map()
    
    for (const reminder of allReminders) {
      const key = `${reminder.churchId}-${reminder.userId}-${reminder.reminderOffset}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key).push(reminder)
    }

    console.log(`📊 Found ${groups.size} unique reminder combinations\n`)

    // Step 3: Identify duplicates (keep oldest, delete rest)
    let totalDuplicates = 0
    const idsToDelete = []

    for (const [key, reminders] of groups.entries()) {
      if (reminders.length > 1) {
        console.log(`⚠️  Found ${reminders.length} duplicates for key: ${key}`)
        // Keep the first one (oldest), delete the rest
        const [keep, ...duplicates] = reminders
        console.log(`   ✓ Keeping: ${keep.id} (created: ${keep.createdAt}, sent: ${keep.sentAt || 'not sent'})`)
        
        for (const dup of duplicates) {
          console.log(`   ✗ Will delete: ${dup.id} (created: ${dup.createdAt}, sent: ${dup.sentAt || 'not sent'})`)
          idsToDelete.push(dup.id)
        }
        totalDuplicates += duplicates.length
        console.log()
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   Total reminders: ${allReminders.length}`)
    console.log(`   Unique combinations: ${groups.size}`)
    console.log(`   Duplicates to delete: ${totalDuplicates}`)

    if (idsToDelete.length === 0) {
      console.log('\n✅ No duplicates found! Database is clean.')
      return
    }

    // Step 4: Delete duplicates
    console.log(`\n🗑️  Deleting ${idsToDelete.length} duplicate records...`)
    
    const deleteResult = await prisma.emailSchedule.deleteMany({
      where: {
        id: {
          in: idsToDelete
        }
      }
    })

    console.log(`\n✅ CLEANUP COMPLETE!`)
    console.log(`   Deleted ${deleteResult.count} duplicate trial reminder records`)
    console.log(`   Remaining records: ${allReminders.length - deleteResult.count}`)

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupDuplicates()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

