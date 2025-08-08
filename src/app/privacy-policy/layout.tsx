import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Church Music Pro',
  description:
    'Read the Church Music Pro privacy policy covering data collection, usage, retention, and your rights.',
  alternates: {
    canonical: '/privacy-policy',
  },
  openGraph: {
    title: 'Privacy Policy | Church Music Pro',
    description:
      'Our privacy policy explains what data we collect, how we use it, and your choices.',
  },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}


