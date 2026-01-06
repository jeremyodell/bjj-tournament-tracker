// frontend/src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { getAndClearReturnPath } from '@/lib/auth';

// Single point of auth initialization - runs once on app mount
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasInitialized = useRef(false);
  const hasCheckedReturnPath = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      checkAuth();
    }
  }, [checkAuth]);

  // Handle OAuth return path redirect
  useEffect(() => {
    if (isAuthenticated && !hasCheckedReturnPath.current) {
      hasCheckedReturnPath.current = true;
      const returnPath = getAndClearReturnPath();
      if (returnPath && returnPath !== window.location.pathname) {
        console.log('[Auth] Redirecting to return path:', returnPath);
        router.replace(returnPath);
      }
    }
  }, [isAuthenticated, router]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 2,
          },
          mutations: {
            retry: false, // Don't retry mutations on network errors
            networkMode: 'always', // Attempt mutations even when offline (let axios timeout handle it)
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>{children}</AuthInitializer>
    </QueryClientProvider>
  );
}
