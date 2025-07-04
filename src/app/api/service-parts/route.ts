import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and associate directors can manage service parts
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceParts = await prisma.servicePart.findMany({
      where: {
        churchId: session.user.churchId
      },
      orderBy: {
        order: 'asc'
      }
    })

    return NextResponse.json({ serviceParts })
  } catch (error) {
    console.error('Error fetching service parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and associate directors can manage service parts
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { serviceParts } = await req.json()

    if (!Array.isArray(serviceParts)) {
      return NextResponse.json({ error: 'Invalid service parts data' }, { status: 400 })
    }

    // Process each service part
    const updatedServiceParts = []

    for (const part of serviceParts) {
      if (!part.name.trim()) {
        continue // Skip empty names
      }

      if (part.id.startsWith('temp-')) {
        // Create new service part
        const newPart = await prisma.servicePart.create({
          data: {
            name: part.name.trim(),
            isRequired: part.isRequired || false,
            order: part.order || 0,
            churchId: session.user.churchId
          }
        })
        updatedServiceParts.push(newPart)
      } else {
        // Update existing service part
        const updatedPart = await prisma.servicePart.update({
          where: {
            id: part.id,
            churchId: session.user.churchId // Ensure user can only update their church's parts
          },
          data: {
            name: part.name.trim(),
            isRequired: part.isRequired || false,
            order: part.order || 0
          }
        })
        updatedServiceParts.push(updatedPart)
      }
    }

    // Sort by order
    updatedServiceParts.sort((a, b) => a.order - b.order)

    return NextResponse.json({ serviceParts: updatedServiceParts })
  } catch (error) {
    console.error('Error saving service parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 