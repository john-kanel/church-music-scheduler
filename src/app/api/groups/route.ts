import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/groups - List groups for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const groups = await prisma.group.findMany({
      where: {
        churchId: session.user.churchId
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            assignments: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Format the response
    const formattedGroups = groups.map((group: any) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      leaderIds: group.leaderIds || [],
      isLocked: group.isLocked || false,
      members: group.members.map((member: any) => ({
        id: member.user.id,
        name: `${member.user.firstName} ${member.user.lastName}`,
        email: member.user.email,
        role: member.user.role,
        joinedAt: member.joinedAt
      })),
      memberCount: group._count.members,
      assignmentCount: group._count.assignments
    }))

    return NextResponse.json({ groups: formattedGroups })
  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    )
  }
}

// POST /api/groups - Create new group
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can create groups
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, leaderIds, isLocked } = body

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      )
    }

    // Check if group name already exists in church
    const existingGroup = await prisma.group.findFirst({
      where: {
        name: name.trim(),
        churchId: session.user.churchId
      }
    })

    if (existingGroup) {
      return NextResponse.json(
        { error: 'A group with this name already exists' },
        { status: 400 }
      )
    }

    // Create the group
    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        churchId: session.user.churchId,
        leaderIds: Array.isArray(leaderIds) ? leaderIds : [],
        isLocked: Boolean(isLocked)
      },
      include: {
        _count: {
          select: {
            members: true,
            assignments: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Group created successfully',
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        createdAt: group.createdAt,
        isLocked: group.isLocked,
        members: [],
        memberCount: 0,
        assignmentCount: 0
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    )
  }
}

// PUT /api/groups - Update group settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can update groups
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { groupId, updates } = body

    // Validation
    if (!groupId || !updates) {
      return NextResponse.json(
        { error: 'Group ID and updates are required' },
        { status: 400 }
      )
    }

    // Verify group belongs to church
    const existingGroup = await prisma.group.findFirst({
      where: {
        id: groupId,
        churchId: session.user.churchId
      }
    })

    if (!existingGroup) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Update the group (allow updating name, description, leaders, lock status)
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: updates.name || existingGroup.name,
        description: updates.description !== undefined ? updates.description : existingGroup.description,
        leaderIds: Array.isArray(updates.leaderIds) ? updates.leaderIds : existingGroup.leaderIds,
        isLocked: updates.isLocked !== undefined ? Boolean(updates.isLocked) : existingGroup.isLocked
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            assignments: true
          }
        }
      }
    })

    // Format response
    const formattedGroup = {
      id: updatedGroup.id,
      name: updatedGroup.name,
      description: updatedGroup.description,
      createdAt: updatedGroup.createdAt,
      isLocked: updatedGroup.isLocked,
      members: updatedGroup.members.map((member: any) => ({
        id: member.user.id,
        name: `${member.user.firstName} ${member.user.lastName}`,
        email: member.user.email,
        role: member.user.role,
        joinedAt: member.joinedAt
      })),
      leaderIds: updatedGroup.leaderIds || [],
      memberCount: updatedGroup._count.members,
      assignmentCount: updatedGroup._count.assignments
    }

    return NextResponse.json({
      message: 'Group updated successfully',
      group: formattedGroup
    })

  } catch (error) {
    console.error('Error updating group:', error)
    return NextResponse.json(
      { error: 'Failed to update group' },
      { status: 500 }
    )
  }
}

// PATCH /api/groups - Manage group membership (add/remove musicians)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can manage group memberships
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { groupId, action, musicianId } = body

    // Validation
    if (!groupId || !action || !musicianId) {
      return NextResponse.json(
        { error: 'Group ID, action, and musician ID are required' },
        { status: 400 }
      )
    }

    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be either "add" or "remove"' },
        { status: 400 }
      )
    }

    // Verify group belongs to church
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        churchId: session.user.churchId
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Verify musician belongs to church
    const musician = await prisma.user.findFirst({
      where: {
        id: musicianId,
        churchId: session.user.churchId,
        role: 'MUSICIAN'
      }
    })

    if (!musician) {
      return NextResponse.json({ error: 'Musician not found' }, { status: 404 })
    }

    if (action === 'add') {
      // Check if musician is already in the group
      const existingMembership = await prisma.groupMember.findFirst({
        where: {
          userId: musicianId,
          groupId: groupId
        }
      })

      if (existingMembership) {
        return NextResponse.json(
          { error: 'Musician is already a member of this group' },
          { status: 400 }
        )
      }

      // Add musician to group
      await prisma.groupMember.create({
        data: {
          userId: musicianId,
          groupId: groupId
        }
      })

      return NextResponse.json({
        message: `${musician.firstName} ${musician.lastName} added to ${group.name}`,
        action: 'added'
      })

    } else if (action === 'remove') {
      // Check if musician is in the group
      const existingMembership = await prisma.groupMember.findFirst({
        where: {
          userId: musicianId,
          groupId: groupId
        }
      })

      if (!existingMembership) {
        return NextResponse.json(
          { error: 'Musician is not a member of this group' },
          { status: 400 }
        )
      }

      // Remove musician from group
      await prisma.groupMember.delete({
        where: {
          id: existingMembership.id
        }
      })

      return NextResponse.json({
        message: `${musician.firstName} ${musician.lastName} removed from ${group.name}`,
        action: 'removed'
      })
    }

  } catch (error) {
    console.error('Error managing group membership:', error)
    return NextResponse.json(
      { error: 'Failed to manage group membership' },
      { status: 500 }
    )
  }
} 