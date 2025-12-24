// frontend/src/components/tournaments/TournamentFilters.tsx
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

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <Input
          placeholder="Search tournaments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="flex flex-wrap gap-4">
        <Select value={filters.org || 'all'} onValueChange={handleOrgChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Organization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orgs</SelectItem>
            <SelectItem value="IBJJF">IBJJF</SelectItem>
            <SelectItem value="JJWL">JJWL</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            variant={filters.gi ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFormatChange('gi')}
          >
            GI
          </Button>
          <Button
            variant={filters.nogi ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFormatChange('nogi')}
          >
            NOGI
          </Button>
          <Button
            variant={filters.kids ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFormatChange('kids')}
          >
            Kids
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
