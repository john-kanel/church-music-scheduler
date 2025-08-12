import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceEventId, targetEventId, parts } = await request.json()

    if (!sourceEventId || !targetEventId || !parts || !Array.isArray(parts)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify both events exist and user has access
    const [sourceEvent, targetEvent] = await Promise.all([
      prisma.event.findUnique({
        where: { id: sourceEventId },
        include: {
          hymns: {
            orderBy: { createdAt: 'asc' } // Ensure hymns are in correct order
          },
          documents: true,
          assignments: true
        }
      }),
      prisma.event.findUnique({
        where: { id: targetEventId },
        select: { id: true, churchId: true }
      })
    ])

    if (!sourceEvent || !targetEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify user has access to target event's church
    const userChurchAccess = await prisma.user.findFirst({
      where: {
        id: session.user.id,
        churchId: targetEvent.churchId
      }
    })

    if (!userChurchAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const copyResults = {
      documents: 0,
      serviceParts: 0,
      groups: 0,
      musicians: 0
    }

    // Copy service parts (hymns)
    if (parts.includes('serviceParts') && sourceEvent.hymns?.length > 0) {
      // Determine source composition
      const sourceServicePartIds = Array.from(new Set(
        sourceEvent.hymns
          .filter(h => h.servicePartId)
          .map(h => h.servicePartId as string)
      ))
      const sourceHasStandalone = sourceEvent.hymns.some(h => !h.servicePartId)

      // Determine target composition (what currently exists) so we ONLY replace existing parts
      const targetHymns = await prisma.eventHymn.findMany({
        where: { eventId: targetEventId },
        select: { servicePartId: true }
      })
      const targetServicePartIds = new Set(
        targetHymns
          .filter(h => h.servicePartId)
          .map(h => h.servicePartId as string)
      )
      const targetHasStandalone = targetHymns.some(h => !h.servicePartId)

      // Only operate on INTERSECTION of parts to avoid adding new/unexpected parts
      const intersectServicePartIds = sourceServicePartIds.filter(id => targetServicePartIds.has(id))

      const deleteOrConditions: any[] = []
      if (intersectServicePartIds.length > 0) {
        deleteOrConditions.push({ servicePartId: { in: intersectServicePartIds } })
      }
      if (sourceHasStandalone && targetHasStandalone) {
        deleteOrConditions.push({ servicePartId: null })
      }

      if (deleteOrConditions.length > 0) {
        await prisma.eventHymn.deleteMany({
          where: {
            eventId: targetEventId,
            OR: deleteOrConditions
          }
        })
      }

      // Now add the new hymns from source, preserving exact order, but ONLY for allowed parts
      const baseTime = new Date()
      console.log(
        `📋 COPY: Preparing to copy hymns from ${sourceEventId} to ${targetEventId}. ` +
        `Allowed parts: ${intersectServicePartIds.length}, includeStandalone: ${sourceHasStandalone && targetHasStandalone}`
      )

      let createIndex = 0
      for (const hymn of sourceEvent.hymns) {
        const isStandalone = !hymn.servicePartId
        const isAllowedServicePart = hymn.servicePartId ? intersectServicePartIds.includes(hymn.servicePartId) : false
        const canCreate = (isStandalone && sourceHasStandalone && targetHasStandalone) || isAllowedServicePart
        if (!canCreate) continue

        const newCreatedAt = new Date(baseTime.getTime() + createIndex * 1000)
        createIndex++
        try {
          await prisma.eventHymn.create({
            data: {
              eventId: targetEventId,
              title: hymn.title,
              notes: hymn.notes || null,
              servicePartId: hymn.servicePartId ?? null,
              createdAt: newCreatedAt
            }
          })
          copyResults.serviceParts++
        } catch (error) {
          console.error('Error copying hymn:', error)
        }
      }

      console.log(`📋 COPY: Successfully copied ${copyResults.serviceParts} hymns`)
    }

    // Copy documents
    if (parts.includes('documents') && sourceEvent.documents?.length > 0) {
      for (const doc of sourceEvent.documents) {
        try {
          // Create a copy of the document record for the target event
          await prisma.eventDocument.create({
            data: {
              eventId: targetEventId,
              filename: doc.filename,
              originalFilename: doc.originalFilename,
              filePath: doc.filePath,
              fileSize: doc.fileSize,
              mimeType: doc.mimeType,
              uploadedBy: session.user.id, // Current user becomes the uploader
              aiProcessed: doc.aiProcessed || false,
              aiResults: doc.aiResults || undefined
            }
          })
          copyResults.documents++
        } catch (error) {
          console.error('Error copying document:', error)
        }
      }
    }

    // Copy assignments (groups and musicians)
    if (parts.includes('groups') || parts.includes('musicians')) {
      const assignments = sourceEvent.assignments || []
      
      for (const assignment of assignments) {
        const shouldCopyGroup = parts.includes('groups') && assignment.groupId
        const shouldCopyMusician = parts.includes('musicians') && assignment.userId
        
        if (!shouldCopyGroup && !shouldCopyMusician) continue

        try {
          // Check if assignment already exists
          const existing = await prisma.eventAssignment.findFirst({
            where: {
              eventId: targetEventId,
              roleName: assignment.roleName,
              ...(assignment.groupId && { groupId: assignment.groupId }),
              ...(assignment.userId && { userId: assignment.userId })
            }
          })

          if (!existing) {
            await prisma.eventAssignment.create({
              data: {
                eventId: targetEventId,
                roleName: assignment.roleName || null,
                groupId: assignment.groupId || null,
                userId: assignment.userId || null,
                maxMusicians: assignment.maxMusicians || null,
                customRoleId: assignment.customRoleId || null,
                status: 'PENDING'
              }
            })
            
            if (assignment.groupId) copyResults.groups++
            if (assignment.userId) copyResults.musicians++
          }
        } catch (error) {
          console.error('Error copying assignment:', error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Event parts copied successfully',
      copyResults
    })

  } catch (error) {
    console.error('Error copying event parts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 