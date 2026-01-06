# Debug: Untrack Tournament Not Working

**Date:** 2026-01-06
**Status:** In Progress - Needs Backend Log Analysis
**Severity:** High - Core feature broken

---

## Issue Summary

**Problem:** Clicking "untrack" on a tracked tournament doesn't update the UI. The tournament stays showing as "✓ TRACKING" with yellow glow even after the API call succeeds.

**What Works:**
- ✅ Track button works (adding to wishlist)
- ✅ API DELETE call returns success (204)
- ✅ Frontend mutation lifecycle completes successfully
- ✅ Optimistic update removes from cache temporarily
- ✅ Refetch is triggered and executes

**What's Broken:**
- ❌ After refetch, tournament reappears as tracked
- ❌ Backend is returning 5 items instead of 4 after deletion
- ❌ UI doesn't update to show "TRACK" button

---

## Changes Made So Far

### Frontend Changes (Committed)
1. ✅ Added 10-second timeout to axios config (fixes offline hanging)
2. ✅ Changed `invalidateQueries` → `refetchQueries` in mutations
3. ✅ Added debug logging to `useRemoveFromWishlist` hook
4. ✅ Added debug logging to `useWishlist` hook

### Backend Changes (NOT Committed Yet)
1. ✅ Added debug logging to `removeFromWishlist` function in `backend/src/db/wishlistQueries.ts`

**Files Modified (Uncommitted):**
- `backend/src/db/wishlistQueries.ts` (lines 43-60)

---

## Evidence from Logs

### Frontend Console Logs (Most Recent Test)
```
[useWishlist] Fetching wishlist from API...
[useWishlist] Fetched wishlist: {wishlist: Array(5)}        // INITIAL STATE: 5 items

[useRemoveFromWishlist] onMutate called
[useRemoveFromWishlist] Previous wishlist: {wishlist: Array(5)}
[useRemoveFromWishlist] Updated wishlist: {wishlist: Array(4)}  // OPTIMISTIC: 4 items

[useRemoveFromWishlist] mutationFn called {tournament: {…}}
[useRemoveFromWishlist] Calling API with tournamentPK: TOURN#IBJJF#3063
[useRemoveFromWishlist] API call successful                 // DELETE SUCCEEDED

[useRemoveFromWishlist] onSuccess called
[useRemoveFromWishlist] onSettled called - forcing refetch

[useWishlist] Fetching wishlist from API...                 // REFETCH TRIGGERED
[useWishlist] Fetched wishlist: {wishlist: Array(5)}        // ❌ STILL 5 ITEMS!

[useRemoveFromWishlist] Refetch completed
```

**Key Finding:** The backend DELETE returns 204 (success) but the subsequent GET still returns 5 items. This means:
1. Either the DELETE didn't actually delete the item
2. Or the GET is reading stale/cached data

---

## Root Cause Hypothesis

**Most Likely:** DynamoDB key mismatch - the DELETE is using a different key than what was used to PUT the item.

**Evidence:**
- DELETE command returns success (204) but item isn't deleted
- In DynamoDB, deleting a non-existent key succeeds silently (no error)
- This suggests we're deleting the wrong key

**Possible Key Mismatches:**
1. PK format: `USER#{userId}` - should be correct
2. SK format: `WISH#{tournamentPK}` - might be double-encoding?
   - When adding: `tournamentPK = "TOURN#IBJJF#3063"` → SK = `"WISH#TOURN#IBJJF#3063"`
   - When deleting: Same input, same SK builder... but something is different?

---

## Next Steps (IMMEDIATE ACTION REQUIRED)

### Step 1: Check Backend Logs

The backend now has logging that will show us EXACTLY what key it's trying to delete.

**Commands to Run:**
```bash
# Navigate to project root
cd /home/jeremyodell/dev/projects/bjj-tournament-tracker

# Check if servers are running
./dev.sh status

# If not running, start them
./dev.sh start

# Open backend logs (live tail)
./dev.sh logs backend
```

### Step 2: Reproduce the Issue

With backend logs tailing:

1. Open browser to http://localhost:3000/tournaments
2. Open Chrome DevTools Console (F12)
3. Find a **tracked tournament** (yellow glow, "✓ TRACKING")
4. Click the "✓ TRACKING" button to untrack
5. **Watch both logs simultaneously:**
   - Browser console (frontend)
   - Terminal (backend logs)

### Step 3: Analyze Backend Logs

Look for these log messages from `removeFromWishlist`:

```
[removeFromWishlist] Attempting to delete with key: {"PK":"USER#...","SK":"WISH#TOURN#..."}
[removeFromWishlist] userId: ... tournamentPK: TOURN#IBJJF#3063
[removeFromWishlist] Delete command sent, result: {...}
```

**Key Questions to Answer:**
1. What is the exact `PK` value?
2. What is the exact `SK` value?
3. Does the `SK` look correct? Should be `WISH#TOURN#IBJJF#3063`
4. What does the delete result contain?

### Step 4: Compare with Stored Data

**Verify what's actually in DynamoDB:**
```bash
# List items for a specific user (replace with actual userId from logs)
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local aws dynamodb query \
  --table-name bjj-tournament-tracker-dev \
  --endpoint-url http://localhost:8000 \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{":pk":{"S":"USER#<userId>"},":sk":{"S":"WISH#"}}'

# Or use scan to see all wishlist items
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local aws dynamodb scan \
  --table-name bjj-tournament-tracker-dev \
  --endpoint-url http://localhost:8000 \
  --filter-expression "begins_with(SK, :sk)" \
  --expression-attribute-values '{":sk":{"S":"WISH#"}}'
```

**Compare:**
- SK in DynamoDB: `WISH#___________`
- SK in delete logs: `WISH#___________`
- **Do they match exactly?** Character for character?

---

## Debugging Scenarios

### Scenario A: Keys Match Perfectly
**Implication:** The issue is somewhere else (caching, timing, race condition)

**Next Steps:**
1. Add logging to DynamoDB read operations
2. Check if there's caching at the database client level
3. Verify the DELETE actually executes (not a conditional delete failing silently)

### Scenario B: SK is Different
**Example:**
- Stored SK: `WISH#TOURN#IBJJF#3063`
- Delete SK: `WISH#TOURN%23IBJJF%233063` (URL encoded)

**Root Cause:** URL encoding issue in the path parameter

**Fix:** Decode the tournamentId in the handler before calling removeFromWishlist

### Scenario C: PK is Different
**Example:**
- Stored PK: `USER#sub_abc123`
- Delete PK: `USER#different_id`

**Root Cause:** User ID mismatch (wrong user context)

**Fix:** Check auth middleware and ensure userId is extracted correctly

---

## Expected Resolution Path

Once we identify the key mismatch:

1. **Fix the backend** to use the correct key format
2. **Test** that untrack works
3. **Remove debug logging** from both frontend and backend
4. **Commit the fix** with proper message
5. **Update tests** to prevent regression
6. **Close this issue**

---

## Files to Check

### Backend
- `backend/src/handlers/wishlist.ts` (lines 60-64) - DELETE handler
- `backend/src/db/wishlistQueries.ts` (lines 43-60) - removeFromWishlist function
- `backend/src/db/types.ts` (line 11) - buildWishlistSK function

### Frontend
- `frontend/src/hooks/useRemoveFromWishlist.ts` - Mutation hook
- `frontend/src/lib/api.ts` - API client (removeFromWishlist function)

---

## Prompt for Next Session

**Copy-Paste This:**

```
Debug tournament untrack issue - the DELETE API call succeeds but the item isn't actually removed from DynamoDB.

Context:
- Issue documented in: docs/plans/2026-01-06-debug-untrack-issue.md
- Backend has debug logging added (uncommitted changes in backend/src/db/wishlistQueries.ts)
- Frontend has debug logging (already committed)

Immediate Steps:
1. Start the servers: ./dev.sh start
2. Tail backend logs: ./dev.sh logs backend
3. In browser, untrack a tournament and observe backend logs
4. Check what PK and SK the backend is trying to delete
5. Query DynamoDB to see what's actually stored
6. Compare the keys - there's likely a mismatch (URL encoding, double-encoding, or user ID issue)

Expected Outcome:
Find the key mismatch, fix the backend to use correct keys, verify untrack works, clean up debug logging, commit fix.

IMPORTANT: Focus on the backend logs first - they will show us exactly what key is being used for the DELETE command.
```

---

## Success Criteria

- [ ] Backend logs show the exact DELETE key being used
- [ ] DynamoDB query shows the exact stored key
- [ ] Key mismatch identified and documented
- [ ] Fix implemented and tested
- [ ] Untrack button updates UI correctly
- [ ] Debug logging removed
- [ ] Changes committed with descriptive message
- [ ] Tests added to prevent regression

---

## Additional Notes

### Why This is Critical
- Untrack is a core feature - users need to manage their wishlists
- This blocks the wishlist page feature (next phase)
- Without working untrack, wishlist will grow indefinitely

### Why It's Tricky
- API returns success but doesn't work
- DynamoDB silently succeeds when deleting non-existent keys
- Key format includes `#` characters which can cause URL encoding issues
- Multiple layers (handler → service → database) make debugging harder

### Time Estimate
- 15-30 minutes to identify the issue via logs
- 5-10 minutes to implement the fix
- 10 minutes to test and clean up
- **Total: ~45 minutes**
