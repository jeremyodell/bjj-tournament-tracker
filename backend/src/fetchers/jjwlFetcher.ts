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
      if (url.includes('hermes') || url.includes('events') || url.includes('load') || url.includes('api')) {
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

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      const monthMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };

      // JJWL uses .carousel_event_wrapper for event cards
      const eventElements = window.document.querySelectorAll('.carousel_event_wrapper');

      eventElements.forEach((el: Element) => {
        // Find the parent link or link within the element
        const linkEl = el.closest('a') || el.querySelector('a') || el.parentElement?.closest('a');
        let link = linkEl?.getAttribute('href') || '';

        // Event name is in .eventname
        const name = el.querySelector('.eventname')?.textContent?.trim() || '';

        // Date is split: .month has "Jul", .day has "16" or "16/17"
        const month = el.querySelector('.month')?.textContent?.trim() || '';
        const day = el.querySelector('.day')?.textContent?.trim().split('/')[0] || ''; // Take first day if range

        // Determine year: if event month is before current month, it's next year
        let year = currentYear;
        if (month) {
          const eventMonth = monthMap[month.toLowerCase().substring(0, 3)];
          if (eventMonth !== undefined && eventMonth < currentMonth) {
            year = currentYear + 1;
          }
        }

        const date = month && day ? `${month} ${day}, ${year}` : '';

        // Extract city from event name (JJWL uses city names in event titles)
        const cityMap: Record<string, string> = {
          'dallas': 'Dallas, TX',
          'houston': 'Houston, TX',
          'austin': 'Austin, TX',
          'san antonio': 'San Antonio, TX',
          'phoenix': 'Phoenix, AZ',
          'san diego': 'San Diego, CA',
          'california': 'Los Angeles, CA',
          'golden state': 'San Jose, CA',
          'florida': 'Miami, FL',
          'new york': 'New York, NY',
          'new jersey': 'Newark, NJ',
          'boston': 'Boston, MA',
          'chicago': 'Chicago, IL',
          'las vegas': 'Las Vegas, NV',
          'denver': 'Denver, CO',
          'seattle': 'Seattle, WA',
          'portland': 'Portland, OR',
          'atlanta': 'Atlanta, GA',
        };

        let city = el.querySelector('.city, .location')?.textContent?.trim() || '';
        if (!city && name) {
          const nameLower = name.toLowerCase();
          for (const [key, value] of Object.entries(cityMap)) {
            if (nameLower.includes(key)) {
              city = value;
              break;
            }
          }
        }

        // If no link found, construct from event name
        if (!link && name) {
          const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          link = `/events/${slug}`;
        }

        if (name && name !== 'Join now') {
          events.push({ name, city, date, link });
        }
      });

      return events;
    });

    if (scrapedEvents.length > 0) {
      const tournaments: NormalizedTournament[] = [];

      for (const [index, event] of scrapedEvents.entries()) {
        const parsedDate = parseJJWLDate(event.date);
        if (!parsedDate) {
          console.warn(`[JJWL] Skipping event "${event.name}" due to unparseable date: "${event.date}"`);
          continue;
        }

        tournaments.push({
          org: 'JJWL' as const,
          externalId: `scraped-${index}`,
          name: event.name,
          city: event.city,
          venue: null,
          country: null,
          startDate: parsedDate,
          endDate: parsedDate,
          gi: true, // Default to gi since we can't tell
          nogi: false,
          kids: false,
          registrationUrl: event.link.startsWith('http')
            ? event.link
            : `https://www.jjworldleague.com${event.link}`,
          bannerUrl: null,
        });
      }

      return tournaments;
    }

    return [];
  } finally {
    await browser.close();
  }
}

export function parseJJWLDate(dateStr: string): string | null {
  // Try to parse dates like "Jan 15, 2025" or "2025-01-15"
  if (!dateStr || !dateStr.trim()) {
    console.warn('[JJWL] Empty date string received');
    return null;
  }

  const trimmed = dateStr.trim();

  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04',
    may: '05', jun: '06', jul: '07', aug: '08',
    sep: '09', oct: '10', nov: '11', dec: '12',
  };

  // Match "Jan 15, 2025" or "January 15 2025" (month first, requires year or comma)
  const match = trimmed.match(/([a-zA-Z]+)\s+(\d{1,2})(?:,\s*(\d{4})|[\s,]+(\d{4}))/i);
  if (match) {
    const monthKey = match[1].toLowerCase().substring(0, 3);
    const month = months[monthKey];
    if (month) {
      const day = match[2].padStart(2, '0');
      const year = match[3] || match[4];
      return `${year}-${month}-${day}`;
    }
  }

  // Try alternative format: "15 Jan 2025" or "15/01/2025"
  const altMatch = trimmed.match(/(\d{1,2})[\s/.-](\w+|\d{1,2})[\s/.-](\d{4})/i);
  if (altMatch) {
    const day = altMatch[1].padStart(2, '0');
    const monthPart = altMatch[2];
    const year = altMatch[3];

    let month: string | undefined;
    if (/^\d+$/.test(monthPart)) {
      month = monthPart.padStart(2, '0');
    } else {
      month = months[monthPart.toLowerCase().substring(0, 3)];
    }

    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  console.warn(`[JJWL] Could not parse date: "${dateStr}"`);
  return null;
}
