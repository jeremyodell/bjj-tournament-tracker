// frontend/src/components/planner/wizard/PlannerWizard.tsx
'use client';

import { useState } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useTournaments } from '@/hooks/useTournaments';
import { generatePlan, getHomeLocationFromAirport } from '@/lib/planGenerator';
import { BudgetStep } from './BudgetStep';
import { LocationStep } from './LocationStep';
import { MustGoStep } from './MustGoStep';

interface PlannerWizardProps {
  athleteName: string;
  onComplete: () => void;
}

type WizardStep = 'budget' | 'location' | 'must-go';

export function PlannerWizard({ athleteName, onComplete }: PlannerWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('budget');
  const { config, setPlan, markWizardComplete, setIsGenerating, isGenerating } = usePlannerStore();
  const { data: tournamentsData, hasNextPage, fetchNextPage, isFetchingNextPage } = useTournaments({});

  const steps: WizardStep[] = ['budget', 'location', 'must-go'];
  const currentStepIndex = steps.indexOf(currentStep);

  const handleGenerate = async () => {
    const homeLocation = getHomeLocationFromAirport(config.homeAirport);
    if (!homeLocation) return;

    setIsGenerating(true);

    try {
      // Fetch all pages
      let hasMore = hasNextPage;
      while (hasMore) {
        const result = await fetchNextPage();
        hasMore = result.hasNextPage ?? false;
      }

      const allTournaments = tournamentsData?.pages.flatMap(page => page.tournaments) ?? [];

      // Generate plan with setTimeout for UI responsiveness
      setTimeout(() => {
        try {
          const plan = generatePlan({ config, allTournaments, homeLocation });
          setPlan(plan);
          markWizardComplete();
          onComplete();
        } finally {
          setIsGenerating(false);
        }
      }, 100);
    } catch {
      setIsGenerating(false);
    }
  };

  const showLoadingOverlay = isGenerating || isFetchingNextPage;

  return (
    <div className="min-h-[60vh] flex flex-col">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index <= currentStepIndex
                    ? 'bg-[#d4af37] text-black'
                    : 'bg-white/10 text-white/40'
                }`}
              >
                {index < currentStepIndex ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 transition-colors ${
                    index < currentStepIndex ? 'bg-[#d4af37]' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm opacity-60">
          Setting up {athleteName}&apos;s {new Date().getFullYear()} season
        </p>
      </div>

      {/* Step Content */}
      <div className="flex-1">
        {currentStep === 'budget' && (
          <BudgetStep onNext={() => setCurrentStep('location')} />
        )}
        {currentStep === 'location' && (
          <LocationStep
            onNext={() => setCurrentStep('must-go')}
            onBack={() => setCurrentStep('budget')}
          />
        )}
        {currentStep === 'must-go' && (
          <MustGoStep
            onNext={handleGenerate}
            onBack={() => setCurrentStep('location')}
          />
        )}
      </div>

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="relative mb-4 mx-auto w-16 h-16">
              <div className="w-16 h-16 border-4 border-[#d4af37]/20 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-lg font-medium">Generating your season plan...</p>
            <p className="text-sm opacity-60">Analyzing tournaments and travel costs</p>
          </div>
        </div>
      )}
    </div>
  );
}
