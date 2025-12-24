/**
 * Creates the DynamoDB table for local development.
 * Run with: npm run db:create
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker';

const client = new DynamoDBClient({
  region: 'local',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

async function tableExists(): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return false;
    }
    throw error;
  }
}

async function createTable(): Promise<void> {
  const command = new CreateTableCommand({
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  });

  await client.send(command);
}

async function main(): Promise<void> {
  console.log(`Checking if table "${TABLE_NAME}" exists...`);

  if (await tableExists()) {
    console.log(`Table "${TABLE_NAME}" already exists.`);
    return;
  }

  console.log(`Creating table "${TABLE_NAME}"...`);
  await createTable();
  console.log(`Table "${TABLE_NAME}" created successfully.`);
}

main().catch((error) => {
  console.error('Failed to create table:', error);
  process.exit(1);
});
