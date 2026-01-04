import { describe, it, expect } from '@jest/globals';
import { parseRosterResponse } from '../../fetchers/jjwlRosterFetcher.js';

describe('jjwlRosterFetcher', () => {
  describe('parseRosterResponse', () => {
    it('parses DataTables format response', () => {
      const response = {
        data: [
          ['John Doe', '1', '10:00', 'Male', 'Adult (18+)', 'Blue', 'Light'],
          ['Jane Smith', '2', '11:00', 'Female', 'Juvenile (16-17)', 'Purple', 'Feather'],
        ],
      };

      const result = parseRosterResponse(response);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'John Doe',
        gender: 'Male',
        ageDiv: 'Adult (18+)',
        belt: 'Blue',
        weight: 'Light',
      });
      expect(result[1]).toEqual({
        name: 'Jane Smith',
        gender: 'Female',
        ageDiv: 'Juvenile (16-17)',
        belt: 'Purple',
        weight: 'Feather',
      });
    });

    it('handles empty data array', () => {
      const response = { data: [] };

      const result = parseRosterResponse(response);

      expect(result).toHaveLength(0);
    });

    it('handles missing data property', () => {
      const response = {};

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result).toHaveLength(0);
    });

    it('handles null data property', () => {
      const response = { data: null } as unknown as { data: unknown[] };

      const result = parseRosterResponse(response);

      expect(result).toHaveLength(0);
    });

    it('filters out rows with empty names', () => {
      const response = {
        data: [
          ['Valid Name', '1', '10:00', 'Male', 'Adult', 'Blue', 'Light'],
          ['', '2', '11:00', 'Male', 'Adult', 'Blue', 'Light'],
          ['   ', '3', '12:00', 'Male', 'Adult', 'Blue', 'Light'],
        ],
      };

      const result = parseRosterResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Name');
    });

    it('filters out null rows', () => {
      const response = {
        data: [
          ['Valid Name', '1', '10:00', 'Male', 'Adult', 'Blue', 'Light'],
          null,
        ],
      };

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result).toHaveLength(1);
    });

    it('filters out rows with insufficient length', () => {
      const response = {
        data: [
          ['Valid Name', '1', '10:00', 'Male', 'Adult', 'Blue', 'Light'],
          ['Short Row', '1', '10:00'], // Only 3 elements
        ],
      };

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result).toHaveLength(1);
    });

    it('trims whitespace from all fields', () => {
      const response = {
        data: [
          ['  John Doe  ', '1', '10:00', '  Male  ', '  Adult  ', '  Blue  ', '  Light  '],
        ],
      };

      const result = parseRosterResponse(response);

      expect(result[0]).toEqual({
        name: 'John Doe',
        gender: 'Male',
        ageDiv: 'Adult',
        belt: 'Blue',
        weight: 'Light',
      });
    });

    it('handles missing optional fields gracefully', () => {
      const response = {
        data: [
          ['John Doe', '1', '10:00', null, undefined, '', 'Light'],
        ],
      };

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result[0]).toEqual({
        name: 'John Doe',
        gender: '',
        ageDiv: '',
        belt: '',
        weight: 'Light',
      });
    });
  });
});
