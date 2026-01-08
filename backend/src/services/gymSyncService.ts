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
  listUSIBJJFGyms,
  listAllJJWLGyms,
} from '../db/gymQueries.js';
import { queryTournaments } from '../db/queries.js';
import { processGymMatches } from './gymMatchingService.js';
import type { TournamentItem, SourceGymItem } from '../db/types.js';
import type { NormalizedGym } from '../fetchers/types.js';

export interface GymSyncResult {
  fetched: number;
  saved: number;
  matching?: {
    processed: number;
    autoLinked: number;
    pendingCreated: number;
  };
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
  matching?: {
    processed: number;
    autoLinked: number;
    pendingCreated: number;
  };
  error?: string;
}

export interface IBJJFSyncOptions {
  forceSync?: boolean;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Run matching for JJWL gyms against cached US IBJJF gyms.
 * Loads both JJWL and US IBJJF gyms once to eliminate N+1 query pattern.
 */
async function runMatchingForJJWLGyms(
  jjwlGyms: NormalizedGym[]
): Promise<{ processed: number; autoLinked: number; pendingCreated: number }> {
  console.log('[GymSyncService] Loading gyms for matching...');
  const startLoad = Date.now();

  // Load both JJWL and US IBJJF gyms in parallel
  const [jjwlSourceGyms, usIbjjfGyms] = await Promise.all([
    listAllJJWLGyms(),
    listUSIBJJFGyms(),
  ]);

  const loadDuration = Date.now() - startLoad;
  console.log(
    `[GymSyncService] Loaded ${jjwlSourceGyms.length} JJWL gyms and ${usIbjjfGyms.length} US IBJJF gyms in ${loadDuration}ms`
  );

  // Create Map for O(1) lookup of JJWL source gyms by key
  const jjwlGymMap = new Map<string, SourceGymItem>();
  for (const gym of jjwlSourceGyms) {
    const key = `${gym.org}#${gym.externalId}`;
    jjwlGymMap.set(key, gym);
  }

  let processed = 0;
  let autoLinked = 0;
  let pendingCreated = 0;

  const matchingStart = Date.now();
  for (const gym of jjwlGyms) {
    // Lookup source gym from Map (O(1) instead of DB query)
    const key = `${gym.org}#${gym.externalId}`;
    const sourceGym = jjwlGymMap.get(key);

    if (!sourceGym || sourceGym.masterGymId) {
      // Already linked or not found, skip
      continue;
    }

    // Run matching for this unlinked gym using cached array
    const result = await processGymMatches(sourceGym, usIbjjfGyms);
    processed++;
    autoLinked += result.autoLinked;
    pendingCreated += result.pendingCreated;

    // Progress logging every 100 gyms
    if (processed % 100 === 0) {
      console.log(
        `[GymSyncService] Matching progress: ${processed}/${jjwlGyms.length}`
      );
    }
  }

  const matchingDuration = Date.now() - matchingStart;
  console.log(
    `[GymSyncService] Matching completed in ${matchingDuration}ms (${(matchingDuration / 1000).toFixed(1)}s)`
  );

  return { processed, autoLinked, pendingCreated };
}

/**
 * Sync all JJWL gyms to database.
 * Fetches the full gym list from JJWL API, batch upserts to DynamoDB,
 * and runs fuzzy matching for unlinked gyms.
 */
export async function syncJJWLGyms(): Promise<GymSyncResult> {
  try {
    const gyms = await fetchJJWLGyms();
    const saved = await batchUpsertGyms(gyms);

    // Run matching for unlinked gyms
    const matching = await runMatchingForJJWLGyms(gyms);
    console.log(
      `[GymSyncService] JJWL matching: ${matching.processed} processed, ${matching.autoLinked} auto-linked, ${matching.pendingCreated} pending`
    );

    return {
      fetched: gyms.length,
      saved,
      matching,
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
