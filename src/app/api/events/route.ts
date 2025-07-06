import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { checkSubscriptionStatus, createSubscriptionErrorResponse } from '@/lib/subscription-check'

// Helper function to generate recurring events
function generateRecurringEvents(
  baseEvent: any,
  recurrencePattern: string,
  recurrenceEnd: Date | null,
  churchId: string
) {
  const events: any[] = []
  const startDate = new Date(baseEvent.startTime)
  const endDate = baseEvent.endTime ? new Date(baseEvent.endTime) : null
  
  // Default to 6 months if no end date specified
  const finalEndDate = recurrenceEnd || new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000)
  
  let currentDate = new Date(startDate)
  
  // Skip the first occurrence (that's the original event)
  switch (recurrencePattern) {
    case 'weekly':
      currentDate.setDate(currentDate.getDate() + 7)
      break
    case 'biweekly':
      currentDate.setDate(currentDate.getDate() + 14)
      break
    case 'monthly':
      currentDate.setMonth(currentDate.getMonth() + 1)
      break
    case 'quarterly':
      currentDate.setMonth(currentDate.getMonth() + 3)
      break
    default:
      return events // Unknown pattern
  }
  
  // Generate recurring events
  while (currentDate <= finalEndDate && events.length < 52) { // Max 52 occurrences
    const eventStartTime = new Date(currentDate)
    const eventEndTime = endDate ? new Date(currentDate.getTime() + (endDate.getTime() - startDate.getTime())) : null
    
    events.push({
      name: baseEvent.name,
      description: baseEvent.description,
      location: baseEvent.location,
      startTime: eventStartTime,
      endTime: eventEndTime,
      isRecurring: false, // Child events are not recurring themselves
      recurrencePattern: null,
      recurrenceEnd: null,
      churchId: churchId,
      eventTypeId: baseEvent.eventTypeId,
      templateId: baseEvent.templateId
    })
    
    // Increment for next occurrence
    switch (recurrencePattern) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7)
        break
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14)
        break
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1)
        break
      case 'quarterly':
        currentDate.setMonth(currentDate.getMonth() + 3)
        break
    }
  }
  
  return events
}

// GET /api/events - List events for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription status
    const subscriptionStatus = await checkSubscriptionStatus(session.user.churchId)
    if (!subscriptionStatus.isActive) {
      return createSubscriptionErrorResponse()
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    // Build date filter
    const dateFilter: any = {}
    
    if (monthParam && yearParam) {
      // If month and year are provided, filter by that month
      const targetDate = new Date(parseInt(yearParam), parseInt(monthParam) - 1, 1)
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59)
      dateFilter.gte = startOfMonth
      dateFilter.lte = endOfMonth
    } else {
      // Otherwise use startDate/endDate if provided
      if (startDate) {
        dateFilter.gte = new Date(startDate)
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate)
      }
    }

    const events = await prisma.event.findMany({
      where: {
        churchId: session.user.churchId,
        ...(Object.keys(dateFilter).length > 0 && { startTime: dateFilter })
      },
      include: {
        eventType: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            group: true,
            customRole: true
          }
        },
        musicFiles: true,
        _count: {
          select: {
            assignments: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// POST /api/events - Create a new event
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription status
    const subscriptionStatus = await checkSubscriptionStatus(session.user.churchId)
    if (!subscriptionStatus.isActive) {
      return createSubscriptionErrorResponse()
    }

    // Only directors and pastors can create events
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const formData = await request.formData()
    
    // Extract form data
    const name = formData.get('name') as string
    const description = formData.get('description') as string || ''
    const location = formData.get('location') as string
    const startDate = formData.get('startDate') as string
    const startTime = formData.get('startTime') as string
    const endTime = formData.get('endTime') as string || ''
    const eventTypeId = formData.get('eventTypeId') as string || null
    const templateId = formData.get('templateId') as string || null
    const templateColor = formData.get('templateColor') as string || null
    const isRecurring = formData.get('isRecurring') === 'true'
    const recurrencePattern = formData.get('recurrencePattern') as string || ''
    const recurrenceEnd = formData.get('recurrenceEnd') as string || ''
    
    // Parse JSON fields with safe defaults
    const roles = formData.get('roles') ? JSON.parse(formData.get('roles') as string) : []
    const hymns = formData.get('hymns') ? JSON.parse(formData.get('hymns') as string) : []
    const selectedGroups = formData.get('selectedGroups') ? JSON.parse(formData.get('selectedGroups') as string) : []
    const copyHymnsToRecurring = formData.get('copyHymnsToRecurring') === 'true'

    // Ensure all arrays are properly defined
    const validRoles = Array.isArray(roles) ? roles : []
    const validHymns = Array.isArray(hymns) ? hymns : []
    const validSelectedGroups = Array.isArray(selectedGroups) ? selectedGroups : []

    // Validation
    if (!name || !location || !startDate || !startTime) {
      return NextResponse.json(
        { error: 'Name, location, start date, and start time are required' },
        { status: 400 }
      )
    }

    // Combine date and time - treat as local time to avoid timezone issues
    const [year, month, day] = startDate.split('-').map(Number)
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startDateTime = new Date(year, month - 1, day, startHour, startMinute)
    
    let endDateTime = null
    if (endTime) {
      const [endHour, endMinute] = endTime.split(':').map(Number)
      endDateTime = new Date(year, month - 1, day, endHour, endMinute)
    }

    // Find or create event type
    let finalEventTypeId = eventTypeId
    
    if (!finalEventTypeId) {
      // If we have a template with color, create/find event type with that color
      if (templateId && templateColor) {
        // Look for existing event type with the template name and color
        let templateEventType = await prisma.eventType.findFirst({
          where: {
            churchId: session.user.churchId,
            name: name,
            color: templateColor
          }
        })

        if (!templateEventType) {
          templateEventType = await prisma.eventType.create({
            data: {
              name: name,
              color: templateColor,
              churchId: session.user.churchId
            }
          })
        }
        finalEventTypeId = templateEventType.id
      } else {
        // Default event type
        const defaultEventType = await prisma.eventType.findFirst({
          where: {
            churchId: session.user.churchId,
            name: 'General'
          }
        })

        if (!defaultEventType) {
          const newEventType = await prisma.eventType.create({
            data: {
              name: 'General',
              color: '#3B82F6',
              churchId: session.user.churchId
            }
          })
          finalEventTypeId = newEventType.id
        } else {
          finalEventTypeId = defaultEventType.id
        }
      }
    }

    // Create event in transaction with assignments
    const result = await prisma.$transaction(async (tx) => {
      // Create the event
      const event = await tx.event.create({
        data: {
          name,
          description,
          location,
          startTime: startDateTime,
          endTime: endDateTime,
          isRecurring,
          recurrencePattern,
          recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
          churchId: session.user.churchId,
          eventTypeId: finalEventTypeId,
          templateId: templateId || null
        }
      })

      // Create role assignments if provided
      if (validRoles.length > 0) {
        for (const role of validRoles) {
          if (role.assignedMusicians && role.assignedMusicians.length > 0) {
            // Create individual assignments for each assigned musician
            await tx.eventAssignment.createMany({
              data: role.assignedMusicians.map((musicianId: string) => ({
                eventId: event.id,
                userId: musicianId,
                roleName: role.name,
                status: 'PENDING'
              }))
            })
          } else {
            // Create multiple open role assignments based on maxCount
            const maxCount = role.maxCount || 1
            const assignmentsToCreate = []
            
            for (let i = 0; i < maxCount; i++) {
              assignmentsToCreate.push({
                eventId: event.id,
                roleName: role.name,
                maxMusicians: 1, // Each assignment is for 1 musician
                status: 'PENDING' as const
              })
            }
            
            await tx.eventAssignment.createMany({
              data: assignmentsToCreate
            })
          }
        }
      }

      // Create group assignments if provided
      if (validSelectedGroups.length > 0) {
        for (const groupId of validSelectedGroups) {
          // Verify group exists and belongs to church
          const group = await tx.group.findFirst({
            where: {
              id: groupId,
              churchId: session.user.churchId
            },
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          })

          if (group) {
            // Create group assignment
            await tx.eventAssignment.create({
              data: {
                eventId: event.id,
                groupId: group.id,
                status: 'PENDING'
              }
            })

            // Also create individual assignments for each group member
            // This ensures they get individual notifications and can accept/decline
            for (const member of group.members) {
              await tx.eventAssignment.create({
                data: {
                  eventId: event.id,
                  userId: member.user.id,
                  roleName: `${group.name} Member`,
                  status: 'PENDING'
                }
              })
            }
          }
        }
      }

      // Create hymns if provided
      if (validHymns.length > 0) {
        for (const hymn of validHymns) {
          // Skip empty hymns
          if (!hymn.title?.trim()) continue

          await tx.eventHymn.create({
            data: {
              eventId: event.id,
              title: hymn.title.trim(),
              notes: hymn.notes?.trim() || null,
              servicePartId: hymn.servicePartId === 'custom' || !hymn.servicePartId ? null : hymn.servicePartId
            }
          })
        }
      }

      // If this is a recurring event, create recurring instances
      if (isRecurring && recurrencePattern) {
        // Generate recurring events
        const recurringEvents = generateRecurringEvents(
          event,
          recurrencePattern,
          recurrenceEnd ? new Date(recurrenceEnd) : null,
          session.user.churchId
        )

        // Create recurring events
        for (const recurringEvent of recurringEvents) {
          const createdEvent = await tx.event.create({
            data: {
              ...recurringEvent,
              parentEventId: event.id
            }
          })

          // Copy role assignments to recurring events
          if (validRoles.length > 0) {
            for (const role of validRoles) {
              if (role.assignedMusicians && role.assignedMusicians.length > 0) {
                await tx.eventAssignment.createMany({
                  data: role.assignedMusicians.map((musicianId: string) => ({
                    eventId: createdEvent.id,
                    userId: musicianId,
                    roleName: role.name,
                    status: 'PENDING'
                  }))
                })
              } else {
                const maxCount = role.maxCount || 1
                const assignmentsToCreate = []
                
                for (let i = 0; i < maxCount; i++) {
                  assignmentsToCreate.push({
                    eventId: createdEvent.id,
                    roleName: role.name,
                    maxMusicians: 1,
                    status: 'PENDING' as const
                  })
                }
                
                await tx.eventAssignment.createMany({
                  data: assignmentsToCreate
                })
              }
            }
          }

          // Copy hymns to recurring events (only if user chose to)
          if (validHymns.length > 0 && copyHymnsToRecurring) {
            for (const hymn of validHymns) {
              // Skip empty hymns
              if (!hymn.title?.trim()) continue

              await tx.eventHymn.create({
                data: {
                  eventId: createdEvent.id,
                  title: hymn.title.trim(),
                  notes: hymn.notes?.trim() || null,
                  servicePartId: hymn.servicePartId === 'custom' || !hymn.servicePartId ? null : hymn.servicePartId
                }
              })
            }
          }

          // Copy group assignments to recurring events
          if (validSelectedGroups.length > 0) {
            for (const groupId of validSelectedGroups) {
              const group = await tx.group.findFirst({
                where: {
                  id: groupId,
                  churchId: session.user.churchId
                },
                include: {
                  members: {
                    include: {
                      user: true
                    }
                  }
                }
              })

              if (group) {
                // Create group assignment for recurring event
                await tx.eventAssignment.create({
                  data: {
                    eventId: createdEvent.id,
                    groupId: group.id,
                    status: 'PENDING'
                  }
                })

                // Create individual assignments for each group member
                for (const member of group.members) {
                  await tx.eventAssignment.create({
                    data: {
                      eventId: createdEvent.id,
                      userId: member.user.id,
                      roleName: `${group.name} Member`,
                      status: 'PENDING'
                    }
                  })
                }
              }
            }
          }
        }
      }

      return event
    })

    // Fetch the complete event with relations
    const completeEvent = await prisma.event.findUnique({
      where: { id: result.id },
      include: {
        eventType: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            customRole: true
          }
        },
        musicFiles: true
      }
    })

    // Log activity
    await logActivity({
      type: 'EVENT_CREATED',
      description: `Created event: ${name}`,
      churchId: session.user.churchId,
      userId: session.user.id,
      metadata: {
        eventId: result.id,
        eventName: name,
        eventDate: startDateTime.toISOString()
      }
    })

    // Schedule automated notifications for this new event
    const { scheduleEventNotifications } = await import('@/lib/automation-helpers')
    await scheduleEventNotifications(result.id, session.user.churchId)

    return NextResponse.json({ 
      message: 'Event created successfully',
      event: completeEvent 
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
} 