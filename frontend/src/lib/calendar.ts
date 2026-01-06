import type { Tournament } from './types';
import { getTournamentPK } from './tournamentUtils';

/**
 * Generates an iCalendar (.ics) file content for a single tournament
 *
 * @param tournament - The tournament to generate calendar event for
 * @returns .ics file content as a string
 */
export function generateTournamentICS(tournament: Tournament): string {
  const tournamentPK = getTournamentPK(tournament);

  // Convert YYYY-MM-DD to YYYYMMDD format for .ics
  const startDate = tournament.startDate.replace(/-/g, '');

  // DTEND is exclusive, so we need to add 1 day to the start date
  // For all-day events, DTEND represents the day AFTER the event ends
  const endDate = getNextDay(tournament.startDate).replace(/-/g, '');

  // Current timestamp in UTC for DTSTAMP
  const now = new Date();
  const dtstamp = formatDateTimeUTC(now);

  // Build description with org and registration URL
  let description = `${tournament.org} Tournament`;
  if (tournament.registrationUrl) {
    description += `\\n\\nRegister: ${tournament.registrationUrl}`;
  }

  // Build location string
  const location = [tournament.city, tournament.country]
    .filter(Boolean)
    .join(', ');

  // Escape special characters in text fields
  const summary = escapeICSText(tournament.name);
  const escapedDescription = escapeICSText(description);
  const escapedLocation = escapeICSText(location);

  // Generate unique UID using tournament PK
  const uid = `${tournamentPK}@bjjcomps.com`;

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BJJ Tournament Tracker//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:${summary}
LOCATION:${escapedLocation}
DESCRIPTION:${escapedDescription}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
}

/**
 * Generates an iCalendar (.ics) file content for multiple tournaments
 *
 * @param tournaments - Array of tournaments to include in calendar
 * @returns .ics file content as a string with multiple VEVENT entries
 */
export function generateBulkICS(tournaments: Tournament[]): string {
  if (tournaments.length === 0) {
    throw new Error('Cannot generate calendar with no tournaments');
  }

  // Sort tournaments by start date (earliest first)
  const sortedTournaments = [...tournaments].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  // Current timestamp in UTC for DTSTAMP
  const now = new Date();
  const dtstamp = formatDateTimeUTC(now);

  // Generate VEVENT entries for each tournament
  const vevents = sortedTournaments.map(tournament => {
    const tournamentPK = getTournamentPK(tournament);
    const startDate = tournament.startDate.replace(/-/g, '');
    const endDate = getNextDay(tournament.startDate).replace(/-/g, '');

    let description = `${tournament.org} Tournament`;
    if (tournament.registrationUrl) {
      description += `\\n\\nRegister: ${tournament.registrationUrl}`;
    }

    const location = [tournament.city, tournament.country]
      .filter(Boolean)
      .join(', ');

    const summary = escapeICSText(tournament.name);
    const escapedDescription = escapeICSText(description);
    const escapedLocation = escapeICSText(location);
    const uid = `${tournamentPK}@bjjcomps.com`;

    return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:${summary}
LOCATION:${escapedLocation}
DESCRIPTION:${escapedDescription}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT`;
  }).join('\n');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BJJ Tournament Tracker//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${vevents}
END:VCALENDAR`;
}

/**
 * Triggers a browser download of the .ics file content
 *
 * @param content - The .ics file content
 * @param filename - Name for the downloaded file (should end in .ics)
 */
export function downloadICS(content: string, filename: string): void {
  // Ensure filename ends with .ics
  const fullFilename = filename.endsWith('.ics') ? filename : `${filename}.ics`;

  // Create a Blob with proper MIME type
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });

  // Create object URL
  const url = URL.createObjectURL(blob);

  // Create temporary link and trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = fullFilename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up object URL
  URL.revokeObjectURL(url);
}

/**
 * Helper: Adds one day to a YYYY-MM-DD date string
 */
function getNextDay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

/**
 * Helper: Formats a Date object as YYYYMMDDTHHMMSSZ (UTC)
 */
function formatDateTimeUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Helper: Escapes special characters in .ics text fields
 *
 * Per RFC 5545, we need to escape:
 * - Backslashes (\) → \\
 * - Commas (,) → \,
 * - Semicolons (;) → \;
 * - Newlines (\n) → \\n
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/,/g, '\\,')     // Escape commas
    .replace(/;/g, '\\;')     // Escape semicolons
    .replace(/\n/g, '\\n');   // Escape newlines
}
