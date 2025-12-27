'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export function AuthButton() {
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
      className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
      style={{
        background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
        color: '#000',
      }}
    >
      Sign In
    </Link>
  );
}
