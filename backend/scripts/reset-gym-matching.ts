#!/usr/bin/env npx tsx

import 'dotenv/config';
import { ScanCommand, BatchWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../src/db/client.js';

async function deleteAllMasterGyms(): Promise<number> {
  console.log('Scanning for master gyms...');
  let count = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
          ':pk': 'MASTERGYM#',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items && result.Items.length > 0) {
      // Batch delete in chunks of 25 (DynamoDB limit)
      for (let i = 0; i < result.Items.length; i += 25) {
        const chunk = result.Items.slice(i, i + 25);
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: chunk.map(item => ({
                DeleteRequest: {
                  Key: {
                    PK: item.PK,
                    SK: item.SK,
                  },
                },
              })),
            },
          })
        );
        count += chunk.length;
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return count;
}

async function deleteAllPendingMatches(): Promise<number> {
  console.log('Scanning for pending matches...');
  let count = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
          ':pk': 'PENDINGMATCH#',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items && result.Items.length > 0) {
      // Batch delete in chunks of 25
      for (let i = 0; i < result.Items.length; i += 25) {
        const chunk = result.Items.slice(i, i + 25);
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: chunk.map(item => ({
                DeleteRequest: {
                  Key: {
                    PK: item.PK,
                    SK: item.SK,
                  },
                },
              })),
            },
          })
        );
        count += chunk.length;
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return count;
}

async function unlinkAllSourceGyms(): Promise<number> {
  console.log('Scanning for linked source gyms...');
  let count = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND attribute_exists(masterGymId)',
        ExpressionAttributeValues: {
          ':pk': 'SRCGYM#',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items && result.Items.length > 0) {
      // Update each gym to set masterGymId = null
      for (const item of result.Items) {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
            UpdateExpression: 'SET masterGymId = :null',
            ExpressionAttributeValues: {
              ':null': null,
            },
          })
        );
        count++;

        if (count % 100 === 0) {
          console.log(`  Unlinked ${count} gyms...`);
        }
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return count;
}

async function main() {
  console.log('=== RESETTING GYM MATCHING DATA ===\n');

  console.log('Step 1: Deleting all master gyms...');
  const masterGymsDeleted = await deleteAllMasterGyms();
  console.log(`✅ Deleted ${masterGymsDeleted} master gyms\n`);

  console.log('Step 2: Deleting all pending matches...');
  const pendingMatchesDeleted = await deleteAllPendingMatches();
  console.log(`✅ Deleted ${pendingMatchesDeleted} pending matches\n`);

  console.log('Step 3: Unlinking all source gyms...');
  const gymsUnlinked = await unlinkAllSourceGyms();
  console.log(`✅ Unlinked ${gymsUnlinked} source gyms\n`);

  console.log('=== RESET COMPLETE ===');
  console.log(`Total operations: ${masterGymsDeleted + pendingMatchesDeleted + gymsUnlinked}`);
  console.log('\nDatabase is now ready for a clean performance test.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
