import { prisma } from './db'

/**
 * Resolves dynamic group assignments for events
 * This function takes events with their current assignments and dynamically
 * adds current group members to the assignments list
 */
export async function resolveEventAssignments(events: any[]) {
  const resolvedEvents = []
  
  for (const event of events) {
    const resolvedEvent = { ...event }
    
    // Start with existing assignments (individual and non-group assignments)
    const existingAssignments = event.assignments || []
    
    // Get group assignments for this event
    const groupAssignments = existingAssignments.filter((a: any) => a.groupId && !a.userId)
    
    // For each group assignment, get current group members
    const dynamicAssignments = []
    for (const groupAssignment of groupAssignments) {
      const currentMembers = await prisma.groupMember.findMany({
        where: { groupId: groupAssignment.groupId },
        include: { user: true }
      })
      
      for (const member of currentMembers) {
        // Check if this user already has an individual assignment for this event
        const hasExistingAssignment = existingAssignments.some((a: any) => 
          a.userId === member.user.id && !a.groupId
        )
        
        if (!hasExistingAssignment) {
          dynamicAssignments.push({
            id: `dynamic-${groupAssignment.id}-${member.user.id}`,
            eventId: event.id,
            userId: member.user.id,
            groupId: groupAssignment.groupId,
            roleName: groupAssignment.roleName,
            customRoleId: groupAssignment.customRoleId,
            maxMusicians: null,
            status: 'PENDING',
            assignedAt: groupAssignment.assignedAt,
            respondedAt: null,
            isAutoAssigned: false,
            user: {
              id: member.user.id,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              email: member.user.email
            },
            group: groupAssignment.group,
            customRole: groupAssignment.customRole
          })
        }
      }
    }
    
    // Combine existing individual assignments with dynamic group member assignments
    resolvedEvent.assignments = [
      ...existingAssignments.filter((a: any) => a.userId || !a.groupId), // Keep individual assignments and non-group assignments
      ...dynamicAssignments
    ]
    
    resolvedEvents.push(resolvedEvent)
  }
  
  return resolvedEvents
}

/**
 * Resolves dynamic assignments for a single event
 */
export async function resolveEventAssignmentsForSingle(event: any) {
  const [resolvedEvent] = await resolveEventAssignments([event])
  return resolvedEvent
}

/**
 * Gets all assigned user IDs for an event, including dynamic group members
 * This is useful for notification systems that need just the user IDs
 */
export async function getEventAssignedUserIds(eventId: string): Promise<string[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      assignments: {
        include: {
          user: true,
          group: true
        }
      }
    }
  })
  
  if (!event) return []
  
  const resolvedEvent = await resolveEventAssignmentsForSingle(event)
  return resolvedEvent.assignments
    .filter((a: any) => a.userId)
    .map((a: any) => a.userId)
}
