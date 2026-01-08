import type { JJWLGym, NormalizedGym } from './types.js';

const JJWL_GYMS_URL =
  'https://www.jjworldleague.com/style2020_ajax/lists/gyms.php';

/**
 * Map JJWL gym to normalized format
 */
export function mapJJWLGymToNormalized(gym: JJWLGym): NormalizedGym {
  return {
    org: 'JJWL',
    externalId: gym.id,
    name: gym.name.trim(),
  };
}

/**
 * Parse and validate JJWL gyms response
 * Response format: { status: true, length: 5783, data: [...] }
 */
export function parseJJWLGymsResponse(data: unknown): NormalizedGym[] {
  if (!data || typeof data !== 'object') {
    console.warn('[JJWLGymFetcher] Response is not an object');
    return [];
  }

  const response = data as Record<string, unknown>;

  if (!Array.isArray(response.data)) {
    console.warn('[JJWLGymFetcher] Response.data is not an array');
    return [];
  }

  return response.data
    .filter((item): item is JJWLGym => {
      if (!item || typeof item !== 'object') return false;
      const gym = item as Record<string, unknown>;
      return (
        typeof gym.id === 'string' &&
        gym.id.length > 0 &&
        typeof gym.name === 'string' &&
        gym.name.trim().length > 0
      );
    })
    .map(mapJJWLGymToNormalized);
}

/**
 * Fetch all gyms from JJWL
 */
export async function fetchJJWLGyms(): Promise<NormalizedGym[]> {
  console.log('[JJWLGymFetcher] Fetching gyms from JJWL...');

  const response = await fetch(JJWL_GYMS_URL, {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    throw new Error(
      `JJWL gyms API returned ${response.status}: ${response.statusText}`
    );
  }

  const data = await response.json();
  const gyms = parseJJWLGymsResponse(data);

  console.log(`[JJWLGymFetcher] Fetched ${gyms.length} gyms`);
  return gyms;
}
