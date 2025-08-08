import { NextResponse } from 'next/server'

export function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://churchmusicpro.com'
  const body = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`
  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/plain' },
  })
}


