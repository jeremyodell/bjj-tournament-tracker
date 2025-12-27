// frontend/src/app/(protected)/layout.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { LandingNav } from '@/components/landing/LandingNav';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    if (!hasCheckedAuth.current) {
      hasCheckedAuth.current = true;
      checkAuth();
    }
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Always render the nav to prevent AuthButton from unmounting/remounting
  // which was causing an infinite loop (each remount reset the checkAuth ref guard)
  return (
    <div className="min-h-screen bg-black">
      <LandingNav />
      <main className="pt-20">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#d4af37] border-t-transparent" />
          </div>
        ) : !isAuthenticated ? null : (
          children
        )}
      </main>
    </div>
  );
}
