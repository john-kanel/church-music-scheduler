import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST /api/dev/seed - Seed database with sample data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.parishId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow directors to seed data
    if (!['DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const parishId = session.user.parishId

    // Create sample event types
    const eventTypes = await Promise.all([
      prisma.eventType.upsert({
        where: { name_parishId: { name: 'Sunday Mass', parishId } },
        update: {},
        create: {
          name: 'Sunday Mass',
          color: '#3B82F6',
          parishId
        }
      }),
      prisma.eventType.upsert({
        where: { name_parishId: { name: 'Wedding', parishId } },
        update: {},
        create: {
          name: 'Wedding',
          color: '#10B981',
          parishId
        }
      }),
      prisma.eventType.upsert({
        where: { name_parishId: { name: 'Funeral', parishId } },
        update: {},
        create: {
          name: 'Funeral',
          color: '#6B7280',
          parishId
        }
      }),
      prisma.eventType.upsert({
        where: { name_parishId: { name: 'Special Event', parishId } },
        update: {},
        create: {
          name: 'Special Event',
          color: '#F59E0B',
          parishId
        }
      })
    ])

    // Create sample musicians
    const hashedPassword = await bcrypt.hash('password123', 10)
    
    const musicians = await Promise.all([
      prisma.user.upsert({
        where: { email: 'john.smith@example.com' },
        update: {},
        create: {
          email: 'john.smith@example.com',
          firstName: 'John',
          lastName: 'Smith',
          phone: '555-0101',
          password: hashedPassword,
          role: 'MUSICIAN',
          isVerified: true,
          parishId
        }
      }),
      prisma.user.upsert({
        where: { email: 'mary.jones@example.com' },
        update: {},
        create: {
          email: 'mary.jones@example.com',
          firstName: 'Mary',
          lastName: 'Jones',
          phone: '555-0102',
          password: hashedPassword,
          role: 'MUSICIAN',
          isVerified: true,
          parishId
        }
      }),
      prisma.user.upsert({
        where: { email: 'david.wilson@example.com' },
        update: {},
        create: {
          email: 'david.wilson@example.com',
          firstName: 'David',
          lastName: 'Wilson',
          phone: '555-0103',
          password: hashedPassword,
          role: 'MUSICIAN',
          isVerified: true,
          parishId
        }
      }),
      prisma.user.upsert({
        where: { email: 'sarah.brown@example.com' },
        update: {},
        create: {
          email: 'sarah.brown@example.com',
          firstName: 'Sarah',
          lastName: 'Brown',
          phone: '555-0104',
          password: hashedPassword,
          role: 'MUSICIAN',
          isVerified: true,
          parishId
        }
      }),
      prisma.user.upsert({
        where: { email: 'michael.davis@example.com' },
        update: {},
        create: {
          email: 'michael.davis@example.com',
          firstName: 'Michael',
          lastName: 'Davis',
          phone: '555-0105',
          password: hashedPassword,
          role: 'MUSICIAN',
          isVerified: true,
          parishId
        }
      })
    ])

    // Create sample groups
    const groups = await Promise.all([
      prisma.group.upsert({
        where: { name_parishId: { name: 'Choir', parishId } },
        update: {},
        create: {
          name: 'Choir',
          description: 'Main parish choir',
          parishId
        }
      }),
      prisma.group.upsert({
        where: { name_parishId: { name: 'Instrumentalists', parishId } },
        update: {},
        create: {
          name: 'Instrumentalists',
          description: 'Musicians who play instruments',
          parishId
        }
      })
    ])

    // Add musicians to groups
    await Promise.all([
      // Add first 3 musicians to choir
      ...musicians.slice(0, 3).map(musician =>
        prisma.groupMember.upsert({
          where: { userId_groupId: { userId: musician.id, groupId: groups[0].id } },
          update: {},
          create: {
            userId: musician.id,
            groupId: groups[0].id
          }
        })
      ),
      // Add last 2 musicians to instrumentalists
      ...musicians.slice(3, 5).map(musician =>
        prisma.groupMember.upsert({
          where: { userId_groupId: { userId: musician.id, groupId: groups[1].id } },
          update: {},
          create: {
            userId: musician.id,
            groupId: groups[1].id
          }
        })
      )
    ])

    // Create sample events for the next few weeks
    const now = new Date()
    const events = []

    for (let i = 0; i < 8; i++) {
      const eventDate = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000) // Weekly events
      eventDate.setHours(10, 0, 0, 0) // 10 AM
      
      const event = await prisma.event.create({
        data: {
          name: `Sunday Mass - Week ${i + 1}`,
          description: 'Weekly Sunday morning mass',
          location: 'Main Sanctuary',
          startTime: eventDate,
          endTime: new Date(eventDate.getTime() + 60 * 60 * 1000), // 1 hour later
          parishId,
          eventTypeId: eventTypes[0].id // Sunday Mass
        }
      })

      events.push(event)

      // Create assignments for each event
      await Promise.all([
        prisma.eventAssignment.create({
          data: {
            eventId: event.id,
            userId: musicians[i % musicians.length].id,
            roleName: 'Cantor',
            status: i < 3 ? 'ACCEPTED' : 'PENDING'
          }
        }),
        prisma.eventAssignment.create({
          data: {
            eventId: event.id,
            userId: musicians[(i + 1) % musicians.length].id,
            roleName: 'Accompanist',
            status: i < 2 ? 'ACCEPTED' : 'PENDING'
          }
        })
      ])
    }

    // Create a few special events
    const weddingDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    weddingDate.setHours(14, 0, 0, 0) // 2 PM

    const wedding = await prisma.event.create({
      data: {
        name: 'Johnson Wedding',
        description: 'Wedding ceremony for Tom and Lisa Johnson',
        location: 'Main Sanctuary',
        startTime: weddingDate,
        endTime: new Date(weddingDate.getTime() + 90 * 60 * 1000), // 1.5 hours
        parishId,
        eventTypeId: eventTypes[1].id // Wedding
      }
    })

    await prisma.eventAssignment.create({
      data: {
        eventId: wedding.id,
        userId: musicians[0].id,
        roleName: 'Soloist',
        status: 'PENDING'
      }
    })

    // Create some sample communications
    await prisma.communication.create({
      data: {
        subject: 'Welcome to the Music Ministry!',
        message: 'Thank you for joining our music ministry. We look forward to making beautiful music together.',
        type: 'EMAIL',
        recipients: ['all'],
        parishId,
        sentBy: session.user.id
      }
    })

    return NextResponse.json({
      message: 'Sample data created successfully',
      summary: {
        eventTypes: eventTypes.length,
        musicians: musicians.length,
        groups: groups.length,
        events: events.length + 1, // +1 for wedding
        assignments: events.length * 2 + 1, // 2 per event + 1 for wedding
        communications: 1
      }
    })

  } catch (error) {
    console.error('Error seeding data:', error)
    return NextResponse.json(
      { error: 'Failed to seed data: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
} 