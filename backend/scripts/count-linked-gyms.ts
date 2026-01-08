#!/usr/bin/env npx tsx

import 'dotenv/config';
import { listAllJJWLGyms, listUSIBJJFGyms } from '../src/db/gymQueries.js';

async function main() {
  console.log('Counting linked gyms...\n');

  const [jjwlGyms, ibjjfGyms] = await Promise.all([
    listAllJJWLGyms(),
    listUSIBJJFGyms(),
  ]);

  const jjwlLinked = jjwlGyms.filter(g => g.masterGymId !== null);
  const ibjjfLinked = ibjjfGyms.filter(g => g.masterGymId !== null);

  console.log(`JJWL Gyms:`);
  console.log(`  Total: ${jjwlGyms.length}`);
  console.log(`  Linked: ${jjwlLinked.length} (${((jjwlLinked.length / jjwlGyms.length) * 100).toFixed(1)}%)`);
  console.log(`  Unlinked: ${jjwlGyms.length - jjwlLinked.length}`);
  console.log();

  console.log(`US IBJJF Gyms:`);
  console.log(`  Total: ${ibjjfGyms.length}`);
  console.log(`  Linked: ${ibjjfLinked.length} (${((ibjjfLinked.length / ibjjfGyms.length) * 100).toFixed(1)}%)`);
  console.log(`  Unlinked: ${ibjjfGyms.length - ibjjfLinked.length}`);
  console.log();

  console.log(`\nThis explains why matching found 0 auto-linked gyms:`);
  console.log(`The ${ibjjfLinked.length} already-linked IBJJF gyms were skipped during matching!`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
