# Gym Unification Fix - Single-Org Master Creation

**Date:** 2026-01-09
**Issue:** Single-org gyms (appearing in only IBJJF or JJWL) were not getting master gym records
**Status:** ✅ Resolved

## Problem

The gym unification system only created master gyms when cross-org matches were found (score ≥90). Gyms appearing in only one organization (e.g., Labyrinth in JJWL only) were left without master records, making them unsearchable in the gym dropdown.

### Impact

- **Before:** 14,394 source gyms → 1,674 master gyms (12% coverage)
- **After:** 14,394 source gyms → 13,608 master gyms (95% coverage)
- **11,934 gyms** were previously unsearchable

## Root Cause

The matching logic in `gymMatchingService.ts` and sync services only called `createMasterGym()` when:
1. A cross-org match was found with score ≥90 (auto-link)
2. A cross-org match was found with score 70-89 (pending review)

Single-org gyms never triggered either condition, so they never got masters.

Additionally:
- **IBJJF sync had NO matching logic** - it never ran fuzzy matching at all
- **JJWL sync** had matching but no fallback for unmatched gyms

## Solution

### 1. Enhanced Matching Service

**File:** `backend/src/services/gymMatchingService.ts`

Updated `processGymMatches()` to check if target gym already has master before creating new one:

```typescript
// Auto-link if ≥90% confidence
if (topMatch.score >= 90) {
  let masterGymId: string;

  if (topMatch.gym.masterGymId) {
    // Target gym already has a master - link source to it
    masterGymId = topMatch.gym.masterGymId;
    await linkSourceGymToMaster(sourceGym.org, sourceGym.externalId, masterGymId);
  } else {
    // Neither has a master - create new shared master
    const masterGym = await createMasterGym({
      canonicalName: sourceGym.name,
      city: sourceGym.city || topMatch.gym.city,
      country: sourceGym.country || topMatch.gym.country,
    });
    masterGymId = masterGym.id;

    await linkSourceGymToMaster(sourceGym.org, sourceGym.externalId, masterGymId);
    await linkSourceGymToMaster(topMatch.gym.org, topMatch.gym.externalId, masterGymId);
  }
  return { autoLinked: 1, pendingCreated: 0 };
}
```

This ensures when a single-org gym later appears in the other org, it links to the existing master instead of creating a duplicate.

### 2. Enhanced Sync Service

**File:** `backend/src/services/gymSyncService.ts`

Added two critical functions:

#### `createMastersForUnlinkedGyms()`
Creates master gyms for all source gyms that don't have one yet. Called after matching to ensure every gym has a master.

```typescript
async function createMastersForUnlinkedGyms(
  sourceGyms: SourceGymItem[]
): Promise<number> {
  let created = 0;
  for (const gym of sourceGyms) {
    if (!gym.masterGymId) {
      const masterGym = await createMasterGym({
        canonicalName: gym.name,
        city: gym.city,
        country: gym.country,
      });
      await linkSourceGymToMaster(gym.org, gym.externalId, masterGym.id);
      created++;
      if (created % 100 === 0) {
        console.log(`[GymSyncService] Created ${created} single-org masters...`);
      }
    }
  }
  return created;
}
```

#### `runMatchingForIBJJFGyms()`
IBJJF gyms previously had NO matching logic. This function mirrors the JJWL matching flow:
- Get all JJWL gyms
- For each IBJJF gym without master, try matching against JJWL gyms
- Apply same thresholds (≥90 auto-link, 70-89 pending review)

Both `syncJJWLGyms()` and `syncIBJJFGyms()` now:
1. Sync source gyms
2. Run fuzzy matching
3. Create masters for any remaining unlinked gyms

### 3. Migration Script

**File:** `backend/scripts/backfill-master-gyms.ts`

Created migration script to backfill masters for existing gyms. Key fix:

```typescript
FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk AND (attribute_not_exists(masterGymId) OR masterGymId = :null)',
ExpressionAttributeValues: {
  ':prefix': 'SRCGYM#',
  ':sk': 'META',
  ':null': null, // Handle gyms with explicit null value
},
```

Initial filter only checked `attribute_not_exists(masterGymId)` but many gyms had `masterGymId = null`.

## Migration Results

```
═══════════════════════════════════════
✅ Migration complete!
📊 Total source gyms scanned: 11,934
📝 Masters created: 11,934
═══════════════════════════════════════
```

### Verification

**All gyms now have masters:**
```bash
$ npx tsx scripts/check-unlinked-gyms.ts
Checking for unlinked JJWL gyms...
JJWL gyms without masterGymId: 0

Checking for unlinked IBJJF gyms...
IBJJF gyms without masterGymId: 0
```

**Search works with case insensitivity:**
```bash
$ curl "http://localhost:3001/api/master-gyms/search?q=gracie" | jq '.gyms | length'
20

$ curl "http://localhost:3001/api/master-gyms/search?q=GRACIE" | jq '.gyms | length'
20
```

## Future Behavior

Going forward, every gym sync will:
1. Sync source gyms from API
2. Run fuzzy matching across orgs
3. Create masters for any unlinked gyms

This ensures:
- **Every source gym** has exactly one master
- **Cross-org matches** link to existing masters (no duplicates)
- **Single-org gyms** are immediately searchable
- **Future cross-org appearance** links to existing master

## Files Modified

1. `backend/src/services/gymMatchingService.ts` - Enhanced matching logic
2. `backend/src/services/gymSyncService.ts` - Added master creation for unlinked gyms
3. `backend/scripts/backfill-master-gyms.ts` - Migration script (one-time use)

## Testing Commands

```bash
# Check for unlinked gyms
npx tsx scripts/check-unlinked-gyms.ts

# Search for specific gym
npx tsx scripts/find-gym-by-name.ts "Gym Name"

# Test API search
curl "http://localhost:3001/api/master-gyms/search?q=query"

# Run backfill (if needed)
npx tsx scripts/backfill-master-gyms.ts --dry-run
npx tsx scripts/backfill-master-gyms.ts  # live mode
```

## Database State

### Before Fix
- 5,780 JJWL source gyms
- 8,614 IBJJF source gyms
- 1,674 master gyms
- **Coverage:** 12%

### After Fix
- 5,780 JJWL source gyms (all linked)
- 8,614 IBJJF source gyms (all linked)
- 13,608 master gyms
- **Coverage:** 95%

Note: Total is less than 14,394 because some gyms were successfully matched across orgs and share a master.
