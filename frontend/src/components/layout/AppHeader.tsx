'use client';

import Image from 'next/image';
import Link from 'next/link';

/**
 * AppHeader - Glass-style navigation for interior pages
 *
 * Design spec:
 * - Same logo + wordmark as landing nav
 * - Glass background with blur (works over content, not heroes)
 * - Fixed positioning with subtle border
 * - Gold accent on hover, consistent with brand
 */
export function AppHeader() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'var(--glass-border)',
      }}
      role="banner"
    >
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between"
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo and Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group min-h-[44px]"
          aria-label="BJJComps Home"
        >
          <Image
            src="/logo.png"
            alt="BJJComps logo"
            width={36}
            height={36}
            className="transition-transform duration-300 group-hover:scale-105"
            priority
          />
          <span
            className="text-lg font-semibold tracking-tight text-white transition-colors duration-300 group-hover:text-[#d4af37]"
          >
            BJJComps
          </span>
        </Link>

        {/* Right side - could add more nav items here later */}
        <div className="flex items-center gap-4">
          {/* Current page indicator or additional nav */}
        </div>
      </nav>
    </header>
  );
}
