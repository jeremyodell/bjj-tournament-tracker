import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

async function checkCountries() {
  console.log('Scanning for IBJJF gyms with country data...\n');

  const result = await docClient.send(
    new ScanCommand({
      TableName: 'bjj-tournament-tracker-dev',
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'SRCGYM#IBJJF#',
      },
      Limit: 50, // Just get a sample
    })
  );

  if (!result.Items || result.Items.length === 0) {
    console.log('No IBJJF gyms found in database');
    return;
  }

  // Collect unique country values
  const countries = new Map<string, number>();
  const countryAbbrs = new Map<string, number>();

  for (const item of result.Items) {
    const country = item.country as string;
    const countryAbbr = item.countryAbbr as string;

    if (country) {
      countries.set(country, (countries.get(country) || 0) + 1);
    }
    if (countryAbbr) {
      countryAbbrs.set(countryAbbr, (countryAbbrs.get(countryAbbr) || 0) + 1);
    }
  }

  console.log('Country values found (sample of 50 gyms):');
  console.log('=====================================');
  console.log('\nFull country names:');
  for (const [country, count] of Array.from(countries.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${country}: ${count}`);
  }

  console.log('\nCountry abbreviations:');
  for (const [abbr, count] of Array.from(countryAbbrs.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${abbr}: ${count}`);
  }

  // Show a few example gyms
  console.log('\nExample US gyms (if any):');
  const usGyms = result.Items.filter(
    (item) =>
      item.country === 'United States' ||
      item.country === 'USA' ||
      item.countryAbbr === 'US'
  ).slice(0, 3);

  for (const gym of usGyms) {
    console.log(`  - ${gym.name} (${gym.city}, ${gym.country}/${gym.countryAbbr})`);
  }
}

checkCountries().catch(console.error);
