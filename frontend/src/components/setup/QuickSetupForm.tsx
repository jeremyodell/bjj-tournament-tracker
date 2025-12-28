'use client';

import { useSetupStore } from '@/stores/setupStore';

interface QuickSetupFormProps {
  onComplete: () => void;
}

const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 4); // 4-16
const BELT_OPTIONS = ['white', 'gray', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black'];
const WEIGHT_OPTIONS = ['40', '45', '50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100', '110', '120', '130', '140', '150+'];

export function QuickSetupForm({ onComplete }: QuickSetupFormProps) {
  const {
    athleteName,
    age,
    belt,
    weight,
    location,
    isComplete,
    setAthleteInfo,
    setLocation,
  } = useSetupStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isComplete) {
      onComplete();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">
        Let&apos;s find tournaments for your athlete
      </h2>

      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-2">
          Where are you based?
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
          Athlete&apos;s first name
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
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none"
          >
            <option value="">--</option>
            {AGE_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
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
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none capitalize"
          >
            <option value="">--</option>
            {BELT_OPTIONS.map((b) => (
              <option key={b} value={b} className="capitalize">{b}</option>
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
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none"
          >
            <option value="">--</option>
            {WEIGHT_OPTIONS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={!isComplete}
        className="w-full py-4 rounded-full font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100"
        style={{
          background: isComplete
            ? 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)'
            : 'rgba(255,255,255,0.1)',
          color: isComplete ? '#000' : 'rgba(255,255,255,0.5)',
        }}
      >
        Show Me Tournaments
      </button>
    </form>
  );
}
