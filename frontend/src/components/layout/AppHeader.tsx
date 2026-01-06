'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

/**
 * AppHeader - Unified navigation header for all pages
 *
 * Features:
 * - Scroll-aware: transparent at top, solid when scrolled
 * - Auth-aware: different nav items for logged in/out states
 * - Consistent across all pages via root layout
 */
export function AppHeader() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, logout } = useAuthStore();
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ${
        isScrolled
          ? 'bg-black/95 backdrop-blur-md border-b border-white/10'
          : 'bg-transparent border-b border-transparent'
      }`}
      role="banner"
    >
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between"
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
          <span className="text-lg font-semibold tracking-tight text-white transition-colors duration-300 group-hover:text-[#d4af37]">
            BJJComps
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Browse Tournaments - Always visible */}
          <Link
            href="/tournaments"
            className={`px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 min-h-[44px] flex items-center ${
              isActive('/tournaments')
                ? 'bg-[#d4af37]/20 text-[#d4af37]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            Browse
          </Link>

          {/* Authenticated nav items */}
          {isAuthenticated && (
            <>
              <Link
                href="/wishlist"
                className={`px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 min-h-[44px] flex items-center ${
                  isActive('/wishlist')
                    ? 'bg-[#d4af37]/20 text-[#d4af37]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Wishlist
              </Link>
              <Link
                href="/plan"
                className={`px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 min-h-[44px] flex items-center ${
                  isActive('/plan')
                    ? 'bg-[#d4af37]/20 text-[#d4af37]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                My Plan
              </Link>
              <Link
                href="/profile"
                className={`px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 min-h-[44px] flex items-center ${
                  isActive('/profile')
                    ? 'bg-[#d4af37]/20 text-[#d4af37]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Profile
              </Link>
            </>
          )}

          {/* Separator */}
          <div className="w-px h-6 bg-white/10 mx-1 sm:mx-2" />

          {/* Auth Button */}
          {isLoading ? (
            <div className="w-20 h-10 rounded-full bg-white/5 animate-pulse" />
          ) : isAuthenticated ? (
            <button
              onClick={() => logout()}
              className="px-3 sm:px-4 py-2 rounded-full text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 min-h-[44px] flex items-center"
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105 min-h-[44px] flex items-center"
              style={{
                background:
                  'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)',
                color: '#000',
                boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)',
              }}
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
