import type { ScheduledEvent, Context } from 'aws-lambda';
import { syncAllTournaments, type SyncResult } from '../services/syncService.js';

interface SyncResponse {
  success: boolean;
  result: SyncResult;
  duration: number;
}

export async function handler(
  event: ScheduledEvent,
  context: Context
): Promise<SyncResponse> {
  const startTime = Date.now();

  console.log('Starting tournament sync', {
    requestId: context.awsRequestId,
    source: event.source,
    time: event.time,
  });

  try {
    const result = await syncAllTournaments();

    const duration = Date.now() - startTime;

    console.log('Sync completed', {
      requestId: context.awsRequestId,
      duration,
      ibjjf: {
        fetched: result.ibjjf.fetched,
        saved: result.ibjjf.saved,
        error: result.ibjjf.error,
      },
      jjwl: {
        fetched: result.jjwl.fetched,
        saved: result.jjwl.saved,
        error: result.jjwl.error,
      },
    });

    // Check if both sources failed
    const bothFailed = result.ibjjf.error && result.jjwl.error;

    if (bothFailed) {
      console.error('Both sources failed to sync');
    }

    return {
      success: !bothFailed,
      result,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('Sync failed with unexpected error', {
      requestId: context.awsRequestId,
      error: message,
      duration,
    });

    throw error;
  }
}
