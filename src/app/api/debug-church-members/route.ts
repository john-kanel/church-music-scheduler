import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/debug-church-members - Debug endpoint to see all church members including current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors and pastors can access this debug endpoint
    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Fetch ALL church members including current user
    const allMembers = await prisma.user.findMany({
      where: {
        churchId: session.user.churchId
      },
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
        { role: 'asc' },
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    })

    // Format the response with detailed SMS capability info
    const formattedMembers = allMembers.map(member => {
      const isCurrentUser = member.id === session.user.id
      
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
          if (member.instruments && member.instruments.length > 0) {
            displayRole = member.instruments[0]
          } else {
            displayRole = 'Musician'
          }
          break
      }

      // Detailed SMS capability analysis
      const hasPhone = member.phone && member.phone.trim() !== ''
      const hasSMSEnabled = member.smsNotifications
      const canReceiveSMS = hasSMSEnabled && hasPhone

      return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`.trim(),
        email: member.email,
        phone: member.phone,
        phoneFormatted: member.phone ? `"${member.phone}"` : 'null',
        phoneLength: member.phone ? member.phone.length : 0,
        role: displayRole,
        userRole: member.role,
        isVerified: member.isVerified,
        emailNotifications: member.emailNotifications,
        smsNotifications: member.smsNotifications,
        isCurrentUser: isCurrentUser,
        smsCapability: {
          hasPhone: hasPhone,
          hasSMSEnabled: hasSMSEnabled,
          canReceiveSMS: canReceiveSMS,
          reason: !canReceiveSMS ? 
            (!hasPhone ? 'No phone number' : 
             !hasSMSEnabled ? 'SMS notifications disabled' : 
             'Unknown') : 'Can receive SMS'
        }
      }
    })

    return NextResponse.json({ 
      members: formattedMembers,
      total: formattedMembers.length,
      currentUserId: session.user.id,
      currentUserEmail: session.user.email,
      debug: true
    })
    
  } catch (error) {
    console.error('Error fetching debug church members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch debug church members' },
      { status: 500 }
    )
  }
}