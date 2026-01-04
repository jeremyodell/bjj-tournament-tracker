import type { IBJJFAcademy, IBJJFNormalizedGym } from './types.js';

export interface ParsedIBJJFResponse {
  gyms: IBJJFNormalizedGym[];
  totalRecords: number;
}

/**
 * Sanitize gym name by removing # characters (breaks GSI1SK) and trimming whitespace
 */
export function sanitizeGymName(name: string): string {
  return name.replace(/#/g, '').trim();
}

/**
 * Map IBJJF academy to normalized gym format
 */
export function mapIBJJFAcademyToGym(academy: IBJJFAcademy): IBJJFNormalizedGym {
  return {
    org: 'IBJJF',
    externalId: String(academy.id),
    name: sanitizeGymName(academy.name),
    country: academy.country || undefined,
    countryCode: academy.countryCode || undefined,
    city: academy.city || undefined,
    address: academy.address || undefined,
    federation: academy.federation || undefined,
    website: academy.site || undefined,
    responsible: academy.responsible || undefined,
  };
}

/**
 * Parse and validate IBJJF academies response
 */
export function parseIBJJFAcademiesResponse(data: unknown): ParsedIBJJFResponse {
  if (!data || typeof data !== 'object') {
    console.warn('[IBJJFGymFetcher] Response is not an object');
    return { gyms: [], totalRecords: 0 };
  }

  const response = data as Record<string, unknown>;

  if (!Array.isArray(response.data)) {
    console.warn('[IBJJFGymFetcher] Response.data is not an array');
    return { gyms: [], totalRecords: 0 };
  }

  const totalRecords =
    typeof response.totalRecords === 'number' ? response.totalRecords : 0;

  const gyms = response.data
    .filter((item): item is IBJJFAcademy => {
      if (!item || typeof item !== 'object') return false;
      const academy = item as Record<string, unknown>;

      const hasValidId = typeof academy.id === 'number';
      const hasValidName =
        typeof academy.name === 'string' && academy.name.trim().length > 0;

      if (!hasValidId) {
        console.warn('[IBJJFGymFetcher] Skipping entry with invalid id');
        return false;
      }
      if (!hasValidName) {
        console.warn(
          `[IBJJFGymFetcher] Skipping entry ${academy.id} with invalid name`
        );
        return false;
      }

      return true;
    })
    .map(mapIBJJFAcademyToGym);

  return { gyms, totalRecords };
}
