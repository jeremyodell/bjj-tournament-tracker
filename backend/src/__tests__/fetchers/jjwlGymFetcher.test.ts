import { describe, it, expect } from '@jest/globals';
import {
  mapJJWLGymToNormalized,
  parseJJWLGymsResponse,
} from '../../fetchers/jjwlGymFetcher.js';
import type { JJWLGym } from '../../fetchers/types.js';

describe('jjwlGymFetcher', () => {
  describe('mapJJWLGymToNormalized', () => {
    it('maps gym fields correctly', () => {
      const jjwlGym: JJWLGym = { id: '5713', name: 'Pablo Silva BJJ' };

      const result = mapJJWLGymToNormalized(jjwlGym);

      expect(result.org).toBe('JJWL');
      expect(result.externalId).toBe('5713');
      expect(result.name).toBe('Pablo Silva BJJ');
    });

    it('trims whitespace from name', () => {
      const jjwlGym: JJWLGym = { id: '123', name: '  Test Gym  ' };

      const result = mapJJWLGymToNormalized(jjwlGym);

      expect(result.name).toBe('Test Gym');
    });
  });

  describe('parseJJWLGymsResponse', () => {
    it('parses valid JSON array', () => {
      const response = {
        status: true,
        length: 2,
        data: [
          { id: '1', name: 'Gym A' },
          { id: '2', name: 'Gym B' },
        ],
      };

      const result = parseJJWLGymsResponse(response);

      expect(result).toHaveLength(2);
      expect(result[0].externalId).toBe('1');
      expect(result[1].externalId).toBe('2');
    });

    it('filters out entries with empty id', () => {
      const response = {
        status: true,
        length: 2,
        data: [
          { id: '1', name: 'Valid Gym' },
          { id: '', name: 'No ID' },
        ],
      };

      const result = parseJJWLGymsResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Gym');
    });

    it('filters out entries with empty name', () => {
      const response = {
        status: true,
        length: 2,
        data: [
          { id: '1', name: 'Valid Gym' },
          { id: '3', name: '' },
        ],
      };

      const result = parseJJWLGymsResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Gym');
    });

    it('filters out entries with whitespace-only name', () => {
      const response = {
        status: true,
        length: 2,
        data: [
          { id: '1', name: 'Valid Gym' },
          { id: '3', name: '   ' },
        ],
      };

      const result = parseJJWLGymsResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Gym');
    });

    it('filters out entries with missing id field', () => {
      const response = {
        status: true,
        length: 2,
        data: [
          { id: '1', name: 'Valid Gym' },
          { name: 'Missing ID' },
        ],
      };

      const result = parseJJWLGymsResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Gym');
    });

    it('handles non-array response', () => {
      const response = { error: 'not an array' };

      const result = parseJJWLGymsResponse(response);

      expect(result).toHaveLength(0);
    });

    it('handles null response', () => {
      const result = parseJJWLGymsResponse(null);

      expect(result).toHaveLength(0);
    });

    it('handles empty array', () => {
      const result = parseJJWLGymsResponse({ status: true, length: 0, data: [] });

      expect(result).toHaveLength(0);
    });
  });
});
