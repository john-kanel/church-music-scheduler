'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/auth/signin')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-600"></div>
    </div>
  )
} 