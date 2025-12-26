'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { TournamentFilters } from '@/lib/types';

type DatePreset = 'month' | '30' | '60' | '90' | 'year';
type DistancePreset = 50 | 100 | 250 | 'any';

interface FilterState extends TournamentFilters {
  datePreset: DatePreset;
  distancePreset: DistancePreset;
}

function getDateRange(preset: DatePreset): { startAfter: string; startBefore: string } {
  const now = new Date();
  const startAfter = now.toISOString().split('T')[0];

  let endDate: Date;

  switch (preset) {
    case 'month':
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case '30':
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    case '60':
      endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      break;
    case '90':
      endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      // In December, show next year since people are planning ahead
      const targetYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      endDate = new Date(targetYear, 11, 31);
      break;
  }

  return {
    startAfter,
    startBefore: endDate.toISOString().split('T')[0],
  };
}

function getRadiusMiles(preset: DistancePreset): number | undefined {
  return preset === 'any' ? undefined : preset;
}

export function useFilterParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo((): FilterState => {
    const datePreset = (searchParams.get('date') as DatePreset) || '30';
    const distancePreset = searchParams.get('d')
      ? (parseInt(searchParams.get('d')!) as DistancePreset)
      : 'any';

    const { startAfter, startBefore } = getDateRange(datePreset);

    return {
      org: (searchParams.get('org') as 'IBJJF' | 'JJWL') || undefined,
      gi: searchParams.get('gi') === '1' ? true : undefined,
      nogi: searchParams.get('nogi') === '1' ? true : undefined,
      kids: searchParams.get('kids') === '1' ? true : undefined,
      lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
      lng: searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined,
      radiusMiles: getRadiusMiles(distancePreset),
      startAfter,
      startBefore,
      datePreset,
      distancePreset,
    };
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: Partial<Record<string, string | undefined>>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setDatePreset = useCallback(
    (preset: DatePreset) => {
      updateParams({ date: preset });
    },
    [updateParams]
  );

  const setDistancePreset = useCallback(
    (preset: DistancePreset) => {
      updateParams({ d: preset === 'any' ? undefined : String(preset) });
    },
    [updateParams]
  );

  const setLocation = useCallback(
    (lat: number, lng: number) => {
      updateParams({ lat: String(lat), lng: String(lng) });
    },
    [updateParams]
  );

  const clearLocation = useCallback(() => {
    updateParams({ lat: undefined, lng: undefined, d: undefined });
  }, [updateParams]);

  const toggleFormat = useCallback(
    (format: 'gi' | 'nogi' | 'kids') => {
      const current = searchParams.get(format) === '1';
      updateParams({ [format]: current ? undefined : '1' });
    },
    [searchParams, updateParams]
  );

  const setOrg = useCallback(
    (org: 'IBJJF' | 'JJWL' | undefined) => {
      updateParams({ org });
    },
    [updateParams]
  );

  const clearAll = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  return {
    filters: state,
    setDatePreset,
    setDistancePreset,
    setLocation,
    clearLocation,
    toggleFormat,
    setOrg,
    clearAll,
  };
}
