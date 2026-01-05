import type { Context, ScheduledEvent } from 'aws-lambda';
import {
  syncWishlistedRosters,
  type RosterSyncBatchResult,
} from '../services/rosterSyncService.js';

/**
 * Event payload for manual invocation
 */
interface RosterSyncEvent {
  daysAhead?: number;
}

/**
 * Response format for the Lambda handler
 */
interface RosterSyncResponse {
  success: boolean;
  result: RosterSyncBatchResult;
}

/**
 * Daily Roster Sync Lambda Handler
 *
 * Triggered by EventBridge at 3am UTC to pre-fetch rosters for upcoming tournaments.
 * Only syncs (tournament, gym) pairs where users have wishlisted tournaments.
 *
 * Rate limited: 10 concurrent requests with 1s delay between batches.
 *
 * @param event - ScheduledEvent from EventBridge or manual invocation with daysAhead
 * @param context - Lambda execution context
 * @returns Summary of sync results
 */
export async function handler(
  event: RosterSyncEvent | ScheduledEvent,
  context: Context
): Promise<RosterSyncResponse> {
  const requestId = context.awsRequestId;
  const source = 'source' in event ? event.source : 'manual';
  const daysAhead = 'daysAhead' in event && typeof event.daysAhead === 'number'
    ? event.daysAhead
    : 60;

  console.log('[RosterSync] Starting sync', {
    requestId,
    source,
    daysAhead,
  });

  try {
    const result = await syncWishlistedRosters(daysAhead);

    console.log('[RosterSync] Sync complete', {
      requestId,
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalPairs: result.pairs.length,
    });

    return {
      success: true,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('[RosterSync] Unexpected error', {
      requestId,
      error: message,
    });

    // Throw to trigger CloudWatch alarm
    throw error;
  }
}
