'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QuickSetupForm } from '@/components/setup/QuickSetupForm';
import { useAuthStore } from '@/stores/authStore';
import { useSetupStore } from '@/stores/setupStore';
import { fetchAthletes, createAthlete } from '@/lib/api';

function PlanSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, getAccessToken } = useAuthStore();
  const loadFromAthlete = useSetupStore((state) => state.loadFromAthlete);

  const [isCheckingAthletes, setIsCheckingAthletes] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isCreatingAthlete, setIsCreatingAthlete] = useState(false);
  const hasChecked = useRef(false);

  const forceNew = searchParams.get('new') === 'true';

  useEffect(() => {
    // Prevent double-checking
    if (hasChecked.current) return;

    async function checkAthletes() {
      // Not authenticated - show form immediately
      if (!isAuthenticated) {
        setShowForm(true);
        setIsCheckingAthletes(false);
        return;
      }

      // Force new athlete creation
      if (forceNew) {
        setShowForm(true);
        setIsCheckingAthletes(false);
        return;
      }

      try {
        const token = await getAccessToken();
        if (!token) {
          setShowForm(true);
          setIsCheckingAthletes(false);
          return;
        }

        const data = await fetchAthletes(token);
        const athletes = data.athletes;

        if (athletes.length === 0) {
          // No athletes - show setup form
          setShowForm(true);
        } else if (athletes.length === 1) {
          // Single athlete - auto-select and go to athlete's season page
          loadFromAthlete(athletes[0]);
          router.replace(`/plan/${athletes[0].athleteId}`);
          return;
        } else {
          // Multiple athletes - go to select page
          router.replace('/plan/select');
          return;
        }
      } catch {
        // On error, fall back to showing the form
        setShowForm(true);
      }

      setIsCheckingAthletes(false);
    }

    if (!authLoading) {
      hasChecked.current = true;
      checkAthletes();
    }
  }, [isAuthenticated, authLoading, forceNew, getAccessToken, loadFromAthlete, router]);

  const handleComplete = async () => {
    // For authenticated users, create athlete in backend
    if (isAuthenticated) {
      setIsCreatingAthlete(true);
      try {
        const token = await getAccessToken();
        if (token) {
          const { athleteName, age, belt, weight } = useSetupStore.getState();
          const currentYear = new Date().getFullYear();
          const birthYear = age ? currentYear - age : undefined;

          const newAthlete = await createAthlete(token, {
            name: athleteName,
            beltRank: belt || undefined,
            birthYear,
            weight: weight ? parseInt(weight) : undefined,
          });

          // Load the new athlete into the store
          loadFromAthlete(newAthlete);

          setIsCreatingAthlete(false);
          // Redirect to the new athlete's season page
          router.push(`/plan/${newAthlete.athleteId}`);
          return;
        }
      } catch (error) {
        console.error('Failed to create athlete:', error);
      }
      setIsCreatingAthlete(false);
    }

    // For unauthenticated users, redirect to select page (they'll need to sign up)
    router.push('/plan/select');
  };

  // Show loading while checking auth or athletes
  if (authLoading || isCheckingAthletes) {
    return (
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto pt-16 text-center">
          <p className="opacity-60">Loading...</p>
        </div>
      </main>
    );
  }

  if (!showForm) {
    return null;
  }

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="max-w-lg mx-auto pt-16">
        <p className="text-center text-sm opacity-60 mb-12">
          {isAuthenticated ? 'Create a new athlete profile' : 'No account required'}
        </p>
        <QuickSetupForm onComplete={handleComplete} />
        {isCreatingAthlete && (
          <p className="text-center text-sm opacity-60 mt-4">Saving...</p>
        )}
      </div>
    </main>
  );
}

export default function PlanSetupPage() {
  return (
    <Suspense
      fallback={
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-lg mx-auto pt-16 text-center">
            <p className="opacity-60">Loading...</p>
          </div>
        </main>
      }
    >
      <PlanSetupContent />
    </Suspense>
  );
}
