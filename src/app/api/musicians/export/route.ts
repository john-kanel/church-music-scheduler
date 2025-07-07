import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's church ID
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { churchId: true, role: true }
    })

    if (!user?.churchId) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    // Check if user has permission to export data
    const canExport = user.role && ['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR', 'ASSOCIATE_PASTOR'].includes(user.role)
    
    if (!canExport) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Fetch all musicians for the church
    const musicians = await prisma.user.findMany({
      where: {
        churchId: user.churchId,
        role: 'MUSICIAN'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isVerified: true,
        createdAt: true,
        groupMemberships: {
          select: {
            group: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    // Convert to CSV format
    const csvHeaders = [
      'First Name',
      'Last Name', 
      'Email',
      'Phone',
      'Status',
      'Groups',
      'Date Joined'
    ]

    const csvRows = musicians.map((musician: any) => {
      // Determine status based on isVerified
      const status = musician.isVerified ? 'Active' : 'Pending'

      // Format groups
      const groups = musician.groupMemberships
        .map((membership: any) => membership.group.name)
        .join('; ')

      // Format date
      const joinedDate = musician.createdAt.toLocaleDateString()

      return [
        musician.firstName,
        musician.lastName,
        musician.email,
        musician.phone || '',
        status,
        groups || 'No groups',
        joinedDate
      ]
    })

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row: any) => 
        row.map((cell: any) => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const escaped = cell.replace(/"/g, '""')
          return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped
        }).join(',')
      )
    ].join('\n')

    // Generate filename with timestamp
    const now = new Date()
    const timestamp = now.toISOString().split('T')[0] // YYYY-MM-DD format
    const filename = `musicians_export_${timestamp}.csv`

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 