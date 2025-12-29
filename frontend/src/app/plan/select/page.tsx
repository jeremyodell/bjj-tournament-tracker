'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetupStore } from '@/stores/setupStore';
import { useAuthStore } from '@/stores/authStore';
import { fetchAthletes, type Athlete } from '@/lib/api';
import { Plus } from 'lucide-react';

export default function SelectPage() {
  const router = useRouter();
  const { getAccessToken } = useAuthStore();
  const { loadFromAthlete } = useSetupStore();

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAthletes() {
      try {
        const token = await getAccessToken();
        if (!token) {
          router.replace('/login');
          return;
        }

        const data = await fetchAthletes(token);
        setAthletes(data.athletes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load athletes');
      } finally {
        setIsLoading(false);
      }
    }

    loadAthletes();
  }, [getAccessToken, router]);

  const handleSelectAthlete = (athlete: Athlete) => {
    loadFromAthlete(athlete);
    router.push('/wishlist');
  };

  const handleAddNewAthlete = () => {
    router.push('/plan?new=true');
  };

  const calculateAge = (birthYear: number | null): string => {
    if (!birthYear) return '--';
    const currentYear = new Date().getFullYear();
    return String(currentYear - birthYear);
  };

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto pt-16 text-center">
          <p className="opacity-60">Loading athletes...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto pt-16 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="max-w-lg mx-auto pt-16">
        <h2 className="text-2xl font-bold text-center mb-8">
          Who&apos;s competing?
        </h2>

        <div className="space-y-4">
          {athletes.map((athlete) => (
            <button
              key={athlete.athleteId}
              onClick={() => handleSelectAthlete(athlete)}
              className="w-full p-4 rounded-lg bg-white/5 border border-white/10 hover:border-[#d4af37] hover:bg-white/10 transition-all text-left"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-lg">{athlete.name}</h3>
                  <div className="flex gap-3 mt-1 text-sm opacity-60">
                    {athlete.beltRank && (
                      <span className="capitalize">{athlete.beltRank} belt</span>
                    )}
                    {athlete.weightClass && (
                      <span>{athlete.weightClass} lbs</span>
                    )}
                    {athlete.birthYear && (
                      <span>Age {calculateAge(athlete.birthYear)}</span>
                    )}
                  </div>
                </div>
                <div className="text-[#d4af37]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleAddNewAthlete}
          className="w-full mt-6 p-4 rounded-lg border-2 border-dashed border-white/20 hover:border-[#d4af37] hover:bg-white/5 transition-all flex items-center justify-center gap-2 opacity-80 hover:opacity-100"
        >
          <Plus className="w-5 h-5" />
          Add New Athlete
        </button>
      </div>
    </main>
  );
}
