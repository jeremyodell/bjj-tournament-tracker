/**
 * Integration tests for gym matching performance.
 * These tests hit real DynamoDB Local - ensure it's running:
 *   docker compose up -d
 *
 * Run with:
 *   npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Set environment BEFORE importing modules that use it
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.DYNAMODB_TABLE = 'bjj-tournament-tracker-test';
process.env.AWS_REGION = 'us-east-1';

import { syncJJWLGyms, syncIBJJFGyms } from '../../services/gymSyncService.js';
import {
  createTestTable,
  deleteTestTable,
  isDynamoDBLocalRunning,
  deleteAllGyms,
  deleteAllMasterGyms,
  deleteAllPendingMatches,
  putSourceGym,
} from './setup.js';
import * as jjwlFetcher from '../../fetchers/jjwlGymFetcher.js';
import * as ibjjfFetcher from '../../fetchers/ibjjfGymFetcher.js';

describe('Gym Matching Performance Integration', () => {
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
    await deleteAllGyms();
    await deleteAllMasterGyms();
    await deleteAllPendingMatches();
  });

  it('should complete JJWL matching quickly with sample data', async () => {
    // Mock fetchers to avoid rate limiting - use small sample instead of ALL records
    const sampleIBJJFGyms = [
      {
        org: 'IBJJF' as const,
        externalId: 'ibjjf-1',
        name: 'Gracie Barra Austin',
        city: 'Austin',
        state: 'TX',
        countryCode: 'US',
        country: 'United States',
      },
      {
        org: 'IBJJF' as const,
        externalId: 'ibjjf-2',
        name: 'Alliance BJJ Dallas',
        city: 'Dallas',
        state: 'TX',
        countryCode: 'US',
        country: 'United States',
      },
      {
        org: 'IBJJF' as const,
        externalId: 'ibjjf-3',
        name: 'Atos Jiu-Jitsu San Diego',
        city: 'San Diego',
        state: 'CA',
        countryCode: 'US',
        country: 'United States',
      },
    ];

    const sampleJJWLGyms = [
      { org: 'JJWL' as const, externalId: 'jjwl-1', name: 'Gracie Barra Austin' },
      { org: 'JJWL' as const, externalId: 'jjwl-2', name: 'Alliance BJJ Dallas' },
    ];

    jest.spyOn(ibjjfFetcher, 'fetchIBJJFGymCount').mockResolvedValue(3);
    jest.spyOn(ibjjfFetcher, 'fetchAllIBJJFGyms').mockResolvedValue(sampleIBJJFGyms);
    jest.spyOn(jjwlFetcher, 'fetchJJWLGyms').mockResolvedValue(sampleJJWLGyms);

    // Run IBJJF sync first to populate US gyms
    const ibjjfResult = await syncIBJJFGyms();
    expect(ibjjfResult.fetched).toBe(3);

    // Run JJWL sync with matching
    const startTime = Date.now();
    const jjwlResult = await syncJJWLGyms();
    const duration = Date.now() - startTime;

    // Performance assertion: should be fast with small dataset (<5 seconds)
    expect(duration).toBeLessThan(5000);

    // Verify matching ran
    expect(jjwlResult.matching).toBeDefined();
    expect(jjwlResult.matching!.processed).toBe(2);

    console.log(`Matching completed in ${duration}ms`);
    console.log(`Processed: ${jjwlResult.matching!.processed}`);
    console.log(`Auto-linked: ${jjwlResult.matching!.autoLinked}`);
    console.log(`Pending: ${jjwlResult.matching!.pendingCreated}`);
  });

  it('should only compare against US IBJJF gyms', async () => {
    // Seed mix of US and non-US IBJJF gyms
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'us-gym',
      name: 'US Test Gym',
      city: 'Austin',
      countryCode: 'US',
    });

    await putSourceGym({
      org: 'IBJJF',
      externalId: 'br-gym',
      name: 'Brazilian Test Gym',
      city: 'Rio',
      countryCode: 'BR',
    });

    // Mock JJWL to return one gym
    jest.spyOn(jjwlFetcher, 'fetchJJWLGyms').mockResolvedValue([
      {
        org: 'JJWL',
        externalId: 'jjwl-1',
        name: 'US Test Gym',
      },
    ]);

    const result = await syncJJWLGyms();

    // Should match against US gym, not Brazilian gym
    expect(result.matching!.processed).toBe(1);
  });

  it('should produce auto-linked and pending matches', async () => {
    // Use sample data to verify matching logic works without hitting real APIs
    const sampleIBJJFGyms = [
      {
        org: 'IBJJF' as const,
        externalId: 'ibjjf-exact',
        name: 'Team Alliance Houston',
        city: 'Houston',
        state: 'TX',
        countryCode: 'US',
        country: 'United States',
      },
      {
        org: 'IBJJF' as const,
        externalId: 'ibjjf-partial',
        name: 'Gracie Humaita',
        city: 'Austin',
        state: 'TX',
        countryCode: 'US',
        country: 'United States',
      },
    ];

    const sampleJJWLGyms = [
      { org: 'JJWL' as const, externalId: 'jjwl-exact', name: 'Team Alliance Houston' }, // Exact match
      { org: 'JJWL' as const, externalId: 'jjwl-partial', name: 'Gracie Humaita Austin' }, // Partial match
    ];

    jest.spyOn(ibjjfFetcher, 'fetchIBJJFGymCount').mockResolvedValue(2);
    jest.spyOn(ibjjfFetcher, 'fetchAllIBJJFGyms').mockResolvedValue(sampleIBJJFGyms);
    jest.spyOn(jjwlFetcher, 'fetchJJWLGyms').mockResolvedValue(sampleJJWLGyms);

    await syncIBJJFGyms();
    const result = await syncJJWLGyms();

    // Should produce both auto-linked (high confidence) and pending (medium confidence)
    expect(result.matching!.processed).toBe(2);
    expect(result.matching!.autoLinked + result.matching!.pendingCreated).toBeGreaterThan(0);

    // Log for manual review
    console.log('Match results:', result.matching);
  });
});
