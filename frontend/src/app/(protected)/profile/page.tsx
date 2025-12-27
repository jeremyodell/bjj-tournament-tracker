// frontend/src/app/(protected)/profile/page.tsx
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAthletes } from '@/hooks/useAthletes';
import { AthleteCard } from '@/components/profile/AthleteCard';
import { AddAthleteModal } from '@/components/profile/AddAthleteModal';
import type { Athlete } from '@/lib/api';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { data, isLoading, error } = useAthletes();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);

  const handleAddAthlete = () => {
    setEditingAthlete(null);
    setIsModalOpen(true);
  };

  const handleEditAthlete = (athlete: Athlete) => {
    setEditingAthlete(athlete);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAthlete(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Profile</h1>
        {user && (
          <p className="text-lg opacity-60">{user.email}</p>
        )}
      </div>

      {/* Athletes Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">My Athletes</h2>
          <button
            onClick={handleAddAthlete}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
              color: '#000',
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Athlete
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            Error loading athletes. Please try again.
          </div>
        )}

        {/* Athletes List */}
        {!isLoading && !error && data && (
          <>
            {data.athletes.length === 0 ? (
              <div
                className="p-8 rounded-xl border text-center"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <div className="mb-4">
                  <svg
                    className="w-16 h-16 mx-auto opacity-30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <p className="text-xl opacity-60 mb-4">No athletes added yet</p>
                <p className="text-sm opacity-40 mb-6">
                  Add your first athlete to start planning their competition season
                </p>
                <button
                  onClick={handleAddAthlete}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
                    color: '#000',
                  }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Your First Athlete
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {data.athletes.map((athlete) => (
                  <AthleteCard
                    key={athlete.athleteId}
                    athlete={athlete}
                    onEdit={handleEditAthlete}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Info Section */}
      {data && data.athletes.length > 0 && (
        <div
          className="p-4 rounded-xl border text-center"
          style={{
            background: 'rgba(212, 175, 55, 0.1)',
            borderColor: 'rgba(212, 175, 55, 0.3)',
          }}
        >
          <p className="opacity-80">
            Click &quot;View Season Plan&quot; on any athlete to start planning their competition season!
          </p>
        </div>
      )}

      {/* Add/Edit Athlete Modal */}
      <AddAthleteModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingAthlete={editingAthlete}
      />
    </div>
  );
}
