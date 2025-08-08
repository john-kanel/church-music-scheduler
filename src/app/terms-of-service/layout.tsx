import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Church Music Pro',
  description:
    'The legal terms governing your use of Church Music Pro, including subscriptions and acceptable use.',
  alternates: {
    canonical: '/terms-of-service',
  },
  openGraph: {
    title: 'Terms of Service | Church Music Pro',
    description: 'Please review the legal terms for using Church Music Pro.',
  },
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children
}


