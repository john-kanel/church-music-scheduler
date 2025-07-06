import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from '@/components/providers/session-provider'
import { SubscriptionWarning } from '@/components/subscription-guard'

export const metadata: Metadata = {
  title: "Church Music Scheduler",
  description: "Simple, intuitive scheduling for church music directors",
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
        <meta name="apple-mobile-web-app-title" content="Church Music Scheduler" />
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
