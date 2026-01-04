# Update Gym Queries for IBJJF Fields - Design

**Issue:** ODE-26
**Date:** 2026-01-04
**Status:** Approved

## Summary

Extend `upsertSourceGym` function to handle IBJJF extended fields when inserting/updating gym records.

## Approach

Use union type parameter with nullish coalescing for safe field access.

## Changes

### 1. `backend/src/db/gymQueries.ts`

**Import change:**
```typescript
import type { NormalizedGym, IBJJFNormalizedGym, JJWLRosterAthlete } from '../fetchers/types.js';
```

**Function signature:**
```typescript
export async function upsertSourceGym(gym: NormalizedGym | IBJJFNormalizedGym): Promise<void>
```

**Item construction - add IBJJF fields:**
```typescript
const item: SourceGymItem = {
  // ... existing fields unchanged ...

  // IBJJF extended fields
  country: (gym as IBJJFNormalizedGym).country ?? null,
  countryCode: (gym as IBJJFNormalizedGym).countryCode ?? null,
  city: (gym as IBJJFNormalizedGym).city ?? null,
  address: (gym as IBJJFNormalizedGym).address ?? null,
  federation: (gym as IBJJFNormalizedGym).federation ?? null,
  website: (gym as IBJJFNormalizedGym).website ?? null,
  responsible: (gym as IBJJFNormalizedGym).responsible ?? null,
};
```

### 2. `backend/src/__tests__/db/gymQueries.test.ts`

Add test for IBJJF extended fields persistence and verify JJWL stores nulls.

## No Changes Required

- `types.ts` - Already has optional IBJJF fields on `SourceGymItem`
- `fetchers/types.ts` - Already has `IBJJFNormalizedGym` interface
- `batchUpsertGyms` - Inherits fix through `upsertSourceGym` call

## Acceptance Criteria

- [x] Design: upsertSourceGym accepts both NormalizedGym and IBJJFNormalizedGym
- [ ] Extended IBJJF fields (country, city, etc.) are persisted when present
- [ ] Fields default to null when not provided (JJWL compatibility)
- [ ] TypeScript compiles without errors
- [ ] Existing tests pass, new test added for IBJJF fields
