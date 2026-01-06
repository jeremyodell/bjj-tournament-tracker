// frontend/src/lib/tournamentUtils.ts

/**
 * Tournament utilities for building and parsing tournament PKs
 * Following DynamoDB single-table design pattern
 */

import type { Tournament } from './types';

/**
 * Build a tournament PK from org and externalId
 * Format: TOURN#{org}#{externalId}
 * Example: TOURN#IBJJF#12345
 */
export function buildTournamentPK(org: 'IBJJF' | 'JJWL', externalId: string): string {
  return `TOURN#${org}#${externalId}`;
}

/**
 * Build tournament PK from a Tournament object
 */
export function getTournamentPK(tournament: Tournament): string {
  return buildTournamentPK(tournament.org, tournament.externalId);
}

/**
 * Parse a tournament PK to extract org and externalId
 * Returns null if PK format is invalid
 */
export function parseTournamentPK(pk: string): { org: 'IBJJF' | 'JJWL'; externalId: string } | null {
  const parts = pk.split('#');

  if (parts.length !== 3 || parts[0] !== 'TOURN') {
    return null;
  }

  const org = parts[1];
  if (org !== 'IBJJF' && org !== 'JJWL') {
    return null;
  }

  return {
    org: org as 'IBJJF' | 'JJWL',
    externalId: parts[2],
  };
}

/**
 * Calculate days until tournament from today
 * Returns positive number for future dates, negative for past dates
 */
export function getDaysUntilTournament(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diffTime = start.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format tournament date for display
 * Returns month (short uppercase), day (zero-padded), and year
 */
export function formatTournamentDate(startDate: string) {
  const date = new Date(startDate);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(date.getDate()).padStart(2, '0'),
    year: date.getFullYear(),
  };
}
