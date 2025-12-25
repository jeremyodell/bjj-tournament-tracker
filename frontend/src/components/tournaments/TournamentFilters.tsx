'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TournamentFilters as Filters } from '@/lib/types';

interface TournamentFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function TournamentFilters({ filters, onFiltersChange }: TournamentFiltersProps) {
  const [search, setSearch] = useState(filters.search || '');
  const [, startTransition] = useTransition();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ ...filters, search: search || undefined });
  };

  const handleOrgChange = (value: string) => {
    onFiltersChange({
      ...filters,
      org: value === 'all' ? undefined : (value as 'IBJJF' | 'JJWL'),
    });
  };

  const handleFormatChange = (format: 'gi' | 'nogi' | 'kids') => {
    onFiltersChange({
      ...filters,
      [format]: filters[format] ? undefined : true,
    });
  };

  const handleClear = () => {
    setSearch('');
    onFiltersChange({});
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.org ||
    filters.gi ||
    filters.nogi ||
    filters.kids ||
    filters.search;

  return (
    <div className="space-y-4 p-6 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-2xl">
      {/* Search form - stacks on mobile */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            placeholder="Search tournaments..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              startTransition(() => setSearch(value));
            }}
            className="pl-10 bg-white/5 border-white/10 placeholder:text-white/40 text-white focus-visible:ring-white/20 focus-visible:border-white/30"
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto bg-white/5 border border-white/10 text-white/80 hover:bg-white/10">
          Search
        </Button>
      </form>

      {/* Filter controls - responsive layout */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        {/* Organization select */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/50 whitespace-nowrap">Org:</span>
          <Select value={filters.org || 'all'} onValueChange={handleOrgChange}>
            <SelectTrigger className="w-[120px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Organization" />
            </SelectTrigger>
            <SelectContent className="bg-[#0A0A1A] border-white/10 text-white">
              <SelectItem value="all">All Orgs</SelectItem>
              <SelectItem value="IBJJF">IBJJF</SelectItem>
              <SelectItem value="JJWL">JJWL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Divider for larger screens */}
        <div className="hidden sm:block h-6 w-px bg-white/10" />

        {/* Format toggle buttons */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/50 whitespace-nowrap">Format:</span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFormatChange('gi')}
              className={`min-w-[50px] ${
                filters.gi
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }`}
            >
              GI
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFormatChange('nogi')}
              className={`min-w-[60px] ${
                filters.nogi
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }`}
            >
              NOGI
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFormatChange('kids')}
              className={`min-w-[50px] ${
                filters.kids
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }`}
            >
              Kids
            </Button>
          </div>
        </div>

        {/* Clear button - show only when filters are active */}
        {hasActiveFilters && (
          <>
            {/* Divider for larger screens */}
            <div className="hidden sm:block h-6 w-px bg-white/10" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-white/60 hover:text-white hover:bg-white/10 self-start sm:self-center"
            >
              <svg
                className="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Clear
            </Button>
          </>
        )}
      </div>

      {/* Active filters summary for mobile */}
      {hasActiveFilters && (
        <div className="sm:hidden text-xs text-white/50">
          Active filters:{' '}
          {[
            filters.org,
            filters.gi && 'GI',
            filters.nogi && 'NOGI',
            filters.kids && 'Kids',
            filters.search && `"${filters.search}"`,
          ]
            .filter(Boolean)
            .join(', ')}
        </div>
      )}
    </div>
  );
}
