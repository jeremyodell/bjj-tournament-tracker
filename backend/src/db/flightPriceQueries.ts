import { PutCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './client.js';
import { buildFlightPK, type FlightPriceItem } from './types.js';

export type FlightPriceInput = Omit<FlightPriceItem, 'PK' | 'SK' | 'ttl'>;

export async function saveFlightPrice(price: FlightPriceInput): Promise<void> {
  const item: FlightPriceItem = {
    PK: buildFlightPK(price.originAirport, price.destinationCity),
    SK: price.tournamentStartDate,
    ttl: Math.floor(new Date(price.expiresAt).getTime() / 1000),
    ...price,
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  });

  await docClient.send(command);
}

export async function getFlightPrice(
  originAirport: string,
  destinationCity: string,
  tournamentStartDate: string
): Promise<FlightPriceItem | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildFlightPK(originAirport, destinationCity),
      SK: tournamentStartDate,
    },
  });

  const result = await docClient.send(command);
  return (result.Item as FlightPriceItem) || null;
}

export async function getFlightPricesForAirport(
  originAirport: string
): Promise<FlightPriceItem[]> {
  // Use Scan with filter since we need to match prefix across multiple destination cities
  // In a production system with many records, consider a GSI for better performance
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix)',
    ExpressionAttributeValues: {
      ':prefix': `FLIGHT#${originAirport}#`,
    },
  });

  const result = await docClient.send(command);
  return (result.Items as FlightPriceItem[]) || [];
}

export async function getExpiredFlightPrices(): Promise<FlightPriceItem[]> {
  const now = new Date().toISOString();

  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix) AND expiresAt < :now',
    ExpressionAttributeValues: {
      ':prefix': 'FLIGHT#',
      ':now': now,
    },
  });

  const result = await docClient.send(command);
  return (result.Items as FlightPriceItem[]) || [];
}

export async function getFlightPricesForRoute(
  originAirport: string,
  destinationCity: string
): Promise<FlightPriceItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': buildFlightPK(originAirport, destinationCity),
    },
  });

  const result = await docClient.send(command);
  return (result.Items as FlightPriceItem[]) || [];
}
