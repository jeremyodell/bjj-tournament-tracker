// frontend/src/app/layout.tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';

const satoshi = localFont({
  src: '../../public/fonts/Satoshi-Variable.woff2',
  variable: '--font-satoshi',
  display: 'swap',
  weight: '300 900',
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
      <body className={satoshi.variable} style={{ fontFamily: 'var(--font-satoshi)' }}>
        <AnimatedBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
