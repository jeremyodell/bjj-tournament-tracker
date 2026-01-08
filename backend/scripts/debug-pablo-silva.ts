#!/usr/bin/env npx tsx

import 'dotenv/config';
import { listAllJJWLGyms, listUSIBJJFGyms } from '../src/db/gymQueries.js';
import { findMatchesForGym } from '../src/services/gymMatchingService.js';

async function main() {
  console.log('Loading gyms...\n');

  const [jjwlGyms, ibjjfGyms] = await Promise.all([
    listAllJJWLGyms(),
    listUSIBJJFGyms(),
  ]);

  console.log(`Loaded ${jjwlGyms.length} JJWL gyms and ${ibjjfGyms.length} US IBJJF gyms\n`);

  // Search for Pablo Silva in JJWL
  const jjwlPabloGyms = jjwlGyms.filter(g =>
    g.name.toLowerCase().includes('pablo') && g.name.toLowerCase().includes('silva')
  );

  console.log(`Found ${jjwlPabloGyms.length} JJWL gyms matching "Pablo Silva":`);
  jjwlPabloGyms.forEach(g => {
    console.log(`  - ${g.name} (${g.city || 'no city'}, ${g.state || 'no state'})`);
  });
  console.log();

  // Search for Pablo Silva in IBJJF
  const ibjjfPabloGyms = ibjjfGyms.filter(g =>
    g.name.toLowerCase().includes('pablo') && g.name.toLowerCase().includes('silva')
  );

  console.log(`Found ${ibjjfPabloGyms.length} US IBJJF gyms matching "Pablo Silva":`);
  ibjjfPabloGyms.forEach(g => {
    console.log(`  - ${g.name} (${g.city || 'no city'}, ${g.state || 'no state'})`);
  });
  console.log();

  // Test matching between them
  if (jjwlPabloGyms.length > 0) {
    console.log('=== MATCHING RESULTS ===\n');

    for (const jjwlGym of jjwlPabloGyms) {
      console.log(`JJWL Gym: "${jjwlGym.name}" (${jjwlGym.city || 'no city'}, ${jjwlGym.state || 'no state'})`);

      const matches = await findMatchesForGym(jjwlGym, ibjjfGyms);

      console.log(`  Found ${matches.length} potential matches:\n`);

      matches.forEach(match => {
        console.log(`  - Score: ${match.score.toFixed(1)}%`);
        console.log(`    IBJJF: "${match.gym.name}"`);
        console.log(`    City: ${match.gym.city || 'no city'}, ${match.gym.state || 'no state'}`);
        console.log(`    Country: ${match.gym.country}, ${match.gym.countryCode}`);
        console.log();
      });

      if (matches.length === 0) {
        console.log('  No matches found above 70% threshold\n');
      }
    }
  }

  console.log('\n=== SAMPLE OF TOP SCORING MATCHES (any gym) ===\n');

  // Take first 3 JJWL gyms and show their best matches
  const sampleGyms = jjwlGyms.slice(0, 3);

  for (const jjwlGym of sampleGyms) {
    console.log(`JJWL: "${jjwlGym.name}" (${jjwlGym.city || 'no city'})`);

    const matches = await findMatchesForGym(jjwlGym, ibjjfGyms);

    if (matches.length > 0) {
      const topMatch = matches[0];
      console.log(`  Best match: ${topMatch.score.toFixed(1)}% - "${topMatch.gym.name}" (${topMatch.gym.city || 'no city'})`);
    } else {
      console.log(`  No matches above 70%`);
    }
    console.log();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
