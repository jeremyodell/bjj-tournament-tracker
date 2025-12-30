import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handler } from '../../handlers/websocket.js';
import { saveConnection, deleteConnection } from '../../db/wsConnectionQueries.js';

// Mock the wsConnectionQueries
jest.mock('../../db/wsConnectionQueries.js', () => ({
  saveConnection: jest.fn(),
  deleteConnection: jest.fn(),
}));

const mockSaveConnection = saveConnection as jest.MockedFunction<
  typeof saveConnection
>;
const mockDeleteConnection = deleteConnection as jest.MockedFunction<
  typeof deleteConnection
>;

describe('websocket handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('$connect', () => {
    it('should handle $connect with userId', async () => {
      mockSaveConnection.mockResolvedValueOnce(undefined);

      const event = {
        requestContext: {
          connectionId: 'test-conn-id',
          routeKey: '$connect',
        },
        queryStringParameters: {
          userId: 'user-123',
        },
      };

      const result = await handler(event as any);

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Connected');
      expect(mockSaveConnection).toHaveBeenCalledWith('test-conn-id', 'user-123');
    });

    it('should return 400 when userId is missing on $connect', async () => {
      const event = {
        requestContext: {
          connectionId: 'test-conn-id',
          routeKey: '$connect',
        },
        queryStringParameters: null,
      };

      const result = await handler(event as any);

      expect(result.statusCode).toBe(400);
      expect(result.body).toBe('userId required');
      expect(mockSaveConnection).not.toHaveBeenCalled();
    });

    it('should return 400 when queryStringParameters is undefined', async () => {
      const event = {
        requestContext: {
          connectionId: 'test-conn-id',
          routeKey: '$connect',
        },
      };

      const result = await handler(event as any);

      expect(result.statusCode).toBe(400);
      expect(result.body).toBe('userId required');
    });
  });

  describe('$disconnect', () => {
    it('should handle $disconnect', async () => {
      mockDeleteConnection.mockResolvedValueOnce(undefined);

      const event = {
        requestContext: {
          connectionId: 'test-conn-id',
          routeKey: '$disconnect',
        },
      };

      const result = await handler(event as any);

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Disconnected');
      expect(mockDeleteConnection).toHaveBeenCalledWith('test-conn-id');
    });
  });

  describe('unknown route', () => {
    it('should return 400 for unknown route', async () => {
      const event = {
        requestContext: {
          connectionId: 'test-conn-id',
          routeKey: '$unknown',
        },
      };

      const result = await handler(event as any);

      expect(result.statusCode).toBe(400);
      expect(result.body).toBe('Unknown route');
    });
  });

  describe('error handling', () => {
    it('should return 500 on saveConnection error', async () => {
      mockSaveConnection.mockRejectedValueOnce(new Error('DB error'));

      const event = {
        requestContext: {
          connectionId: 'test-conn-id',
          routeKey: '$connect',
        },
        queryStringParameters: {
          userId: 'user-123',
        },
      };

      const result = await handler(event as any);

      expect(result.statusCode).toBe(500);
      expect(result.body).toBe('Internal error');
    });

    it('should return 500 on deleteConnection error', async () => {
      mockDeleteConnection.mockRejectedValueOnce(new Error('DB error'));

      const event = {
        requestContext: {
          connectionId: 'test-conn-id',
          routeKey: '$disconnect',
        },
      };

      const result = await handler(event as any);

      expect(result.statusCode).toBe(500);
      expect(result.body).toBe('Internal error');
    });
  });
});
