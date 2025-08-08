import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from '@/components/providers/session-provider'
import { SubscriptionWarning } from '@/components/subscription-guard'

const baseUrl = process.env.NEXTAUTH_URL || 'https://churchmusicpro.com'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Church Music Pro",
    template: "%s | Church Music Pro",
  },
  description: "Simple, intuitive scheduling for church music directors",
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    type: 'website',
    url: baseUrl,
    title: 'Church Music Pro',
    description: 'Simple, intuitive scheduling for church music directors',
    siteName: 'Church Music Pro',
    images: [
      {
        url: '/android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'Church Music Pro Logo'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Church Music Pro',
    description: 'Simple, intuitive scheduling for church music directors',
    images: ['/android-chrome-512x512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/Montserrat-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Montserrat-Medium.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Montserrat-SemiBold.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Montserrat-Bold.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        
        {/* Favicon - Safari optimized order */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#660033" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Church Music Pro" />
        {/* Organization & WebSite JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Church Music Pro',
              url: baseUrl,
              logo: `${baseUrl}/android-chrome-512x512.png`,
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Church Music Pro',
              url: baseUrl,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${baseUrl}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        {/* FAQ JSON-LD (Quick Wins) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'What is Church Music Pro?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Church Music Pro is scheduling software for church music directors to plan services, coordinate musicians, and share live calendars.'
                  }
                },
                {
                  '@type': 'Question',
                  name: 'Does it integrate with Google Calendar?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes. You can connect a dedicated Google Calendar for instant sync, or share a live iCal feed for Apple/Outlook.'
                  }
                },
                {
                  '@type': 'Question',
                  name: 'Is there a free trial?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes. New churches get a free trial and can cancel anytime.'
                  }
                }
              ]
            }),
          }}
        />
      </head>
      <body suppressHydrationWarning={true}>
        <SessionProvider>
          <SubscriptionWarning />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
