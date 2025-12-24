import axios from 'axios';
import type { IBJJFEvent, NormalizedTournament } from './types.js';

const IBJJF_API_URL = 'https://ibjjf.com/api/v1/events/calendar.json';

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04',
  May: '05', Jun: '06', Jul: '07', Aug: '08',
  Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

export function parseIBJJFDate(day: number, month: string, year: number): string {
  const monthNum = MONTH_MAP[month] || '01';
  const dayStr = day.toString().padStart(2, '0');
  return `${year}-${monthNum}-${dayStr}`;
}

export function mapIBJJFToTournament(event: IBJJFEvent): NormalizedTournament {
  const groups = event.eventGroups.map((g) => g.toUpperCase());

  return {
    org: 'IBJJF',
    externalId: String(event.id),
    name: event.name,
    city: event.city,
    venue: event.local || null,
    country: event.region || null,
    startDate: parseIBJJFDate(event.startDay, event.month, event.year),
    endDate: parseIBJJFDate(event.endDay, event.month, event.year),
    gi: groups.includes('GI'),
    nogi: groups.includes('NOGI') || groups.includes('NO-GI'),
    kids: groups.includes('KIDS'),
    registrationUrl: event.pageUrl
      ? `https://ibjjf.com${event.pageUrl}`
      : null,
    bannerUrl: null,
  };
}

export async function fetchIBJJFTournaments(): Promise<NormalizedTournament[]> {
  const response = await axios.get<IBJJFEvent[]>(IBJJF_API_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BJJTracker/1.0)',
    },
    timeout: 10000,
  });

  return response.data.map(mapIBJJFToTournament);
}
