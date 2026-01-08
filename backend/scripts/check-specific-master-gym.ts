#!/usr/bin/env npx tsx

import 'dotenv/config';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../src/db/client.js';
import { listAllJJWLGyms, listUSIBJJFGyms } from '../src/db/gymQueries.js';

const masterGymId = process.argv[2];

if (!masterGymId) {
  console.error('Usage: npx tsx check-specific-master-gym.ts <master-gym-id>');
  process.exit(1);
}

async function main() {
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

  console.log('Master Gym:');
  console.log(`  ID: ${result.Item?.id}`);
  console.log(`  Canonical Name: ${result.Item?.canonicalName}`);
  console.log(`  City: ${result.Item?.city}`);
  console.log(`  Country: ${result.Item?.country}`);
  console.log();

  // Find all source gyms linked to this master gym
  const [jjwlGyms, ibjjfGyms] = await Promise.all([
    listAllJJWLGyms(),
    listUSIBJJFGyms(),
  ]);

  const allGyms = [...jjwlGyms, ...ibjjfGyms];
  const linkedGyms = allGyms.filter(g => g.masterGymId === masterGymId);

  console.log(`Linked Source Gyms (${linkedGyms.length}):\n`);

  linkedGyms.forEach(g => {
    console.log(`- [${g.org}] "${g.name}"`);
    console.log(`  City: ${g.city || 'no city'}, State: ${g.state || 'no state'}`);
    console.log(`  External ID: ${g.externalId}`);
    console.log();
  });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
