# Implementation Prompt: Season Planner UX Redesign

Use this prompt to kick off implementation in a new session.

---

## Prompt

Implement the Season Planner UX Redesign according to `docs/plans/2025-12-29-season-planner-redesign.md`.

### Context

We're unifying two confusing concepts ("My Season" and "View Season Plan") into a single wizard-driven flow. The budget optimization planner already exists at `/planner/[athleteId]` - we're promoting it to be THE primary experience.

### What Exists

- `PlannerConfig` component - budget, airport, must-gos, org preference (keep)
- `PlannerResults` component - displays generated plan (keep)
- `plannerStore` - all state management (keep)
- `generatePlan()` in `lib/planGenerator.ts` - plan generation logic (keep)
- `/wishlist` page - flat tournament list (remove)
- `/planner/[athleteId]` page - current Pro planner (refactor into new flow)

### Implementation Steps

1. **Create wizard components**
   - `PlannerWizard.tsx` - orchestrates multi-step flow
   - `BudgetStep.tsx` - total budget + reserve input
   - `LocationStep.tsx` - airport code + max drive hours
   - `MustGoStep.tsx` - browse/search to pin tournaments (with skip option)
   - Use existing shadcn components for inputs

2. **Refactor routing**
   - `/plan` - entry point, checks athlete count and plan state
   - `/plan/select` - athlete picker (2+ athletes only, already exists)
   - `/plan/[athleteId]` - wizard OR plan view based on whether plan exists
   - Remove `/wishlist` route

3. **Update navigation**
   - `AppHeader.tsx` - change "My Season" label to "My Plan", keep href as `/plan`
   - `AthleteCard.tsx` - remove "View Season Plan" button

4. **Update plannerStore**
   - Add `hasCompletedWizard` flag per athlete
   - Persist generated plan (currently only config is persisted)

5. **Handle migration**
   - If user has wishlist items, show prompt to convert to must-gos on first visit
   - If user has existing planner config, skip wizard and show plan view

6. **Clean up**
   - Delete `/wishlist` page and `WishlistCard` component
   - Remove wishlist-related hooks if no longer needed
   - Update any links pointing to `/wishlist`

### Design Constraints

- Keep existing `PlannerConfig` and `PlannerResults` components mostly intact
- Wizard should feel lightweight (3 steps max before generating)
- Mobile-first: wizard should work well on phones
- Don't break existing planner functionality for Pro users

### Testing

- Test wizard flow with new athlete (no existing data)
- Test returning user flow (has existing plan)
- Test athlete picker with multiple athletes
- Test settings changes and regeneration
- Verify old `/wishlist` URLs redirect appropriately

### Start Command

```
Use superpowers:using-git-worktrees to create a worktree for this feature, then use superpowers:writing-plans to create a detailed implementation plan.
```
