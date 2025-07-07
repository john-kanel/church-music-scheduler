import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST /api/dev/seed - Seed database with sample data
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow directors to seed data
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const churchId = session.user.churchId

    // Create sample event types
    const eventTypes = await Promise.all([
      prisma.eventType.upsert({
        where: { name_color_churchId: { name: 'Sunday Mass', color: '#3B82F6', churchId } },
        update: {},
        create: {
          name: 'Sunday Mass',
          color: '#3B82F6',
          churchId
        }
      }),
      prisma.eventType.upsert({
        where: { name_color_churchId: { name: 'Wedding', color: '#10B981', churchId } },
        update: {},
        create: {
          name: 'Wedding',
          color: '#10B981',
          churchId
        }
      }),
      prisma.eventType.upsert({
        where: { name_color_churchId: { name: 'Funeral', color: '#6B7280', churchId } },
        update: {},
        create: {
          name: 'Funeral',
          color: '#6B7280',
          churchId
        }
      }),
      prisma.eventType.upsert({
        where: { name_color_churchId: { name: 'Special Event', color: '#F59E0B', churchId } },
        update: {},
        create: {
          name: 'Special Event',
          color: '#F59E0B',
          churchId
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
          churchId
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
          churchId
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
          churchId
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
          churchId
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
          churchId
        }
      })
    ])

    // Create sample groups
    const groups = await Promise.all([
      prisma.group.upsert({
        where: { name_churchId: { name: 'Choir', churchId } },
        update: {},
        create: {
          name: 'Choir',
          description: 'Main church choir',
          churchId
        }
      }),
      prisma.group.upsert({
        where: { name_churchId: { name: 'Instrumentalists', churchId } },
        update: {},
        create: {
          name: 'Instrumentalists',
          description: 'Musicians who play instruments',
          churchId
        }
      })
    ])

    // Add musicians to groups
    await Promise.all([
      // Add first 3 musicians to choir
      ...musicians.slice(0, 3).map((musician: any) =>
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
      ...musicians.slice(3, 5).map((musician: any) =>
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
          endTime: new Date(eventDate.getTime() + 60 * 60 * 1000), // 1 hour duration
          eventTypeId: eventTypes[0].id,
          churchId
        }
      })

      events.push(event)

      // Assign musicians to some events (alternating pattern)
      const musiciansToAssign = i % 2 === 0 ? musicians.slice(0, 3) : musicians.slice(2, 5)
      
      await Promise.all(
                 musiciansToAssign.map((musician: any) =>
           prisma.eventAssignment.create({
             data: {
               eventId: event.id,
               userId: musician.id,
               status: 'ACCEPTED'
             }
           })
         )
      )
    }

    // Create a few special events
    const specialEvent = await prisma.event.create({
      data: {
        name: 'Christmas Concert',
        description: 'Annual Christmas concert featuring choir and instrumentalists',
        location: 'Main Sanctuary',
        startTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        endTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours
        eventTypeId: eventTypes[3].id, // Special Event
        churchId
      }
    })

    // Assign all musicians to the special event
    await Promise.all(
             musicians.map((musician: any) =>
         prisma.eventAssignment.create({
           data: {
             eventId: specialEvent.id,
             userId: musician.id,
             status: 'PENDING'
           }
         })
       )
    )

    return NextResponse.json({
      message: 'Sample data created successfully',
      data: {
        eventTypes: eventTypes.length,
        musicians: musicians.length,
        groups: groups.length,
        events: events.length + 1,
        assignments: (events.length * 3) + musicians.length
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error seeding data:', error)
    return NextResponse.json(
      { error: 'Failed to seed data' },
      { status: 500 }
    )
  }
} 