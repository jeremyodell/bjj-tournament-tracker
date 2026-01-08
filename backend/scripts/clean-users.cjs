#!/usr/bin/env node

/**
 * Clean all user data from DynamoDB and Cognito
 *
 * Usage:
 *   node scripts/clean-users.js              # Clean production
 *   node scripts/clean-users.js --local      # Clean local DynamoDB only
 *   node scripts/clean-users.js --force      # Skip confirmation
 */

const { DynamoDBClient, ScanCommand, BatchWriteItemCommand } = require('@aws-sdk/client-dynamodb');
const { CognitoIdentityProviderClient, ListUsersCommand, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { marshall } = require('@aws-sdk/util-dynamodb');
const readline = require('readline');

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const force = args.includes('--force');

const TABLE_NAME = isLocal ? 'bjj-tournament-tracker' : 'bjj-tournament-tracker-dev';
const USER_POOL_ID = 'us-east-1_bjKBB22Kz';
const REGION = 'us-east-1';

const dynamoClient = new DynamoDBClient(
  isLocal
    ? {
        region: REGION,
        endpoint: 'http://localhost:8000',
        credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
      }
    : { region: REGION }
);

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

async function confirm(message) {
  if (force) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function cleanDynamoDB() {
  console.log(`\n🔍 Scanning ${isLocal ? 'LOCAL' : 'PRODUCTION'} DynamoDB for user data...`);

  let itemsToDelete = [];
  let lastKey;

  do {
    const scanParams = {
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :userPrefix)',
      ExpressionAttributeValues: marshall({ ':userPrefix': 'USER#' }),
      ExclusiveStartKey: lastKey,
    };

    const result = await dynamoClient.send(new ScanCommand(scanParams));

    if (result.Items && result.Items.length > 0) {
      itemsToDelete.push(
        ...result.Items.map((item) => ({
          PK: item.PK,
          SK: item.SK,
        }))
      );
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${itemsToDelete.length} user-related items`);

  if (itemsToDelete.length === 0) {
    console.log('✓ No user data found in DynamoDB');
    return 0;
  }

  const shouldDelete = await confirm(
    `Delete ${itemsToDelete.length} items from ${isLocal ? 'LOCAL' : 'PRODUCTION'} DynamoDB?`
  );

  if (!shouldDelete) {
    console.log('❌ Cancelled DynamoDB cleanup');
    return 0;
  }

  // Delete in batches of 25 (DynamoDB limit)
  for (let i = 0; i < itemsToDelete.length; i += 25) {
    const batch = itemsToDelete.slice(i, i + 25);

    const deleteParams = {
      RequestItems: {
        [TABLE_NAME]: batch.map((item) => ({
          DeleteRequest: { Key: item },
        })),
      },
    };

    await dynamoClient.send(new BatchWriteItemCommand(deleteParams));
    console.log(`  Deleted batch ${Math.floor(i / 25) + 1} (${batch.length} items)`);
  }

  console.log('✓ All user data deleted from DynamoDB');
  return itemsToDelete.length;
}

async function cleanCognito() {
  if (isLocal) {
    console.log('\n⏭️  Skipping Cognito (local mode)');
    return 0;
  }

  console.log('\n🔍 Scanning Cognito User Pool for users...');

  const listResult = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
    })
  );

  const users = listResult.Users || [];
  console.log(`Found ${users.length} users in Cognito`);

  if (users.length === 0) {
    console.log('✓ No users found in Cognito');
    return 0;
  }

  // Show user details
  users.forEach((user) => {
    const email = user.Attributes?.find((attr) => attr.Name === 'email')?.Value || 'N/A';
    console.log(`  - ${user.Username} (${email})`);
  });

  const shouldDelete = await confirm(`Delete ${users.length} users from PRODUCTION Cognito?`);

  if (!shouldDelete) {
    console.log('❌ Cancelled Cognito cleanup');
    return 0;
  }

  for (const user of users) {
    await cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: user.Username,
      })
    );
    console.log(`  Deleted user: ${user.Username}`);
  }

  console.log('✓ All users deleted from Cognito');
  return users.length;
}

async function main() {
  console.log('🧹 User Data Cleanup Tool');
  console.log('========================');
  console.log(`Target: ${isLocal ? 'LOCAL DynamoDB' : 'PRODUCTION (DynamoDB + Cognito)'}`);

  try {
    const dynamoCount = await cleanDynamoDB();
    const cognitoCount = await cleanCognito();

    console.log('\n✅ Cleanup Complete');
    console.log(`   DynamoDB: ${dynamoCount} items deleted`);
    if (!isLocal) {
      console.log(`   Cognito: ${cognitoCount} users deleted`);
    }
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

main();
