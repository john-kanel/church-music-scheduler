import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Public Calendar | Church Music Pro',
  description: 'Subscribe to this church’s music ministry calendar.',
  robots: { index: true, follow: true },
}

export default function PublicCalendarLayout({ children }: { children: React.ReactNode }) {
  return children
}


