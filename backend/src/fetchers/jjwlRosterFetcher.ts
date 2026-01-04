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

const JJWL_ROSTER_URL = 'https://www.jjworldleague.com/pages/hermes_ajax/events_competitors_list.php';

/**
 * Fetch roster for a gym at a tournament from JJWL.
 * @param eventId - The JJWL tournament/event ID
 * @param academyId - The JJWL academy/gym ID
 */
export async function fetchJJWLRoster(
  eventId: string,
  academyId: string
): Promise<JJWLRosterAthlete[]> {
  console.log(`[JJWLRosterFetcher] Fetching roster for event ${eventId}, academy ${academyId}`);

  const formData = new URLSearchParams();
  formData.append('event_id', eventId);
  formData.append('academy_id', academyId);
  // DataTables server-side processing params
  formData.append('draw', '1');
  formData.append('start', '0');
  formData.append('length', '1000'); // Get all athletes

  const response = await fetch(JJWL_ROSTER_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`JJWL roster API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const athletes = parseRosterResponse(data);

  console.log(`[JJWLRosterFetcher] Found ${athletes.length} athletes`);
  return athletes;
}
