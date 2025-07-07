import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

// PUT /api/event-templates/[templateId] - Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can update templates
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { templateId } = await params
    const body = await request.json()
    const {
      name,
      description,
      duration,
      color,
      roles = [],
      hymns = [],
      isRecurring,
      recurrencePattern
    } = body

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      )
    }

    // Check if template exists and belongs to the church
    const existingTemplate = await prisma.eventTemplate.findFirst({
      where: {
        id: templateId,
        churchId: session.user.churchId
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Update template in transaction
    const template = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update the template
      const updatedTemplate = await tx.eventTemplate.update({
        where: { id: templateId },
        data: {
          name,
          description,
          duration,
          color,
          isRecurring,
          recurrencePattern
        }
      })

      // Delete existing roles and hymns
      await tx.templateRole.deleteMany({
        where: { templateId }
      })
      await tx.templateHymn.deleteMany({
        where: { templateId }
      })

      // Create new roles if provided
      if (roles.length > 0) {
        await tx.templateRole.createMany({
          data: roles.map((role: any) => ({
            templateId,
            name: role.name,
            maxCount: role.maxCount || 1,
            isRequired: role.isRequired || false
          }))
        })
      }

      // Create new hymns if provided
      if (hymns.length > 0) {
        await tx.templateHymn.createMany({
          data: hymns.map((hymn: any) => ({
            templateId,
            title: hymn.title,
            composer: hymn.composer,
            notes: hymn.notes
          }))
        })
      }

      return updatedTemplate
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
      message: 'Template updated successfully',
      template: completeTemplate 
    })

  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

// DELETE /api/event-templates/[templateId] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can delete templates
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { templateId } = await params

    // Check if template exists and belongs to the church
    const existingTemplate = await prisma.eventTemplate.findFirst({
      where: {
        id: templateId,
        churchId: session.user.churchId
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Soft delete by setting isActive to false
    await prisma.eventTemplate.update({
      where: { id: templateId },
      data: { isActive: false }
    })

    return NextResponse.json({ 
      message: 'Template deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
} 