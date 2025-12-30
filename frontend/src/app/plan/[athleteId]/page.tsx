// frontend/src/app/plan/[athleteId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAthletes } from '@/hooks/useAthletes';
import { usePlannerStore } from '@/stores/plannerStore';
import { PlannerWizard } from '@/components/planner/wizard';
import { PlannerConfig } from '@/components/planner/PlannerConfig';
import { PlannerResults, PlannerMobileFooter, PlannerMobileConfigSheet } from '@/components/planner/PlannerResults';

export default function AthletePlanPage() {
  const params = useParams();
  const rawAthleteId = params.athleteId;
  const athleteId = Array.isArray(rawAthleteId) ? rawAthleteId[0] : rawAthleteId;

  const { data: athletesData, isLoading, error } = useAthletes();
  const { setAthleteId, hasCompletedWizard, plan, resetWizard } = usePlannerStore();

  const [isMobileConfigOpen, setIsMobileConfigOpen] = useState(false);
  // Local override to show wizard after it completes (for re-entering wizard)
  const [forceShowPlan, setForceShowPlan] = useState(false);

  const athlete = athletesData?.athletes.find((a) => a.athleteId === athleteId);

  // Derive whether to show wizard based on store state
  const shouldShowWizard = !forceShowPlan && !(hasCompletedWizard && plan.length > 0);

  // Set athlete ID in store
  useEffect(() => {
    if (athleteId) {
      setAthleteId(athleteId);
    }
  }, [athleteId, setAthleteId]);

  // Loading
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#d4af37] border-t-transparent" />
        </div>
      </div>
    );
  }

  // Error loading athletes
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="p-8 rounded-xl border text-center max-w-md"
            style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
            <h2 className="text-xl font-semibold mb-2">Error Loading Athlete</h2>
            <p className="text-sm opacity-60 mb-6">Could not load athlete data. Please try again.</p>
            <Link href="/profile"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium"
              style={{ background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)', color: '#000' }}>
              Back to Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Athlete not found
  if (!athlete) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="p-8 rounded-xl border text-center max-w-md"
            style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
            <h2 className="text-xl font-semibold mb-2">Athlete Not Found</h2>
            <p className="text-sm opacity-60 mb-6">The athlete does not exist or you do not have access.</p>
            <Link href="/profile"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium"
              style={{ background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)', color: '#000' }}>
              Back to Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Wizard view
  if (shouldShowWizard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PlannerWizard athleteName={athlete.name} onComplete={() => setForceShowPlan(true)} />
      </div>
    );
  }

  // Plan view
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/plan" className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{athlete.name}&apos;s {new Date().getFullYear()} Plan</h1>
              <p className="text-sm opacity-60">
                {athlete.beltRank && <span className="capitalize">{athlete.beltRank} Belt</span>}
                {athlete.weightClass && <span> - {athlete.weightClass}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetWizard();
              setForceShowPlan(false);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restart Wizard
          </button>
        </div>
      </div>

      {/* Desktop: Split Layout */}
      <div className="container mx-auto px-4 pb-8">
        <div className="hidden lg:grid lg:grid-cols-[2fr_3fr] gap-6">
          <div className="sticky top-24 h-fit">
            <PlannerConfig athleteName={athlete.name} />
          </div>
          <div>
            <PlannerResults />
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden">
          <PlannerResults />
          <button onClick={() => setIsMobileConfigOpen(true)}
            className="fixed bottom-20 right-4 z-30 p-4 rounded-full shadow-lg"
            style={{ background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)' }}>
            <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
          <PlannerMobileFooter />
          <PlannerMobileConfigSheet athleteName={athlete.name} isOpen={isMobileConfigOpen} onClose={() => setIsMobileConfigOpen(false)} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}
