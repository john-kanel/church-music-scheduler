import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

function createSlug(churchName: string): string {
  return churchName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
}

async function generateUniqueSlug(churchName: string): Promise<string> {
  let baseSlug = createSlug(churchName)
  let slug = baseSlug
  let counter = 1

  // Check if slug already exists
  while (await prisma.musicianInviteLink.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission (director, pastor, associate)
    const allowedRoles = ['DIRECTOR', 'PASTOR', 'ASSOCIATE_DIRECTOR', 'ASSOCIATE_PASTOR']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 })
    }

    // Get existing invitation link for the church
    const inviteLink = await prisma.musicianInviteLink.findUnique({
      where: { churchId: session.user.churchId },
      include: {
        church: {
          select: { name: true }
        },
        pageViews: {
          select: { id: true, viewedAt: true }
        }
      }
    })

    if (!inviteLink) {
      return NextResponse.json({ inviteLink: null })
    }

    // Count unique signups via this link
    const signupCount = await prisma.user.count({
      where: {
        churchId: session.user.churchId,
        invitedVia: 'invitation_link'
      }
    })

    return NextResponse.json({
      inviteLink: {
        id: inviteLink.id,
        slug: inviteLink.slug,
        url: `${process.env.NEXTAUTH_URL}/join/${inviteLink.slug}`,
        isActive: inviteLink.isActive,
        createdAt: inviteLink.createdAt,
        updatedAt: inviteLink.updatedAt,
        stats: {
          pageViews: inviteLink.pageViews.length,
          signups: signupCount
        }
      }
    })
  } catch (error) {
    console.error('Error fetching musician invite link:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission (director, pastor, associate)
    const allowedRoles = ['DIRECTOR', 'PASTOR', 'ASSOCIATE_DIRECTOR', 'ASSOCIATE_PASTOR']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 })
    }

    const { action } = await request.json()

    if (action !== 'create' && action !== 'regenerate') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Get church information
    const church = await prisma.church.findUnique({
      where: { id: session.user.churchId },
      select: { name: true }
    })

    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    // Check if link already exists
    const existingLink = await prisma.musicianInviteLink.findUnique({
      where: { churchId: session.user.churchId }
    })

    if (existingLink && action === 'create') {
      return NextResponse.json({ error: 'Invitation link already exists' }, { status: 409 })
    }

    if (!existingLink && action === 'regenerate') {
      return NextResponse.json({ error: 'No existing invitation link to regenerate' }, { status: 404 })
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(church.name)

    let inviteLink

    if (action === 'create') {
      // Create new invitation link
      inviteLink = await prisma.musicianInviteLink.create({
        data: {
          churchId: session.user.churchId,
          slug,
          createdBy: session.user.id,
          isActive: true
        }
      })
    } else {
      // Regenerate (update existing link with new slug)
      if (!existingLink) {
        return NextResponse.json({ error: 'No existing invitation link to regenerate' }, { status: 404 })
      }
      
      inviteLink = await prisma.musicianInviteLink.update({
        where: { id: existingLink.id },
        data: { 
          slug,
          isActive: true,
          updatedAt: new Date()
        }
      })
    }

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'MUSICIAN_INVITED',
        description: `${action === 'create' ? 'Created' : 'Regenerated'} musician invitation link`,
        churchId: session.user.churchId,
        userId: session.user.id,
        metadata: {
          slug,
          action
        }
      }
    })

    return NextResponse.json({
      inviteLink: {
        id: inviteLink.id,
        slug: inviteLink.slug,
        url: `${process.env.NEXTAUTH_URL}/join/${inviteLink.slug}`,
        isActive: inviteLink.isActive,
        createdAt: inviteLink.createdAt
      }
    })
  } catch (error) {
    console.error('Error creating/regenerating musician invite link:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 