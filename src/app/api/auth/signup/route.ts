import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/db'
import { UserRole } from '@/generated/prisma'
import { generateReferralCode, isValidReferralCode } from '@/lib/utils'
import { PrismaClient } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, churchName, role, referralCode, ownershipToken, firstName, lastName } = await request.json()

    // Handle ownership token signup (different validation)
    if (ownershipToken) {
      // For ownership transfers, we need firstName, lastName, email, password
      if (!firstName || !lastName || !email || !password) {
        return NextResponse.json(
          { error: 'First name, last name, email, and password are required' },
          { status: 400 }
        )
      }

      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters long' },
          { status: 400 }
        )
      }

      // Verify ownership token
      const transfer = await prisma.ownershipTransfer.findUnique({
        where: { token: ownershipToken },
        include: { church: true }
      })

      if (!transfer || transfer.status !== 'PENDING' || new Date() > transfer.expiresAt) {
        return NextResponse.json(
          { error: 'Invalid or expired ownership invitation' },
          { status: 400 }
        )
      }

      if (transfer.inviteeEmail !== email.toLowerCase().trim()) {
        return NextResponse.json(
          { error: 'Email must match the invitation' },
          { status: 400 }
        )
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        )
      }

      // Hash password
      const saltRounds = 12
      const hashedPassword = await bcrypt.hash(password, saltRounds)

      // Create user for ownership transfer
      const user = await prisma.user.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: transfer.inviteeRole as UserRole,
          churchId: transfer.churchId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          churchId: true,
          church: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      return NextResponse.json(
        {
          message: 'Account created successfully',
          user: {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            role: user.role,
            church: user.church
          }
        },
        { status: 201 }
      )
    }

    // Regular signup validation
    if (!name || !email || !password || !churchName || !role) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    if (!['DIRECTOR', 'ASSOCIATE_DIRECTOR', 'PASTOR'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role specified' },
        { status: 400 }
      )
    }

    // Validate referral code if provided
    let referringChurch = null
    if (referralCode && referralCode.trim()) {
      const trimmedCode = referralCode.trim().toUpperCase()
      
      if (!isValidReferralCode(trimmedCode)) {
        return NextResponse.json(
          { error: 'Invalid referral code format. Code must be 8 characters.' },
          { status: 400 }
        )
      }

      referringChurch = await prisma.church.findUnique({
        where: { referralCode: trimmedCode },
        select: { id: true, name: true }
      })

      if (!referringChurch) {
        return NextResponse.json(
          { error: 'Invalid referral code. Please check and try again.' },
          { status: 400 }
        )
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Split name into firstName and lastName
    const nameParts = name.trim().split(' ')
    const userFirstName = nameParts[0] || ''
    const userLastName = nameParts.slice(1).join(' ') || ''

    // Create parish and user in a transaction
    const result = await prisma.$transaction(async (tx: PrismaClient) => {
              // Generate unique referral code for new church
        const newReferralCode = await generateReferralCode(churchName)
      
      // Create the church first
      const church = await tx.church.create({
        data: {
          name: churchName.trim(),
          address: '', // Default empty, can be updated later
          email: email,
          phone: '', // Default empty, can be updated later
          referralCode: newReferralCode,
          referredBy: referringChurch?.id || null
        }
      })

      // Create the user with the parish connection
      const user = await tx.user.create({
        data: {
          firstName: userFirstName,
          lastName: userLastName,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: role as UserRole,
          churchId: church.id,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          churchId: true,
          church: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      // Create referral record if there was a referring church
      if (referringChurch && referralCode) {
        await tx.referral.create({
          data: {
            referringChurchId: referringChurch.id,
            referredChurchId: church.id,
            referredEmail: email.toLowerCase().trim(),
            referredPersonName: name.trim(),
            referralCode: referralCode.trim().toUpperCase(),
            status: 'PENDING' // Will be updated to COMPLETED when they make first payment
          }
        })
      }

      // Create default automation settings for new church
      if (role === 'DIRECTOR' || role === 'ASSOCIATE_DIRECTOR') {
        await tx.automationSettings.create({
          data: {
            churchId: church.id,
            pastorEmailEnabled: true,
            pastorMonthlyReportDay: 27,
            pastorDailyDigestEnabled: true,
            pastorDailyDigestTime: '08:00',
            musicianNotifications: {
              create: [
                {
                  hoursBeforeEvent: 168, // 1 week
                  isEnabled: true
                },
                {
                  hoursBeforeEvent: 24, // 24 hours
                  isEnabled: true
                }
              ]
            }
          }
        })
      }

      return { user, church }
    })

    return NextResponse.json(
      {
        message: 'Account created successfully',
        user: {
          id: result.user.id,
          name: `${result.user.firstName} ${result.user.lastName}`.trim(),
          email: result.user.email,
          role: result.user.role,
          church: result.user.church
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Signup error:', error)
    
    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Email address is already in use' },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
} 