#!/usr/bin/env npx tsx

import 'dotenv/config';
import { ScanCommand, BatchWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../src/db/client.js';
import { syncIBJJFGyms, syncJJWLGyms } from '../src/services/gymSyncService.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function deleteAllMasterGyms(): Promise<number> {
  console.log('\n🗑️  Scanning for master gyms...');
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
      for (let i = 0; i < result.Items.length; i += 25) {
        const chunk = result.Items.slice(i, i + 25);
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: chunk.map(item => ({
                DeleteRequest: {
                  Key: { PK: item.PK, SK: item.SK },
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

  console.log(`   ✓ Deleted ${count} master gyms`);
  return count;
}

async function deleteAllPendingMatches(): Promise<number> {
  console.log('\n🗑️  Scanning for pending matches...');
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
      for (let i = 0; i < result.Items.length; i += 25) {
        const chunk = result.Items.slice(i, i + 25);
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: chunk.map(item => ({
                DeleteRequest: {
                  Key: { PK: item.PK, SK: item.SK },
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

  console.log(`   ✓ Deleted ${count} pending matches`);
  return count;
}

async function unlinkAllSourceGyms(): Promise<number> {
  console.log('\n🔗 Scanning for linked source gyms...');
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
      for (const item of result.Items) {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: item.PK, SK: item.SK },
            UpdateExpression: 'REMOVE masterGymId',
          })
        );
        count++;
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`   ✓ Unlinked ${count} source gyms`);
  return count;
}

async function deleteAllSourceGyms(): Promise<number> {
  console.log('\n🗑️  Scanning for source gyms...');
  let count = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
          ':pk': 'SRCGYM#',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items && result.Items.length > 0) {
      for (let i = 0; i < result.Items.length; i += 25) {
        const chunk = result.Items.slice(i, i + 25);
        await docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: chunk.map(item => ({
                DeleteRequest: {
                  Key: { PK: item.PK, SK: item.SK },
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

  console.log(`   ✓ Deleted ${count} source gyms`);
  return count;
}

async function main() {
  const isLocal = process.env.DYNAMODB_ENDPOINT?.includes('localhost');

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   AWS Gym Database Reset and Resync                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();
  console.log('📊 Target Environment:');
  console.log(`   Table: ${TABLE_NAME}`);
  console.log(`   Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`   Mode: ${isLocal ? '🏠 LOCAL' : '☁️  AWS PRODUCTION'}`);
  console.log();
  console.log('⚠️  This will:');
  console.log('   1. Delete all master gyms');
  console.log('   2. Delete all pending matches');
  console.log('   3. Delete all source gyms (IBJJF + JJWL)');
  console.log('   4. Re-fetch IBJJF gyms (~8,614 gyms)');
  console.log('   5. Re-fetch JJWL gyms (~5,780 gyms)');
  console.log('   6. Run matching algorithm (~4.4 minutes)');
  console.log();

  const answer = await askQuestion('⚠️  Type "YES" to proceed: ');

  if (answer.trim() !== 'YES') {
    console.log('❌ Aborted.');
    rl.close();
    process.exit(0);
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('STEP 1: Cleaning Database');
  console.log('═══════════════════════════════════════════════════════════');

  const startClean = Date.now();
  await deleteAllMasterGyms();
  await deleteAllPendingMatches();
  await deleteAllSourceGyms();
  const cleanDuration = Date.now() - startClean;

  console.log(`\n✓ Database cleaned in ${(cleanDuration / 1000).toFixed(1)}s`);

  console.log();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('STEP 2: Syncing IBJJF Gyms');
  console.log('═══════════════════════════════════════════════════════════');

  const startIBJJF = Date.now();
  const ibjjfResult = await syncIBJJFGyms();
  const ibjjfDuration = Date.now() - startIBJJF;

  console.log();
  console.log('📊 IBJJF Sync Results:');
  console.log(`   Fetched: ${ibjjfResult.fetched}`);
  console.log(`   Saved: ${ibjjfResult.saved}`);
  console.log(`   Duration: ${(ibjjfDuration / 1000).toFixed(1)}s`);

  console.log();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('STEP 3: Syncing JJWL Gyms + Running Matching');
  console.log('═══════════════════════════════════════════════════════════');

  const startJJWL = Date.now();
  const jjwlResult = await syncJJWLGyms();
  const jjwlDuration = Date.now() - startJJWL;

  console.log();
  console.log('📊 JJWL Sync Results:');
  console.log(`   Fetched: ${jjwlResult.fetched}`);
  console.log(`   Saved: ${jjwlResult.saved}`);
  console.log(`   Duration: ${(jjwlDuration / 1000).toFixed(1)}s`);

  if (jjwlResult.matching) {
    console.log();
    console.log('🔗 Matching Results:');
    console.log(`   Processed: ${jjwlResult.matching.processed}`);
    console.log(`   Auto-linked: ${jjwlResult.matching.autoLinked} (${((jjwlResult.matching.autoLinked / jjwlResult.matching.processed) * 100).toFixed(1)}%)`);
    console.log(`   Pending review: ${jjwlResult.matching.pendingCreated} (${((jjwlResult.matching.pendingCreated / jjwlResult.matching.processed) * 100).toFixed(1)}%)`);
  }

  const totalDuration = Date.now() - startClean;

  console.log();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Total duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  console.log();

  rl.close();
}

main().catch(err => {
  console.error('❌ Error:', err);
  rl.close();
  process.exit(1);
});
