# Tournament Tracking Feature - Code Cleanup Tasks

**Date:** 2026-01-06
**Status:** Ready for next session
**Context:** Tournament tracking feature implemented, needs cleanup based on code review

## Overview

The tournament tracking feature is fully functional and deployed. The following code quality improvements were identified during review and should be addressed in the next session.

---

## Tasks to Complete

### 1. Fix Race Condition Bug (CRITICAL)
**Priority:** High
**File:** `/frontend/src/hooks/useTrackTournament.ts`
**Lines:** 39-46 (trackMutation onMutate)

**Issue:** Rapid clicking can create duplicate wishlist entries because optimistic update doesn't check for existing entries.

**Fix:**
```typescript
// In trackMutation onMutate, change line 39-46 to:
queryClient.setQueryData(['wishlist'], (old: { wishlist: WishlistItem[] } | undefined) => {
  if (!old) return { wishlist: [{ tournamentPK } as WishlistItem] };

  // Check if already tracked to prevent duplicates
  const alreadyTracked = old.wishlist.some(item => item.tournamentPK === tournamentPK);
  if (alreadyTracked) return old;

  return {
    wishlist: [...old.wishlist, { tournamentPK } as WishlistItem],
  };
});
```

---

### 2. Add Missing Query Configuration
**Priority:** High
**File:** `/frontend/src/hooks/useWishlist.ts`
**Lines:** 15-23

**Issue:** Missing `staleTime` and `retry` options that are standard in all other query hooks.

**Fix:**
```typescript
return useQuery({
  queryKey: ['wishlist'],
  queryFn: async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');
    return fetchWishlist(token);
  },
  enabled: isAuthenticated,
  staleTime: 5 * 60 * 1000, // ADD THIS - 5 minutes
  retry: 2,                  // ADD THIS
});
```

---

### 3. Extract Duplicate Mutation Logic (DRY)
**Priority:** Medium
**File:** `/frontend/src/hooks/useTrackTournament.ts`
**Lines:** Entire file

**Issue:** 50+ lines of duplicated logic between trackMutation and untrackMutation.

**Fix:** Create a helper function that both mutations can use:

```typescript
function createWishlistMutation(
  queryClient: QueryClient,
  getAccessToken: () => Promise<string | null>,
  operation: 'add' | 'remove'
) {
  return useMutation({
    mutationFn: async (tournament: Tournament) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const tournamentPK = getTournamentPK(tournament);
      return operation === 'add'
        ? addToWishlist(token, tournamentPK)
        : removeFromWishlist(token, tournamentPK);
    },
    onMutate: async (tournament: Tournament) => {
      const tournamentPK = getTournamentPK(tournament);
      await queryClient.cancelQueries({ queryKey: ['wishlist'] });
      const previousWishlist = queryClient.getQueryData(['wishlist']);

      queryClient.setQueryData(['wishlist'], (old: { wishlist: WishlistItem[] } | undefined) => {
        if (!old) return operation === 'add' ? { wishlist: [{ tournamentPK } as WishlistItem] } : old;

        // Prevent duplicates when adding
        if (operation === 'add') {
          const alreadyTracked = old.wishlist.some(item => item.tournamentPK === tournamentPK);
          if (alreadyTracked) return old;
          return { wishlist: [...old.wishlist, { tournamentPK } as WishlistItem] };
        }

        // Remove when untracking
        return {
          wishlist: old.wishlist.filter((item) => item.tournamentPK !== tournamentPK)
        };
      });

      return { previousWishlist };
    },
    onError: (_err, _tournament, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(['wishlist'], context.previousWishlist);
      }
      toastError(`Failed to ${operation === 'add' ? 'track' : 'untrack'} tournament. Please try again.`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
}

export function useTrackTournament() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  return {
    trackMutation: createWishlistMutation(queryClient, getAccessToken, 'add'),
    untrackMutation: createWishlistMutation(queryClient, getAccessToken, 'remove'),
  };
}
```

---

### 4. Extract Date Utilities from Component
**Priority:** Medium
**File:** `/frontend/src/components/tournaments/ScoreboardTournamentCard.tsx`
**Lines:** 34-42, 47-50

**Issue:** Inline date calculation functions should be in `tournamentUtils.ts` for reusability and testability.

**Fix:**

**Add to `/frontend/src/lib/tournamentUtils.ts`:**
```typescript
export function getDaysUntilTournament(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diffTime = start.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function formatTournamentDate(startDate: string) {
  const date = new Date(startDate);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(date.getDate()).padStart(2, '0'),
    year: date.getFullYear(),
  };
}
```

**Update component to use:**
```typescript
import { getTournamentPK, getDaysUntilTournament, formatTournamentDate } from '@/lib/tournamentUtils';

// Remove lines 34-42 (getDaysUntil function)
const daysUntil = getDaysUntilTournament(tournament.startDate);

// Remove lines 47-50 and replace with:
const { month, day, year } = formatTournamentDate(tournament.startDate);
```

---

### 5. Remove Unused Code
**Priority:** Low
**File:** `/frontend/src/lib/toastConfig.ts`
**Lines:** 40-55

**Issue:** `toastSuccess` function is defined but never used (confirmed by design requirements - no success toasts needed).

**Fix:** Delete lines 40-55:
```typescript
// DELETE THIS ENTIRE BLOCK:
/**
 * Show success toast with scoreboard yellow accent (optional - not used per requirements)
 */
export function toastSuccess(message: string): void {
  toast.success(message, {
    ...defaultToastOptions,
    style: {
      ...defaultToastOptions.style,
      borderColor: '#FFD700',
    },
    iconTheme: {
      primary: '#FFD700',
      secondary: '#0A1128',
    },
  });
}
```

---

### 6. (OPTIONAL) Refactor Hook Structure for Consistency
**Priority:** Low
**File:** `/frontend/src/hooks/useTrackTournament.ts`

**Issue:** Current pattern returns `{ trackMutation, untrackMutation }` from one hook. Established pattern in codebase is to have separate hooks like `useApproveMatch()` and `useRejectMatch()`.

**Fix:** Split into two separate hooks:

**Create `/frontend/src/hooks/useAddToWishlist.ts`:**
```typescript
export function useAddToWishlist() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  return useMutation({
    mutationFn: async (tournament: Tournament) => { ... },
    onMutate: async (tournament: Tournament) => { ... },
    onError: (_err, _tournament, context) => { ... },
    onSettled: () => { ... },
  });
}
```

**Create `/frontend/src/hooks/useRemoveFromWishlist.ts`:**
```typescript
export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  return useMutation({
    mutationFn: async (tournament: Tournament) => { ... },
    onMutate: async (tournament: Tournament) => { ... },
    onError: (_err, _tournament, context) => { ... },
    onSettled: () => { ... },
  });
}
```

**Update component imports:**
```typescript
import { useAddToWishlist } from '@/hooks/useAddToWishlist';
import { useRemoveFromWishlist } from '@/hooks/useRemoveFromWishlist';

const addToWishlist = useAddToWishlist();
const removeFromWishlist = useRemoveFromWishlist();
```

**Note:** This is optional - current pattern works fine, just inconsistent with established patterns.

---

## Implementation Order

1. **Fix race condition bug** (Task #1) - CRITICAL
2. **Add query configuration** (Task #2) - Quick win
3. **Remove unused code** (Task #5) - Quick win
4. **Extract date utilities** (Task #4) - Clean up component
5. **Extract duplicate mutation logic** (Task #3) - DRY improvement
6. **Refactor hook structure** (Task #6) - OPTIONAL, only if desired

---

## Testing After Changes

Run these commands after making changes:

```bash
cd /home/jeremyodell/dev/projects/bjj-tournament-tracker/frontend

# Build to check TypeScript errors
npm run build

# Test the feature manually
# 1. Start dev server: npm run dev
# 2. Login to the app
# 3. Click Track on a tournament
# 4. Rapidly click Track button multiple times (test race condition fix)
# 5. Refresh page - verify tournament still tracked
# 6. Click Untrack - verify it untracks
# 7. Test without auth - verify login redirect
```

---

## Files to Modify

- `/frontend/src/hooks/useWishlist.ts` (Task #2)
- `/frontend/src/hooks/useTrackTournament.ts` (Tasks #1, #3)
- `/frontend/src/lib/tournamentUtils.ts` (Task #4)
- `/frontend/src/lib/toastConfig.ts` (Task #5)
- `/frontend/src/components/tournaments/ScoreboardTournamentCard.tsx` (Task #4)

## Expected Time

- Tasks #1-5: ~30-40 minutes
- Task #6 (optional): +20 minutes
