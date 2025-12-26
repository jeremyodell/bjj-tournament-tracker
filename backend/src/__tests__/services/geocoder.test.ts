import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { geocodeVenue, type GeocodeResult } from '../../services/geocoder.js';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('geocodeVenue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  it('returns high confidence for rooftop result', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 35.1495, lng: -90.0490 },
              location_type: 'ROOFTOP',
            },
            formatted_address: 'Memphis Cook Convention Center, Memphis, TN, USA',
          },
        ],
      },
    });

    const result = await geocodeVenue('Memphis Cook Convention Center', 'Memphis', 'USA');

    expect(result).toEqual({
      lat: 35.1495,
      lng: -90.0490,
      confidence: 'high',
      formattedAddress: 'Memphis Cook Convention Center, Memphis, TN, USA',
    });
  });

  it('returns low confidence for approximate result', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 35.15, lng: -90.05 },
              location_type: 'APPROXIMATE',
            },
            formatted_address: 'Memphis, TN, USA',
          },
        ],
      },
    });

    const result = await geocodeVenue('Unknown Venue', 'Memphis', 'USA');

    expect(result?.confidence).toBe('low');
  });

  it('returns null for zero results', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'ZERO_RESULTS', results: [] },
    });

    const result = await geocodeVenue('Nonexistent Place', 'Nowhere', null);

    expect(result).toBeNull();
  });

  it('builds query with country when provided', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'ZERO_RESULTS', results: [] },
    });

    await geocodeVenue('Some Venue', 'Memphis', 'USA');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('address=Some%20Venue%2C%20Memphis%2C%20USA')
    );
  });

  it('builds query without country when null', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'ZERO_RESULTS', results: [] },
    });

    await geocodeVenue('Some Venue', 'Memphis', null);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('address=Some%20Venue%2C%20Memphis')
    );
    expect(mockedAxios.get).not.toHaveBeenCalledWith(
      expect.stringContaining('null')
    );
  });
});
