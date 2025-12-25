import type { JJWLEvent, NormalizedTournament } from './types.js';
import { launchBrowser } from './browser.js';

const JJWL_URL = 'https://www.jjworldleague.com/';

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
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Capture any API responses that might contain events
    let eventsData: JJWLEvent[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      // Look for any endpoint that might return events
      if (url.includes('hermes') || url.includes('events') || url.includes('load')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json')) {
            const json = await response.json() as unknown;
            // Try to find events array in the response
            if (Array.isArray(json) && json.length > 0 && (json[0] as Record<string, unknown>)?.name) {
              eventsData = json as JJWLEvent[];
            } else if (json && typeof json === 'object' && 'events' in json && Array.isArray((json as { events: unknown[] }).events)) {
              eventsData = (json as { events: JJWLEvent[] }).events;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    });

    await page.goto(JJWL_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait a bit for any delayed API calls
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (eventsData.length > 0) {
      return eventsData.map(mapJJWLToTournament);
    }

    // Fallback: scrape events from the rendered page
    // The function runs in browser context where document exists
    const scrapedEvents = await page.evaluate((): Array<{
      name: string;
      city: string;
      date: string;
      link: string;
    }> => {
      const events: Array<{
        name: string;
        city: string;
        date: string;
        link: string;
      }> = [];

      // Try to find event cards on the page
      const eventElements = window.document.querySelectorAll('a[href*="/events/"], .event-card, [class*="event"]');

      eventElements.forEach((el: Element) => {
        const link = el.getAttribute('href') || '';
        const name = el.querySelector('h2, h3, .title, [class*="name"]')?.textContent?.trim()
          || el.textContent?.trim().split('\n')[0] || '';
        const city = el.querySelector('.city, .location, [class*="city"]')?.textContent?.trim() || '';
        const date = el.querySelector('.date, time, [class*="date"]')?.textContent?.trim() || '';

        if (name && link.includes('/events/')) {
          events.push({ name, city, date, link });
        }
      });

      return events;
    });

    if (scrapedEvents.length > 0) {
      return scrapedEvents.map((event, index) => ({
        org: 'JJWL' as const,
        externalId: `scraped-${index}`,
        name: event.name,
        city: event.city,
        venue: null,
        country: null,
        startDate: parseJJWLDate(event.date),
        endDate: parseJJWLDate(event.date),
        gi: true, // Default to gi since we can't tell
        nogi: false,
        kids: false,
        registrationUrl: event.link.startsWith('http')
          ? event.link
          : `https://www.jjworldleague.com${event.link}`,
        bannerUrl: null,
      }));
    }

    return [];
  } finally {
    await browser.close();
  }
}

function parseJJWLDate(dateStr: string): string {
  // Try to parse dates like "Jan 15, 2025" or "2025-01-15"
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04',
    may: '05', jun: '06', jul: '07', aug: '08',
    sep: '09', oct: '10', nov: '11', dec: '12',
  };

  const match = dateStr.match(/(\w+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
  if (match) {
    const month = months[match[1].toLowerCase().substring(0, 3)] || '01';
    const day = match[2].padStart(2, '0');
    const year = match[3] || new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split('T')[0];
}
