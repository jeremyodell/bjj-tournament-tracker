// frontend/src/app/layout.tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { IBM_Plex_Mono, Instrument_Sans } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import { Providers } from './providers';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { AppHeader } from '@/components/layout/AppHeader';
import { defaultToastOptions } from '@/lib/toastConfig';

const satoshi = localFont({
  src: '../../public/fonts/Satoshi-Variable.woff2',
  variable: '--font-satoshi',
  display: 'swap',
  weight: '300 900',
});

// Tournament Scoreboard: Monospace for headers (LED/digital aesthetic)
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

// Tournament Scoreboard: Clean sans for body text
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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
      <body className={`${satoshi.variable} ${ibmPlexMono.variable} ${instrumentSans.variable}`} style={{ fontFamily: 'var(--font-body)' }} suppressHydrationWarning>
        <AnimatedBackground />
        <Providers>
          <Toaster toastOptions={defaultToastOptions} />
          <AppHeader />
          <div className="pt-16">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
