/**
 * Quick script to fetch a sample of IBJJF gyms and check US gym count
 */
import { fetchIBJJFGymPage } from '../src/fetchers/ibjjfGymFetcher.js';

async function checkUSGyms() {
  console.log('Fetching first page of IBJJF gyms...\n');

  const result = await fetchIBJJFGymPage(0); // Fetch page 0 (first page)

  console.log(`Total IBJJF gyms: ${result.totalRecords}`);
  console.log(`Gyms in first page: ${result.gyms.length}\n`);

  // Collect unique country values
  const countries = new Map<string, number>();
  const countryCodes = new Map<string, number>();

  for (const gym of result.gyms) {
    const country = gym.country || 'Unknown';
    const countryCode = gym.countryCode || 'Unknown';

    countries.set(country, (countries.get(country) || 0) + 1);
    countryCodes.set(countryCode, (countryCodes.get(countryCode) || 0) + 1);
  }

  console.log('Country values found (first page):');
  console.log('===================================');
  console.log('\nFull country names (sorted by frequency):');
  for (const [country, count] of Array.from(countries.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${country.padEnd(25)} : ${count}`);
  }

  console.log('\nCountry codes (sorted by frequency):');
  for (const [code, count] of Array.from(countryCodes.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code.padEnd(5)} : ${count}`);
  }

  // Find US gyms using multiple possible values
  const usGyms = result.gyms.filter(
    (g) =>
      g.country === 'United States' ||
      g.country === 'USA' ||
      g.country === 'US' ||
      g.countryCode === 'US' ||
      g.countryCode === 'USA'
  );

  console.log(`\n★ Found ${usGyms.length} US gyms in this page (${((usGyms.length / result.gyms.length) * 100).toFixed(1)}%)`);

  const estimatedUSTotal = Math.round((usGyms.length / result.gyms.length) * result.totalRecords);
  const estimatedNonUSTotal = result.totalRecords - estimatedUSTotal;
  console.log(`\n📊 Extrapolated estimates:`);
  console.log(`   US gyms:     ~${estimatedUSTotal.toLocaleString()} (filter keeps these)`);
  console.log(`   Non-US gyms: ~${estimatedNonUSTotal.toLocaleString()} (filter removes these)`);
  console.log(`   Reduction:   ${((estimatedNonUSTotal / result.totalRecords) * 100).toFixed(1)}% fewer comparisons`);

  console.log('\nExample US gyms:');
  for (const gym of usGyms.slice(0, 3)) {
    console.log(`  - ${gym.name} (${gym.city || 'no city'}, ${gym.country}/${gym.countryCode})`);
  }
}

checkUSGyms().catch((error) => {
  console.error('Failed:', error.message);
  process.exit(1);
});
