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

    expect(result).toHaveLength(3);
    expect(result.every(gym => gym.countryCode === 'US')).toBe(true);
    expect(result.every(gym => gym.org === 'IBJJF')).toBe(true);
    // Results may not be sorted (ScanCommand doesn't guarantee order)
    const names = result.map(g => g.name).sort();
    expect(names).toEqual(['Alpha BJJ', 'Beta Academy', 'Charlie BJJ']);
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

    expect(result).toHaveLength(2);
    expect(result.every(gym => gym.country === 'United States of America')).toBe(true);
    expect(result.every(gym => gym.org === 'IBJJF')).toBe(true);
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
    expect(result).toHaveLength(1);
    expect(result[0].countryCode).toBe('US');
    expect(result[0].name).toBe('US Gym 1');
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
    expect(result).toHaveLength(1);
    expect(result[0].org).toBe('IBJJF');
    expect(result[0].name).toBe('IBJJF Academy');
  });

  it('should handle pagination internally (fetch all gyms)', async () => {
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

    // Function should fetch all gyms with internal pagination
    const result = await listUSIBJJFGyms();
    expect(result).toHaveLength(5);
    expect(result.every(gym => gym.org === 'IBJJF')).toBe(true);
    expect(result.every(gym => gym.countryCode === 'US')).toBe(true);

    // Verify all gyms are present (order not guaranteed with Scan)
    const names = result.map(g => g.name).sort();
    expect(names).toEqual(['Gym A', 'Gym B', 'Gym C', 'Gym D', 'Gym E']);
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

    expect(result).toHaveLength(0);
  });
});
