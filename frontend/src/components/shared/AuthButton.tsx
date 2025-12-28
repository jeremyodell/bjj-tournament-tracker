'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export function AuthButton() {
  // Read auth state from store - don't trigger checkAuth here to avoid loops
  // Protected pages handle auth via ProtectedLayout
  // Non-protected pages use cached state (session verified on actual API calls)
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  if (isLoading) {
    return (
      <div className="w-20 h-10 rounded-lg bg-white/5 animate-pulse" />
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/wishlist"
          className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          My Season
        </Link>
        <button
          onClick={() => logout()}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:bg-white/10"
          style={{ border: '1px solid rgba(255, 255, 255, 0.2)' }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105"
      style={{
        background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)',
        color: '#000',
        boxShadow: '0 0 20px rgba(212, 175, 55, 0.2), 0 0 40px rgba(212, 175, 55, 0.1)',
      }}
    >
      Sign In
    </Link>
  );
}
