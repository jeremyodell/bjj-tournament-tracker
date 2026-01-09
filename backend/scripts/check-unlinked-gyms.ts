import 'dotenv/config';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../src/db/client.js';

async function checkUnlinkedGyms() {
  console.log('Checking for unlinked JJWL gyms...');
  const jjwlResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND attribute_not_exists(masterGymId)',
    ExpressionAttributeValues: {
      ':prefix': 'SRCGYM#JJWL#',
      ':sk': 'META',
    },
    Limit: 5
  }));

  console.log(`JJWL gyms without masterGymId: ${jjwlResult.Items?.length || 0}`);
  if (jjwlResult.Items && jjwlResult.Items.length > 0) {
    console.log('Examples:', jjwlResult.Items.map((i: any) => i.name).join(', '));
  }

  console.log('\nChecking for unlinked IBJJF gyms...');
  const ibjjfResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND attribute_not_exists(masterGymId)',
    ExpressionAttributeValues: {
      ':prefix': 'SRCGYM#IBJJF#',
      ':sk': 'META',
    },
    Limit: 5
  }));

  console.log(`IBJJF gyms without masterGymId: ${ibjjfResult.Items?.length || 0}`);
  if (ibjjfResult.Items && ibjjfResult.Items.length > 0) {
    console.log('Examples:', ibjjfResult.Items.map((i: any) => i.name).join(', '));
  }
}

await checkUnlinkedGyms();
