// frontend/src/components/planner/wizard/BudgetStep.tsx
'use client';

import { usePlannerStore } from '@/stores/plannerStore';
import { Input } from '@/components/ui/input';

interface BudgetStepProps {
  onNext: () => void;
}

export function BudgetStep({ onNext }: BudgetStepProps) {
  const { config, updateConfig } = usePlannerStore();
  const availableBudget = config.totalBudget - config.reserveBudget;

  const isValid = config.totalBudget > 0 && config.reserveBudget >= 0 && availableBudget > 0;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">What&apos;s your tournament budget?</h2>
        <p className="text-sm opacity-60">This helps us find tournaments that fit your spending plan</p>
      </div>

      <div className="space-y-6 max-w-sm mx-auto">
        {/* Total Budget */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Total Budget for the Year</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-60">$</span>
            <Input
              type="number"
              value={config.totalBudget}
              onChange={(e) => updateConfig({ totalBudget: parseInt(e.target.value) || 0 })}
              className="pl-8 text-2xl h-14 bg-white/5 border-white/10"
              min={0}
            />
          </div>
        </div>

        {/* Reserve Budget */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Reserve for Unannounced Events</label>
          <p className="text-xs opacity-50">Set aside for surprise tournaments (JJWL often announces late)</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-60">$</span>
            <Input
              type="number"
              value={config.reserveBudget}
              onChange={(e) => updateConfig({ reserveBudget: parseInt(e.target.value) || 0 })}
              className="pl-8 text-xl h-12 bg-white/5 border-white/10"
              min={0}
              max={config.totalBudget}
            />
          </div>
        </div>

        {/* Available Budget Display */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-lg"
          style={{
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
          }}
        >
          <span className="font-medium" style={{ color: '#d4af37' }}>Available for planning:</span>
          <span className="text-2xl font-bold" style={{ color: '#d4af37' }}>
            ${availableBudget.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Continue Button */}
      <div className="pt-4">
        <button
          onClick={onNext}
          disabled={!isValid}
          className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: isValid
              ? 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)'
              : 'rgba(255,255,255,0.1)',
            color: isValid ? '#000' : 'rgba(255,255,255,0.5)',
          }}
        >
          Continue
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
