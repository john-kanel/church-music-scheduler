import 'next-auth'
import { UserRole } from '@/generated/prisma'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      parishId: string
      parishName: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: UserRole
    parishId: string
    parishName: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    parishId: string
    parishName: string
  }
} 