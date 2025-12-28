'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetupStore } from '@/stores/setupStore';
import { FreePlannerView } from '@/components/plan/FreePlannerView';

export default function PlanResultsPage() {
  const router = useRouter();
  const { isComplete } = useSetupStore();

  // Redirect to setup if not complete
  useEffect(() => {
    if (!isComplete) {
      router.replace('/plan');
    }
  }, [isComplete, router]);

  if (!isComplete) {
    return null;
  }

  return <FreePlannerView />;
}
