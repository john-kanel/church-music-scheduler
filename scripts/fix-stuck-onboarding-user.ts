/**
 * Script to manually fix a user stuck in the onboarding loop
 * 
 * Usage: 
 *   npx tsx scripts/fix-stuck-onboarding-user.ts user@email.com
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixStuckUser(email: string) {
  try {
    console.log(`🔍 Looking for user: ${email}`)
    
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        hasCompletedOnboarding: true,
        role: true
      }
    })

    if (!user) {
      console.error('❌ User not found with email:', email)
      process.exit(1)
    }

    console.log('✅ Found user:', {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      currentOnboardingStatus: user.hasCompletedOnboarding
    })

    if (user.hasCompletedOnboarding) {
      console.log('ℹ️  User has already completed onboarding in the database.')
      console.log('💡 If they are still seeing the onboarding prompts, they need to:')
      console.log('   1. Sign out completely')
      console.log('   2. Sign back in')
      console.log('   3. This will refresh their session with the correct status')
      return
    }

    console.log('\n🔧 Marking onboarding as complete...')
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { hasCompletedOnboarding: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        hasCompletedOnboarding: true
      }
    })

    console.log('✅ Successfully updated user!')
    console.log('Updated status:', {
      name: `${updatedUser.firstName} ${updatedUser.lastName}`,
      email: updatedUser.email,
      hasCompletedOnboarding: updatedUser.hasCompletedOnboarding
    })
    
    console.log('\n📝 Next steps for the user:')
    console.log('   1. Refresh their browser (F5 or Cmd+R)')
    console.log('   2. They should automatically be redirected to the dashboard')
    console.log('   3. If not, have them sign out and sign back in')
    
  } catch (error) {
    console.error('❌ Error fixing user:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Get email from command line arguments
const email = process.argv[2]

if (!email) {
  console.error('❌ Please provide an email address')
  console.log('Usage: npx tsx scripts/fix-stuck-onboarding-user.ts user@email.com')
  process.exit(1)
}

fixStuckUser(email)

