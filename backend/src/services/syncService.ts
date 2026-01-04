import { fetchIBJJFTournaments } from '../fetchers/ibjjfFetcher.js';
import { fetchJJWLTournaments } from '../fetchers/jjwlFetcher.js';
import { upsertTournaments } from '../db/queries.js';
import { enrichTournamentsWithGeocode, type EnrichmentStats } from './venueEnrichment.js';
import { syncJJWLGyms } from './gymSyncService.js';
import type { NormalizedTournament } from '../fetchers/types.js';

export interface SourceResult {
  fetched: number;
  saved: number;
  error?: string;
  enrichment?: EnrichmentStats;
}

export interface SyncResult {
  ibjjf: SourceResult;
  jjwl: SourceResult;
  gyms?: SourceResult;
}

export interface SyncOptions {
  dryRun?: boolean;
  skipEnrichment?: boolean;
}

async function fetchSource(
  name: string,
  fetcher: () => Promise<NormalizedTournament[]>,
  options: SyncOptions
): Promise<SourceResult> {
  try {
    const tournaments = await fetcher();
    const fetched = tournaments.length;

    if (options.dryRun) {
      return { fetched, saved: 0 };
    }

    // Enrich with geocoding unless skipped
    let enrichedTournaments = tournaments;
    let enrichmentStats: EnrichmentStats | undefined;

    if (!options.skipEnrichment) {
      const enrichResult = await enrichTournamentsWithGeocode(tournaments);
      enrichedTournaments = enrichResult.tournaments;
      enrichmentStats = enrichResult.stats;

      console.log(`${name} enrichment:`, enrichmentStats);
    }

    const saved = await upsertTournaments(enrichedTournaments);
    return { fetched, saved, enrichment: enrichmentStats };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to sync ${name}:`, message);
    return { fetched: 0, saved: 0, error: message };
  }
}

export async function syncAllTournaments(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const [ibjjf, jjwl, gymResult] = await Promise.all([
    fetchSource('IBJJF', fetchIBJJFTournaments, options),
    fetchSource('JJWL', fetchJJWLTournaments, options),
    syncJJWLGyms(),
  ]);

  const gyms: SourceResult = {
    fetched: gymResult.fetched,
    saved: gymResult.saved,
    error: gymResult.error,
  };

  return { ibjjf, jjwl, gyms };
}
