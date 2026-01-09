import 'dotenv/config';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../src/db/client.js';
import { getMasterGym } from '../src/db/masterGymQueries.js';

const searchName = process.argv[2] || 'Labyrinth';

async function findGyms() {
  console.log(`Searching for gyms matching: "${searchName}"`);
  console.log('');

  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND contains(#name, :name)',
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':prefix': 'SRCGYM#',
      ':sk': 'META',
      ':name': searchName
    }
  }));

  const gyms = result.Items || [];
  console.log(`Found ${gyms.length} source gyms:`);
  console.log('');

  for (const gym of gyms) {
    console.log(`📍 ${gym.name} (${gym.org})`);
    console.log(`   PK: ${gym.PK}`);
    console.log(`   MasterGymId: ${gym.masterGymId || 'NONE'}`);

    if (gym.masterGymId) {
      const master = await getMasterGym(gym.masterGymId);
      if (master) {
        console.log(`   Master: ${master.canonicalName}`);
      }
    }
    console.log('');
  }
}

await findGyms();
