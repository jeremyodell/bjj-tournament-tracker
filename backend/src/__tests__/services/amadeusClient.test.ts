import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AmadeusClient } from '../../services/amadeusClient.js';

// Store original fetch
const originalFetch = global.fetch;

describe('AmadeusClient', () => {
  let client: AmadeusClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = mockFetch;
    client = new AmadeusClient('test-key', 'test-secret');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should obtain access token from Amadeus API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token-abc123',
          token_type: 'Bearer',
          expires_in: 1799,
        }),
      } as Response);

      await client.authenticate();

      expect(client.isAuthenticated()).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.amadeus.com/v1/security/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    it('should throw error on auth failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(client.authenticate()).rejects.toThrow('Amadeus auth failed: 401');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false initially', () => {
      expect(client.isAuthenticated()).toBe(false);
    });

    it('should return true after successful auth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 1799,
        }),
      } as Response);

      await client.authenticate();

      expect(client.isAuthenticated()).toBe(true);
    });
  });

  describe('searchFlights', () => {
    it('should return cheapest flight price', async () => {
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 1799,
        }),
      } as Response);

      // Mock flight search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              type: 'flight-offer',
              price: {
                currency: 'USD',
                total: '287.00',
                grandTotal: '287.00',
              },
              validatingAirlineCodes: ['AA'],
            },
          ],
        }),
      } as Response);

      const result = await client.searchFlights({
        origin: 'DFW',
        destination: 'MIA',
        departureDate: '2025-02-14',
        returnDate: '2025-02-16',
      });

      expect(result).not.toBeNull();
      expect(result?.price).toBe(287);
      expect(result?.currency).toBe('USD');
      expect(result?.airline).toBe('AA');
    });

    it('should return null when no flights found', async () => {
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 1799,
        }),
      } as Response);

      // Mock empty result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      const result = await client.searchFlights({
        origin: 'DFW',
        destination: 'XXX',
        departureDate: '2025-02-14',
        returnDate: '2025-02-16',
      });

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 1799,
        }),
      } as Response);

      // Mock API error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await client.searchFlights({
        origin: 'DFW',
        destination: 'MIA',
        departureDate: '2025-02-14',
        returnDate: '2025-02-16',
      });

      expect(result).toBeNull();
    });

    it('should auto-authenticate if not authenticated', async () => {
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 1799,
        }),
      } as Response);

      // Mock flight search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              price: { total: '199.00', currency: 'USD' },
              validatingAirlineCodes: ['UA'],
            },
          ],
        }),
      } as Response);

      // Should authenticate automatically
      expect(client.isAuthenticated()).toBe(false);

      await client.searchFlights({
        origin: 'DFW',
        destination: 'LAX',
        departureDate: '2025-03-01',
        returnDate: '2025-03-03',
      });

      expect(client.isAuthenticated()).toBe(true);
      // Should have made 2 calls: auth + search
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle missing airline codes', async () => {
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token',
          expires_in: 1799,
        }),
      } as Response);

      // Mock flight without airline codes
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              price: { total: '299.00', currency: 'USD' },
              // No validatingAirlineCodes
            },
          ],
        }),
      } as Response);

      const result = await client.searchFlights({
        origin: 'DFW',
        destination: 'MIA',
        departureDate: '2025-02-14',
        returnDate: '2025-02-16',
      });

      expect(result).not.toBeNull();
      expect(result?.price).toBe(299);
      expect(result?.airline).toBeNull();
    });
  });
});
