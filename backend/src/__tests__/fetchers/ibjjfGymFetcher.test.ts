import { describe, it, expect } from '@jest/globals';
import { sanitizeGymName, mapIBJJFAcademyToGym } from '../../fetchers/ibjjfGymFetcher.js';
import type { IBJJFAcademy } from '../../fetchers/types.js';

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

  describe('mapIBJJFAcademyToGym', () => {
    it('maps all fields correctly', () => {
      const academy: IBJJFAcademy = {
        id: 12345,
        name: 'Gracie Barra',
        country: 'United States',
        countryCode: 'US',
        city: 'Irvine',
        address: '123 Main St',
        federation: 'IBJJF',
        site: 'https://graciebarra.com',
        responsible: 'Carlos Gracie Jr',
      };

      const result = mapIBJJFAcademyToGym(academy);

      expect(result.org).toBe('IBJJF');
      expect(result.externalId).toBe('12345');
      expect(result.name).toBe('Gracie Barra');
      expect(result.country).toBe('United States');
      expect(result.countryCode).toBe('US');
      expect(result.city).toBe('Irvine');
      expect(result.address).toBe('123 Main St');
      expect(result.federation).toBe('IBJJF');
      expect(result.website).toBe('https://graciebarra.com');
      expect(result.responsible).toBe('Carlos Gracie Jr');
    });

    it('converts numeric id to string externalId', () => {
      const academy: IBJJFAcademy = {
        id: 99999,
        name: 'Test',
        country: '',
        countryCode: '',
        city: '',
        address: '',
        federation: '',
        site: '',
        responsible: '',
      };

      const result = mapIBJJFAcademyToGym(academy);

      expect(result.externalId).toBe('99999');
      expect(typeof result.externalId).toBe('string');
    });

    it('sanitizes name by removing # characters', () => {
      const academy: IBJJFAcademy = {
        id: 1,
        name: 'Team #1 BJJ',
        country: '',
        countryCode: '',
        city: '',
        address: '',
        federation: '',
        site: '',
        responsible: '',
      };

      const result = mapIBJJFAcademyToGym(academy);

      expect(result.name).toBe('Team 1 BJJ');
    });

    it('handles empty optional fields as undefined', () => {
      const academy: IBJJFAcademy = {
        id: 1,
        name: 'Test Gym',
        country: '',
        countryCode: '',
        city: '',
        address: '',
        federation: '',
        site: '',
        responsible: '',
      };

      const result = mapIBJJFAcademyToGym(academy);

      expect(result.country).toBeUndefined();
      expect(result.countryCode).toBeUndefined();
      expect(result.city).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.federation).toBeUndefined();
      expect(result.website).toBeUndefined();
      expect(result.responsible).toBeUndefined();
    });
  });
});
