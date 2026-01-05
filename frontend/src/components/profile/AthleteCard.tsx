// frontend/src/components/profile/AthleteCard.tsx
'use client';

import { useState } from 'react';
import type { Athlete, Gym } from '@/lib/api';
import { useAthleteMutations } from '@/hooks/useAthletes';
import { GymSearchAutocomplete } from '@/components/gym';

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

// Parse gymSourceId into Gym object (format: "ORG#externalId")
function parseGymFromAthlete(athlete: Athlete): Gym | null {
  if (!athlete.gymSourceId || !athlete.gymName) return null;
  const [org, externalId] = athlete.gymSourceId.split('#');
  if (!org || !externalId) return null;
  return {
    org: org as 'JJWL' | 'IBJJF',
    externalId,
    name: athlete.gymName,
  };
}

export function AthleteCard({ athlete, onEdit }: AthleteCardProps) {
  const { deleteMutation, updateMutation } = useAthleteMutations();
  const [isEditingGym, setIsEditingGym] = useState(false);

  const beltColor = athlete.beltRank
    ? beltColors[athlete.beltRank.toLowerCase()] || '#666'
    : '#666';

  // Calculate age from birth year
  const currentYear = new Date().getFullYear();
  const age = athlete.birthYear ? currentYear - athlete.birthYear : null;

  // Parse current gym from athlete
  const currentGym = parseGymFromAthlete(athlete);

  // Handle gym selection
  const handleGymSelect = (gym: Gym | null) => {
    if (gym) {
      const gymSourceId = `${gym.org}#${gym.externalId}`;
      updateMutation.mutate({
        athleteId: athlete.athleteId,
        input: {
          gymSourceId,
          gymName: gym.name,
        },
      });
      setIsEditingGym(false);
    }
  };

  return (
    <div
      className="p-4 rounded-xl border"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Main athlete info row */}
      <div className="flex items-center justify-between gap-4">
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

      {/* My Gym Section */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium opacity-70">My Gym</h4>
          {currentGym && !isEditingGym && (
            <button
              onClick={() => setIsEditingGym(true)}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Change
            </button>
          )}
          {isEditingGym && (
            <button
              onClick={() => setIsEditingGym(false)}
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Gym display or search */}
        {isEditingGym || !currentGym ? (
          <GymSearchAutocomplete
            selectedGym={null}
            onSelect={handleGymSelect}
          />
        ) : (
          <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
            <OrgBadge org={currentGym.org} />
            <span className="text-white font-medium">{currentGym.name}</span>
            {updateMutation.isPending && (
              <span className="text-sm text-gray-400 ml-auto">Saving...</span>
            )}
          </div>
        )}

        {!currentGym && !isEditingGym && (
          <p className="text-sm text-gray-500 mt-2">
            No gym selected. Search to add your gym.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Badge component displaying organization with themed colors.
 * JJWL = cyan, IBJJF = magenta (fuchsia)
 */
function OrgBadge({ org }: { org: Gym['org'] }) {
  const isJJWL = org === 'JJWL';

  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded ${
        isJJWL
          ? 'bg-cyan-500/20 text-cyan-400'
          : 'bg-fuchsia-500/20 text-fuchsia-400'
      }`}
    >
      {org}
    </span>
  );
}
