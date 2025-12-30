// frontend/src/components/planner/wizard/LocationStep.tsx
'use client';

import { useMemo } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { Input } from '@/components/ui/input';
import { getHomeLocationFromAirport } from '@/lib/planGenerator';

interface LocationStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function LocationStep({ onNext, onBack }: LocationStepProps) {
  const { config, updateConfig } = usePlannerStore();

  const airportValidation = useMemo(() => {
    if (!config.homeAirport) {
      return { isValid: false, message: '' };
    }
    const location = getHomeLocationFromAirport(config.homeAirport);
    if (location) {
      return { isValid: true, message: 'Valid airport code' };
    }
    return { isValid: false, message: 'Airport code not recognized. Try a major airport like DFW, LAX, or JFK.' };
  }, [config.homeAirport]);

  const handleAirportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().slice(0, 4);
    updateConfig({ homeAirport: value });
  };

  const sliderPercentage = ((config.maxDriveHours - 1) / (12 - 1)) * 100;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Where are you traveling from?</h2>
        <p className="text-sm opacity-60">We&apos;ll calculate travel costs from your home airport</p>
      </div>

      <div className="space-y-6 max-w-sm mx-auto">
        {/* Home Airport */}
        <div className="space-y-2">
          <label htmlFor="home-airport" className="text-sm font-medium">Home Airport Code</label>
          <Input
            id="home-airport"
            type="text"
            value={config.homeAirport}
            onChange={handleAirportChange}
            placeholder="DFW"
            className="text-3xl h-16 text-center font-mono tracking-widest uppercase bg-white/5 border-white/10"
            maxLength={4}
          />
          {config.homeAirport && (
            <p
              className="text-sm text-center"
              style={{ color: airportValidation.isValid ? '#22c55e' : '#ef4444' }}
            >
              {airportValidation.message}
            </p>
          )}
        </div>

        {/* Max Drive Hours */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label htmlFor="max-drive-hours" className="text-sm font-medium">Maximum Driving Distance</label>
            <span
              className="text-lg font-bold"
              style={{ color: '#d4af37' }}
            >
              {config.maxDriveHours} {config.maxDriveHours === 1 ? 'hour' : 'hours'}
            </span>
          </div>
          <div className="relative">
            <input
              id="max-drive-hours"
              type="range"
              min={1}
              max={12}
              step={1}
              value={config.maxDriveHours}
              onChange={(e) => updateConfig({ maxDriveHours: parseInt(e.target.value) })}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #d4af37 0%, #d4af37 ${sliderPercentage}%, rgba(255,255,255,0.1) ${sliderPercentage}%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
          </div>
          <p className="text-xs opacity-50 text-center">
            Tournaments within this drive time will show lower travel costs
          </p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="pt-4 flex gap-4 max-w-sm mx-auto">
        <button
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold transition-all duration-300 hover:bg-white/10"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!airportValidation.isValid}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: airportValidation.isValid
              ? 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)'
              : 'rgba(255,255,255,0.1)',
            color: airportValidation.isValid ? '#000' : 'rgba(255,255,255,0.5)',
          }}
        >
          Continue
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
