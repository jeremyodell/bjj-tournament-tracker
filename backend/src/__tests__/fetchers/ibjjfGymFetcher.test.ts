import { describe, it, expect } from '@jest/globals';
import { sanitizeGymName } from '../../fetchers/ibjjfGymFetcher.js';

describe('ibjjfGymFetcher', () => {
  describe('sanitizeGymName', () => {
    it('removes # character from name', () => {
      expect(sanitizeGymName('Team #1 BJJ')).toBe('Team 1 BJJ');
    });

    it('removes multiple # characters', () => {
      expect(sanitizeGymName('Gym #1 #2 #3')).toBe('Gym 1 2 3');
    });

    it('trims whitespace', () => {
      expect(sanitizeGymName('  Test Gym  ')).toBe('Test Gym');
    });

    it('handles empty string', () => {
      expect(sanitizeGymName('')).toBe('');
    });

    it('returns unchanged string with no # or whitespace', () => {
      expect(sanitizeGymName('Normal Gym Name')).toBe('Normal Gym Name');
    });
  });
});
