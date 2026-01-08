import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../db/client.js';
import type { TournamentItem } from '../db/types.js';

// Cache for tournament slugs to avoid repeated DB calls
const slugCache = new Map<string, string>();

/**
 * Generate a URL-friendly slug from tournament name, org, and external ID.
 * Format: {name-slug}-{org}-{externalId}
 */
export function generateSlug(name: string, org: string, externalId: string): string {
  const nameSlug = name
    .toLowerCase()
    .trim()
    // Normalize accented characters
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace ampersands
    .replace(/&/g, '')
    // Remove apostrophes
    .replace(/'/g, '')
    // Replace non-alphanumeric with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Collapse multiple hyphens
    .replace(/-+/g, '-');

  return `${nameSlug}-${org.toLowerCase()}-${externalId}`;
}

/**
 * Get or create a slug for a tournament.
 * Uses caching to avoid repeated DB calls.
 */
export async function ensureTournamentSlug(tournamentPK: string): Promise<string> {
  // Check cache first
  const cached = slugCache.get(tournamentPK);
  if (cached) {
    return cached;
  }

  // Fetch tournament from DB
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: tournamentPK,
        SK: 'META',
      },
    })
  );

  const tournament = result.Item as TournamentItem | undefined;

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  // If tournament already has a slug, cache and return it
  if (tournament.slug) {
    slugCache.set(tournamentPK, tournament.slug);
    return tournament.slug;
  }

  // Generate new slug
  const slug = generateSlug(tournament.name, tournament.org, tournament.externalId);

  // Save to DB
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: tournamentPK,
        SK: 'META',
      },
      UpdateExpression: 'SET slug = :slug, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':slug': slug,
        ':updatedAt': new Date().toISOString(),
      },
    })
  );

  // Cache the result
  slugCache.set(tournamentPK, slug);

  return slug;
}
