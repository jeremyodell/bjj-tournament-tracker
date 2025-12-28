'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetupStore } from '@/stores/setupStore';
import { useAuthStore } from '@/stores/authStore';
import { FreePlannerView } from '@/components/plan/FreePlannerView';

export default function PlanResultsPage() {
  const router = useRouter();
  const { isComplete, athleteId } = useSetupStore();
  const { isAuthenticated } = useAuthStore();

  // Determine if user can view results:
  // - Anonymous users: need isComplete (filled out form)
  // - Authenticated users: need athleteId (selected an athlete)
  const canViewResults = isAuthenticated ? !!athleteId : isComplete;

  // Redirect to setup if not authorized
  useEffect(() => {
    if (!canViewResults) {
      router.replace('/plan');
    }
  }, [canViewResults, router]);

  if (!canViewResults) {
    return null;
  }

  return <FreePlannerView />;
}
