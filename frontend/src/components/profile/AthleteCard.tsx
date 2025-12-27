// frontend/src/components/profile/AthleteCard.tsx
'use client';

import Link from 'next/link';
import type { Athlete } from '@/lib/api';
import { useAthleteMutations } from '@/hooks/useAthletes';

interface AthleteCardProps {
  athlete: Athlete;
  onEdit: (athlete: Athlete) => void;
}

// Belt rank colors for visual indicator
const beltColors: Record<string, string> = {
  white: '#FFFFFF',
  blue: '#0066CC',
  purple: '#6B3FA0',
  brown: '#8B4513',
  black: '#1A1A1A',
};

export function AthleteCard({ athlete, onEdit }: AthleteCardProps) {
  const { deleteMutation } = useAthleteMutations();

  const beltColor = athlete.beltRank
    ? beltColors[athlete.beltRank.toLowerCase()] || '#666'
    : '#666';

  // Calculate age from birth year
  const currentYear = new Date().getFullYear();
  const age = athlete.birthYear ? currentYear - athlete.birthYear : null;

  return (
    <div
      className="p-4 rounded-xl border flex items-center justify-between gap-4"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="flex items-center gap-4">
        {/* Belt indicator */}
        <div
          className="w-3 h-12 rounded-full"
          style={{
            background: beltColor,
            boxShadow: athlete.beltRank?.toLowerCase() === 'white'
              ? 'inset 0 0 0 1px rgba(255,255,255,0.3)'
              : 'none',
          }}
        />

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg">{athlete.name}</h3>
          <div className="flex items-center gap-3 text-sm opacity-60">
            {athlete.beltRank && (
              <span className="capitalize">{athlete.beltRank} Belt</span>
            )}
            {age && <span>{age} years old</span>}
            {athlete.weightClass && <span>{athlete.weightClass}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* View Season Plan button */}
        <Link
          href={`/planner/${athlete.athleteId}`}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            color: '#000',
          }}
        >
          View Season Plan
        </Link>

        {/* Edit button */}
        <button
          onClick={() => onEdit(athlete)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Edit athlete"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          onClick={() => {
            if (confirm(`Are you sure you want to delete ${athlete.name}?`)) {
              deleteMutation.mutate(athlete.athleteId);
            }
          }}
          disabled={deleteMutation.isPending}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-red-400"
          title="Delete athlete"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
