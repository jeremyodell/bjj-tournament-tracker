import type { SourceGymItem, MatchSignals } from '../db/types.js';
import { createMasterGym, linkSourceGymToMaster } from '../db/masterGymQueries.js';
import { createPendingMatch, findExistingPendingMatch } from '../db/pendingMatchQueries.js';
import { listGyms } from '../db/gymQueries.js';
import natural from 'natural';

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
 * Calculate similarity score between two gym names using Jaro-Winkler distance.
 * Returns 0-100 score with boosts for city/affiliation matches.
 */
export function calculateSimilarity(
  name1: string,
  name2: string,
  city1?: string,
  city2?: string
): number {
  // Normalize names for comparison
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  // Jaro-Winkler returns 0.0-1.0, multiply by 100 for existing thresholds
  let score = natural.JaroWinklerDistance(n1, n2) * 100;

  // City boost: +15 if city appears in gym name
  if (city1 && city2) {
    const c1 = city1.toLowerCase();
    const c2 = city2.toLowerCase();
    if (n1.includes(c2) || n2.includes(c1)) {
      score += 15;
    }
  }

  // Affiliation boost: +10 for matching BJJ affiliations
  for (const affiliation of KNOWN_AFFILIATIONS) {
    if (n1.includes(affiliation) && n2.includes(affiliation)) {
      score += 10;
      break;
    }
  }

  // Cap at 100
  return Math.min(score, 100);
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
 * Find matching gyms for a source gym using cached target gyms.
 * @param sourceGym - The gym to find matches for
 * @param cachedTargetGyms - Pre-loaded array of target gyms to compare against
 * @returns Array of matches with scores ≥70%
 */
export async function findMatchesForGym(
  sourceGym: SourceGymItem,
  cachedTargetGyms: SourceGymItem[]
): Promise<Array<{ gym: SourceGymItem; score: number; signals: MatchSignals }>> {
  const matches: Array<{ gym: SourceGymItem; score: number; signals: MatchSignals }> = [];

  // Compare against cached gyms instead of querying DB
  for (const targetGym of cachedTargetGyms) {
    // Skip if same gym
    if (
      sourceGym.org === targetGym.org &&
      sourceGym.externalId === targetGym.externalId
    ) {
      continue;
    }

    // Skip if target gym is already linked
    if (targetGym.masterGymId) {
      continue;
    }

    // Calculate similarity using new Jaro-Winkler algorithm
    const score = calculateSimilarity(
      sourceGym.name,
      targetGym.name,
      sourceGym.city ?? undefined,
      targetGym.city ?? undefined
    );

    // Only keep matches ≥70%
    if (score >= 70) {
      // Also calculate match signals for backward compatibility
      const { signals } = calculateMatchScore(sourceGym, targetGym);
      matches.push({ gym: targetGym, score, signals });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Process matches for a gym: auto-link high-confidence or create pending match.
 * @param sourceGym - The gym to process
 * @param cachedTargetGyms - Pre-loaded array of target gyms
 */
export async function processGymMatches(
  sourceGym: SourceGymItem,
  cachedTargetGyms: SourceGymItem[]
): Promise<{ autoLinked: number; pendingCreated: number }> {
  // Skip if already linked
  if (sourceGym.masterGymId) {
    return { autoLinked: 0, pendingCreated: 0 };
  }

  const matches = await findMatchesForGym(sourceGym, cachedTargetGyms);

  // No matches found - sourceGym will get its own master created by sync service
  if (matches.length === 0) {
    return { autoLinked: 0, pendingCreated: 0 };
  }

  const topMatch = matches[0];

  // Auto-link if ≥90% confidence
  if (topMatch.score >= 90) {
    // Check if either gym already has a master
    let masterGymId: string;

    if (topMatch.gym.masterGymId) {
      // Target gym already has a master - link source to it
      masterGymId = topMatch.gym.masterGymId;
      await linkSourceGymToMaster(sourceGym.org, sourceGym.externalId, masterGymId);
    } else {
      // Neither has a master - create new shared master
      const masterGym = await createMasterGym({
        canonicalName: sourceGym.name,
        city: sourceGym.city || topMatch.gym.city,
        country: sourceGym.country || topMatch.gym.country,
      });
      masterGymId = masterGym.id;

      await linkSourceGymToMaster(sourceGym.org, sourceGym.externalId, masterGymId);
      await linkSourceGymToMaster(topMatch.gym.org, topMatch.gym.externalId, masterGymId);
    }

    return { autoLinked: 1, pendingCreated: 0 };
  }

  // Create pending match for admin review if 70-89%
  if (topMatch.score >= 70 && topMatch.score < 90) {
    // Check for existing pending match
    const existingMatch = await findExistingPendingMatch(
      `SRCGYM#${sourceGym.org}#${sourceGym.externalId}`,
      `SRCGYM#${topMatch.gym.org}#${topMatch.gym.externalId}`
    );

    if (!existingMatch) {
      await createPendingMatch({
        sourceGym1Id: `SRCGYM#${sourceGym.org}#${sourceGym.externalId}`,
        sourceGym1Name: sourceGym.name,
        sourceGym2Id: `SRCGYM#${topMatch.gym.org}#${topMatch.gym.externalId}`,
        sourceGym2Name: topMatch.gym.name,
        confidence: topMatch.score,
        signals: topMatch.signals,
      });

      return { autoLinked: 0, pendingCreated: 1 };
    }
  }

  return { autoLinked: 0, pendingCreated: 0 };
}
