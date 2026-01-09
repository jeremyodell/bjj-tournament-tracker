/**
 * Migration script to create master gyms for all source gyms that don't have one.
 * This fixes the issue where single-org gyms (no cross-org match) weren't getting masters.
 *
 * Run: npx tsx scripts/backfill-master-gyms.ts [--prod]
 */

import 'dotenv/config';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../src/db/client.js';
import { createMasterGym, linkSourceGymToMaster } from '../src/db/masterGymQueries.js';
import type { SourceGymItem } from '../src/db/types.js';

async function backfillMasterGyms(dryRun = false) {
  console.log('🔍 Scanning for source gyms without master gyms...');
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🏃 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  let totalProcessed = 0;
  let totalCreated = 0;
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND (attribute_not_exists(masterGymId) OR masterGymId = :null)',
        ExpressionAttributeValues: {
          ':prefix': 'SRCGYM#',
          ':sk': 'META',
          ':null': null,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = (scanResult.Items || []) as SourceGymItem[];
    totalProcessed += items.length;

    for (const sourceGym of items) {
      if (!dryRun) {
        // Create master gym
        const masterGym = await createMasterGym({
          canonicalName: sourceGym.name,
          city: sourceGym.city,
          country: sourceGym.country,
        });

        // Link source gym to master
        await linkSourceGymToMaster(sourceGym.org, sourceGym.externalId, masterGym.id);

        console.log(`✅ Created master for: ${sourceGym.name} (${sourceGym.org}#${sourceGym.externalId})`);
      } else {
        console.log(`🔄 Would create master for: ${sourceGym.name} (${sourceGym.org}#${sourceGym.externalId})`);
      }

      totalCreated++;

      // Progress logging every 100 gyms
      if (totalCreated % 100 === 0) {
        console.log(`📊 Progress: ${totalCreated} masters ${dryRun ? 'would be' : ''} created...`);
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Migration ${dryRun ? 'preview' : 'complete'}!`);
  console.log(`📊 Total source gyms scanned: ${totalProcessed}`);
  console.log(`📝 Masters ${dryRun ? 'needed' : 'created'}: ${totalCreated}`);
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

await backfillMasterGyms(dryRun);
