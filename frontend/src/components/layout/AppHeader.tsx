'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

/**
 * AppHeader - Glass-style navigation for interior pages
 *
 * Design spec:
 * - Same logo + wordmark as landing nav
 * - Glass background with blur (works over content, not heroes)
 * - Fixed positioning with subtle border
 * - Gold accent on hover, consistent with brand
 * - Navigation links for Browse, My Season, Profile
 */
export function AppHeader() {
  const pathname = usePathname();
  const { isAuthenticated, logout } = useAuthStore();

  const navLinks = [
    { href: '/tournaments', label: 'Browse' },
    { href: '/plan', label: 'My Season' },
    { href: '/profile', label: 'Profile' },
  ];

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

        {/* Navigation Links */}
        <div className="flex items-center gap-1 sm:gap-2">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 min-h-[44px] flex items-center ${
                  isActive
                    ? 'bg-[#d4af37]/20 text-[#d4af37]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {label}
              </Link>
            );
          })}

          {/* Separator */}
          <div className="w-px h-6 bg-white/10 mx-1 sm:mx-2" />

          {/* Sign Out Button (only show if authenticated) */}
          {isAuthenticated ? (
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
                background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)',
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
