/**
 * Creates the DynamoDB table using native fetch (workaround for AWS SDK issues).
 */

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://127.0.0.1:8000';

async function dynamoRequest(action: string, body: object) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': `DynamoDB_20120810.${action}`,
      'Authorization': 'AWS4-HMAC-SHA256 Credential=local/20250101/local/dynamodb/aws4_request',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok && !data.__type?.includes('ResourceNotFoundException')) {
    throw new Error(data.message || data.Message || JSON.stringify(data));
  }
  return { ok: response.ok, data };
}

async function main() {
  console.log(`Checking if table "${TABLE_NAME}" exists...`);

  // Check if table exists
  const describeResult = await dynamoRequest('DescribeTable', { TableName: TABLE_NAME });

  if (describeResult.ok) {
    console.log(`Table "${TABLE_NAME}" already exists.`);
    return;
  }

  console.log(`Creating table "${TABLE_NAME}"...`);

  await dynamoRequest('CreateTable', {
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

  console.log(`Table "${TABLE_NAME}" created successfully.`);
}

main().catch((error) => {
  console.error('Failed:', error.message);
  process.exit(1);
});
