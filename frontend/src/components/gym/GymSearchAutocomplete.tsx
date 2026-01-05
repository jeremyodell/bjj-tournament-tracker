'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGymSearch } from '@/hooks/useGymSearch';
import { cn } from '@/lib/utils';
import type { Gym } from '@/lib/api';

interface GymSearchAutocompleteProps {
  selectedGym: Gym | null;
  onSelect: (gym: Gym | null) => void;
}

/**
 * Autocomplete component for searching and selecting gyms.
 * Shows search results after 2+ characters with org badges (JJWL=cyan, IBJJF=magenta).
 * Selected gym displays as a chip with a "Change" button.
 */
export function GymSearchAutocomplete({
  selectedGym,
  onSelect,
}: GymSearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: gyms = [], isLoading } = useGymSearch(query);

  const shouldShowDropdown = query.length >= 2 && isOpen;

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setIsOpen(value.length >= 2);
    },
    []
  );

  const handleSelect = useCallback(
    (gym: Gym) => {
      onSelect(gym);
      setQuery('');
      setIsOpen(false);
      setIsEditing(false);
    },
    [onSelect]
  );

  const handleChange = useCallback(() => {
    onSelect(null);
    setIsEditing(true);
    setQuery('');
    // Focus input after state update
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    []
  );

  // If gym is selected and not editing, show the chip view
  if (selectedGym && !isEditing) {
    return (
      <div
        ref={containerRef}
        className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700"
      >
        <div className="flex items-center gap-2 flex-1">
          <OrgBadge org={selectedGym.org} />
          <span className="text-white font-medium">{selectedGym.name}</span>
        </div>
        <button
          type="button"
          onClick={handleChange}
          className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Change
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
        onKeyDown={handleKeyDown}
        onFocus={() => query.length >= 2 && setIsOpen(true)}
        className={cn(
          'w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700',
          'text-white placeholder:text-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500',
          'transition-all'
        )}
        autoComplete="off"
      />

      {shouldShowDropdown && (
        <div
          role="listbox"
          className={cn(
            'absolute top-full left-0 right-0 mt-2 z-50',
            'bg-gray-900 border border-gray-700 rounded-lg shadow-xl',
            'max-h-64 overflow-y-auto'
          )}
        >
          {isLoading ? (
            <div className="p-4 text-gray-400 text-center">
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner />
                Searching...
              </span>
            </div>
          ) : gyms.length === 0 ? (
            <div className="p-4 text-gray-400 text-center">No gyms found</div>
          ) : (
            gyms.map((gym) => (
              <button
                key={`${gym.org}-${gym.externalId}`}
                type="button"
                role="option"
                onClick={() => handleSelect(gym)}
                className={cn(
                  'w-full px-4 py-3 flex items-center gap-3',
                  'text-left hover:bg-gray-800 transition-colors',
                  'border-b border-gray-800 last:border-b-0'
                )}
              >
                <OrgBadge org={gym.org} />
                <span className="text-white">{gym.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Badge component displaying organization with themed colors.
 * JJWL = cyan, IBJJF = magenta (fuchsia)
 */
function OrgBadge({ org }: { org: Gym['org'] }) {
  const isJJWL = org === 'JJWL';

  return (
    <span
      className={cn(
        'px-2 py-0.5 text-xs font-medium rounded',
        isJJWL
          ? 'bg-cyan-500/20 text-cyan-400'
          : 'bg-fuchsia-500/20 text-fuchsia-400'
      )}
    >
      {org}
    </span>
  );
}

/**
 * Simple loading spinner component
 */
function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-cyan-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
