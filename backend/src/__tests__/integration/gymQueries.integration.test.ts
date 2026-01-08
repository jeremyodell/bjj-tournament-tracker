/**
 * Integration tests for listUSIBJJFGyms function.
 * These tests hit real DynamoDB Local - ensure it's running:
 *   docker compose up -d
 *
 * Run with:
 *   npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Set environment BEFORE importing modules that use it
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.DYNAMODB_TABLE = 'bjj-tournament-tracker-test';
process.env.AWS_REGION = 'us-east-1';

import {
  createTestTable,
  deleteTestTable,
  isDynamoDBLocalRunning,
  deleteAllGyms,
  putSourceGym,
} from './setup.js';
import { listUSIBJJFGyms } from '../../db/gymQueries.js';

describe('listUSIBJJFGyms Integration Tests', () => {
  beforeAll(async () => {
    // Check DynamoDB Local is running
    const isRunning = await isDynamoDBLocalRunning();
    if (!isRunning) {
      throw new Error(
        'DynamoDB Local is not running. Start it with: docker compose up -d'
      );
    }

    // Create test table
    await createTestTable();
  });

  afterAll(async () => {
    // Clean up test table
    await deleteTestTable();
  });

  beforeEach(async () => {
    // Clean gyms before each test
    await deleteAllGyms();
  });

  it('should return only US IBJJF gyms by countryCode', async () => {
    // Seed US IBJJF gyms with countryCode
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-1',
      name: 'Alpha BJJ',
      city: 'Los Angeles',
      state: 'CA',
      countryCode: 'US',
    });
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-2',
      name: 'Beta Academy',
      city: 'New York',
      state: 'NY',
      countryCode: 'US',
    });
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-3',
      name: 'Charlie BJJ',
      city: 'Miami',
      state: 'FL',
      countryCode: 'US',
    });

    const result = await listUSIBJJFGyms();

    expect(result.items).toHaveLength(3);
    expect(result.items.every(gym => gym.countryCode === 'US')).toBe(true);
    expect(result.items.every(gym => gym.org === 'IBJJF')).toBe(true);
    // Verify sorted by name
    expect(result.items[0].name).toBe('Alpha BJJ');
    expect(result.items[1].name).toBe('Beta Academy');
    expect(result.items[2].name).toBe('Charlie BJJ');
  });

  it('should return US gyms identified by country name', async () => {
    // Seed US IBJJF gyms with country field instead of countryCode
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-4',
      name: 'Delta BJJ',
      city: 'Chicago',
      state: 'IL',
      country: 'United States of America',
    });
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-5',
      name: 'Echo Academy',
      city: 'Boston',
      state: 'MA',
      country: 'United States of America',
    });

    const result = await listUSIBJJFGyms();

    expect(result.items).toHaveLength(2);
    expect(result.items.every(gym => gym.country === 'United States of America')).toBe(true);
    expect(result.items.every(gym => gym.org === 'IBJJF')).toBe(true);
  });

  it('should exclude non-US gyms', async () => {
    // Seed US gyms
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-us-1',
      name: 'US Gym 1',
      city: 'Seattle',
      state: 'WA',
      countryCode: 'US',
    });

    // Seed non-US gyms (Brazil, Japan)
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-br-1',
      name: 'Brazil Gym 1',
      city: 'Rio de Janeiro',
      countryCode: 'BR',
      country: 'Brazil',
    });
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-jp-1',
      name: 'Tokyo BJJ',
      city: 'Tokyo',
      countryCode: 'JP',
      country: 'Japan',
    });

    const result = await listUSIBJJFGyms();

    // Should only return the US gym
    expect(result.items).toHaveLength(1);
    expect(result.items[0].countryCode).toBe('US');
    expect(result.items[0].name).toBe('US Gym 1');
  });

  it('should exclude JJWL gyms (only IBJJF)', async () => {
    // Seed US IBJJF gym
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'ibjjf-gym-1',
      name: 'IBJJF Academy',
      city: 'Austin',
      state: 'TX',
      countryCode: 'US',
    });

    // Seed US JJWL gym (should be excluded)
    await putSourceGym({
      org: 'JJWL',
      externalId: 'jjwl-gym-1',
      name: 'JJWL Academy',
      city: 'Portland',
      state: 'OR',
      countryCode: 'US',
    });

    const result = await listUSIBJJFGyms();

    // Should only return IBJJF gym
    expect(result.items).toHaveLength(1);
    expect(result.items[0].org).toBe('IBJJF');
    expect(result.items[0].name).toBe('IBJJF Academy');
  });

  it('should handle pagination correctly', async () => {
    // Seed 5 US IBJJF gyms
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-page-1',
      name: 'Gym A',
      city: 'City A',
      state: 'CA',
      countryCode: 'US',
    });
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-page-2',
      name: 'Gym B',
      city: 'City B',
      state: 'CA',
      countryCode: 'US',
    });
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-page-3',
      name: 'Gym C',
      city: 'City C',
      state: 'CA',
      countryCode: 'US',
    });
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-page-4',
      name: 'Gym D',
      city: 'City D',
      state: 'CA',
      countryCode: 'US',
    });
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-page-5',
      name: 'Gym E',
      city: 'City E',
      state: 'CA',
      countryCode: 'US',
    });

    // First page: limit 2
    const page1 = await listUSIBJJFGyms(2);
    expect(page1.items).toHaveLength(2);
    expect(page1.lastKey).toBeDefined();
    expect(page1.items[0].name).toBe('Gym A');
    expect(page1.items[1].name).toBe('Gym B');

    // Second page: limit 2, using lastKey
    const page2 = await listUSIBJJFGyms(2, page1.lastKey);
    expect(page2.items).toHaveLength(2);
    expect(page2.lastKey).toBeDefined();
    expect(page2.items[0].name).toBe('Gym C');
    expect(page2.items[1].name).toBe('Gym D');

    // Third page: limit 2, should only return 1 item (last one)
    const page3 = await listUSIBJJFGyms(2, page2.lastKey);
    expect(page3.items).toHaveLength(1);
    expect(page3.lastKey).toBeUndefined(); // No more items
    expect(page3.items[0].name).toBe('Gym E');
  });

  it('should return empty array when no US gyms exist', async () => {
    // Seed only non-US gyms
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'gym-br-1',
      name: 'Brazil Academy',
      city: 'Sao Paulo',
      countryCode: 'BR',
      country: 'Brazil',
    });

    const result = await listUSIBJJFGyms();

    expect(result.items).toHaveLength(0);
    expect(result.lastKey).toBeUndefined();
  });
});
