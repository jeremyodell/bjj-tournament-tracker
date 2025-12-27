'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * LandingNav - Transparent navigation bar for the landing page hero section
 *
 * Design spec requirements:
 * - Logo (belt weave icon + "BJJComps" wordmark) on left
 * - "Browse Tournaments" link/button on right
 * - Transparent over hero, minimal
 * - Gold accent for the button
 */
export function LandingNav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo and Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-3 group"
          aria-label="BJJComps Home"
        >
          <Image
            src="/logo.png"
            alt="BJJComps logo"
            width={40}
            height={40}
            className="transition-transform duration-300 group-hover:scale-105"
            priority
          />
          <span
            className="text-xl font-semibold tracking-tight text-white transition-colors duration-300 group-hover:text-[#d4af37]"
          >
            BJJComps
          </span>
        </Link>

        {/* Browse Tournaments Button - min-h-[44px] for touch target */}
        <Button
          asChild
          variant="outline"
          className="min-h-[44px] border-[#d4af37]/50 text-[#d4af37] hover:bg-[#d4af37]/10 hover:border-[#d4af37] hover:text-[#d4af37] transition-all duration-300"
        >
          <Link href="/tournaments">Browse Tournaments</Link>
        </Button>
      </div>
    </nav>
  );
}
