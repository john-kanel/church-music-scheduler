import 'next-auth'
import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      churchId: string
      churchName: string
      hasCompletedOnboarding?: boolean
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: UserRole
    churchId: string
    churchName: string
    hasCompletedOnboarding?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    churchId: string
    churchName: string
    hasCompletedOnboarding?: boolean
  }
} 