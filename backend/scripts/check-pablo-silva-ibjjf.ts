#!/usr/bin/env npx tsx

import 'dotenv/config';
import { listUSIBJJFGyms } from '../src/db/gymQueries.js';

async function main() {
  const gyms = await listUSIBJJFGyms();

  const pabloGyms = gyms.filter(g =>
    g.name.toLowerCase().includes('pablo') && g.name.toLowerCase().includes('silva')
  );

  console.log(`Found ${pabloGyms.length} Pablo Silva gyms in US IBJJF dataset:\n`);

  pabloGyms.forEach(g => {
    console.log(`Name: "${g.name}"`);
    console.log(`City: ${g.city || 'NO CITY'}`);
    console.log(`State: ${g.state || 'NO STATE'}`);
    console.log(`Country: ${g.country}, ${g.countryCode}`);
    console.log(`External ID: ${g.externalId}`);
    console.log(`Master Gym ID: ${g.masterGymId || 'NOT LINKED'}`);
    console.log(`PK: ${g.PK}`);
    console.log();
  });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
