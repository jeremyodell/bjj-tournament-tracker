import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = 'bjj-tournament-tracker-dev';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function clearTable() {
  console.log(`Clearing table ${TABLE_NAME}...`);
  
  let totalDeleted = 0;
  let lastKey: Record<string, unknown> | undefined;
  
  do {
    // Scan for items
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'PK, SK',
      ExclusiveStartKey: lastKey,
      Limit: 25,
    }));
    
    const items = scanResult.Items || [];
    lastKey = scanResult.LastEvaluatedKey;
    
    if (items.length === 0) break;
    
    // Delete items in batch
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: items.map(item => ({
          DeleteRequest: {
            Key: { PK: item.PK, SK: item.SK }
          }
        }))
      }
    }));
    
    totalDeleted += items.length;
    process.stdout.write(`\rDeleted ${totalDeleted} items...`);
    
  } while (lastKey);
  
  console.log(`\nCleared ${totalDeleted} items from ${TABLE_NAME}`);
}

clearTable().catch(console.error);
