import type { JJWLRosterAthlete } from './types.js';

/**
 * Parse DataTables response into roster athletes.
 * DataTables returns rows as arrays: [name, mat, time, gender, ageDiv, belt, weight]
 */
export function parseRosterResponse(response: { data?: unknown[] }): JJWLRosterAthlete[] {
  if (!response.data || !Array.isArray(response.data)) {
    return [];
  }

  return response.data
    .filter((row): row is string[] => {
      if (!Array.isArray(row) || row.length < 7) return false;
      const name = row[0];
      return typeof name === 'string' && name.trim().length > 0;
    })
    .map((row) => ({
      name: row[0].trim(),
      gender: (row[3] ?? '').toString().trim(),
      ageDiv: (row[4] ?? '').toString().trim(),
      belt: (row[5] ?? '').toString().trim(),
      weight: (row[6] ?? '').toString().trim(),
    }));
}
