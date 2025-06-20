import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email and new password are required' },
        { status: 400 }
      );
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user with new password and mark as verified
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        isVerified: true
      }
    });

    // Log activity
    await logActivity({
      type: 'MUSICIAN_SIGNED_UP',
      description: `${user.firstName} ${user.lastName} completed account setup`,
      parishId: user.parishId,
      userId: user.id,
      metadata: {
        musicianName: `${user.firstName} ${user.lastName}`,
        musicianEmail: user.email
      }
    });

    return NextResponse.json({
      message: 'Account verified successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        isVerified: updatedUser.isVerified
      }
    });

  } catch (error) {
    console.error('Error verifying account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 