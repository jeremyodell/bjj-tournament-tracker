import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const isLocal = process.env.DYNAMODB_ENDPOINT?.includes('localhost');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(isLocal && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: 'local',
      secretAccessKey: 'local',
    },
  }),
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export const TABLE_NAME = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker';
export const GSI1_NAME = 'GSI1';
