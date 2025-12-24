import { fetchIBJJFTournaments } from '../fetchers/ibjjfFetcher.js';
import { fetchJJWLTournaments } from '../fetchers/jjwlFetcher.js';
import { upsertTournaments } from '../db/queries.js';
import type { NormalizedTournament } from '../fetchers/types.js';

export interface SyncResult {
  ibjjf: { fetched: number; saved: number; error?: string };
  jjwl: { fetched: number; saved: number; error?: string };
}

export interface SyncOptions {
  dryRun?: boolean;
}

async function fetchSource(
  name: string,
  fetcher: () => Promise<NormalizedTournament[]>,
  options: SyncOptions
): Promise<{ fetched: number; saved: number; error?: string }> {
  try {
    const tournaments = await fetcher();
    const fetched = tournaments.length;

    if (options.dryRun) {
      return { fetched, saved: 0 };
    }

    const saved = await upsertTournaments(tournaments);
    return { fetched, saved };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to sync ${name}:`, message);
    return { fetched: 0, saved: 0, error: message };
  }
}

export async function syncAllTournaments(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const [ibjjf, jjwl] = await Promise.all([
    fetchSource('IBJJF', fetchIBJJFTournaments, options),
    fetchSource('JJWL', fetchJJWLTournaments, options),
  ]);

  return { ibjjf, jjwl };
}
