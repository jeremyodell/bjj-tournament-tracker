/**
 * Quick script to fetch a sample of IBJJF gyms and check country values
 */
import axios from 'axios';

const IBJJF_BASE_URL = 'https://ibjjfapi.com';
const API_KEY = '6d4ee442-0bd9-4fc5-848f-e3e8ef8b0e0b';

interface IBJJFGym {
  id: number;
  name: string;
  country: string;
  countryAbbr: string;
  city: string;
}

interface IBJJFResponse {
  pagination: {
    page: number;
    totalRecords: number;
  };
  list: IBJJFGym[];
}

async function checkCountries() {
  console.log('Fetching sample IBJJF gyms...\n');

  // Fetch first page
  const response = await axios.get<IBJJFResponse>(`${IBJJF_BASE_URL}/v1/gyms`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    params: { page: 1, pageSize: 100 },
  });

  const gyms = response.data.list;
  console.log(`Fetched ${gyms.length} gyms (page 1 of ${response.data.pagination.totalRecords} total)\n`);

  // Collect unique country values
  const countries = new Map<string, number>();
  const countryAbbrs = new Map<string, number>();

  for (const gym of gyms) {
    const country = gym.country;
    const countryAbbr = gym.countryAbbr;

    countries.set(country, (countries.get(country) || 0) + 1);
    countryAbbrs.set(countryAbbr, (countryAbbrs.get(countryAbbr) || 0) + 1);
  }

  console.log('Country values found (first 100 gyms):');
  console.log('======================================');
  console.log('\nFull country names (sorted by frequency):');
  for (const [country, count] of Array.from(countries.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${country.padEnd(25)} : ${count}`);
  }

  console.log('\nCountry abbreviations (sorted by frequency):');
  for (const [abbr, count] of Array.from(countryAbbrs.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${abbr.padEnd(5)} : ${count}`);
  }

  // Find US gyms
  const usGyms = gyms.filter(
    (g) =>
      g.country === 'United States' ||
      g.country === 'USA' ||
      g.countryAbbr === 'US' ||
      g.countryAbbr === 'USA'
  );

  console.log(`\nFound ${usGyms.length} US gyms in sample`);
  console.log('\nExample US gyms:');
  for (const gym of usGyms.slice(0, 5)) {
    console.log(`  - ${gym.name} (${gym.city}, ${gym.country}/${gym.countryAbbr})`);
  }

  // Show percentage
  const usPercentage = ((usGyms.length / gyms.length) * 100).toFixed(1);
  console.log(`\n★ US gyms represent ${usPercentage}% of this sample`);
  console.log(`  Extrapolated to full dataset: ~${Math.round((usGyms.length / gyms.length) * 8614)} US gyms out of 8,614 total`);
}

checkCountries().catch((error) => {
  console.error('Failed:', error.message);
  process.exit(1);
});
