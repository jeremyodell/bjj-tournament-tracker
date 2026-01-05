import { getAllWishlistedTournamentPKs } from '../db/wishlistQueries.js';
import { getAllAthletesWithGyms } from '../db/athleteQueries.js';
import { syncGymRoster, type RosterSyncResult } from './gymSyncService.js';

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
