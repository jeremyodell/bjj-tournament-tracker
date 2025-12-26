#!/usr/bin/env npx tsx

import 'dotenv/config';
import { syncAllTournaments } from '../src/services/syncService.js';

async function main() {
  console.log('Starting tournament sync with geocoding...\n');

  const result = await syncAllTournaments();

  console.log('\n=== Sync Results ===');
  console.log('IBJJF:');
  console.log(`  Fetched: ${result.ibjjf.fetched}`);
  console.log(`  Saved: ${result.ibjjf.saved}`);
  if (result.ibjjf.enrichment) {
    console.log(`  Cached: ${result.ibjjf.enrichment.cached}`);
    console.log(`  Geocoded: ${result.ibjjf.enrichment.geocoded}`);
    console.log(`  Failed: ${result.ibjjf.enrichment.failed}`);
    console.log(`  Low Confidence: ${result.ibjjf.enrichment.lowConfidence}`);
  }
  if (result.ibjjf.error) {
    console.log(`  Error: ${result.ibjjf.error}`);
  }

  console.log('\nJJWL:');
  console.log(`  Fetched: ${result.jjwl.fetched}`);
  console.log(`  Saved: ${result.jjwl.saved}`);
  if (result.jjwl.enrichment) {
    console.log(`  Cached: ${result.jjwl.enrichment.cached}`);
    console.log(`  Geocoded: ${result.jjwl.enrichment.geocoded}`);
    console.log(`  Failed: ${result.jjwl.enrichment.failed}`);
    console.log(`  Low Confidence: ${result.jjwl.enrichment.lowConfidence}`);
  }
  if (result.jjwl.error) {
    console.log(`  Error: ${result.jjwl.error}`);
  }

  console.log('\nSync complete!');
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
