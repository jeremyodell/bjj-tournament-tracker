'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMasterGymSearch } from '@/hooks/useMasterGymSearch';

interface GymSearchWithOtherProps {
  athleteIndex: number;
  value: {
    masterGymId?: string;
    masterGymName?: string;
    customGymName?: string;
  };
  onChange: (gymData: {
    masterGymId?: string;
    masterGymName?: string;
    customGymName?: string;
  }) => void;
}

export function GymSearchWithOther({ value, onChange }: GymSearchWithOtherProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customGymName, setCustomGymName] = useState(value.customGymName || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: gyms = [], isLoading } = useMasterGymSearch(query);

  const shouldShowDropdown = query.length >= 2 && isOpen;

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(val.length >= 2);
  }, []);

  const handleSelectGym = useCallback(
    (gym: { id: string; canonicalName: string }) => {
      onChange({
        masterGymId: gym.id,
        masterGymName: gym.canonicalName,
        customGymName: undefined,
      });
      setQuery('');
      setIsOpen(false);
      setShowCustomInput(false);
    },
    [onChange]
  );

  const handleSelectOther = useCallback(() => {
    setQuery('');
    setIsOpen(false);
    setShowCustomInput(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleCustomGymChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomGymName(val);
      onChange({
        masterGymId: undefined,
        masterGymName: undefined,
        customGymName: val,
      });
    },
    [onChange]
  );

  const handleChange = useCallback(() => {
    onChange({
      masterGymId: undefined,
      masterGymName: undefined,
      customGymName: undefined,
    });
    setQuery('');
    setCustomGymName('');
    setShowCustomInput(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onChange]);

  // If gym is selected, show the chip view
  if (value.masterGymId || value.customGymName) {
    return (
      <div
        ref={containerRef}
        className="flex items-center gap-3 p-3 glass-card rounded-lg border border-white/20"
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="text-white font-medium">
            {value.masterGymName || value.customGymName}
          </span>
          {value.customGymName && (
            <span className="text-xs px-2 py-0.5 bg-[var(--scoreboard-yellow)]/20 text-[var(--scoreboard-yellow)] rounded border border-[var(--scoreboard-yellow)]/30">
              Custom
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleChange}
          className="text-sm text-[var(--accent-ibjjf)] hover:text-white transition-colors"
        >
          Change
        </button>
      </div>
    );
  }

  // Custom gym input
  if (showCustomInput) {
    return (
      <div ref={containerRef}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Enter your gym name..."
          value={customGymName}
          onChange={handleCustomGymChange}
          className="w-full px-3 py-2 border border-white/20 rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 placeholder:text-white/40 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)] focus:outline-none"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={handleChange}
          className="text-sm text-white/80 hover:text-[var(--accent-ibjjf)] mt-2 transition-colors"
        >
          ← Back to search
        </button>
      </div>
    );
  }

  // Search input view
  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search for your gym..."
        value={query}
        onChange={handleInputChange}
        onFocus={() => query.length >= 2 && setIsOpen(true)}
        className="w-full px-3 py-2 border border-white/20 rounded-md bg-white/8 text-white backdrop-blur-sm transition-all duration-200 placeholder:text-white/40 focus:border-[var(--accent-ibjjf)] focus:ring-2 focus:ring-[var(--accent-ibjjf)]/30 focus:shadow-[0_0_20px_rgba(0,240,255,0.2)] focus:outline-none"
        autoComplete="off"
      />

      {shouldShowDropdown && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 z-50 glass-card border border-white/20 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-h-64 overflow-y-auto animate-slide-down"
        >
          {isLoading ? (
            <div className="p-4 text-white/70 text-center">Searching...</div>
          ) : (
            <>
              {gyms.length === 0 ? (
                <div className="p-4 text-white/70 text-center">No gyms found</div>
              ) : (
                gyms.map((gym) => (
                  <button
                    key={gym.id}
                    type="button"
                    role="option"
                    onClick={() => handleSelectGym(gym)}
                    className="w-full px-4 py-3 text-left hover:bg-[var(--accent-ibjjf)]/10 hover:border-l-2 hover:border-[var(--accent-ibjjf)] transition-all border-b border-white/10 last:border-b-0 group"
                  >
                    <span className="text-white group-hover:text-[var(--accent-ibjjf)] transition-colors">
                      {gym.canonicalName}
                    </span>
                  </button>
                ))
              )}

              {/* "Other" option */}
              <button
                type="button"
                onClick={handleSelectOther}
                className="w-full px-4 py-3 text-left hover:bg-[var(--accent-ibjjf)]/10 transition-all border-t-2 border-white/20 font-medium text-[var(--accent-ibjjf)] hover:text-white"
                style={{ fontFamily: 'var(--font-mono-display)' }}
              >
                Other (enter custom gym name)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
