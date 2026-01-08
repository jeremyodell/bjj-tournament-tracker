'use client';

import { type ChangeEvent } from 'react';

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

export interface AthleteFormValues {
  name: string;
  birthdate: string;
  gender: 'Male' | 'Female' | '';
  beltRank: string;
  weight: number | null;
}

interface AthleteFormFieldsProps {
  values: AthleteFormValues;
  errors: Record<string, string>;
  onChange: (field: keyof AthleteFormValues, value: any) => void;
  variant?: 'page' | 'modal';
}

export function AthleteFormFields({
  values,
  errors,
  onChange,
  variant = 'page',
}: AthleteFormFieldsProps) {
  const spacing = variant === 'modal' ? 'space-y-4' : 'space-y-6';

  return (
    <div className={spacing}>
      {/* Name Field */}
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
          value={values.name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('name', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 placeholder:text-white/40 ${
            errors.name
              ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
              : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)] focus:outline-none'
          }`}
          placeholder="Enter full name"
        />
        {errors.name && (
          <p className="text-[var(--destructive)] text-sm mt-1 font-medium flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-[var(--destructive)] animate-pulse" />
            {errors.name}
          </p>
        )}
      </div>

      {/* Birthdate Field */}
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
          value={values.birthdate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('birthdate', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 [color-scheme:dark] ${
            errors.birthdate
              ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
              : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)] focus:outline-none'
          }`}
        />
        {errors.birthdate && (
          <p className="text-[var(--destructive)] text-sm mt-1 font-medium flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-[var(--destructive)] animate-pulse" />
            {errors.birthdate}
          </p>
        )}
      </div>

      {/* Gender Field */}
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
          value={values.gender}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onChange('gender', e.target.value as 'Male' | 'Female' | '')
          }
          className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 [color-scheme:dark] cursor-pointer ${
            errors.gender
              ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
              : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)] focus:outline-none'
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
          <p className="text-[var(--destructive)] text-sm mt-1 font-medium flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-[var(--destructive)] animate-pulse" />
            {errors.gender}
          </p>
        )}
      </div>

      {/* Belt Rank Field */}
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
          value={values.beltRank}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange('beltRank', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 [color-scheme:dark] cursor-pointer ${
            errors.beltRank
              ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
              : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)] focus:outline-none'
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
          <p className="text-[var(--destructive)] text-sm mt-1 font-medium flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-[var(--destructive)] animate-pulse" />
            {errors.beltRank}
          </p>
        )}
      </div>

      {/* Weight Field */}
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
          value={values.weight || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange('weight', parseFloat(e.target.value) || null)
          }
          className={`w-full px-3 py-2 border rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 placeholder:text-white/40 ${
            errors.weight
              ? 'border-[var(--destructive)] ring-2 ring-[var(--destructive)]/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
              : 'border-white/20 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)] focus:outline-none'
          }`}
          placeholder="Enter weight in pounds"
          min="0"
          step="0.1"
        />
        {errors.weight && (
          <p className="text-[var(--destructive)] text-sm mt-1 font-medium flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-[var(--destructive)] animate-pulse" />
            {errors.weight}
          </p>
        )}
      </div>
    </div>
  );
}
