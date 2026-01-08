import { describe, it, expect } from '@jest/globals';
import {
  sanitizeGymName,
  mapIBJJFAcademyToGym,
  parseIBJJFAcademiesResponse,
} from '../../fetchers/ibjjfGymFetcher.js';
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
        countryAbbr: 'US',
        city: 'Irvine',
        address: '123 Main St',
        federationAbbr: 'IBJJF',
        website: 'https://graciebarra.com',
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
        countryAbbr: '',
        city: '',
        address: '',
        federationAbbr: '',
        website: null,
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
        countryAbbr: '',
        city: '',
        address: '',
        federationAbbr: '',
        website: null,
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
        countryAbbr: '',
        city: '',
        address: '',
        federationAbbr: '',
        website: null,
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

  describe('parseIBJJFAcademiesResponse', () => {
    it('parses valid response with multiple academies', () => {
      const response = {
        pagination: { totalRecords: 100 },
        list: [
          { id: 1, name: 'Gym A', country: 'US', countryAbbr: 'US', city: 'NYC', address: '', federationAbbr: '', website: null, responsible: '' },
          { id: 2, name: 'Gym B', country: 'BR', countryAbbr: 'BR', city: 'Rio', address: '', federationAbbr: '', website: null, responsible: '' },
        ],
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(2);
      expect(result.totalRecords).toBe(100);
      expect(result.gyms[0].externalId).toBe('1');
      expect(result.gyms[1].externalId).toBe('2');
    });

    it('filters entries with missing id', () => {
      const response = {
        pagination: { totalRecords: 2 },
        list: [
          { id: 1, name: 'Valid Gym', country: '', countryAbbr: '', city: '', address: '', federationAbbr: '', website: null, responsible: '' },
          { name: 'No ID Gym', country: '', countryAbbr: '', city: '', address: '', federationAbbr: '', website: null, responsible: '' },
        ],
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(1);
      expect(result.gyms[0].name).toBe('Valid Gym');
    });

    it('filters entries with missing name', () => {
      const response = {
        pagination: { totalRecords: 2 },
        list: [
          { id: 1, name: 'Valid Gym', country: '', countryAbbr: '', city: '', address: '', federationAbbr: '', website: null, responsible: '' },
          { id: 2, country: '', countryAbbr: '', city: '', address: '', federationAbbr: '', website: null, responsible: '' },
        ],
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(1);
      expect(result.gyms[0].name).toBe('Valid Gym');
    });

    it('filters entries with empty name', () => {
      const response = {
        pagination: { totalRecords: 2 },
        list: [
          { id: 1, name: 'Valid Gym', country: '', countryAbbr: '', city: '', address: '', federationAbbr: '', website: null, responsible: '' },
          { id: 2, name: '', country: '', countryAbbr: '', city: '', address: '', federationAbbr: '', website: null, responsible: '' },
        ],
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(1);
    });

    it('filters entries with whitespace-only name', () => {
      const response = {
        pagination: { totalRecords: 2 },
        list: [
          { id: 1, name: 'Valid Gym', country: '', countryAbbr: '', city: '', address: '', federationAbbr: '', website: null, responsible: '' },
          { id: 2, name: '   ', country: '', countryAbbr: '', city: '', address: '', federationAbbr: '', website: null, responsible: '' },
        ],
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(1);
    });

    it('returns empty array for non-object response', () => {
      const result = parseIBJJFAcademiesResponse('not an object');

      expect(result.gyms).toHaveLength(0);
      expect(result.totalRecords).toBe(0);
    });

    it('returns empty array for null response', () => {
      const result = parseIBJJFAcademiesResponse(null);

      expect(result.gyms).toHaveLength(0);
      expect(result.totalRecords).toBe(0);
    });

    it('returns empty array for missing pagination field', () => {
      const result = parseIBJJFAcademiesResponse({ list: [] });

      expect(result.gyms).toHaveLength(0);
      expect(result.totalRecords).toBe(0);
    });

    it('returns empty array when list is not an array', () => {
      const result = parseIBJJFAcademiesResponse({ pagination: { totalRecords: 10 }, list: 'not array' });

      expect(result.gyms).toHaveLength(0);
      expect(result.totalRecords).toBe(10);
    });

    it('extracts totalRecords correctly', () => {
      const response = {
        pagination: { totalRecords: 8574 },
        list: [
          { id: 1, name: 'Gym', country: '', countryAbbr: '', city: '', address: '', federationAbbr: '', website: null, responsible: '' },
        ],
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.totalRecords).toBe(8574);
    });
  });
});
