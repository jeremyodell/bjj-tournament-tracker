import axios from 'axios';
import type { JJWLEvent, NormalizedTournament } from './types.js';

const JJWL_API_URL = 'https://www.jjworldleague.com/ajax/new_load_events.php';

export function mapJJWLToTournament(event: JJWLEvent): NormalizedTournament {
  return {
    org: 'JJWL',
    externalId: String(event.id),
    name: event.name,
    city: event.city,
    venue: event.place || null,
    country: null,
    startDate: event.datebeg,
    endDate: event.dateend,
    gi: event.GI === '1',
    nogi: event.NOGI === '1',
    kids: false, // JJWL doesn't have kids flag
    registrationUrl: event.urlfriendly
      ? `https://www.jjworldleague.com/events/${event.urlfriendly}`
      : null,
    bannerUrl: event.picture || null,
  };
}

export async function fetchJJWLTournaments(): Promise<NormalizedTournament[]> {
  const response = await axios.post<JJWLEvent[]>(
    JJWL_API_URL,
    {},
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; BJJTracker/1.0)',
      },
      timeout: 10000,
    }
  );

  return response.data.map(mapJJWLToTournament);
}
