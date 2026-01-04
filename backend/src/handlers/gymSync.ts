import type { Context, ScheduledEvent } from 'aws-lambda';
import {
  syncIBJJFGyms,
  type IBJJFGymSyncResult,
} from '../services/gymSyncService.js';

interface GymSyncEvent {
  forceSync?: boolean;
}

interface GymSyncResponse {
  success: boolean;
  result: IBJJFGymSyncResult;
}

export async function handler(
  event: GymSyncEvent | ScheduledEvent,
  context: Context
): Promise<GymSyncResponse> {
  const requestId = context.awsRequestId;
  const source = 'source' in event ? event.source : 'manual';
  const forceSync = 'forceSync' in event ? event.forceSync === true : false;

  console.log('[GymSync] Starting sync', {
    requestId,
    source,
    forceSync,
  });

  try {
    const result = await syncIBJJFGyms({ forceSync });

    console.log('[GymSync] Sync complete', {
      requestId,
      ...result,
    });

    // Throw on error to trigger CloudWatch alarm
    if (result.error) {
      throw new Error(`IBJJF gym sync failed: ${result.error}`);
    }

    return {
      success: true,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('[GymSync] Unexpected error', {
      requestId,
      error: message,
    });

    throw error;
  }
}
