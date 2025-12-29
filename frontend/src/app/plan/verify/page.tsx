'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetupStore } from '@/stores/setupStore';
import { useAuthStore } from '@/stores/authStore';
import { createAthlete } from '@/lib/api';

const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 4); // 4-16
const BELT_OPTIONS = ['white', 'gray', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black'];
const WEIGHT_OPTIONS = ['40', '45', '50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100', '110', '120', '130', '140', '150+'];

export default function VerifyPage() {
  const router = useRouter();
  const { isAuthenticated, getAccessToken } = useAuthStore();
  const {
    athleteName,
    age,
    belt,
    weight,
    location,
    isComplete,
    setAthleteInfo,
    setLocation,
    reset,
  } = useSetupStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if no data to verify
  useEffect(() => {
    if (!isComplete) {
      router.replace('/plan');
    }
  }, [isComplete, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isComplete || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Calculate birth year from age
      const currentYear = new Date().getFullYear();
      const birthYear = age ? currentYear - age : undefined;

      await createAthlete(token, {
        name: athleteName,
        beltRank: belt || undefined,
        birthYear,
        weight: weight ? parseInt(weight) : undefined,
      });

      // Clear store and redirect to My Season
      reset();
      router.push('/wishlist');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save athlete');
      setIsSubmitting(false);
    }
  };

  if (!isComplete) {
    return null;
  }

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto pt-16">
        <h2 className="text-2xl font-bold text-center mb-2">
          Confirm {athleteName}&apos;s Info
        </h2>
        <p className="text-center text-sm opacity-60 mb-8">
          We&apos;ll save this to your account
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="location" className="block text-sm font-medium mb-2">
              Location
            </label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Dallas, TX"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="athleteName" className="block text-sm font-medium mb-2">
              Athlete&apos;s Name
            </label>
            <input
              type="text"
              id="athleteName"
              value={athleteName}
              onChange={(e) => setAthleteInfo({ athleteName: e.target.value })}
              placeholder="Sofia"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="age" className="block text-sm font-medium mb-2">
                Age
              </label>
              <select
                id="age"
                value={age ?? ''}
                onChange={(e) => setAthleteInfo({ age: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-4 py-3 rounded-lg border border-white/20 focus:border-[#d4af37] focus:outline-none text-white cursor-pointer"
                style={{
                  backgroundColor: 'rgba(39, 39, 42, 0.95)',
                  colorScheme: 'dark',
                }}
              >
                <option value="" className="bg-zinc-800 text-zinc-400">--</option>
                {AGE_OPTIONS.map((a) => (
                  <option key={a} value={a} className="bg-zinc-800 text-white">{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="belt" className="block text-sm font-medium mb-2">
                Belt
              </label>
              <select
                id="belt"
                value={belt}
                onChange={(e) => setAthleteInfo({ belt: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-white/20 focus:border-[#d4af37] focus:outline-none capitalize text-white cursor-pointer"
                style={{
                  backgroundColor: 'rgba(39, 39, 42, 0.95)',
                  colorScheme: 'dark',
                }}
              >
                <option value="" className="bg-zinc-800 text-zinc-400">--</option>
                {BELT_OPTIONS.map((b) => (
                  <option key={b} value={b} className="bg-zinc-800 text-white capitalize">{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="weight" className="block text-sm font-medium mb-2">
                Weight (lbs)
              </label>
              <select
                id="weight"
                value={weight}
                onChange={(e) => setAthleteInfo({ weight: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-white/20 focus:border-[#d4af37] focus:outline-none text-white cursor-pointer"
                style={{
                  backgroundColor: 'rgba(39, 39, 42, 0.95)',
                  colorScheme: 'dark',
                }}
              >
                <option value="" className="bg-zinc-800 text-zinc-400">--</option>
                {WEIGHT_OPTIONS.map((w) => (
                  <option key={w} value={w} className="bg-zinc-800 text-white">{w}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!isComplete || isSubmitting}
            className="w-full py-4 rounded-full font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100"
            style={{
              background: isComplete && !isSubmitting
                ? 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)'
                : 'rgba(255,255,255,0.1)',
              color: isComplete && !isSubmitting ? '#000' : 'rgba(255,255,255,0.5)',
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save & Continue'}
          </button>
        </form>
      </div>
    </main>
  );
}
