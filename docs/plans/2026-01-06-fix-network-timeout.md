# Fix Network Timeout Issue for Wishlist Track/Untrack

## Context

This is a continuation of debugging session from 2026-01-06. We fixed the main wishlist bug (missing routes in dev server) but discovered a UX issue: when the network is off and users try to track/untrack tournaments, the UI spins indefinitely instead of showing an error.

## Current State

### What We Fixed Today
1. **Root cause of original "untrack bug"**: Wishlist routes were completely missing from `backend/src/dev-server.ts`
   - Added wishlist handler import and all routes (GET, POST, PUT, DELETE)
   - Added athletes handler import and routes
   - Track/untrack now works correctly when network is ON

2. **Attempted timeout fixes** (NOT WORKING YET):
   - Reduced axios timeout from 10s to 5s in `frontend/src/lib/api.ts`
   - Added `retry: false` for mutations in `frontend/src/app/providers.tsx`
   - These changes are committed but the issue persists

### Current Problem

**Steps to reproduce:**
1. Turn off network (airplane mode or disconnect wifi)
2. Click heart icon to track/untrack a tournament
3. Expected: Error toast appears within 5 seconds
4. Actual: UI spinner keeps spinning indefinitely

**Hypothesis**: The axios timeout might not trigger on "network unavailable" errors (only on slow responses). Browser offline detection might be needed.

## Key Files

### Frontend (Network Error Handling)
- `frontend/src/hooks/useRemoveFromWishlist.ts` - Mutation hook with optimistic updates, has onError handler
- `frontend/src/hooks/useAddToWishlist.ts` - Similar pattern for tracking
- `frontend/src/lib/api.ts` - Axios instance config (timeout: 5000)
- `frontend/src/app/providers.tsx` - QueryClient config (retry: false for mutations)
- `frontend/src/components/tournaments/TournamentList.tsx` - UI component showing spinner

### What to Check
1. Does axios timeout actually fire when network is completely off? (vs slow network)
2. Is the mutation's `onError` callback being triggered?
3. Is the optimistic update preventing the error state from showing?
4. Should we detect `navigator.onLine` status before making the API call?

## Instructions for Next Session

**CRITICAL: Use systematic debugging before proposing fixes!**

Use the `superpowers:systematic-debugging` skill to investigate this properly:

```bash
# Start with Phase 1: Root Cause Investigation
1. Add diagnostic logging to understand what's happening:
   - Log when mutation starts
   - Log when axios request is made
   - Log if/when timeout fires
   - Log if/when onError is called
   - Log loading state changes

2. Test with network off and capture console logs

3. Determine EXACTLY why the error handler isn't being called

# Only after understanding root cause:
4. Propose the minimal fix
5. Test that it works
6. Clean up debug logging
```

## Potential Solutions (DO NOT IMPLEMENT WITHOUT INVESTIGATION!)

These are educated guesses - verify root cause first:

### Option A: Browser Offline Detection
```typescript
// Check navigator.onLine before making request
if (!navigator.onLine) {
  throw new Error('No network connection');
}
```

### Option B: Axios Network Error Handling
```typescript
// Axios might not timeout on ERR_NETWORK, only on slow responses
// May need to handle network errors differently than timeouts
```

### Option C: AbortController Timeout
```typescript
// Use AbortController with custom timeout instead of axios timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);
```

### Option D: Mutation State Reset
```typescript
// The loading state might not reset on error
// Check if isPending is stuck true
```

## Success Criteria

1. With network OFF, clicking track/untrack shows error toast within 2-3 seconds max
2. With network ON, track/untrack works normally
3. Loading spinner disappears when error occurs
4. Optimistic updates roll back on error

## Related Context

- The wishlist uses optimistic updates (immediate UI update, rollback on error)
- TanStack Query manages the mutation state
- Toast notifications use `toastError()` from `@/lib/toastConfig`
- Dev mode is enabled (`NEXT_PUBLIC_DEV_MODE=true`) for local testing

## Session Log Reference

Previous session fixed:
- Missing wishlist routes in dev-server.ts
- Missing athletes routes in dev-server.ts
- Cleaned up debug logging in wishlistQueries.ts
- Configured timeout and retry settings (didn't solve offline issue)

The root cause investigation revealed the original "bug" wasn't a key mismatch - it was missing infrastructure. Use the same systematic approach for this network timeout issue.
