# Implementation Prompt: Tournament Tracking Feature

## Context

We just completed the Tournament Scoreboard homepage redesign with:
- New LED/digital aesthetic (IBM Plex Mono + Instrument Sans fonts)
- Navy background (#0A1128) with tournament yellow accents (#FFD700)
- ScoreboardTournamentCard components with Track buttons
- Frontend dev server running at localhost:3000

## What to Implement

Implement the tournament tracking feature according to the design in:
**`docs/plans/2026-01-06-tournament-tracking-design.md`**

### Key Requirements

1. **Create React Query hooks:**
   - `frontend/src/hooks/useWishlist.ts` - Fetch user's tracked tournaments
   - `frontend/src/hooks/useTrackTournament.ts` - Track/untrack mutations

2. **Update tournament cards:**
   - Modify `frontend/src/components/tournaments/ScoreboardTournamentCard.tsx`
   - Connect Track button to real backend (existing `/wishlist` API)
   - Show tracked state from backend
   - Remove "Who's Going" counter (save for later)

3. **Add user feedback:**
   - Install `react-hot-toast` for notifications
   - Show success/error toasts
   - Optimistic updates (instant UI, rollback on error)

4. **Auth gating:**
   - Only logged-in users can track
   - Show "Sign in to track" for anonymous users

### Backend Already Exists

The wishlist API is fully implemented:
- ✅ `GET /wishlist` - List tracked tournaments
- ✅ `POST /wishlist` - Track tournament
- ✅ `DELETE /wishlist/:tournamentId` - Untrack
- ✅ API functions in `frontend/src/lib/api.ts` (addToWishlist, removeFromWishlist)

### Testing After Implementation

Manual test:
1. Start dev server (`npm run dev` in frontend/)
2. Login to the app
3. Click Track on a tournament → should turn yellow
4. Refresh page → should stay tracked
5. Click again → should untrack

### Success Criteria

- [ ] Track button works for logged-in users
- [ ] State persists across page refreshes
- [ ] Optimistic updates feel instant
- [ ] Error handling shows toast notifications
- [ ] Auth-gated for anonymous users

---

**Start by reading the design document, then implement the hooks and update the ScoreboardTournamentCard component.**
