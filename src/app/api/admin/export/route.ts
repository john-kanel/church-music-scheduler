import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type || !['churches', 'users'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid export type. Must be "churches" or "users"' },
        { status: 400 }
      )
    }

    let csvContent = ''
    let filename = ''

    if (type === 'churches') {
      const churches = await prisma.church.findMany({
        include: {
          _count: {
            select: {
              users: true,
              events: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // Create CSV header
      csvContent = 'Church ID,Name,Email,Phone,Subscription Status,Subscription Ends,User Count,Event Count,Created At,Stripe Customer ID\n'

      // Add data rows
      churches.forEach((church: any) => {
        csvContent += [
          church.id,
          `"${church.name}"`,
          church.email || '',
          church.phone || '',
          church.subscriptionStatus,
          church.subscriptionEnds ? church.subscriptionEnds.toISOString() : '',
          church._count.users,
          church._count.events,
          church.createdAt.toISOString(),
          church.stripeCustomerId || ''
        ].join(',') + '\n'
      })

      filename = `churches-export-${new Date().toISOString().split('T')[0]}.csv`

    } else if (type === 'users') {
      const users = await prisma.user.findMany({
        include: {
          church: {
            select: {
              name: true,
              subscriptionStatus: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // Create CSV header
      csvContent = 'User ID,First Name,Last Name,Email,Role,Verified,Church,Subscription Status,Created At,Last Updated\n'

      // Add data rows
      users.forEach((user: any) => {
        csvContent += [
          user.id,
          `"${user.firstName}"`,
          `"${user.lastName}"`,
          user.email,
          user.role,
          user.isVerified,
          `"${user.church.name}"`,
          user.church.subscriptionStatus,
          user.createdAt.toISOString(),
          user.updatedAt.toISOString()
        ].join(',') + '\n'
      })

      filename = `users-export-${new Date().toISOString().split('T')[0]}.csv`
    }

    // Create and return the CSV file
    const response = new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

    return response

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
} 