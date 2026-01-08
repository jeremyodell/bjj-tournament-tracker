import { getAllWishlistedTournamentPKs } from '../db/wishlistQueries.js';
import { getAllAthletesWithGyms } from '../db/athleteQueries.js';
import { syncGymRoster, type RosterSyncResult } from './gymSyncService.js';
import { getAllUserMasterGymIds } from '../db/userProfileQueries.js';
import { getSourceGymsByMasterGymId } from '../db/gymQueries.js';
import { queryTournaments } from '../db/queries.js';
import type { SourceGymItem } from '../db/types.js';

/**
 * Result of a roster sync batch operation
 */
export interface RosterSyncBatchResult {
  successCount: number;
  failureCount: number;
  pairs: Array<{
    tournamentId: string;
    gymExternalId: string;
    success: boolean;
    athleteCount?: number;
    error?: string;
  }>;
}

/**
 * Rate limiting configuration
 */
const CONCURRENCY_LIMIT = 10;
const BATCH_DELAY_MS = 1000;

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse tournament PK to extract org and tournamentId
 * @param tournamentPK - e.g., "TOURN#JJWL#850"
 */
function parseTournamentPK(tournamentPK: string): { org: 'JJWL' | 'IBJJF'; tournamentId: string } | null {
  const parts = tournamentPK.split('#');
  if (parts.length !== 3) return null;

  const org = parts[1] as 'JJWL' | 'IBJJF';
  const tournamentId = parts[2];

  return { org, tournamentId };
}

/**
 * Parse gymSourceId to extract org and gymExternalId
 * @param gymSourceId - e.g., "JJWL#5713"
 */
function parseGymSourceId(gymSourceId: string): { org: 'JJWL' | 'IBJJF'; gymExternalId: string } | null {
  const parts = gymSourceId.split('#');
  if (parts.length !== 2) return null;

  const org = parts[0] as 'JJWL' | 'IBJJF';
  const gymExternalId = parts[1];

  return { org, gymExternalId };
}

/**
 * Sync rosters for wishlisted tournaments.
 *
 * This function:
 * 1. Gets all wishlisted tournaments within the date range
 * 2. Gets all athletes with gym associations
 * 3. Creates (tournament, gym) pairs for syncing
 * 4. Rate-limits syncing to avoid overwhelming the API
 *
 * @param daysAhead - Number of days to look ahead for tournaments
 * @returns Summary of sync results
 */
export async function syncWishlistedRosters(daysAhead: number = 60): Promise<RosterSyncBatchResult> {
  console.log(`[RosterSyncService] Starting roster sync for tournaments within ${daysAhead} days`);

  // Step 1: Get wishlisted tournaments
  const tournamentPKs = await getAllWishlistedTournamentPKs(daysAhead);

  if (tournamentPKs.length === 0) {
    console.log('[RosterSyncService] No wishlisted tournaments found within date range');
    return { successCount: 0, failureCount: 0, pairs: [] };
  }

  console.log(`[RosterSyncService] Found ${tournamentPKs.length} wishlisted tournaments`);

  // Step 2: Get all athletes with gym associations
  const athletes = await getAllAthletesWithGyms();

  if (athletes.length === 0) {
    console.log('[RosterSyncService] No athletes with gym associations found');
    return { successCount: 0, failureCount: 0, pairs: [] };
  }

  console.log(`[RosterSyncService] Found ${athletes.length} athletes with gym associations`);

  // Step 3: Create unique (tournament, gym) pairs
  const uniqueGymIds = [...new Set(
    athletes
      .map(a => a.gymSourceId)
      .filter((id): id is string => id !== null)
  )];

  const pairs: Array<{ tournamentId: string; gymExternalId: string; org: 'JJWL' | 'IBJJF' }> = [];

  for (const tournamentPK of tournamentPKs) {
    const parsed = parseTournamentPK(tournamentPK);
    if (!parsed || parsed.org !== 'JJWL') continue; // Only JJWL supported

    for (const gymSourceId of uniqueGymIds) {
      const gymParsed = parseGymSourceId(gymSourceId);
      if (!gymParsed || gymParsed.org !== 'JJWL') continue; // Only JJWL gyms

      pairs.push({
        tournamentId: parsed.tournamentId,
        gymExternalId: gymParsed.gymExternalId,
        org: 'JJWL',
      });
    }
  }

  console.log(`[RosterSyncService] Created ${pairs.length} (tournament, gym) pairs to sync`);

  if (pairs.length === 0) {
    return { successCount: 0, failureCount: 0, pairs: [] };
  }

  // Step 4: Rate-limited sync
  const results: RosterSyncBatchResult['pairs'] = [];
  let successCount = 0;
  let failureCount = 0;

  // Process in batches of CONCURRENCY_LIMIT
  for (let i = 0; i < pairs.length; i += CONCURRENCY_LIMIT) {
    const batch = pairs.slice(i, i + CONCURRENCY_LIMIT);

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (pair) => {
        try {
          const result = await syncGymRoster(pair.org, pair.tournamentId, pair.gymExternalId);
          return {
            tournamentId: pair.tournamentId,
            gymExternalId: pair.gymExternalId,
            success: result.success,
            athleteCount: result.athleteCount,
            error: result.error,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return {
            tournamentId: pair.tournamentId,
            gymExternalId: pair.gymExternalId,
            success: false,
            error: message,
          };
        }
      })
    );

    // Aggregate results
    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    // Delay before next batch (unless this is the last batch)
    if (i + CONCURRENCY_LIMIT < pairs.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  console.log(
    `[RosterSyncService] Sync complete: ${successCount} success, ${failureCount} failures out of ${pairs.length} pairs`
  );

  return { successCount, failureCount, pairs: results };
}

/**
 * Sync rosters for user gym affiliations.
 *
 * This function:
 * 1. Gets all master gym IDs from user profiles
 * 2. Gets source gyms linked to each master gym
 * 3. Queries tournaments within the date range (default 90 days)
 * 4. Creates (tournament, gym) pairs for syncing (matching org)
 * 5. Rate-limits syncing to avoid overwhelming the API
 *
 * @param daysAhead - Number of days to look ahead for tournaments (default 90)
 * @returns Summary of sync results
 */
export async function syncUserGymRosters(daysAhead: number = 90): Promise<RosterSyncBatchResult> {
  console.log(`[RosterSyncService] Starting user gym roster sync for tournaments within ${daysAhead} days`);

  // Step 1: Get all unique master gym IDs from user profiles
  const masterGymIds = await getAllUserMasterGymIds();

  if (masterGymIds.length === 0) {
    console.log('[RosterSyncService] No user gyms found');
    return { successCount: 0, failureCount: 0, pairs: [] };
  }

  // Deduplicate master gym IDs (users may share the same gym)
  const uniqueMasterGymIds = [...new Set(masterGymIds)];
  console.log(`[RosterSyncService] Found ${uniqueMasterGymIds.length} unique user gyms`);

  // Step 2: Get source gyms linked to each master gym
  const sourceGymsMap = new Map<string, SourceGymItem[]>();
  for (const masterGymId of uniqueMasterGymIds) {
    const sourceGyms = await getSourceGymsByMasterGymId(masterGymId);
    if (sourceGyms.length > 0) {
      sourceGymsMap.set(masterGymId, sourceGyms);
    }
  }

  // Flatten and deduplicate source gyms
  const allSourceGyms: SourceGymItem[] = [];
  const seenSourceGymPKs = new Set<string>();
  for (const sourceGyms of sourceGymsMap.values()) {
    for (const gym of sourceGyms) {
      if (!seenSourceGymPKs.has(gym.PK)) {
        seenSourceGymPKs.add(gym.PK);
        allSourceGyms.push(gym);
      }
    }
  }

  if (allSourceGyms.length === 0) {
    console.log('[RosterSyncService] No source gyms linked to user master gyms');
    return { successCount: 0, failureCount: 0, pairs: [] };
  }

  console.log(`[RosterSyncService] Found ${allSourceGyms.length} unique source gyms`);

  // Step 3: Query tournaments within the date range
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const startAfter = today.toISOString().split('T')[0];
  const startBefore = futureDate.toISOString().split('T')[0];

  // Fetch all tournaments in window (paginate if needed)
  const allTournaments = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await queryTournaments(
      { startAfter, startBefore },
      250,
      lastKey
    );
    allTournaments.push(...result.items);
    lastKey = result.lastKey;
  } while (lastKey);

  if (allTournaments.length === 0) {
    console.log('[RosterSyncService] No tournaments found within date range');
    return { successCount: 0, failureCount: 0, pairs: [] };
  }

  console.log(`[RosterSyncService] Found ${allTournaments.length} tournaments within ${daysAhead} days`);

  // Step 4: Create (tournament, gym) pairs - only match org (JJWL gyms at JJWL tournaments, etc.)
  const pairs: Array<{ tournamentId: string; gymExternalId: string; org: 'JJWL' | 'IBJJF' }> = [];

  for (const tournament of allTournaments) {
    // Only JJWL supported for now
    if (tournament.org !== 'JJWL') continue;

    for (const sourceGym of allSourceGyms) {
      // Only sync gyms that match the tournament org
      if (sourceGym.org !== tournament.org) continue;

      pairs.push({
        tournamentId: tournament.externalId,
        gymExternalId: sourceGym.externalId,
        org: sourceGym.org,
      });
    }
  }

  console.log(`[RosterSyncService] Created ${pairs.length} (tournament, gym) pairs to sync`);

  if (pairs.length === 0) {
    return { successCount: 0, failureCount: 0, pairs: [] };
  }

  // Step 5: Rate-limited sync (reuse existing batch logic)
  const results: RosterSyncBatchResult['pairs'] = [];
  let successCount = 0;
  let failureCount = 0;

  // Process in batches of CONCURRENCY_LIMIT
  for (let i = 0; i < pairs.length; i += CONCURRENCY_LIMIT) {
    const batch = pairs.slice(i, i + CONCURRENCY_LIMIT);

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (pair) => {
        try {
          const result = await syncGymRoster(pair.org, pair.tournamentId, pair.gymExternalId);
          return {
            tournamentId: pair.tournamentId,
            gymExternalId: pair.gymExternalId,
            success: result.success,
            athleteCount: result.athleteCount,
            error: result.error,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return {
            tournamentId: pair.tournamentId,
            gymExternalId: pair.gymExternalId,
            success: false,
            error: message,
          };
        }
      })
    );

    // Aggregate results
    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    // Delay before next batch (unless this is the last batch)
    if (i + CONCURRENCY_LIMIT < pairs.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  console.log(
    `[RosterSyncService] User gym sync complete: ${successCount} success, ${failureCount} failures out of ${pairs.length} pairs`
  );

  return { successCount, failureCount, pairs: results };
}
