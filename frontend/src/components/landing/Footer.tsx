'use client';

import Image from 'next/image';
import Link from 'next/link';

/**
 * Footer - Minimal footer for the landing page
 *
 * Design spec requirements:
 * - Single row, minimal
 * - Dark, doesn't distract
 * - Content: Logo (small) | (c) 2025 BJJComps | Contact link
 */
export function Footer() {
  return (
    <footer
      className="w-full border-t border-white/5 bg-black/50 backdrop-blur-sm"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-4 text-sm text-white/40 sm:flex-row sm:gap-6">
          {/* Small Logo */}
          <Link href="/" className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="BJJComps logo"
              width={24}
              height={24}
              className="opacity-60 hover:opacity-100 transition-opacity duration-300"
            />
          </Link>

          {/* Separator - hidden on mobile */}
          <span className="hidden text-white/20 sm:inline">|</span>

          {/* Copyright */}
          <span>&copy; 2025 BJJComps</span>

          {/* Separator - hidden on mobile */}
          <span className="hidden text-white/20 sm:inline">|</span>

          {/* Contact Link - with adequate touch target */}
          <a
            href="mailto:contact@bjjcomps.com"
            className="min-h-[44px] flex items-center justify-center hover:text-white/70 transition-colors duration-300"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
