'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useAuthStore } from '@/stores/authStore';
import { useSetupStore } from '@/stores/setupStore';
import { useOnboarding } from '@/hooks/useOnboarding';
import { RoleSelectionStep } from '@/components/onboarding/RoleSelectionStep';
import { AthleteFormStep } from '@/components/onboarding/AthleteFormStep';

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const {
    role,
    athletes,
    currentStep,
    setCurrentStep,
    isOnboardingComplete,
    isAthleteComplete,
    addAthlete,
    reset,
  } = useOnboardingStore();
  const loadFromAthlete = useSetupStore((state) => state.loadFromAthlete);

  const { mutate: submitOnboarding, isPending, isError, error } = useOnboarding();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/onboarding');
    }
  }, [isAuthenticated, router]);

  // Reset onboarding state on mount
  useEffect(() => {
    reset();
  }, [reset]);

  const handleNext = () => {
    if (!role) return;

    // If athlete role and form is complete, go to review
    if (role === 'athlete' && isAthleteComplete(athletes[0])) {
      setCurrentStep('review');
      return;
    }

    // For parent role, allow adding more athletes
    if (role === 'parent') {
      const currentAthlete = athletes[athletes.length - 1];
      if (currentAthlete && isAthleteComplete(currentAthlete)) {
        // Add new athlete slot or go to review
        if (athletes.length < 4) {
          addAthlete({
            name: '',
            birthdate: '',
            gender: '',
            beltRank: '',
            weight: null,
          });
        } else {
          setCurrentStep('review');
        }
      }
    }
  };

  const handleSubmit = () => {
    if (!isOnboardingComplete()) return;

    // Type-narrow athletes to match API requirements
    // isOnboardingComplete() already validates all fields are present
    const validatedAthletes = athletes.map((athlete) => ({
      ...athlete,
      gender: athlete.gender as 'Male' | 'Female',
      weight: athlete.weight as number,
    }));

    submitOnboarding(
      { role: role!, athletes: validatedAthletes },
      {
        onSuccess: (result) => {
          // Redirect based on number of athletes created
          if (result.athletes.length === 0) {
            router.push('/');
          } else if (result.athletes.length === 1) {
            // Auto-load into setupStore and go to wishlist
            loadFromAthlete(result.athletes[0]);
            router.push('/wishlist');
          } else {
            // Go to select page for multiple athletes
            router.push('/plan/select');
          }
        },
      }
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Role selection step
  if (currentStep === 'role') {
    return <RoleSelectionStep />;
  }

  // Athlete form step
  if (currentStep === 'athlete-form') {
    const currentAthleteIndex = athletes.length - 1;

    return (
      <div>
        <AthleteFormStep athleteIndex={currentAthleteIndex} />

        <div className="max-w-2xl mx-auto p-6 flex gap-4">
          <button
            onClick={() => setCurrentStep('role')}
            className="px-6 py-2 border border-white/20 rounded-md bg-white/5 text-white backdrop-blur-sm hover:bg-white/10 transition-all"
          >
            Back
          </button>

          {role === 'parent' && athletes.length > 0 && (
            <button
              onClick={() => setCurrentStep('review')}
              className="px-6 py-2 border border-white/20 rounded-md bg-white/5 text-white backdrop-blur-sm hover:bg-white/10 transition-all"
            >
              Skip to Review
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={!isAthleteComplete(athletes[currentAthleteIndex])}
            className="px-6 py-2 rounded-md ml-auto font-bold uppercase tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              fontFamily: 'var(--font-mono-display)',
              backgroundColor: isAthleteComplete(athletes[currentAthleteIndex])
                ? 'var(--scoreboard-yellow)'
                : 'rgba(255, 255, 255, 0.1)',
              color: isAthleteComplete(athletes[currentAthleteIndex]) ? '#000' : '#fff',
              boxShadow: isAthleteComplete(athletes[currentAthleteIndex])
                ? '0 0 30px rgba(255, 215, 0, 0.4)'
                : 'none',
            }}
          >
            {role === 'parent' && athletes.length < 4 ? 'Add Another' : 'Next'}
          </button>
        </div>
      </div>
    );
  }

  // Review step
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
          REVIEW
        </span>
      </div>

      {/* Progress indicator */}
      <div className="flex gap-2 mb-8 justify-center">
        <div className="w-8 h-1 bg-white/20" />
        <div className="w-8 h-1 bg-white/20" />
        <div className="w-8 h-1 bg-[var(--scoreboard-yellow)]" />
      </div>

      <h2
        className="text-2xl font-bold mb-6 uppercase tracking-wide text-white text-center"
        style={{ fontFamily: 'var(--font-mono-display)' }}
      >
        Review Your Information
      </h2>

      <div className="space-y-4 mb-6">
        {athletes.map((athlete, index) => (
          <div
            key={index}
            className="p-5 glass-card rounded-xl hover:bg-white/5 transition-all"
          >
            <h3
              className="font-semibold mb-3 text-[var(--scoreboard-yellow)] uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-mono-display)' }}
            >
              {role === 'athlete' ? 'Your Profile' : `Athlete ${index + 1}`}
            </h3>
            <div className="space-y-2 text-sm text-white/90">
              <p>
                <strong className="text-white/80">Name:</strong> {athlete.name}
              </p>
              <p>
                <strong className="text-white/80">Birthdate:</strong> {athlete.birthdate}
              </p>
              <p>
                <strong className="text-white/80">Gender:</strong> {athlete.gender}
              </p>
              <p>
                <strong className="text-white/80">Belt:</strong> {athlete.beltRank}
              </p>
              <p>
                <strong className="text-white/80">Weight:</strong> {athlete.weight} lbs
              </p>
              <p>
                <strong className="text-white/80">Gym:</strong>{' '}
                {athlete.masterGymName || athlete.customGymName || 'N/A'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isError && (
        <div className="text-[var(--destructive)] mb-4 p-3 glass-card rounded-lg border border-[var(--destructive)]/30">
          Error: {error?.message}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => setCurrentStep('athlete-form')}
          className="px-6 py-2 border border-white/20 rounded-md bg-white/5 text-white backdrop-blur-sm hover:bg-white/10 transition-all"
        >
          Back
        </button>

        <button
          onClick={handleSubmit}
          disabled={!isOnboardingComplete() || isPending}
          className="px-6 py-2 rounded-md ml-auto font-bold uppercase tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'var(--font-mono-display)',
            backgroundColor:
              isOnboardingComplete() && !isPending
                ? 'var(--scoreboard-yellow)'
                : 'rgba(255, 255, 255, 0.1)',
            color: isOnboardingComplete() && !isPending ? '#000' : '#fff',
            boxShadow:
              isOnboardingComplete() && !isPending
                ? '0 0 30px rgba(255, 215, 0, 0.4)'
                : 'none',
          }}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span>SUBMITTING</span>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"
                  style={{ animationDelay: '300ms' }}
                />
              </span>
            </span>
          ) : (
            'Complete Setup'
          )}
        </button>
      </div>
    </div>
  );
}
