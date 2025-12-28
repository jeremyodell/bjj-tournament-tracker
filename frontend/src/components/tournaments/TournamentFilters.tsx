'use client';

import { useEffect, useRef } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PresetButtonGroup } from '@/components/ui/preset-button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useFilterParams } from '@/hooks/useFilterParams';

// In December, show next year since people are planning ahead
const getYearLabel = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed, so December is 11
  const year = month === 11 ? now.getFullYear() + 1 : now.getFullYear();
  return String(year);
};

const DATE_OPTIONS = [
  { value: 'month' as const, label: 'This Month' },
  { value: '30' as const, label: '30 Days' },
  { value: '60' as const, label: '60 Days' },
  { value: '90' as const, label: '90 Days' },
  { value: 'year' as const, label: getYearLabel() },
];

const DISTANCE_OPTIONS = [
  { value: 50 as const, label: '50mi' },
  { value: 100 as const, label: '100mi' },
  { value: 250 as const, label: '250mi' },
  { value: 'any' as const, label: 'Any' },
];

export function TournamentFilters() {
  const geo = useGeolocation();
  const {
    filters,
    setDatePreset,
    setDistancePreset,
    setLocation,
    clearLocation,
    toggleFormat,
    setOrg,
    clearAll,
  } = useFilterParams();

  // Track if we've synced location to prevent infinite loops
  const hasSyncedLocation = useRef(false);

  // Sync geolocation to URL params when it updates
  useEffect(() => {
    if (geo.lat && geo.lng && !hasSyncedLocation.current) {
      if (geo.lat !== filters.lat || geo.lng !== filters.lng) {
        setLocation(geo.lat, geo.lng);
        hasSyncedLocation.current = true;
      }
    }
  }, [geo.lat, geo.lng, filters.lat, filters.lng, setLocation]);

  const handleNearMe = () => {
    hasSyncedLocation.current = false;
    geo.requestLocation();
  };

  const handleClearLocation = () => {
    hasSyncedLocation.current = false;
    geo.clearLocation();
    clearLocation();
  };

  const hasLocation = filters.lat && filters.lng;
  const hasActiveFilters =
    filters.org ||
    filters.gi ||
    filters.nogi ||
    filters.kids ||
    hasLocation ||
    filters.datePreset !== '30';

  return (
    <div className="space-y-4 p-6 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-2xl">
      {/* Location Section */}
      <div className="space-y-2">
        <span className="text-sm text-white/50">Location</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNearMe}
            disabled={geo.loading}
            className={
              hasLocation
                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
            }
          >
            {geo.loading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4 mr-1.5" />
            )}
            {hasLocation ? geo.label || 'Near me' : 'Near me'}
          </Button>
          {hasLocation && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearLocation}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {geo.error && (
            <span className="text-xs text-red-400">{geo.error}</span>
          )}
        </div>
      </div>

      {/* Distance Section */}
      <div className="space-y-2">
        <span className="text-sm text-white/50">Distance</span>
        <PresetButtonGroup
          options={DISTANCE_OPTIONS}
          selected={filters.distancePreset}
          onChange={setDistancePreset}
          disabled={!hasLocation}
        />
      </div>

      {/* Date Section */}
      <div className="space-y-2">
        <span className="text-sm text-white/50">Date</span>
        <PresetButtonGroup
          options={DATE_OPTIONS}
          selected={filters.datePreset}
          onChange={setDatePreset}
        />
      </div>

      {/* Format Section */}
      <div className="space-y-2">
        <span className="text-sm text-white/50">Format</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFormat('gi')}
              className={
                filters.gi
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              GI
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFormat('nogi')}
              className={
                filters.nogi
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              NOGI
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFormat('kids')}
              className={
                filters.kids
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              Kids
            </Button>
          </div>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOrg(filters.org === 'IBJJF' ? undefined : 'IBJJF')}
              className={
                filters.org === 'IBJJF'
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              IBJJF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOrg(filters.org === 'JJWL' ? undefined : 'JJWL')}
              className={
                filters.org === 'JJWL'
                  ? 'bg-[#FF2D6A]/20 text-[#FF2D6A] border-[#FF2D6A]/30 hover:bg-[#FF2D6A]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              JJWL
            </Button>
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="pt-2 border-t border-white/10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
