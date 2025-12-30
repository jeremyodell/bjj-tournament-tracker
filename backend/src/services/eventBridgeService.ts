import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const client = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'bjj-flight-prices-dev';

export async function publishAirportAddedEvent(airport: string, userId: string): Promise<void> {
  const command = new PutEventsCommand({
    Entries: [
      {
        EventBusName: EVENT_BUS_NAME,
        Source: 'bjj.airports',
        DetailType: 'airport.added',
        Detail: JSON.stringify({
          airport,
          userId,
          timestamp: new Date().toISOString(),
        }),
      },
    ],
  });

  await client.send(command);
}
