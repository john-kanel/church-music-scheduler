import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/db'
import { UserRole } from '@/generated/prisma'
import { generateReferralCode, isValidReferralCode } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, churchName, role, referralCode } = await request.json()

    // Validation
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

    if (!['DIRECTOR', 'PASTOR'].includes(role)) {
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
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Create parish and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate unique referral code for new church
      const newReferralCode = await generateReferralCode()
      
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
          firstName: firstName,
          lastName: lastName,
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