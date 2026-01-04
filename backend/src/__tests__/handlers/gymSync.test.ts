import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handler } from '../../handlers/gymSync.js';
import * as gymSyncService from '../../services/gymSyncService.js';

jest.mock('../../services/gymSyncService.js');

const mockSyncIBJJFGyms = gymSyncService.syncIBJJFGyms as jest.MockedFunction<
  typeof gymSyncService.syncIBJJFGyms
>;

describe('gymSync handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call syncIBJJFGyms and return success', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: false,
      fetched: 8573,
      saved: 8573,
      duration: 480000,
    });

    const result = await handler(
      { forceSync: false },
      { awsRequestId: 'test-123' } as any
    );

    expect(result.success).toBe(true);
    expect(result.result.fetched).toBe(8573);
    expect(mockSyncIBJJFGyms).toHaveBeenCalledWith({ forceSync: false });
  });

  it('should pass forceSync from event', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: false,
      fetched: 100,
      saved: 100,
      duration: 1000,
    });

    await handler({ forceSync: true }, { awsRequestId: 'test-456' } as any);

    expect(mockSyncIBJJFGyms).toHaveBeenCalledWith({ forceSync: true });
  });

  it('should throw on sync error to trigger CloudWatch alarm', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: false,
      fetched: 0,
      saved: 0,
      duration: 1000,
      error: 'API timeout',
    });

    await expect(
      handler({}, { awsRequestId: 'test-789' } as any)
    ).rejects.toThrow('IBJJF gym sync failed: API timeout');
  });

  it('should return skipped result without error', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: true,
      fetched: 0,
      saved: 0,
      duration: 100,
    });

    const result = await handler({}, { awsRequestId: 'test-skip' } as any);

    expect(result.success).toBe(true);
    expect(result.result.skipped).toBe(true);
  });

  it('should default forceSync to false when not provided', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: true,
      fetched: 0,
      saved: 0,
      duration: 100,
    });

    await handler({}, { awsRequestId: 'test-default' } as any);

    expect(mockSyncIBJJFGyms).toHaveBeenCalledWith({ forceSync: false });
  });

  it('should handle ScheduledEvent format', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: false,
      fetched: 100,
      saved: 100,
      duration: 1000,
    });

    const scheduledEvent = {
      source: 'aws.events',
      time: '2026-01-04T06:00:00Z',
      'detail-type': 'Scheduled Event',
      detail: {},
    };

    const result = await handler(
      scheduledEvent as any,
      { awsRequestId: 'test-scheduled' } as any
    );

    expect(result.success).toBe(true);
    expect(mockSyncIBJJFGyms).toHaveBeenCalledWith({ forceSync: false });
  });

  it('should propagate unexpected service exceptions', async () => {
    mockSyncIBJJFGyms.mockRejectedValue(new Error('DB connection failed'));

    await expect(
      handler({}, { awsRequestId: 'test-exception' } as any)
    ).rejects.toThrow('DB connection failed');
  });
});
