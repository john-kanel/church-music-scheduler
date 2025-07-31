import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/dev/cleanup-seed - Remove all seed/sample data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow directors to cleanup seed data
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden - Directors only' }, { status: 403 })
    }

    const churchId = session.user.churchId

    // Define sample email patterns to remove
    const sampleEmails = [
      'john.smith@example.com',
      'mary.jones@example.com', 
      'david.wilson@example.com',
      'sarah.brown@example.com',
      'michael.davis@example.com',
      'john@example.com',
      'mary@example.com',
      'david@example.com',
      'sarah@example.com',
      'michael@example.com'
    ]

    // Also remove any users with obvious test/sample patterns
    const sampleEmailPatterns = [
      '%@example.com',
      '%@test.com',
      '%@sample.com',
      'test%@%',
      'sample%@%'
    ]

    console.log('🧹 Starting cleanup of seed/sample data...')

    // Remove sample users (but protect the current user)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        churchId: churchId,
        id: { not: session.user.id }, // Don't delete the current user
        OR: [
          { email: { in: sampleEmails } },
          ...sampleEmailPatterns.map(pattern => ({
            email: { contains: pattern.replace('%', '') }
          }))
        ]
      }
    })

    // Remove sample invitations
    const deletedInvitations = await prisma.invitation.deleteMany({
      where: {
        churchId: churchId,
        OR: [
          { email: { in: sampleEmails } },
          ...sampleEmailPatterns.map(pattern => ({
            email: { contains: pattern.replace('%', '') }
          }))
        ]
      }
    })

    // Remove activities related to sample users
    const deletedActivities = await prisma.activity.deleteMany({
      where: {
        churchId: churchId,
        OR: [
          { description: { contains: 'John Smith' } },
          { description: { contains: 'Mary Jones' } },
          { description: { contains: 'David Wilson' } },
          { description: { contains: 'Sarah Brown' } },
          { description: { contains: 'Michael Davis' } },
          { description: { contains: 'john@example.com' } },
          { description: { contains: 'test@' } },
          { description: { contains: 'sample@' } }
        ]
      }
    })

    // Remove any events that might have been created with sample data
    const sampleEventNames = [
      'Sample Sunday Service',
      'Test Event',
      'Sample Event',
      'Practice Session'
    ]

    const deletedEvents = await prisma.event.deleteMany({
      where: {
        churchId: churchId,
        name: { in: sampleEventNames }
      }
    })

    console.log('✅ Cleanup completed!')
    console.log(`   - Deleted ${deletedUsers.count} sample users`)
    console.log(`   - Deleted ${deletedInvitations.count} sample invitations`)
    console.log(`   - Deleted ${deletedActivities.count} sample activities`)
    console.log(`   - Deleted ${deletedEvents.count} sample events`)

    return NextResponse.json({
      message: 'Sample data cleanup completed successfully',
      deletedCounts: {
        users: deletedUsers.count,
        invitations: deletedInvitations.count,
        activities: deletedActivities.count,
        events: deletedEvents.count
      }
    })
    
  } catch (error) {
    console.error('Error cleaning up seed data:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup seed data' },
      { status: 500 }
    )
  }
}