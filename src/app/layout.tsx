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
