'use client';

import { useState } from 'react';
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
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      {/* Search form - stacks on mobile */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
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
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto">
          Search
        </Button>
      </form>

      {/* Filter controls - responsive layout */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        {/* Organization select */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Org:</span>
          <Select value={filters.org || 'all'} onValueChange={handleOrgChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orgs</SelectItem>
              <SelectItem value="IBJJF">IBJJF</SelectItem>
              <SelectItem value="JJWL">JJWL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Divider for larger screens */}
        <div className="hidden sm:block h-6 w-px bg-border" />

        {/* Format toggle buttons */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Format:</span>
          <div className="flex gap-1.5">
            <Button
              variant={filters.gi ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFormatChange('gi')}
              className="min-w-[50px]"
            >
              GI
            </Button>
            <Button
              variant={filters.nogi ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFormatChange('nogi')}
              className="min-w-[60px]"
            >
              NOGI
            </Button>
            <Button
              variant={filters.kids ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFormatChange('kids')}
              className="min-w-[50px]"
            >
              Kids
            </Button>
          </div>
        </div>

        {/* Clear button - show only when filters are active */}
        {hasActiveFilters && (
          <>
            {/* Divider for larger screens */}
            <div className="hidden sm:block h-6 w-px bg-border" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground self-start sm:self-center"
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
        <div className="sm:hidden text-xs text-muted-foreground">
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
