import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/event-templates - List templates for the church
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await prisma.eventTemplate.findMany({
      where: {
        churchId: session.user.churchId,
        isActive: true
      },
      include: {
        roles: true,
        hymns: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST /api/event-templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can create templates
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      duration = 60, // Default 1 hour
      color = '#3B82F6',
      roles = [],
      hymns = [],
      isRecurring = false,
      recurrencePattern
    } = body

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      )
    }

    // Create template in transaction
    const template = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the template
      const newTemplate = await tx.eventTemplate.create({
        data: {
          name,
          description,
          duration,
          color,
          isRecurring,
          recurrencePattern,
          churchId: session.user.churchId,
          isActive: true
        }
      })

      // Create roles if provided
      if (roles.length > 0) {
        await tx.templateRole.createMany({
          data: roles.map((role: any) => ({
            templateId: newTemplate.id,
            name: role.name,
            maxCount: role.maxCount || 1,
            isRequired: role.isRequired || false
          }))
        })
      }

      // Create hymns if provided
      if (hymns.length > 0) {
        await tx.templateHymn.createMany({
          data: hymns.map((hymn: any) => ({
            templateId: newTemplate.id,
            title: hymn.title,
            servicePartId: hymn.servicePartId === 'custom' || !hymn.servicePartId ? null : hymn.servicePartId,
            notes: hymn.notes
          }))
        })
      }

      return newTemplate
    })

    // Fetch the complete template with relations
    const completeTemplate = await prisma.eventTemplate.findUnique({
      where: { id: template.id },
      include: {
        roles: true,
        hymns: true
      }
    })

    return NextResponse.json({ 
      message: 'Template created successfully',
      template: completeTemplate 
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
} 