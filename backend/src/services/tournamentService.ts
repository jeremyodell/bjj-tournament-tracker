import { z } from 'zod';
import { queryTournaments, getTournamentById } from '../db/queries.js';
import { filterByDistance } from '../utils/distance.js';
import { NotFoundError } from '../shared/errors.js';
import type { TournamentItem } from '../db/types.js';
import type { TournamentFilters } from '../db/queries.js';

const filtersSchema = z.object({
  org: z.enum(['IBJJF', 'JJWL']).optional(),
  startAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  city: z.string().min(1).optional(),
  gi: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  nogi: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  kids: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  // New location params
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusMiles: z.coerce.number().min(1).max(1000).optional(),
});

type ParsedFilters = z.infer<typeof filtersSchema>;

export function validateTournamentFilters(
  params: Record<string, string | undefined>
): ParsedFilters {
  // Remove empty strings
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== '' && v !== undefined)
  );
  return filtersSchema.parse(cleaned);
}

export interface TournamentResponse {
  id: string;
  org: 'IBJJF' | 'JJWL';
  externalId: string;
  name: string;
  city: string;
  venue: string | null;
  country: string | null;
  startDate: string;
  endDate: string;
  gi: boolean;
  nogi: boolean;
  kids: boolean;
  registrationUrl: string | null;
  bannerUrl: string | null;
  lat: number | null;
  lng: number | null;
  distanceMiles?: number;
}

export function formatTournamentResponse(
  item: TournamentItem,
  distanceMiles?: number
): TournamentResponse {
  return {
    id: item.PK,
    org: item.org,
    externalId: item.externalId,
    name: item.name,
    city: item.city,
    venue: item.venue,
    country: item.country,
    startDate: item.startDate,
    endDate: item.endDate,
    gi: item.gi,
    nogi: item.nogi,
    kids: item.kids,
    registrationUrl: item.registrationUrl,
    bannerUrl: item.bannerUrl,
    lat: item.lat,
    lng: item.lng,
    ...(distanceMiles !== undefined && { distanceMiles }),
  };
}

export async function listTournaments(
  params: Record<string, string | undefined>,
  lastKey?: string
): Promise<{
  tournaments: TournamentResponse[];
  nextCursor?: string;
}> {
  const filters = validateTournamentFilters(params);
  const { lat, lng, radiusMiles, ...dbFilters } = filters;
  const parsedLastKey = lastKey ? JSON.parse(Buffer.from(lastKey, 'base64').toString()) : undefined;

  // For distance or org queries, we need to fetch more and filter client-side
  // because DynamoDB applies filters AFTER reading items up to the limit
  const hasPostQueryFilters = lat && lng && radiusMiles || dbFilters.org || dbFilters.gi !== undefined || dbFilters.nogi !== undefined || dbFilters.kids !== undefined;
  const fetchLimit = hasPostQueryFilters ? 500 : filters.limit;

  const { items, lastKey: newLastKey } = await queryTournaments(
    dbFilters as TournamentFilters,
    fetchLimit,
    parsedLastKey
  );

  let tournaments: TournamentResponse[];

  if (lat !== undefined && lng !== undefined && radiusMiles !== undefined) {
    // Apply distance filtering
    const withDistance = filterByDistance(items, lat, lng, radiusMiles);
    tournaments = withDistance.map((item) =>
      formatTournamentResponse(item, item.distanceMiles)
    );
  } else {
    tournaments = items.map((item) => formatTournamentResponse(item));
  }

  // Limit after all filtering when we fetched extra items
  if (hasPostQueryFilters) {
    tournaments = tournaments.slice(0, filters.limit);
  }

  return {
    tournaments,
    // Don't return cursor when using post-query filters (we fetch all and filter)
    nextCursor:
      !hasPostQueryFilters && newLastKey
        ? Buffer.from(JSON.stringify(newLastKey)).toString('base64')
        : undefined,
  };
}

export async function getTournament(id: string): Promise<TournamentResponse> {
  const item = await getTournamentById(id);

  if (!item) {
    throw new NotFoundError('Tournament');
  }

  return formatTournamentResponse(item);
}
