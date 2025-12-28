'use client';

import { useSetupStore } from '@/stores/setupStore';

interface PlannerHeaderProps {
  onSave: () => void;
  onEdit: () => void;
  isSaved?: boolean;
}

export function PlannerHeader({ onSave, onEdit, isSaved = false }: PlannerHeaderProps) {
  const { athleteName, age, belt, weight, location } = useSetupStore();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          {athleteName}&apos;s 2025 Season
        </h1>
        <p className="text-sm opacity-60 mt-1">
          <span className="capitalize">{belt} Belt</span>
          {' • '}
          {weight} lbs
          {' • '}
          Age {age}
        </p>
        <p className="text-sm opacity-60">
          Based near {location}
          <button
            onClick={onEdit}
            className="ml-2 text-[#d4af37] hover:underline"
          >
            Edit
          </button>
        </p>
      </div>
      <button
        onClick={onSave}
        className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-2"
      >
        {isSaved ? (
          <>
            <svg className="w-4 h-4 text-[#d4af37]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            View Saved
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Save
          </>
        )}
      </button>
    </div>
  );
}
