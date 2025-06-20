import 'next-auth'
import { UserRole } from '@/generated/prisma'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      churchId: string
      churchName: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: UserRole
    churchId: string
    churchName: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    churchId: string
    churchName: string
  }
} 