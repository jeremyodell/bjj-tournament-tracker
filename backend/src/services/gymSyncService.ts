import { fetchJJWLGyms } from '../fetchers/jjwlGymFetcher.js';
import { fetchJJWLRoster } from '../fetchers/jjwlRosterFetcher.js';
import {
  fetchIBJJFGymCount,
  fetchAllIBJJFGyms,
} from '../fetchers/ibjjfGymFetcher.js';
import {
  batchUpsertGyms,
  upsertGymRoster,
  getSourceGym,
  getGymSyncMeta,
  updateGymSyncMeta,
} from '../db/gymQueries.js';
import { queryTournaments } from '../db/queries.js';
import type { TournamentItem } from '../db/types.js';

export interface GymSyncResult {
  fetched: number;
  saved: number;
  error?: string;
}

export interface RosterSyncResult {
  success: boolean;
  athleteCount: number;
  error?: string;
}

export interface TournamentQueryResult {
  tournaments: TournamentItem[];
  error?: string;
}

export interface IBJJFGymSyncResult {
  skipped: boolean;
  fetched: number;
  saved: number;
  duration: number;
  error?: string;
}

export interface IBJJFSyncOptions {
  forceSync?: boolean;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Sync all JJWL gyms to database.
 * Fetches the full gym list from JJWL API and batch upserts to DynamoDB.
 */
export async function syncJJWLGyms(): Promise<GymSyncResult> {
  try {
    const gyms = await fetchJJWLGyms();
    const saved = await batchUpsertGyms(gyms);

    return {
      fetched: gyms.length,
      saved,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GymSyncService] Failed to sync JJWL gyms:', message);
    return {
      fetched: 0,
      saved: 0,
      error: message,
    };
  }
}

/**
 * Sync IBJJF gyms with change detection.
 * Skips full sync if totalRecords hasn't changed (unless forceSync=true).
 */
export async function syncIBJJFGyms(
  options: IBJJFSyncOptions = {}
): Promise<IBJJFGymSyncResult> {
  const { forceSync = false, onProgress } = options;
  const startTime = Date.now();

  try {
    // Get current count from API
    const totalRecords = await fetchIBJJFGymCount();

    // Get previous sync metadata
    const meta = await getGymSyncMeta('IBJJF');
    const previousTotal = meta?.totalRecords;

    // Skip if unchanged (unless force)
    if (!forceSync && meta && previousTotal === totalRecords) {
      console.log(
        `[GymSyncService] IBJJF unchanged (${totalRecords} records), skipping sync`
      );
      return {
        skipped: true,
        fetched: 0,
        saved: 0,
        duration: Date.now() - startTime,
      };
    }

    console.log(
      `[GymSyncService] IBJJF sync starting: ${previousTotal ?? 0} -> ${totalRecords} records`
    );

    // Fetch all gyms
    const gyms = await fetchAllIBJJFGyms(onProgress);

    // Batch upsert to database
    const saved = await batchUpsertGyms(gyms);

    // Update sync metadata
    await updateGymSyncMeta('IBJJF', totalRecords);

    const duration = Date.now() - startTime;
    console.log(
      `[GymSyncService] IBJJF sync complete: ${gyms.length} fetched, ${saved} saved in ${duration}ms`
    );

    return {
      skipped: false,
      fetched: gyms.length,
      saved,
      duration,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GymSyncService] IBJJF sync failed:', message);
    return {
      skipped: false,
      fetched: 0,
      saved: 0,
      duration: Date.now() - startTime,
      error: message,
    };
  }
}

/**
 * Get unique gym IDs from all athletes (for targeted roster sync).
 * Returns a Map of gymSourceId -> { org, externalId }.
 *
 * Note: For MVP, this returns empty since athlete-gym tracking isn't
 * fully implemented. Rosters are fetched on-demand via API.
 */
export async function getActiveGymIds(): Promise<
  Map<string, { org: 'JJWL' | 'IBJJF'; externalId: string }>
> {
  // TODO: Implement proper gym tracking when scale requires it
  // Would need to scan all athletes or maintain a GSI for gym lookups
  return new Map();
}

/**
 * Get upcoming tournaments (next N days).
 * Useful for pre-fetching rosters before tournaments.
 */
export async function getUpcomingTournaments(
  daysAhead = 60
): Promise<TournamentQueryResult> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const result = await queryTournaments({
      startAfter: today,
      startBefore: futureDate,
    });

    return { tournaments: result.items };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GymSyncService] Failed to get upcoming tournaments:', message);
    return { tournaments: [], error: message };
  }
}

/**
 * Sync roster for a specific gym at a specific tournament.
 * Fetches from JJWL API and caches in DynamoDB.
 */
export async function syncGymRoster(
  org: 'JJWL' | 'IBJJF',
  tournamentId: string,
  gymExternalId: string
): Promise<RosterSyncResult> {
  try {
    if (org !== 'JJWL') {
      return {
        success: false,
        athleteCount: 0,
        error: 'Only JJWL supported currently',
      };
    }

    // Get gym name for denormalization
    const gym = await getSourceGym(org, gymExternalId);
    const gymName = gym?.name || 'Unknown Gym';

    // Fetch roster from JJWL
    const athletes = await fetchJJWLRoster(tournamentId, gymExternalId);

    // Save to database
    await upsertGymRoster(org, tournamentId, gymExternalId, gymName, athletes);

    return {
      success: true,
      athleteCount: athletes.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[GymSyncService] Failed to sync roster for ${org}/${tournamentId}/${gymExternalId}:`,
      message
    );
    return {
      success: false,
      athleteCount: 0,
      error: message,
    };
  }
}
