import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/church-members - List all church members for messaging
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can fetch church members for messaging
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const verified = searchParams.get('verified') !== 'false' // Default to verified users only

    // Build search filter for all church members
    const whereClause: any = {
      churchId: session.user.churchId,
      id: { not: session.user.id } // Don't include the current user
    }

    // Filter by verified status 
    if (verified) {
      whereClause.isVerified = true
    }

    // Add search functionality
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Fetch all church members
    const members = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        emailNotifications: true,
        smsNotifications: true,
        instruments: true
      },
      orderBy: [
        { role: 'asc' }, // Directors first, then musicians
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    // Format the response
    const formattedMembers = members.map(member => {
      // Determine the display role
      let displayRole = 'Member'
      switch (member.role) {
        case 'DIRECTOR':
          displayRole = 'Music Director'
          break
        case 'ASSOCIATE_DIRECTOR':
          displayRole = 'Associate Director'
          break
        case 'PASTOR':
          displayRole = 'Pastor'
          break
        case 'ASSOCIATE_PASTOR':
          displayRole = 'Associate Pastor'
          break
        case 'MUSICIAN':
          // Show primary instrument if available
          if (member.instruments && member.instruments.length > 0) {
            displayRole = member.instruments[0]
          } else {
            displayRole = 'Musician'
          }
          break
      }

      return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`.trim(),
        email: member.email,
        phone: member.phone,
        role: displayRole,
        userRole: member.role,
        isVerified: member.isVerified,
        emailNotifications: member.emailNotifications,
        smsNotifications: member.smsNotifications,
        canReceiveEmail: member.emailNotifications,
        canReceiveSMS: member.smsNotifications && member.phone && member.phone.trim() !== ''
      }
    })

    return NextResponse.json({ 
      members: formattedMembers,
      total: formattedMembers.length
    })
    
  } catch (error) {
    console.error('Error fetching church members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch church members' },
      { status: 500 }
    )
  }
}