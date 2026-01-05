import type { SourceGymItem, MatchSignals } from '../db/types.js';
import { createMasterGym, linkSourceGymToMaster } from '../db/masterGymQueries.js';
import { createPendingMatch, findExistingPendingMatch } from '../db/pendingMatchQueries.js';
import { listGyms } from '../db/gymQueries.js';

// Known BJJ affiliations for affiliation boost
const KNOWN_AFFILIATIONS = [
  'gracie barra',
  'alliance',
  'atos',
  'checkmat',
  'carlson gracie',
  'nova uniao',
  'brazilian top team',
  'btt',
  'ribeiro',
  'zenith',
  'unity',
  'renzo gracie',
  'marcelo garcia',
  'arte suave',
  'gracie humaita',
  'gracie academy',
  '10th planet',
  'tenth planet',
];

// Suffixes to remove during normalization
const GYM_SUFFIXES = [
  'bjj',
  'brazilian jiu jitsu',
  'brazilian jiu-jitsu',
  'jiu jitsu',
  'jiu-jitsu',
  'jiujitsu',
  'academy',
  'team',
  'mma',
  'martial arts',
  'training center',
  'hq',
  'headquarters',
];

/**
 * Normalize gym name for comparison:
 * - Remove common suffixes (BJJ, Academy, etc)
 * - Lowercase
 * - Collapse whitespace
 * - Trim
 */
export function normalizeGymName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove suffixes (longest first to avoid partial matches)
  const sortedSuffixes = [...GYM_SUFFIXES].sort((a, b) => b.length - a.length);
  for (const suffix of sortedSuffixes) {
    const regex = new RegExp(`\\s*${suffix}\\s*$`, 'i');
    normalized = normalized.replace(regex, '');
  }

  // Collapse multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate name similarity score (0-100) using Levenshtein distance
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const normalized1 = normalizeGymName(name1);
  const normalized2 = normalizeGymName(name2);

  if (normalized1 === normalized2) return 100;
  if (normalized1.length === 0 || normalized2.length === 0) return 0;

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(Math.max(0, similarity));
}

/**
 * Check if city from one gym appears in another gym's name
 */
function hasCityMatch(gym1City: string | null | undefined, gym2Name: string): boolean {
  if (!gym1City) return false;
  const cityLower = gym1City.toLowerCase().trim();
  const nameLower = gym2Name.toLowerCase();
  return nameLower.includes(cityLower);
}

/**
 * Extract affiliation from gym name if present
 */
function extractAffiliation(name: string): string | null {
  const nameLower = name.toLowerCase();
  for (const affiliation of KNOWN_AFFILIATIONS) {
    if (nameLower.includes(affiliation)) {
      return affiliation;
    }
  }
  return null;
}

/**
 * Calculate total match score with boosts
 */
export function calculateMatchScore(
  gym1: SourceGymItem,
  gym2: SourceGymItem
): { score: number; signals: MatchSignals } {
  const nameSimilarity = calculateNameSimilarity(gym1.name, gym2.name);

  // City boost: +15 if city from one gym appears in other's name
  let cityBoost = 0;
  if (hasCityMatch(gym1.city, gym2.name) || hasCityMatch(gym2.city, gym1.name)) {
    cityBoost = 15;
  }

  // Affiliation boost: +10 if both have same known affiliation
  let affiliationBoost = 0;
  const affiliation1 = extractAffiliation(gym1.name);
  const affiliation2 = extractAffiliation(gym2.name);
  if (affiliation1 && affiliation2 && affiliation1 === affiliation2) {
    affiliationBoost = 10;
  }

  const signals: MatchSignals = {
    nameSimilarity,
    cityBoost,
    affiliationBoost,
  };

  // Cap total score at 100
  const score = Math.min(100, nameSimilarity + cityBoost + affiliationBoost);

  return { score, signals };
}

/**
 * Find potential matches for a gym from the other org
 * Returns matches above 70% threshold
 */
export async function findMatchesForGym(
  sourceGym: SourceGymItem,
  threshold = 70
): Promise<Array<{ gym: SourceGymItem; score: number; signals: MatchSignals }>> {
  // Determine which org to search (opposite of source)
  const targetOrg = sourceGym.org === 'JJWL' ? 'IBJJF' : 'JJWL';

  const matches: Array<{ gym: SourceGymItem; score: number; signals: MatchSignals }> = [];

  // Paginate through all gyms from target org
  let lastKey: Record<string, unknown> | undefined;
  do {
    const { items, lastKey: nextKey } = await listGyms(targetOrg, 100, lastKey);

    for (const targetGym of items) {
      // Skip if already linked to a master gym
      if (targetGym.masterGymId) continue;

      const { score, signals } = calculateMatchScore(sourceGym, targetGym);

      if (score >= threshold) {
        matches.push({ gym: targetGym, score, signals });
      }
    }

    lastKey = nextKey;
  } while (lastKey);

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Process gym matches:
 * - ≥90%: Auto-link to new master gym
 * - 70-89%: Create pending match for admin review
 * Returns counts of auto-linked and pending matches
 */
export async function processGymMatches(
  sourceGym: SourceGymItem
): Promise<{ autoLinked: number; pendingCreated: number }> {
  // Skip if already linked
  if (sourceGym.masterGymId) {
    return { autoLinked: 0, pendingCreated: 0 };
  }

  const matches = await findMatchesForGym(sourceGym);
  let autoLinked = 0;
  let pendingCreated = 0;

  for (const match of matches) {
    if (match.score >= 90) {
      // Auto-link: Create master gym and link both source gyms
      const masterGym = await createMasterGym({
        canonicalName: sourceGym.name, // Use source gym name as canonical
        city: sourceGym.city || match.gym.city,
        country: sourceGym.country || match.gym.country,
      });

      await linkSourceGymToMaster(sourceGym.org, sourceGym.externalId, masterGym.id);
      await linkSourceGymToMaster(match.gym.org, match.gym.externalId, masterGym.id);

      autoLinked++;
      // Only process the first auto-link match
      break;
    } else if (match.score >= 70) {
      // Check for existing pending match
      const existingMatch = await findExistingPendingMatch(
        `SRCGYM#${sourceGym.org}#${sourceGym.externalId}`,
        `SRCGYM#${match.gym.org}#${match.gym.externalId}`
      );

      if (!existingMatch) {
        await createPendingMatch({
          sourceGym1Id: `SRCGYM#${sourceGym.org}#${sourceGym.externalId}`,
          sourceGym1Name: sourceGym.name,
          sourceGym2Id: `SRCGYM#${match.gym.org}#${match.gym.externalId}`,
          sourceGym2Name: match.gym.name,
          confidence: match.score,
          signals: match.signals,
        });

        pendingCreated++;
      }
    }
  }

  return { autoLinked, pendingCreated };
}
