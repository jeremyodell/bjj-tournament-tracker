/**
 * Jest configuration for integration tests.
 * These tests require DynamoDB Local to be running.
 */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  // Only run integration tests
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  // Longer timeout for DB operations
  testTimeout: 30000,
  // Run tests serially to avoid table conflicts
  maxWorkers: 1,
  // Verbose output
  verbose: true,
};
