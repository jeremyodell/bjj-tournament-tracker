import type { IBJJFAcademy, IBJJFNormalizedGym } from './types.js';

export interface ParsedIBJJFResponse {
  gyms: IBJJFNormalizedGym[];
  totalRecords: number;
}

const IBJJF_ACADEMIES_URL = 'https://ibjjf.com/api/academies';
const PAGE_SIZE = 20;

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

/**
 * Fetch a single page of IBJJF academies
 */
export async function fetchIBJJFGymPage(
  page: number
): Promise<{ data: IBJJFAcademy[]; totalRecords: number }> {
  const start = page * PAGE_SIZE;
  const url = `${IBJJF_ACADEMIES_URL}?start=${start}&length=${PAGE_SIZE}`;

  console.log(`[IBJJFGymFetcher] Fetching page ${page} (start=${start})`);

  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    throw new Error(
      `IBJJF academies API returned ${response.status}: ${response.statusText}`
    );
  }

  const json = await response.json();
  const parsed = parseIBJJFAcademiesResponse(json);

  return {
    data: parsed.gyms as unknown as IBJJFAcademy[],
    totalRecords: parsed.totalRecords,
  };
}

/**
 * Fetch total count of IBJJF academies for change detection
 */
export async function fetchIBJJFGymCount(): Promise<number> {
  const url = `${IBJJF_ACADEMIES_URL}?start=0&length=1`;

  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    throw new Error(
      `IBJJF academies API returned ${response.status}: ${response.statusText}`
    );
  }

  const json = await response.json();
  const parsed = parseIBJJFAcademiesResponse(json);

  return parsed.totalRecords;
}
