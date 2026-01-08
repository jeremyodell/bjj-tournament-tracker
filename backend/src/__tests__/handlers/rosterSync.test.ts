import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handler } from '../../handlers/rosterSync.js';
import * as rosterSyncService from '../../services/rosterSyncService.js';

// Mock dependencies
jest.mock('../../services/rosterSyncService.js');

const mockSyncUserGymRosters = rosterSyncService.syncUserGymRosters as jest.MockedFunction<
  typeof rosterSyncService.syncUserGymRosters
>;

describe('rosterSync handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call syncUserGymRosters and return success', async () => {
    mockSyncUserGymRosters.mockResolvedValue({
      successCount: 10,
      failureCount: 2,
      pairs: [],
    });

    const result = await handler(
      {},
      { awsRequestId: 'test-123' } as any
    );

    expect(result.success).toBe(true);
    expect(result.result.successCount).toBe(10);
    expect(result.result.failureCount).toBe(2);
    expect(mockSyncUserGymRosters).toHaveBeenCalledWith(90);
  });

  it('should use custom daysAhead from event', async () => {
    mockSyncUserGymRosters.mockResolvedValue({
      successCount: 5,
      failureCount: 0,
      pairs: [],
    });

    await handler(
      { daysAhead: 30 },
      { awsRequestId: 'test-456' } as any
    );

    expect(mockSyncUserGymRosters).toHaveBeenCalledWith(30);
  });

  it('should handle ScheduledEvent format from EventBridge', async () => {
    mockSyncUserGymRosters.mockResolvedValue({
      successCount: 15,
      failureCount: 0,
      pairs: [],
    });

    const scheduledEvent = {
      source: 'aws.events',
      time: '2026-01-05T03:00:00Z',
      'detail-type': 'Scheduled Event',
      detail: {},
    };

    const result = await handler(
      scheduledEvent as any,
      { awsRequestId: 'test-scheduled' } as any
    );

    expect(result.success).toBe(true);
    expect(mockSyncUserGymRosters).toHaveBeenCalledWith(90);
  });

  it('should throw on service exception to trigger CloudWatch alarm', async () => {
    mockSyncUserGymRosters.mockRejectedValue(new Error('Database connection failed'));

    await expect(
      handler({}, { awsRequestId: 'test-error' } as any)
    ).rejects.toThrow('Database connection failed');
  });

  it('should log request context', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockSyncUserGymRosters.mockResolvedValue({
      successCount: 0,
      failureCount: 0,
      pairs: [],
    });

    await handler({}, { awsRequestId: 'test-logging' } as any);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[RosterSync]'),
      expect.anything()
    );

    consoleSpy.mockRestore();
  });

  it('should return success even with some failures', async () => {
    mockSyncUserGymRosters.mockResolvedValue({
      successCount: 8,
      failureCount: 4,
      pairs: [],
    });

    const result = await handler({}, { awsRequestId: 'test-partial' } as any);

    // Partial failures should still return success (logging handles visibility)
    expect(result.success).toBe(true);
    expect(result.result.failureCount).toBe(4);
  });

  it('should default daysAhead to 90 when not provided in event', async () => {
    mockSyncUserGymRosters.mockResolvedValue({
      successCount: 0,
      failureCount: 0,
      pairs: [],
    });

    await handler({}, { awsRequestId: 'test-default' } as any);

    expect(mockSyncUserGymRosters).toHaveBeenCalledWith(90);
  });
});
