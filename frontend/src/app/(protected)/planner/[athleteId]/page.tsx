// frontend/src/app/(protected)/planner/[athleteId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAthletes } from '@/hooks/useAthletes';
import { usePlannerStore } from '@/stores/plannerStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { PlannerConfig } from '@/components/planner/PlannerConfig';
import { PlannerResults, PlannerMobileFooter, PlannerMobileConfigSheet } from '@/components/planner/PlannerResults';
import { UpgradeModal } from '@/components/shared/UpgradeModal';

export default function PlannerPage() {
  const params = useParams();
  const router = useRouter();
  const athleteId = params.athleteId as string;

  const { data: athletesData, isLoading, error } = useAthletes();
  const { setAthleteId } = usePlannerStore();
  const { isPro, isLoading: isSubscriptionLoading, checkSubscription } = useSubscriptionStore();

  const [isMobileConfigOpen, setIsMobileConfigOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Find the athlete
  const athlete = athletesData?.athletes.find((a) => a.athleteId === athleteId);

  // Set athlete ID in store when component mounts
  useEffect(() => {
    if (athleteId) {
      setAthleteId(athleteId);
    }
  }, [athleteId, setAthleteId]);

  // Check subscription on mount
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Show upgrade modal if not Pro (after subscription check completes)
  useEffect(() => {
    if (!isSubscriptionLoading && !isPro) {
      setShowUpgradeModal(true);
    }
  }, [isSubscriptionLoading, isPro]);

  // Handle "Maybe Later" - redirect to profile since user can't use planner without Pro
  const handleUpgradeModalClose = () => {
    setShowUpgradeModal(false);
    // If still not Pro after closing modal, redirect to profile
    if (!isPro) {
      router.push('/profile');
    }
  };

  // Show loading while either athlete data or subscription is loading
  if (isLoading || isSubscriptionLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#d4af37] border-t-transparent" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-center max-w-md">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="font-medium mb-2">Error loading athlete</p>
            <p className="text-sm opacity-60">Please try again or go back to your profile.</p>
            <Link
              href="/profile"
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
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
          <div
            className="p-8 rounded-xl border text-center max-w-md"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
            }}
          >
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Athlete Not Found</h2>
            <p className="text-sm opacity-60 mb-6">
              The athlete you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
                color: '#000',
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/profile"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{athlete.name}&apos;s Season Planner</h1>
            <p className="text-sm opacity-60">
              {athlete.beltRank && <span className="capitalize">{athlete.beltRank} Belt</span>}
              {athlete.weightClass && <span> - {athlete.weightClass}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-8">
        {/* Desktop: Split Screen Layout */}
        <div className="hidden lg:grid lg:grid-cols-[2fr_3fr] gap-6">
          {/* Left Panel - Config (40%) */}
          <div className="sticky top-24 h-fit">
            <PlannerConfig athleteName={athlete.name} />
          </div>

          {/* Right Panel - Results (60%) */}
          <div>
            <PlannerResults />
          </div>
        </div>

        {/* Mobile: Full Screen Results with Config Sheet */}
        <div className="lg:hidden">
          <PlannerResults />

          {/* Mobile Config Button */}
          <button
            onClick={() => setIsMobileConfigOpen(true)}
            className="fixed bottom-20 right-4 z-30 p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            }}
          >
            <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

          {/* Mobile Footer */}
          <PlannerMobileFooter />

          {/* Mobile Config Sheet */}
          <PlannerMobileConfigSheet
            athleteName={athlete.name}
            isOpen={isMobileConfigOpen}
            onClose={() => setIsMobileConfigOpen(false)}
          />
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>

      {/* Upgrade Modal for non-Pro users */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={handleUpgradeModalClose}
        athleteName={athlete.name}
      />
    </div>
  );
}
