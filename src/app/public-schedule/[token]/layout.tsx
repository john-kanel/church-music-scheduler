import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Public Music Schedule | Church Music Pro',
  description:
    'View the live music ministry schedule with events, musicians, and music selections.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Public Music Schedule',
    description: 'Live music ministry events and details.',
  },
}

export default function PublicScheduleLayout({ children }: { children: React.ReactNode }) {
  return children
}


