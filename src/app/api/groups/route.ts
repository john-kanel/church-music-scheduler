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
    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      members: group.members.map(member => ({
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
    if (!['DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description } = body

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
        churchId: session.user.churchId
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
    if (!['DIRECTOR', 'PASTOR'].includes(session.user.role)) {
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

    // Update the group (only allow updating name and description)
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: updates.name || existingGroup.name,
        description: updates.description !== undefined ? updates.description : existingGroup.description
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
      members: updatedGroup.members.map(member => ({
        id: member.user.id,
        name: `${member.user.firstName} ${member.user.lastName}`,
        email: member.user.email,
        role: member.user.role,
        joinedAt: member.joinedAt
      })),
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