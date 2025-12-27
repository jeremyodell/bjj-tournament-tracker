// frontend/src/app/layout.tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Instrument_Serif } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';

const satoshi = localFont({
  src: '../../public/fonts/Satoshi-Variable.woff2',
  variable: '--font-satoshi',
  display: 'swap',
  weight: '300 900',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: '400',
});

export const metadata: Metadata = {
  title: 'BJJ Tournament Tracker',
  description: 'Find and track BJJ tournaments from IBJJF, JJWL, and more',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${satoshi.variable} ${instrumentSerif.variable}`} style={{ fontFamily: 'var(--font-satoshi)' }} suppressHydrationWarning>
        <AnimatedBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
