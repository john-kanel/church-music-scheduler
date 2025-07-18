import { PrismaAdapter } from '@auth/prisma-adapter'
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
// import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this-in-production',
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          },
          include: {
            church: true
          }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Mark user as verified on successful login if not already verified
        if (!user.isVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isVerified: true }
          })

          // Also mark any corresponding invitation as accepted
          await prisma.invitation.updateMany({
            where: {
              email: user.email,
              churchId: user.churchId,
              status: 'PENDING'
            },
            data: {
              status: 'ACCEPTED'
            }
          })
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          churchId: user.churchId,
          churchName: user.church.name,
          hasCompletedOnboarding: user.hasCompletedOnboarding
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.churchId = user.churchId
        token.churchName = user.churchName
        token.hasCompletedOnboarding = user.hasCompletedOnboarding
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as any
        session.user.churchId = token.churchId as string
        session.user.churchName = token.churchName as string
        session.user.hasCompletedOnboarding = token.hasCompletedOnboarding as boolean
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin'
  }
} 