import type { Metadata } from 'next'
import Link from 'next/link'

const baseUrl = process.env.NEXTAUTH_URL || 'https://churchmusicpro.com'

export const metadata: Metadata = {
  title: 'Blog | Church Music Pro',
  description: 'Guides for church music directors: scheduling, calendars, and rehearsal tips.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Church Music Pro Blog',
    description: 'Practical guidance for church music ministry operations.'
  }
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/blog` },
            ],
          }),
        }}
      />
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            {/* Logo */}
            <img src="/apple-touch-icon.png" alt="Church Music Pro" width={32} height={32} className="rounded" />
            <span className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors">Church Music Pro</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-gray-700 hover:text-brand-600">Home</Link>
            <Link href="/auth/signin" className="text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg">Sign In</Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}


