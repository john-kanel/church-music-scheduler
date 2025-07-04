import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and associate directors can manage service parts
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Check if the service part exists and belongs to the user's church
    const servicePart = await prisma.servicePart.findFirst({
      where: {
        id,
        churchId: session.user.churchId
      }
    })

    if (!servicePart) {
      return NextResponse.json({ error: 'Service part not found' }, { status: 404 })
    }

    // Check for usage in templates
    const templateUsageCount = await prisma.templateHymn.count({
      where: {
        servicePartId: id
      }
    })

    // Check for usage in events
    const eventUsageCount = await prisma.eventHymn.count({
      where: {
        servicePartId: id
      }
    })

    const totalUsage = templateUsageCount + eventUsageCount

    if (totalUsage > 0) {
      // Instead of deleting, we could mark existing usages as "Custom"
      // For now, we'll inform the user and prevent deletion
      return NextResponse.json({
        error: 'Cannot delete service part',
        message: `This service part is used in ${templateUsageCount} template(s) and ${eventUsageCount} event(s). If you delete it, those items will be marked as "Custom". Are you sure you want to continue?`,
        usageCount: totalUsage,
        templateUsage: templateUsageCount,
        eventUsage: eventUsageCount
      }, { status: 400 })
    }

    // Delete the service part if not in use
    await prisma.servicePart.delete({
      where: {
        id,
        churchId: session.user.churchId
      }
    })

    return NextResponse.json({ message: 'Service part deleted successfully' })
  } catch (error) {
    console.error('Error deleting service part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and associate directors can manage service parts
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { forceDelete } = await req.json()

    if (forceDelete) {
      // Force delete - mark all usages as "Custom" and then delete the service part
      
      // Update template hymns to remove the service part reference
      await prisma.templateHymn.updateMany({
        where: {
          servicePartId: id
        },
        data: {
          servicePartId: null
        }
      })

      // Update event hymns to remove the service part reference
      await prisma.eventHymn.updateMany({
        where: {
          servicePartId: id
        },
        data: {
          servicePartId: null
        }
      })

      // Now delete the service part
      await prisma.servicePart.delete({
        where: {
          id,
          churchId: session.user.churchId
        }
      })

      return NextResponse.json({ 
        message: 'Service part deleted successfully. Existing usages have been marked as "Custom".' 
      })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Error force deleting service part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 