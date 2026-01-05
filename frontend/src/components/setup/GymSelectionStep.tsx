'use client';

import { useSetupStore } from '@/stores/setupStore';
import { GymSearchAutocomplete } from '@/components/gym';

interface GymSelectionStepProps {
  onContinue: () => void;
}

export function GymSelectionStep({ onContinue }: GymSelectionStepProps) {
  const { selectedGym, setGym, skipGym } = useSetupStore();

  const handleSkip = () => {
    skipGym();
    onContinue();
  };

  const handleContinue = () => {
    onContinue();
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Select Your Gym</h2>
        <p className="text-gray-400 text-sm">
          Connect with your gym to see teammates at tournaments and track your academy&apos;s competition schedule.
        </p>
      </div>

      <div className="space-y-4">
        <GymSearchAutocomplete
          selectedGym={selectedGym}
          onSelect={setGym}
        />
      </div>

      <div className="flex flex-col gap-3">
        {selectedGym && (
          <button
            type="button"
            onClick={handleContinue}
            className="w-full py-4 rounded-full font-semibold transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)',
              color: '#000',
            }}
          >
            Continue
          </button>
        )}

        <button
          type="button"
          onClick={handleSkip}
          className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
