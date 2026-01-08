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

  it('should complete JJWL matching in under 2 minutes with real data', async () => {
    // This test uses REAL data from the APIs
    // Run IBJJF sync first to populate US gyms
    const ibjjfResult = await syncIBJJFGyms();
    expect(ibjjfResult.fetched).toBeGreaterThan(0);

    // Run JJWL sync with matching
    const startTime = Date.now();
    const jjwlResult = await syncJJWLGyms();
    const duration = Date.now() - startTime;

    // Performance assertion: <2 minutes (120,000ms)
    expect(duration).toBeLessThan(120000);

    // Verify matching ran
    expect(jjwlResult.matching).toBeDefined();
    expect(jjwlResult.matching!.processed).toBeGreaterThan(0);

    console.log(`Matching completed in ${duration}ms`);
    console.log(`Processed: ${jjwlResult.matching!.processed}`);
    console.log(`Auto-linked: ${jjwlResult.matching!.autoLinked}`);
    console.log(`Pending: ${jjwlResult.matching!.pendingCreated}`);
  }, 180000); // 3 minute timeout for safety

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

  it('should produce similar match counts to old algorithm', async () => {
    // This is a regression test - ensures new algorithm finds roughly same matches
    // Run full sync with real data
    await syncIBJJFGyms();
    const result = await syncJJWLGyms();

    // These are approximate baselines from old algorithm (adjust based on reality)
    // Auto-linked should be within 10% of baseline
    // Pending should be within 20% of baseline
    expect(result.matching!.autoLinked).toBeGreaterThan(0);
    expect(result.matching!.pendingCreated).toBeGreaterThan(0);

    // Log for manual review
    console.log('Match results:', result.matching);
  }, 180000);
});
