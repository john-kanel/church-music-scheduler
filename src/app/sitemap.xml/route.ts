import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://churchmusicpro.com'
  const urls = [
    '',
    '/features',
    '/pricing',
    '/signup',
    '/login',
    '/privacy-policy',
    '/terms-of-service',
  ]

  const lastmod = new Date().toISOString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (path) => `<url><loc>${baseUrl}${path}</loc><lastmod>${lastmod}</lastmod></url>`
  )
  .join('\n')}
</urlset>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}


