#!/usr/bin/env npx tsx

import 'dotenv/config';
import { syncIBJJFGyms } from '../src/services/gymSyncService.js';

async function main() {
  console.log('Syncing IBJJF gyms (forced)...\n');

  const result = await syncIBJJFGyms({ forceSync: true });

  console.log('\n=== IBJJF Gym Sync Results ===');
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Fetched: ${result.fetched}`);
  console.log(`Saved: ${result.saved}`);
  console.log(`Duration: ${result.duration}ms`);

  if (result.matching) {
    console.log(`\nMatching:`);
    console.log(`  Processed: ${result.matching.processed}`);
    console.log(`  Auto-linked: ${result.matching.autoLinked}`);
    console.log(`  Pending: ${result.matching.pendingCreated}`);
  }

  if (result.error) {
    console.log(`\nError: ${result.error}`);
    process.exit(1);
  }

  console.log('\nSync complete!');
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
