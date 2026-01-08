import type { IBJJFAcademy, IBJJFNormalizedGym } from './types.js';

export interface ParsedIBJJFResponse {
  gyms: IBJJFNormalizedGym[];
  totalRecords: number;
}

const IBJJF_ACADEMIES_URL = 'https://ibjjf.com/api/v1/academies/list.json';
const PAGE_SIZE = 20;
/** Delay between API requests to avoid rate limiting */
const RATE_LIMIT_DELAY_MS = 200;

const IBJJF_API_HEADERS = {
  accept: 'application/json, text/javascript, */*; q=0.01',
  'x-requested-with': 'XMLHttpRequest',
};

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
    countryCode: academy.countryAbbr || undefined,
    city: academy.city || undefined,
    address: academy.address || undefined,
    federation: academy.federationAbbr || undefined,
    website: academy.website || undefined,
    responsible: academy.responsible || undefined,
  };
}

/**
 * Parse and validate IBJJF academies response (v1 API)
 */
export function parseIBJJFAcademiesResponse(data: unknown): ParsedIBJJFResponse {
  if (!data || typeof data !== 'object') {
    console.warn('[IBJJFGymFetcher] Response is not an object');
    return { gyms: [], totalRecords: 0 };
  }

  const response = data as Record<string, unknown>;

  // Check for pagination object
  if (!response.pagination || typeof response.pagination !== 'object') {
    console.warn('[IBJJFGymFetcher] Response.pagination is missing or invalid');
    return { gyms: [], totalRecords: 0 };
  }

  const pagination = response.pagination as Record<string, unknown>;
  const totalRecords =
    typeof pagination.totalRecords === 'number' ? pagination.totalRecords : 0;

  // Check for list array
  if (!Array.isArray(response.list)) {
    console.warn('[IBJJFGymFetcher] Response.list is not an array');
    return { gyms: [], totalRecords };
  }

  const gyms = response.list
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
 * Fetch a single page of IBJJF academies (v1 API uses 1-based page numbers)
 */
export async function fetchIBJJFGymPage(
  page: number
): Promise<ParsedIBJJFResponse> {
  const pageNumber = page + 1; // API uses 1-based pages
  const url = `${IBJJF_ACADEMIES_URL}?page=${pageNumber}`;

  console.log(`[IBJJFGymFetcher] Fetching page ${page} (API page=${pageNumber})`);

  const response = await fetch(url, {
    headers: IBJJF_API_HEADERS,
  });

  if (!response.ok) {
    throw new Error(
      `IBJJF academies API returned ${response.status}: ${response.statusText}`
    );
  }

  const json = await response.json();
  return parseIBJJFAcademiesResponse(json);
}

/**
 * Fetch total count of IBJJF academies for change detection
 */
export async function fetchIBJJFGymCount(): Promise<number> {
  const url = `${IBJJF_ACADEMIES_URL}?page=1`;

  const response = await fetch(url, {
    headers: IBJJF_API_HEADERS,
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

export type ProgressCallback = (current: number, total: number) => void;

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch all IBJJF academies with sequential pagination
 */
export async function fetchAllIBJJFGyms(
  onProgress?: ProgressCallback
): Promise<IBJJFNormalizedGym[]> {
  console.log('[IBJJFGymFetcher] Starting full gym sync...');

  const allGyms: IBJJFNormalizedGym[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    try {
      const parsed = await fetchIBJJFGymPage(page);

      if (page === 0) {
        totalPages = Math.ceil(parsed.totalRecords / PAGE_SIZE);
        console.log(
          `[IBJJFGymFetcher] Total records: ${parsed.totalRecords}, pages: ${totalPages}`
        );
      }

      allGyms.push(...parsed.gyms);
      onProgress?.(page + 1, totalPages);
    } catch (error) {
      console.warn(
        `[IBJJFGymFetcher] Page ${page} failed, skipping:`,
        error instanceof Error ? error.message : error
      );
    }

    if (page < totalPages - 1) {
      await delay(RATE_LIMIT_DELAY_MS);
    }
    page++;
  }

  console.log(`[IBJJFGymFetcher] Fetched ${allGyms.length} gyms total`);
  return allGyms;
}
