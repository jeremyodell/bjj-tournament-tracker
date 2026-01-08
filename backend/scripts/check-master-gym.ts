#!/usr/bin/env npx tsx

import 'dotenv/config';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../src/db/client.js';
import { listAllJJWLGyms, listUSIBJJFGyms } from '../src/db/gymQueries.js';

async function main() {
  const masterGymId = 'c07dcf8b-8894-4aee-8c1e-0b155bc4cc1a';

  // Get the master gym
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `MASTERGYM#${masterGymId}`,
        SK: 'META',
      },
    })
  );

  console.log('Master Gym:', result.Item);
  console.log();

  // Find all source gyms linked to this master gym
  const [jjwlGyms, ibjjfGyms] = await Promise.all([
    listAllJJWLGyms(),
    listUSIBJJFGyms(),
  ]);

  const allGyms = [...jjwlGyms, ...ibjjfGyms];
  const linkedGyms = allGyms.filter(g => g.masterGymId === masterGymId);

  console.log(`Source gyms linked to this master gym (${linkedGyms.length}):\n`);

  linkedGyms.forEach(g => {
    console.log(`- [${g.org}] "${g.name}" (${g.city || 'no city'})`);
    console.log(`  External ID: ${g.externalId}`);
    console.log();
  });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
