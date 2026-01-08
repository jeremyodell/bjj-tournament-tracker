#!/usr/bin/env npx tsx

import natural from 'natural';

// Copy of the normalization logic from gymMatchingService.ts
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

function normalizeGymName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove special characters but keep spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Remove common suffixes
  for (const suffix of GYM_SUFFIXES) {
    const pattern = new RegExp(`\\b${suffix}\\b`, 'g');
    normalized = normalized.replace(pattern, '');
  }

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

function calculateSimilarity(
  name1: string,
  name2: string,
  city1?: string,
  city2?: string
): number {
  const norm1 = normalizeGymName(name1);
  const norm2 = normalizeGymName(name2);

  console.log(`Original names:`);
  console.log(`  Name 1: "${name1}"`);
  console.log(`  Name 2: "${name2}"`);
  console.log();

  console.log(`Normalized names:`);
  console.log(`  Norm 1: "${norm1}"`);
  console.log(`  Norm 2: "${norm2}"`);
  console.log();

  // Calculate Jaro-Winkler score (0.0 to 1.0)
  const jaroWinklerScore = natural.JaroWinklerDistance(norm1, norm2);
  console.log(`Jaro-Winkler score: ${jaroWinklerScore.toFixed(4)} (raw)`);

  // Scale to 0-100
  let score = jaroWinklerScore * 100;
  console.log(`Scaled score: ${score.toFixed(1)}% (base)`);

  // City boost: +15 if city appears in gym name
  if (city1 && city2) {
    const city1Lower = city1.toLowerCase();
    const city2Lower = city2.toLowerCase();
    const name1Lower = name1.toLowerCase();
    const name2Lower = name2.toLowerCase();

    if (name1Lower.includes(city2Lower) || name2Lower.includes(city1Lower)) {
      score += 15;
      console.log(`City boost: +15 (city found in name)`);
    } else {
      console.log(`City boost: none (city not in name)`);
      console.log(`  City 1: "${city1}", City 2: "${city2}"`);
    }
  } else {
    console.log(`City boost: none (cities missing)`);
    console.log(`  City 1: ${city1 || 'MISSING'}, City 2: ${city2 || 'MISSING'}`);
  }

  // Cap at 100
  score = Math.min(score, 100);
  console.log(`Final score: ${score.toFixed(1)}%`);

  return score;
}

// Test Pablo Silva BJJ gyms
console.log('=== TESTING PABLO SILVA BJJ MATCH ===\n');

const jjwlName = 'Pablo Silva BJJ';
const jjwlCity = undefined; // no city in JJWL

const ibjjfName = 'Pablo Silva BJJ';
const ibjjfCity = 'Bellaire';

const score = calculateSimilarity(jjwlName, ibjjfName, jjwlCity, ibjjfCity);

console.log();
console.log(`\n=== RESULT ===`);
console.log(`Score: ${score.toFixed(1)}%`);
console.log(`Threshold for auto-link: ≥90%`);
console.log(`Threshold for pending: 70-89%`);
console.log(`Result: ${score >= 90 ? '✅ AUTO-LINK' : score >= 70 ? '⚠️ PENDING' : '❌ NO MATCH'}`);
