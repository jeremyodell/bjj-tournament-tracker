'use client';

import { useState } from 'react';
import { useOnboardingStore, type OnboardingAthleteData } from '@/stores/onboardingStore';
import { GymSearchWithOther } from './GymSearchWithOther';

const BELT_RANKS = [
  'White',
  'Grey',
  'Yellow',
  'Orange',
  'Green',
  'Blue',
  'Purple',
  'Brown',
  'Black',
];

interface AthleteFormStepProps {
  athleteIndex: number;
}

export function AthleteFormStep({ athleteIndex }: AthleteFormStepProps) {
  const { athletes, updateAthlete, role, canAddAthlete } = useOnboardingStore();
  const athlete = athletes[athleteIndex] || {
    name: '',
    birthdate: '',
    gender: '',
    beltRank: '',
    weight: null,
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof OnboardingAthleteData, value: any) => {
    updateAthlete(athleteIndex, { [field]: value });
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!athlete.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!athlete.birthdate) {
      newErrors.birthdate = 'Birthdate is required';
    }

    if (!athlete.gender) {
      newErrors.gender = 'Gender is required';
    }

    if (!athlete.beltRank) {
      newErrors.beltRank = 'Belt rank is required';
    }

    if (!athlete.weight || athlete.weight <= 0) {
      newErrors.weight = 'Weight must be greater than 0';
    }

    if (!athlete.masterGymId && !athlete.customGymName) {
      newErrors.gym = 'Please select a gym or enter a custom gym name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in-up">
      {/* LED Status Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div
          className="w-2 h-2 rounded-full bg-[var(--led-amber)] animate-pulse shadow-[0_0_8px_var(--led-amber)]"
          aria-hidden="true"
        />
        <span
          className="text-xs font-bold tracking-widest uppercase text-white/80"
          style={{ fontFamily: 'var(--font-mono-display)' }}
        >
          DATA ENTRY
        </span>
      </div>

      {/* Progress indicator */}
      <div className="flex gap-2 mb-8 justify-center">
        <div className="w-8 h-1 bg-white/20" />
        <div className="w-8 h-1 bg-[var(--scoreboard-yellow)]" />
        <div className="w-8 h-1 bg-white/20" />
      </div>

      <div className="mb-6">
        <h2
          className="text-2xl font-bold mb-2 uppercase tracking-wide text-white"
          style={{ fontFamily: 'var(--font-mono-display)' }}
        >
          {role === 'athlete' ? 'Your Information' : `Athlete ${athleteIndex + 1}`}
        </h2>
        <p className="text-white/70" style={{ fontFamily: 'var(--font-body)' }}>
          Please fill in all required fields
        </p>
      </div>

      <div className="space-y-6 glass-card rounded-xl p-6">
        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-xs font-semibold mb-2 uppercase tracking-wide text-white/80"
            style={{ fontFamily: 'var(--font-mono-display)' }}
          >
            Name *
          </label>
          <input
            type="text"
            id="name"
            value={athlete.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 placeholder:text-white/40 ${
              errors.name
                ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
                : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)]'
            }`}
            placeholder="Enter full name"
          />
          {errors.name && (
            <p className="text-[var(--destructive)] text-sm mt-1 font-medium">
              {errors.name}
            </p>
          )}
        </div>

        {/* Birthdate */}
        <div>
          <label
            htmlFor="birthdate"
            className="block text-xs font-semibold mb-2 uppercase tracking-wide text-white/80"
            style={{ fontFamily: 'var(--font-mono-display)' }}
          >
            Birthdate *
          </label>
          <input
            type="date"
            id="birthdate"
            value={athlete.birthdate}
            onChange={(e) => handleChange('birthdate', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 [color-scheme:dark] ${
              errors.birthdate
                ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
                : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)]'
            }`}
          />
          {errors.birthdate && (
            <p className="text-[var(--destructive)] text-sm mt-1 font-medium">
              {errors.birthdate}
            </p>
          )}
        </div>

        {/* Gender */}
        <div>
          <label
            htmlFor="gender"
            className="block text-xs font-semibold mb-2 uppercase tracking-wide text-white/80"
            style={{ fontFamily: 'var(--font-mono-display)' }}
          >
            Gender *
          </label>
          <select
            id="gender"
            value={athlete.gender}
            onChange={(e) => handleChange('gender', e.target.value as 'Male' | 'Female')}
            className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 [color-scheme:dark] ${
              errors.gender
                ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
                : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)]'
            }`}
          >
            <option value="" className="bg-[#0A1128] text-white">
              Select gender
            </option>
            <option value="Male" className="bg-[#0A1128] text-white">
              Male
            </option>
            <option value="Female" className="bg-[#0A1128] text-white">
              Female
            </option>
          </select>
          {errors.gender && (
            <p className="text-[var(--destructive)] text-sm mt-1 font-medium">
              {errors.gender}
            </p>
          )}
        </div>

        {/* Belt Rank */}
        <div>
          <label
            htmlFor="beltRank"
            className="block text-xs font-semibold mb-2 uppercase tracking-wide text-white/80"
            style={{ fontFamily: 'var(--font-mono-display)' }}
          >
            Belt Rank *
          </label>
          <select
            id="beltRank"
            value={athlete.beltRank}
            onChange={(e) => handleChange('beltRank', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 [color-scheme:dark] ${
              errors.beltRank
                ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
                : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)]'
            }`}
          >
            <option value="" className="bg-[#0A1128] text-white">
              Select belt rank
            </option>
            {BELT_RANKS.map((belt) => (
              <option key={belt} value={belt} className="bg-[#0A1128] text-white">
                {belt}
              </option>
            ))}
          </select>
          {errors.beltRank && (
            <p className="text-[var(--destructive)] text-sm mt-1 font-medium">
              {errors.beltRank}
            </p>
          )}
        </div>

        {/* Weight */}
        <div>
          <label
            htmlFor="weight"
            className="block text-xs font-semibold mb-2 uppercase tracking-wide text-white/80"
            style={{ fontFamily: 'var(--font-mono-display)' }}
          >
            Weight (lbs) *
          </label>
          <input
            type="number"
            id="weight"
            value={athlete.weight || ''}
            onChange={(e) => handleChange('weight', parseFloat(e.target.value) || null)}
            className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 placeholder:text-white/40 ${
              errors.weight
                ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
                : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)]'
            }`}
            placeholder="Enter weight in pounds"
            min="0"
            step="0.1"
          />
          {errors.weight && (
            <p className="text-[var(--destructive)] text-sm mt-1 font-medium">
              {errors.weight}
            </p>
          )}
        </div>

        {/* Gym Selection */}
        <div>
          <label
            className="block text-xs font-semibold mb-2 uppercase tracking-wide text-white/80"
            style={{ fontFamily: 'var(--font-mono-display)' }}
          >
            Gym *
          </label>
          <GymSearchWithOther
            athleteIndex={athleteIndex}
            value={{
              masterGymId: athlete.masterGymId,
              masterGymName: athlete.masterGymName,
              customGymName: athlete.customGymName,
            }}
            onChange={(gymData) => {
              updateAthlete(athleteIndex, gymData);
              if (errors.gym) {
                setErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.gym;
                  return newErrors;
                });
              }
            }}
          />
          {errors.gym && (
            <p className="text-[var(--destructive)] text-sm mt-1 font-medium">{errors.gym}</p>
          )}
        </div>
      </div>
    </div>
  );
}
