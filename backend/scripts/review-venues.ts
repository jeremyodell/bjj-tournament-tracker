#!/usr/bin/env npx tsx

/**
 * CLI script to review and correct low-confidence geocoded venues
 * Usage: npx tsx scripts/review-venues.ts
 */

import * as readline from 'readline';
import { getLowConfidenceVenues, upsertVenue } from '../src/db/queries.js';
import { geocodeVenue } from '../src/services/geocoder.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('Fetching low-confidence venues...\n');

  const venues = await getLowConfidenceVenues();

  if (venues.length === 0) {
    console.log('No low-confidence venues to review.');
    rl.close();
    return;
  }

  console.log(`Found ${venues.length} venue(s) to review.\n`);

  for (const venue of venues) {
    console.log('═'.repeat(60));
    console.log(`\nVenue: ${venue.name}`);
    console.log(`City: ${venue.city}`);
    console.log(`Country: ${venue.country || 'Unknown'}`);
    console.log(`Current coords: ${venue.lat}, ${venue.lng}`);
    console.log(`Confidence: ${venue.geocodeConfidence}`);
    console.log('');

    const action = await question(
      'Options:\n' +
        '  [r] Re-geocode with corrected name\n' +
        '  [m] Enter manual coordinates\n' +
        '  [a] Approve current (mark as high confidence)\n' +
        '  [s] Skip\n' +
        '  [q] Quit\n' +
        '\nChoice: '
    );

    switch (action.toLowerCase()) {
      case 'r': {
        const newName = await question('Enter corrected venue name: ');
        const city = await question(`City [${venue.city}]: `) || venue.city;
        const country = await question(`Country [${venue.country || ''}]: `) || venue.country;

        console.log('\nRe-geocoding...');
        const result = await geocodeVenue(newName || venue.name, city, country);

        if (result) {
          console.log(`New coords: ${result.lat}, ${result.lng}`);
          console.log(`Confidence: ${result.confidence}`);
          console.log(`Address: ${result.formattedAddress}`);

          const confirm = await question('\nSave? [y/n]: ');
          if (confirm.toLowerCase() === 'y') {
            await upsertVenue({
              ...venue,
              name: newName || venue.name,
              city,
              country,
              lat: result.lat,
              lng: result.lng,
              geocodeConfidence: result.confidence,
              manualOverride: true,
            });
            console.log('Saved!');
          }
        } else {
          console.log('Geocoding failed.');
        }
        break;
      }

      case 'm': {
        const latStr = await question('Enter latitude: ');
        const lngStr = await question('Enter longitude: ');
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        if (isNaN(lat) || isNaN(lng)) {
          console.log('Invalid coordinates.');
        } else {
          await upsertVenue({
            ...venue,
            lat,
            lng,
            geocodeConfidence: 'high',
            manualOverride: true,
          });
          console.log('Saved!');
        }
        break;
      }

      case 'a': {
        await upsertVenue({
          ...venue,
          geocodeConfidence: 'high',
          manualOverride: true,
        });
        console.log('Approved!');
        break;
      }

      case 's':
        console.log('Skipped.');
        break;

      case 'q':
        console.log('\nExiting...');
        rl.close();
        return;

      default:
        console.log('Invalid option, skipping.');
    }

    console.log('');
  }

  console.log('\nReview complete!');
  rl.close();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
