import puppeteer from 'puppeteer';
import type { IBJJFEvent, NormalizedTournament } from './types.js';

const IBJJF_CALENDAR_URL = 'https://ibjjf.com/events/calendar';
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
  // eventGroups is now [{id, name}] - extract names and uppercase
  const groups = event.eventGroups.map((g) => g.name.toUpperCase());

  return {
    org: 'IBJJF',
    externalId: String(event.id),
    name: event.name,
    city: event.city,
    venue: event.local || null,
    country: event.region || null,
    startDate: parseIBJJFDate(event.startDay, event.month, event.year),
    endDate: parseIBJJFDate(event.endDay, event.month, event.year),
    gi: groups.some(g => g === 'GI' || (g.includes('GI') && !g.includes('NO-GI'))),
    nogi: groups.some(g => g.includes('NO-GI') || g.includes('NOGI')),
    kids: groups.some(g => g.includes('KIDS')),
    registrationUrl: event.pageUrl
      ? `https://ibjjf.com${event.pageUrl}`
      : null,
    bannerUrl: null,
  };
}

export async function fetchIBJJFTournaments(): Promise<NormalizedTournament[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set up promise to capture API response
    const apiResponsePromise = new Promise<IBJJFEvent[]>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for calendar API')), 45000);

      page.on('response', async (response) => {
        if (response.url().includes('calendar.json')) {
          clearTimeout(timeout);
          try {
            const json = await response.json();
            // API returns { infosite_events: [...] }
            const events = json?.infosite_events || json;
            if (Array.isArray(events)) {
              resolve(events);
            } else {
              reject(new Error(`API returned unexpected format: ${JSON.stringify(json).substring(0, 100)}`));
            }
          } catch (e) {
            reject(e);
          }
        }
      });
    });

    // Navigate to page (this triggers the API call)
    await page.goto(IBJJF_CALENDAR_URL, {
      waitUntil: 'domcontentloaded', // Don't wait for networkidle - API is slow
      timeout: 30000,
    });

    // Wait for the API response (up to 45s since it takes ~3.3s)
    const eventsData = await apiResponsePromise;

    return eventsData.map(mapIBJJFToTournament);
  } finally {
    await browser.close();
  }
}
