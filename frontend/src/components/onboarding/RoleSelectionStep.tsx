'use client';

import { useOnboardingStore } from '@/stores/onboardingStore';

export function RoleSelectionStep() {
  const setRole = useOnboardingStore((state) => state.setRole);

  return (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in-up">
      {/* LED Status Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div
          className="w-2 h-2 rounded-full bg-[var(--led-green)] animate-pulse shadow-[0_0_8px_var(--led-green)]"
          aria-hidden="true"
        />
        <span
          className="text-xs font-bold tracking-widest uppercase text-white/80"
          style={{ fontFamily: 'var(--font-mono-display)' }}
        >
          SETUP
        </span>
      </div>

      {/* Heading with gradient effect */}
      <div className="text-center mb-8">
        <h1
          className="text-3xl font-bold mb-2 uppercase tracking-wide bg-gradient-to-r from-[var(--scoreboard-yellow)] to-white bg-clip-text text-transparent"
          style={{ fontFamily: 'var(--font-mono-display)' }}
        >
          Welcome to BJJ Tournament Tracker
        </h1>
        <p className="text-white/70" style={{ fontFamily: 'var(--font-body)' }}>
          Let's get started by setting up your profile
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex gap-2 mb-8 justify-center">
        <div className="w-8 h-1 bg-[var(--scoreboard-yellow)]" />
        <div className="w-8 h-1 bg-white/20" />
        <div className="w-8 h-1 bg-white/20" />
      </div>

      <div className="space-y-4">
        <div
          className="text-lg font-semibold mb-4 uppercase tracking-wide text-white/90"
          style={{ fontFamily: 'var(--font-mono-display)' }}
        >
          I am a...
        </div>

        <button
          onClick={() => setRole('athlete')}
          className="w-full p-6 border-2 border-white/20 rounded-xl glass-card hover:border-[var(--accent-ibjjf)] hover:bg-white/5 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] hover:scale-[1.01] transition-all duration-200 text-left group"
        >
          <div className="flex items-start">
            <div className="flex-1">
              <div
                className="text-xl font-semibold mb-2 text-white group-hover:text-[var(--accent-ibjjf)] transition-colors"
                style={{ fontFamily: 'var(--font-mono-display)' }}
              >
                ATHLETE
              </div>
              <p className="text-white/70" style={{ fontFamily: 'var(--font-body)' }}>
                I compete in BJJ tournaments and want to track my season
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setRole('parent')}
          className="w-full p-6 border-2 border-white/20 rounded-xl glass-card hover:border-[var(--accent-ibjjf)] hover:bg-white/5 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] hover:scale-[1.01] transition-all duration-200 text-left group"
        >
          <div className="flex items-start">
            <div className="flex-1">
              <div
                className="text-xl font-semibold mb-2 text-white group-hover:text-[var(--accent-ibjjf)] transition-colors"
                style={{ fontFamily: 'var(--font-mono-display)' }}
              >
                PARENT / COACH
              </div>
              <p className="text-white/70" style={{ fontFamily: 'var(--font-body)' }}>
                I manage tournament schedules for my kids or students (up to 4 athletes)
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
