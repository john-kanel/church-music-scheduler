import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    console.log('Debug login attempt:', { email, password })

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        password: true,
        isVerified: true,
        role: true,
        churchId: true
      }
    })

    if (!user) {
      return NextResponse.json({ 
        error: 'User not found',
        debug: { email, userExists: false }
      })
    }

    console.log('User found:', {
      id: user.id,
      email: user.email,
      hasPassword: !!user.password,
      passwordLength: user.password?.length,
      isVerified: user.isVerified
    })

    // Test password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    
    console.log('Password comparison:', {
      provided: password,
      isValid: isPasswordValid
    })

    return NextResponse.json({
      userExists: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        role: user.role,
        churchId: user.churchId
      },
      passwordValid: isPasswordValid,
      debug: {
        providedPassword: password,
        hasStoredPassword: !!user.password,
        passwordLength: user.password?.length
      }
    })

  } catch (error) {
    console.error('Debug login error:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: error },
      { status: 500 }
    )
  }
} 