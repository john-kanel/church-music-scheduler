import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Resend } from 'resend'
import { ReferralInvitationEmail } from '@/components/emails/referral-invitation'
import { render } from '@react-email/render'

const resend = new Resend(process.env.RESEND_API_KEY)

// GET - Get referral information for current church
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const church = await prisma.church.findUnique({
      where: { id: session.user.churchId },
      select: {
        referralCode: true,
        referralRewardsEarned: true,
        referralRewardsSaved: true,
        name: true
      }
    })

    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    // Get referral history
    const referrals = await prisma.referral.findMany({
      where: { referringChurchId: session.user.churchId },
      select: {
        id: true,
        referredPersonName: true,
        referredEmail: true,
        status: true,
        completedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      referralCode: church.referralCode,
      rewardsEarned: church.referralRewardsEarned,
      rewardsSaved: church.referralRewardsSaved.toNumber(),
      churchName: church.name,
      referralHistory: referrals
    })
  } catch (error) {
    console.error('Error fetching referral data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Send referral email(s)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.churchId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type = 'single' } = body

    if (type === 'single') {
      return await handleSingleReferral(session, body)
    } else if (type === 'bulk') {
      return await handleBulkReferrals(session, body)
    } else {
      return NextResponse.json({ error: 'Invalid request type. Must be "single" or "bulk"' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing referral request:', error)
    return NextResponse.json({ error: 'Failed to process referral request' }, { status: 500 })
  }
}

async function handleSingleReferral(session: any, body: any) {
  const { recipientName, recipientEmail } = body

  if (!recipientName || !recipientEmail) {
    return NextResponse.json({ error: 'Recipient name and email are required' }, { status: 400 })
  }

  // Get church and user info
  const church = await prisma.church.findUnique({
    where: { id: session.user.churchId },
    select: {
      name: true,
      referralCode: true
    }
  })

  if (!church) {
    return NextResponse.json({ error: 'Church not found' }, { status: 404 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      lastName: true
    }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const referrerName = `${user.firstName} ${user.lastName}`.trim()

  // Check for existing referral to this email
  const existingReferral = await prisma.referral.findFirst({
    where: {
      referringChurchId: session.user.churchId,
      referredEmail: recipientEmail.toLowerCase().trim(),
      status: 'PENDING'
    }
  })

  if (existingReferral) {
    return NextResponse.json({ error: 'A pending referral already exists for this email address' }, { status: 409 })
  }

  // Create referral record
  await prisma.referral.create({
    data: {
      referringChurchId: session.user.churchId,
      referredEmail: recipientEmail.toLowerCase().trim(),
      referredPersonName: recipientName.trim(),
      referralCode: church.referralCode,
      status: 'PENDING'
    }
  })

  // Generate email HTML
  const emailHtml = await render(
    ReferralInvitationEmail({
      referrerName,
      referrerChurchName: church.name,
      referralCode: church.referralCode,
      recipientName: recipientName.trim()
    })
  )

  // Send email
  await resend.emails.send({
    from: 'Church Music Scheduler <noreply@churchmusicscheduler.com>',
    to: recipientEmail,
    subject: `${referrerName} invited you to join Church Music Scheduler! Get 60 days FREE!`,
    html: emailHtml
  })

  return NextResponse.json({ 
    message: 'Referral email sent successfully',
    referralCode: church.referralCode
  })
}

async function handleBulkReferrals(session: any, body: any) {
  const { referrals } = body

  if (!referrals || !Array.isArray(referrals) || referrals.length === 0) {
    return NextResponse.json({ error: 'Referrals array is required and must not be empty' }, { status: 400 })
  }

  if (referrals.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 referrals allowed per bulk request' }, { status: 400 })
  }

  // Get church and user info once
  const [church, user] = await Promise.all([
    prisma.church.findUnique({
      where: { id: session.user.churchId },
      select: {
        name: true,
        referralCode: true
      }
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        firstName: true,
        lastName: true
      }
    })
  ])

  if (!church || !user) {
    return NextResponse.json({ error: 'Church or user not found' }, { status: 404 })
  }

  const referrerName = `${user.firstName} ${user.lastName}`.trim()

  const results = {
    successful: [] as Array<{
      email: string;
      name: string;
      referralId: string;
    }>,
    failed: [] as Array<{
      email: string;
      name: string;
      error: string;
    }>
  }

  // Process each referral
  for (const referralData of referrals) {
    const { recipientName, recipientEmail } = referralData

    try {
      // Validation
      if (!recipientName || !recipientEmail) {
        results.failed.push({
          email: recipientEmail || 'unknown',
          name: recipientName || 'unknown',
          error: 'Name and email are required'
        })
        continue
      }

      const cleanEmail = recipientEmail.toLowerCase().trim()
      const cleanName = recipientName.trim()

      // Check for existing referral
      const existingReferral = await prisma.referral.findFirst({
        where: {
          referringChurchId: session.user.churchId,
          referredEmail: cleanEmail,
          status: 'PENDING'
        }
      })

      if (existingReferral) {
        results.failed.push({
          email: cleanEmail,
          name: cleanName,
          error: 'Pending referral already exists'
        })
        continue
      }

      // Create referral record
      const newReferral = await prisma.referral.create({
        data: {
          referringChurchId: session.user.churchId,
          referredEmail: cleanEmail,
          referredPersonName: cleanName,
          referralCode: church.referralCode,
          status: 'PENDING'
        }
      })

      // Generate email HTML
      const emailHtml = await render(
        ReferralInvitationEmail({
          referrerName,
          referrerChurchName: church.name,
          referralCode: church.referralCode,
          recipientName: cleanName
        })
      )

      // Send email
      await resend.emails.send({
        from: 'Church Music Scheduler <noreply@churchmusicscheduler.com>',
        to: cleanEmail,
        subject: `${referrerName} invited you to join Church Music Scheduler! Get 60 days FREE!`,
        html: emailHtml
      })

      results.successful.push({
        email: cleanEmail,
        name: cleanName,
        referralId: newReferral.id
      })

    } catch (error) {
      console.error(`Error processing referral for ${recipientEmail}:`, error)
      results.failed.push({
        email: recipientEmail,
        name: recipientName || 'unknown',
        error: 'Failed to send referral email'
      })
    }
  }

  return NextResponse.json({
    message: `Processed ${referrals.length} referrals. ${results.successful.length} successful, ${results.failed.length} failed.`,
    results,
    referralCode: church.referralCode
  })
} 