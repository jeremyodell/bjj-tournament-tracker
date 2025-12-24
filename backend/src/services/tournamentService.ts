import { z } from 'zod';
import { queryTournaments } from '../db/queries.js';
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
});

export function validateTournamentFilters(
  params: Record<string, string | undefined>
): TournamentFilters & { limit: number } {
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
}

export function formatTournamentResponse(item: TournamentItem): TournamentResponse {
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
  const parsedLastKey = lastKey ? JSON.parse(Buffer.from(lastKey, 'base64').toString()) : undefined;

  const { items, lastKey: newLastKey } = await queryTournaments(
    filters,
    filters.limit,
    parsedLastKey
  );

  return {
    tournaments: items.map(formatTournamentResponse),
    nextCursor: newLastKey
      ? Buffer.from(JSON.stringify(newLastKey)).toString('base64')
      : undefined,
  };
}

export async function getTournament(id: string): Promise<TournamentResponse> {
  // Query by PK
  const { items } = await queryTournaments({}, 1);
  const item = items.find((t) => t.PK === id);

  if (!item) {
    throw new NotFoundError('Tournament');
  }

  return formatTournamentResponse(item);
}
