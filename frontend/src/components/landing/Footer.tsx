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
        <div className="flex items-center justify-center gap-6 text-sm text-white/40">
          {/* Small Logo */}
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/logo.png"
              alt="BJJComps logo"
              width={24}
              height={24}
              className="opacity-60 hover:opacity-100 transition-opacity duration-300"
            />
          </Link>

          {/* Separator */}
          <span className="text-white/20">|</span>

          {/* Copyright */}
          <span>&copy; 2025 BJJComps</span>

          {/* Separator */}
          <span className="text-white/20">|</span>

          {/* Contact Link */}
          <a
            href="mailto:contact@bjjcomps.com"
            className="hover:text-white/70 transition-colors duration-300"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
