/**
 * Migration script to convert all MasterGym GSI1SK values to lowercase
 * for case-insensitive searching.
 *
 * Run: tsx scripts/migrate-lowercase-gym-names.ts [--prod]
 */

import 'dotenv/config';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../src/db/client.js';

async function migrateMasterGyms(dryRun = false) {
  console.log('🔍 Scanning for MasterGym records...');
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🏃 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  let totalProcessed = 0;
  let totalUpdated = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk',
        ExpressionAttributeValues: {
          ':prefix': 'MASTERGYM#',
          ':sk': 'META',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = scanResult.Items || [];
    totalProcessed += items.length;

    for (const item of items) {
      const canonicalName = item.canonicalName as string;
      const currentGSI1SK = item.GSI1SK as string;
      const expectedGSI1SK = canonicalName.toLowerCase();

      // Check if GSI1SK needs updating
      if (currentGSI1SK !== expectedGSI1SK) {
        console.log(`📝 ${canonicalName}`);
        console.log(`   Current:  "${currentGSI1SK}"`);
        console.log(`   Expected: "${expectedGSI1SK}"`);

        if (!dryRun) {
          await docClient.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: {
                PK: item.PK,
                SK: item.SK,
              },
              UpdateExpression: 'SET GSI1SK = :gsi1sk, updatedAt = :updatedAt',
              ExpressionAttributeValues: {
                ':gsi1sk': expectedGSI1SK,
                ':updatedAt': new Date().toISOString(),
              },
            })
          );
          console.log('   ✅ Updated');
        } else {
          console.log('   🔄 Would update');
        }

        totalUpdated++;
        console.log('');
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Migration ${dryRun ? 'preview' : 'complete'}!`);
  console.log(`📊 Total records scanned: ${totalProcessed}`);
  console.log(`📝 Records ${dryRun ? 'needing update' : 'updated'}: ${totalUpdated}`);
  console.log('═══════════════════════════════════════');
}

// Parse command line args
const args = process.argv.slice(2);
const isProd = args.includes('--prod');
const dryRun = args.includes('--dry-run');

if (isProd && !dryRun) {
  console.log('⚠️  WARNING: Running in PRODUCTION mode');
  console.log('Press Ctrl+C within 5 seconds to cancel...');
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

await migrateMasterGyms(dryRun);
