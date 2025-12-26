import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { VenueItem } from '../../db/types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSend = jest.fn<() => Promise<any>>();

// Mock the DynamoDB client
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: mockSend,
  },
  TABLE_NAME: 'test-table',
  GSI1_NAME: 'GSI1',
}));

// Import after mock
import { getVenueByLookup, upsertVenue } from '../../db/queries.js';

describe('venue cache queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVenueByLookup', () => {
    it('returns venue when found', async () => {
      const mockVenue: VenueItem = {
        PK: 'VENUE#123',
        SK: 'META',
        GSI1PK: 'VENUE_LOOKUP',
        GSI1SK: 'memphis cook convention center#memphis',
        venueId: '123',
        name: 'Memphis Cook Convention Center',
        city: 'Memphis',
        country: 'USA',
        lat: 35.15,
        lng: -90.05,
        geocodeConfidence: 'high',
        manualOverride: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      mockSend.mockResolvedValue({ Items: [mockVenue] });

      const result = await getVenueByLookup('Memphis Cook Convention Center', 'Memphis');

      expect(result).toEqual(mockVenue);
    });

    it('returns null when not found', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await getVenueByLookup('Unknown Venue', 'Nowhere');

      expect(result).toBeNull();
    });
  });
});
