// frontend/src/components/profile/AddAthleteModal.tsx
'use client';

import { useState } from 'react';
import type { Athlete, CreateAthleteInput } from '@/lib/api';
import { useAthleteMutations } from '@/hooks/useAthletes';

interface AddAthleteModalContentProps {
  onClose: () => void;
  editingAthlete?: Athlete | null;
}

const beltRanks = ['White', 'Blue', 'Purple', 'Brown', 'Black'];

// Helper to extract weight from weightClass string
function extractWeight(weightClass: string | null): string {
  if (!weightClass) return '';
  const match = weightClass.match(/(\d+)/);
  return match ? match[1] : '';
}

// Inner component that handles the form state
function AddAthleteModalContent({ onClose, editingAthlete }: AddAthleteModalContentProps) {
  const { createMutation, updateMutation } = useAthleteMutations();

  // Initialize state from editingAthlete (computed once when component mounts)
  const [name, setName] = useState(editingAthlete?.name || '');
  const [beltRank, setBeltRank] = useState(editingAthlete?.beltRank || '');
  const [birthYear, setBirthYear] = useState(editingAthlete?.birthYear?.toString() || '');
  const [weight, setWeight] = useState(extractWeight(editingAthlete?.weightClass || null));
  const [error, setError] = useState('');

  const isEditing = !!editingAthlete;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const input: CreateAthleteInput = {
      name: name.trim(),
      beltRank: beltRank || undefined,
      birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
      weight: weight ? parseInt(weight, 10) : undefined,
    };

    try {
      if (isEditing && editingAthlete) {
        await updateMutation.mutateAsync({
          athleteId: editingAthlete.athleteId,
          input,
        });
      } else {
        await createMutation.mutateAsync(input);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save athlete');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 p-6 rounded-2xl border"
        style={{
          background: 'rgba(20, 20, 20, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-bold mb-6">
          {isEditing ? 'Edit Athlete' : 'Add Athlete'}
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
              placeholder="Enter athlete name"
              required
            />
          </div>

          {/* Belt rank field */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">
              Belt Rank
            </label>
            <select
              value={beltRank}
              onChange={(e) => setBeltRank(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors cursor-pointer text-white"
              style={{
                backgroundColor: 'rgba(39, 39, 42, 0.95)',
                colorScheme: 'dark',
              }}
            >
              <option value="" className="bg-zinc-800 text-zinc-400">Select belt rank</option>
              {beltRanks.map((belt) => (
                <option key={belt} value={belt.toLowerCase()} className="bg-zinc-800 text-white">
                  {belt}
                </option>
              ))}
            </select>
          </div>

          {/* Birth year field */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">
              Birth Year
            </label>
            <input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
              placeholder="e.g., 2005"
              min="1950"
              max={new Date().getFullYear()}
            />
          </div>

          {/* Weight field */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">
              Weight (lbs)
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
              placeholder="e.g., 155"
              min="50"
              max="400"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
              color: '#000',
            }}
          >
            {isPending
              ? (isEditing ? 'Saving...' : 'Adding...')
              : (isEditing ? 'Save Changes' : 'Add Athlete')
            }
          </button>
        </form>
      </div>
    </div>
  );
}

// Props for the outer wrapper component
interface AddAthleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAthlete?: Athlete | null;
}

// Outer component that handles visibility and forces remount on open
export function AddAthleteModal({ isOpen, onClose, editingAthlete }: AddAthleteModalProps) {
  if (!isOpen) return null;

  // Use key to force remount when editingAthlete changes, resetting all form state
  const key = editingAthlete?.athleteId || 'new';

  return (
    <AddAthleteModalContent
      key={key}
      onClose={onClose}
      editingAthlete={editingAthlete}
    />
  );
}
