import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/db'
import { UserRole } from '@/generated/prisma'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, parishName, role } = await request.json()

    // Validation
    if (!name || !email || !password || !parishName || !role) {
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
      // Create the parish first
      const parish = await tx.parish.create({
        data: {
          name: parishName.trim(),
          address: '', // Default empty, can be updated later
          email: email,
          phone: '', // Default empty, can be updated later
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
          parishId: parish.id,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          parishId: true,
          parish: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      return { user, parish }
    })

    return NextResponse.json(
      {
        message: 'Account created successfully',
        user: {
          id: result.user.id,
          name: `${result.user.firstName} ${result.user.lastName}`.trim(),
          email: result.user.email,
          role: result.user.role,
          parish: result.user.parish
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