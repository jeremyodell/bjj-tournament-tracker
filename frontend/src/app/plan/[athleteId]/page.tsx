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

// localStorage key for sidebar collapse state
const SIDEBAR_COLLAPSED_KEY = 'planner-sidebar-collapsed';

// Collapsed sidebar icon configuration
const COLLAPSED_ICONS = [
  {
    label: 'Budget',
    path: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    label: 'Location',
    paths: [
      'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z',
      'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
    ],
  },
  {
    label: 'Schedule',
    path: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  },
  {
    label: 'Must-Go',
    path: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  },
];

export default function AthletePlanPage() {
  const params = useParams();
  const rawAthleteId = params.athleteId;
  const athleteId = Array.isArray(rawAthleteId) ? rawAthleteId[0] : rawAthleteId;

  const { data: athletesData, isLoading, error } = useAthletes();
  const { setAthleteId, hasCompletedWizard, plan, resetWizard } = usePlannerStore();

  const [isMobileConfigOpen, setIsMobileConfigOpen] = useState(false);
  // Local override to show wizard after it completes (for re-entering wizard)
  const [forceShowPlan, setForceShowPlan] = useState(false);
  // Sidebar collapse state - start with null to avoid hydration mismatch
  const [isCollapsed, setIsCollapsed] = useState<boolean | null>(null);

  const athlete = athletesData?.athletes.find((a) => a.athleteId === athleteId);

  // Derive whether to show wizard based on store state
  const shouldShowWizard = !forceShowPlan && !(hasCompletedWizard && plan.length > 0);

  // Load collapse state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    setIsCollapsed(stored === 'true');
  }, []);

  // Persist collapse state to localStorage
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
  };

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

  // Determine effective collapsed state (default to false while loading from localStorage)
  const effectiveCollapsed = isCollapsed ?? false;

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

      {/* Desktop: Split Layout with Collapsible Sidebar */}
      <div className="container mx-auto px-4 pb-8">
        <div className="hidden lg:flex gap-6">
          {/* Collapsible Config Panel */}
          <div
            className={`relative flex-shrink-0 transition-all duration-300 ease-out motion-reduce:transition-none ${
              effectiveCollapsed ? 'w-14' : 'w-[340px]'
            }`}
          >
            {/* Collapse Toggle Button */}
            <button
              onClick={toggleCollapse}
              className="absolute -right-3 top-4 z-10 p-1.5 rounded-full border transition-all duration-200 hover:scale-110 motion-reduce:transition-none"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
                borderColor: 'rgba(212, 175, 55, 0.5)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              }}
              aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!effectiveCollapsed}
            >
              <svg
                className={`w-4 h-4 text-black transition-transform duration-300 motion-reduce:transition-none ${
                  effectiveCollapsed ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Sidebar Content - Full Config */}
            <div
              className={`sticky top-24 h-fit transition-opacity duration-300 motion-reduce:transition-none ${
                effectiveCollapsed ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'
              }`}
              aria-hidden={effectiveCollapsed}
            >
              <PlannerConfig athleteName={athlete.name} />
            </div>

            {/* Collapsed State - Icon Rail */}
            <div
              className={`sticky top-24 h-fit rounded-2xl border p-3 space-y-3 transition-opacity duration-300 motion-reduce:transition-none ${
                effectiveCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'
              }`}
              style={{
                background: 'var(--glass-bg)',
                borderColor: 'var(--glass-border)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
              aria-hidden={!effectiveCollapsed}
            >
              {COLLAPSED_ICONS.map((icon) => (
                <button
                  key={icon.label}
                  onClick={toggleCollapse}
                  className="w-full p-2 rounded-lg hover:bg-white/10 transition-colors group"
                  aria-label={`${icon.label} - expand sidebar to edit`}
                >
                  <svg
                    className="w-5 h-5 mx-auto opacity-60 group-hover:opacity-100 transition-opacity"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    {icon.paths ? (
                      icon.paths.map((p, i) => (
                        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={p} />
                      ))
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon.path} />
                    )}
                  </svg>
                </button>
              ))}

              <div className="border-t pt-3" style={{ borderColor: 'var(--glass-border)' }}>
                {/* Generate Button (collapsed) */}
                <button
                  onClick={toggleCollapse}
                  className="w-full p-2 rounded-lg transition-colors"
                  style={{
                    background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
                  }}
                  aria-label="Generate Plan - expand sidebar to configure"
                >
                  <svg
                    className="w-5 h-5 mx-auto text-black"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Results Panel - Takes remaining space */}
          <div className="flex-1 min-w-0">
            <PlannerResults />
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden">
          <PlannerResults />
          <button onClick={() => setIsMobileConfigOpen(true)}
            className="fixed bottom-20 right-4 z-30 p-4 rounded-full shadow-lg"
            style={{ background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)' }}
            aria-label="Open configuration"
          >
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
