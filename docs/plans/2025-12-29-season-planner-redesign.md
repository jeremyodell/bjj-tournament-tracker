# Season Planner UX Redesign

## Problem

The current app has two confusing concepts:
- **"My Season"** (`/wishlist`) - A flat list of saved tournaments, not athlete-specific
- **"View Season Plan"** (`/planner/[athleteId]`) - Pro feature with budget optimization, buried in profile

Users don't understand the difference. The naming is similar but the functionality is completely different. The actual value (budget-optimized planning with travel costs) is hidden behind the profile page.

## Solution

Unify into a single **wizard-driven flow** that makes budget optimization the primary experience.

### Core Concept

One entry point: `/plan` (nav label: "My Plan")

| User State | Experience |
|------------|------------|
| No plan exists | Wizard: Budget → Airport → Must-Gos → Generate |
| Plan exists | Plan view with settings sidebar |
| Multiple athletes | Pick athlete first, then wizard/plan |

### Navigation Changes

**Before:**
- Browse | My Season | Profile
- Athlete card → "View Season Plan" button

**After:**
- Browse | My Plan | Profile
- Athlete card → Remove "View Season Plan" button (accessible from nav)

## Wizard Flow (First-Time Setup)

Runs when an athlete has no saved plan.

### Step 1: Budget
- "What's your tournament budget for the year?"
- Total budget input (default: $3,000)
- Optional reserve for unannounced events (default: $500)

### Step 2: Home Location
- "Where are you traveling from?"
- Airport code input (e.g., DFW, LAX)
- Max drive hours slider (1-12 hours)

### Step 3: Must-Go Events (Optional)
- "Any tournaments you definitely want to attend?"
- Browse/search interface to pin anchor events (Worlds, Pan, etc.)
- Skip option: "I'll decide later"

### Step 4: Generate
- System generates optimized plan based on:
  - Budget constraints
  - Travel costs (airfare for fly, gas for drive)
  - Must-go anchors
  - Pacing preferences
- Redirects to Plan View

## Plan View (Returning Users)

What users see after completing wizard and on all future visits.

### Layout

**Desktop:** Split screen
- Left panel (~35%): Settings/configuration
- Right panel (~65%): Plan results

**Mobile:**
- Full-screen plan results
- Floating settings button → opens bottom sheet

### Plan Results

Chronological list of tournaments showing:
- Tournament name and organization (IBJJF/JJWL badge)
- Date and location
- Travel type indicator (car icon for drive, plane for fly)
- Estimated cost breakdown (registration + travel)
- "Must-go" badge on locked tournaments

Summary bar:
- Total tournaments in plan
- Budget spent / remaining
- Estimated total cost

### Settings Panel

Always accessible, contains:
- Budget (total + reserve) with "Available" display
- Home airport + max drive hours
- Tournaments per month (1-3)
- Org preference slider (IBJJF ↔ Balanced ↔ JJWL)
- Must-go tournaments list with add/remove
- "Regenerate Plan" button (appears when settings change)

### User Actions

From Plan View, users can:
- **Remove** a tournament from plan
- **Lock** a tournament (promotes to must-go, persists through regeneration)
- **Browse tournaments** → marking one adds it to must-go list
- **Adjust settings** → regenerate plan

## Athlete Selection

For families with multiple athletes:

| Athletes | Behavior |
|----------|----------|
| 1 athlete | Skip selection, go directly to wizard/plan |
| 2+ athletes | Show athlete picker, then wizard/plan for selected |

This matches current `/plan` routing logic.

## Data Model Changes

### Remove
- Wishlist concept (or repurpose as must-go backing store)

### Keep
- `plannerStore` - already has all needed fields
- `PlannerConfig` interface - budget, airport, must-gos, etc.

### Add
- Persist generated plan per athlete (currently only config is persisted)
- Flag to track if wizard has been completed for an athlete

## Routes

| Route | Purpose |
|-------|---------|
| `/plan` | Entry point - checks athletes, routes appropriately |
| `/plan/select` | Athlete picker (2+ athletes only) |
| `/plan/setup` | Wizard flow (new athletes) |
| `/plan/[athleteId]` | Plan view (existing athletes with plan) |

Or simplified:
| Route | Purpose |
|-------|---------|
| `/plan` | Smart router based on state |
| `/plan/[athleteId]` | Wizard OR plan view depending on athlete state |

## Migration

1. Existing wishlist items → prompt user to convert to must-gos on first visit
2. Existing planner configs → preserved, user lands on plan view directly

## Pages to Remove

- `/wishlist` - replaced by plan view
- Potentially `/plan/verify` - fold into wizard

## Components to Modify

- `AppHeader` - change "My Season" to "My Plan"
- `AthleteCard` - remove "View Season Plan" button
- `PlannerConfig` - already good, may need minor tweaks
- `PlannerResults` - already good

## Components to Create

- `PlannerWizard` - multi-step setup flow
- `BudgetStep`, `LocationStep`, `MustGoStep` - wizard steps

## Success Criteria

1. Users immediately understand what "My Plan" does
2. Budget optimization is discoverable on first visit
3. No confusion between "season" concepts
4. Returning users land directly on their plan
