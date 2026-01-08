# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BJJ Tournament Tracker - A tournament aggregation and season planning app for Brazilian Jiu-Jitsu athletes (primarily kids). Syncs tournaments from IBJJF and JJWL, allows users to plan their competition season.

## Tech Stack

### Frontend (`/frontend`)
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** Zustand (stores in `src/stores/`)
- **Data Fetching:** TanStack Query (`src/hooks/`)
- **Testing:** Vitest + React Testing Library
- **Deployment:** Vercel

### Backend (`/backend`)
- **Framework:** AWS SAM (Serverless)
- **Runtime:** Node.js 20, TypeScript
- **Database:** DynamoDB (single-table design)
- **Auth:** AWS Cognito
- **API:** API Gateway + Lambda
- **Deployment:** AWS SAM CLI

## Project Structure

```
bjj-tournament-tracker/
├── frontend/                 # Next.js app
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   │   ├── (auth)/      # Auth pages (login, register)
│   │   │   ├── (protected)/ # Auth-required pages (profile, wishlist, admin)
│   │   │   │   └── admin/   # Admin pages (gym-matches)
│   │   │   └── plan/        # Planner flow pages
│   │   ├── components/      # React components
│   │   │   └── admin/       # Admin components (GymMatchesPage)
│   │   ├── hooks/           # TanStack Query hooks (useAdminMatches, etc.)
│   │   ├── stores/          # Zustand stores
│   │   ├── lib/             # Utilities, API client, types
│   │   └── __tests__/       # Test files
│   └── package.json
├── backend/                  # AWS SAM backend
│   ├── src/
│   │   ├── handlers/        # Lambda handlers (athletes, tournaments, adminMatches, masterGyms)
│   │   ├── fetchers/        # Tournament/gym data fetchers (IBJJF, JJWL)
│   │   ├── db/              # DynamoDB client, types, and query modules
│   │   │   ├── types.ts           # All entity types and key builders
│   │   │   ├── gymQueries.ts      # Source gym queries
│   │   │   ├── masterGymQueries.ts    # Master gym CRUD
│   │   │   └── pendingMatchQueries.ts # Pending match CRUD
│   │   └── services/        # Business logic
│   │       ├── gymSyncService.ts      # Gym sync with change detection
│   │       └── gymMatchingService.ts  # Fuzzy matching logic
│   ├── scripts/             # Utility scripts
│   ├── template.yaml        # SAM/CloudFormation template
│   └── package.json
├── docs/                     # Design docs and plans
│   └── plans/               # Implementation plans
└── .worktrees/              # Git worktrees for feature branches
```

## AWS Resources

### Cognito (Authentication)
- **User Pool:** `bjj-tournament-tracker-users-{stage}`
- **User Pool Client:** `bjj-tournament-tracker-web-{stage}`
- **Auth flows:** SRP, password, refresh token
- **Identity Providers:** Cognito (email/password), Google OAuth
- **Hosted UI Domain:** `bjj-tournament-tracker-{stage}.auth.{region}.amazoncognito.com`

### DynamoDB (Database)
- **Table:** `bjj-tournament-tracker-{stage}`
- **Design:** Single-table with PK/SK pattern
- **GSI:** GSI1 for alternate access patterns

#### Key Patterns
| Entity | PK | SK |
|--------|----|----|
| Tournament | `TOURN#{org}#{id}` | `META` |
| User Athlete | `USER#{userId}` | `ATHLETE#{athleteId}` |
| User Wishlist | `USER#{userId}` | `WISH#{tournamentPK}` |
| Source Gym | `SRCGYM#{org}#{externalId}` | `META` |
| Master Gym | `MASTERGYM#{uuid}` | `META` |
| Pending Match | `PENDINGMATCH#{uuid}` | `META` |
| Gym Sync Meta | `GYMSYNC#{org}` | `META` |

### API Gateway
- **Base URL (prod):** `https://api.bjj-tournament-tracker.com` (via CloudFormation output)
- **Stage:** `dev` or `prod`

## Environment Variables

### Frontend (`frontend/.env.local`)
```bash
NEXT_PUBLIC_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=bjj-tournament-tracker-dev.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=xxxxx
NEXT_PUBLIC_DEV_MODE=true  # Set to bypass Cognito for local testing
```

### Backend (`backend/.env`)
```bash
DYNAMODB_TABLE=bjj-tournament-tracker-dev
GOOGLE_MAPS_API_KEY=xxxxx
```

## Common Commands

### Full Stack Development
```bash
./dev.sh start    # Start both frontend + backend + DynamoDB
./dev.sh stop     # Stop both
./dev.sh status   # Check what's running
./dev.sh restart  # Restart both
./dev.sh logs backend   # Tail backend logs
./dev.sh logs frontend  # Tail frontend logs
```

### Git Workflow
```bash
./git.sh pull                         # Pull latest changes
./git.sh test                         # Run all tests (frontend + backend)
./git.sh commit "message"             # Test + build + commit
./git.sh commit                       # Test + build + commit (opens editor)
./git.sh push                         # Push to remote
./git.sh sync "message"               # Pull → test → commit → push
./git.sh status                       # Show git status + recent commits
```

**Note:** The `commit` and `sync` commands automatically enforce pre-commit requirements (tests + build).

### Frontend
```bash
cd frontend
npm install
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm test             # Run Vitest tests
npm run test:coverage # Run tests with coverage
npm run lint         # ESLint
```

### Backend
```bash
cd backend
npm install
sam build            # Build SAM application
sam deploy           # Deploy to AWS
npm test             # Run unit tests
npm run test:integration  # Run integration tests
npm run test:all     # Run all tests

# Local Development
npm run dev:setup    # First-time: start DynamoDB, create table, seed data
npm run dev:start    # Daily: start DynamoDB + Express dev server
npm run dev          # Start Express dev server only (requires DynamoDB running)

# Database Management
docker compose up -d       # Start local DynamoDB
npm run db:create          # Create local table
npm run db:seed            # Seed with real tournament data
npm run db:seed:mock       # Seed with mock data (reliable for testing)
npm run db:reset           # Delete all data and re-seed
npm run sync               # Manual tournament sync from IBJJF/JJWL
```

### Git Worktrees
```bash
# Create feature worktree
git worktree add .worktrees/feature-name -b feature/name

# Remove after merge
git worktree remove .worktrees/feature-name
```

## Auth Setup

### Current State
- Email/password auth via Cognito: WORKING
- Google OAuth via Cognito: WORKING (configured in SAM template)

### Google OAuth
Google OAuth is configured via CloudFormation in `backend/template.yaml`. To deploy:
1. Obtain Google OAuth credentials from Google Cloud Console
2. Deploy with: `sam deploy --parameter-overrides GoogleClientSecret=YOUR_SECRET`

### Dev Mode
Set `NEXT_PUBLIC_DEV_MODE=true` in frontend to bypass Cognito for local testing. This allows login with any email/password combination.

## Key Stores (Zustand)

### `authStore`
- `user`, `isAuthenticated`, `isLoading`
- `login()`, `logout()`, `getAccessToken()`

### `setupStore`
- Planner form state: `athleteName`, `age`, `belt`, `weight`, `location`
- `athleteId` - set when athlete loaded from backend
- `loadFromAthlete(athlete)` - populate from backend athlete
- `isComplete` - computed, true when all fields filled

### `favoritesStore`
- Local favorites (not persisted) - currently unused

## API Endpoints

### Public
- `GET /tournaments` - List tournaments (with filters)
- `GET /tournaments/{id}` - Get tournament details
- `GET /master-gyms/{id}` - Get master gym by ID
- `GET /master-gyms/search?q=query` - Search master gyms by name prefix

### Protected (requires Cognito JWT)
- `GET /athletes` - List user's athletes
- `POST /athletes` - Create athlete
- `PUT /athletes/{id}` - Update athlete
- `DELETE /athletes/{id}` - Delete athlete
- `GET /wishlist` - List wishlisted tournaments
- `POST /wishlist` - Add to wishlist
- `DELETE /wishlist/{tournamentId}` - Remove from wishlist

### Admin (requires Cognito JWT)
- `GET /admin/pending-matches?status=pending` - List pending gym matches for review
- `POST /admin/pending-matches/{id}/approve` - Approve match and create master gym
- `POST /admin/pending-matches/{id}/reject` - Reject match
- `POST /admin/master-gyms/{id}/unlink` - Unlink source gym from master

## Pre-Commit Requirements (MANDATORY)

**Before EVERY commit, you MUST:**

1. **Run all tests** - Both frontend and backend must pass
   ```bash
   cd frontend && npm test
   cd backend && npm test
   ```

2. **Build the frontend** - Catch TypeScript and build errors
   ```bash
   cd frontend && npm run build
   ```

3. **Fix any failures** before committing - Never commit broken code

This is non-negotiable. Do not commit without running tests first.

## Testing

- **Framework:** Vitest + React Testing Library
- **Pattern:** Tests in `__tests__/` directories, `.test.tsx` suffix
- **Mocking:** Mock stores and next/navigation in test files

## Deployment

### Frontend (Vercel)
- **Auto-deploys on push to `master`** - just `git push`, no manual deploy needed
- Do NOT use `vercel` CLI for deployments - CI/CD handles it
- Production URLs:
  - `https://bjjcomps.com` (custom domain)
  - `https://bjj-tournament-frontend.vercel.app` (Vercel default)

### Backend (AWS SAM)
```bash
cd backend
sam build && sam deploy
# For prod with Google OAuth:
sam deploy --config-env prod --parameter-overrides GoogleClientSecret=YOUR_SECRET
```

## Gym Unification System

The system unifies gyms across IBJJF and JJWL into a single `MasterGym` entity using fuzzy matching.

### How It Works
1. **Source Gyms:** Each org (IBJJF, JJWL) stores gyms as `SourceGym` entities
2. **Fuzzy Matching:** `gymMatchingService.ts` compares gyms using:
   - Levenshtein distance for name similarity (0-100 score)
   - City boost (+15 if city appears in gym name)
   - Affiliation boost (+10 for matching BJJ affiliations like "Gracie Barra", "Alliance")
3. **Auto-linking:** Matches ≥90% are automatically linked to a new `MasterGym`
4. **Admin Review:** Matches 70-89% create `PendingMatch` records for manual review
5. **Master Gym:** Unified gym entity that links multiple source gyms

### Key Files
- `backend/src/services/gymMatchingService.ts` - Fuzzy matching logic
- `backend/src/services/gymSyncService.ts` - Gym sync with matching integration
- `backend/src/db/masterGymQueries.ts` - Master gym CRUD
- `backend/src/db/pendingMatchQueries.ts` - Pending match CRUD
- `backend/src/handlers/adminMatches.ts` - Admin review endpoints
- `backend/src/handlers/masterGyms.ts` - Public gym search
- `frontend/src/app/(protected)/admin/gym-matches/page.tsx` - Admin review UI
- `frontend/src/components/admin/GymMatchesPage.tsx` - Match review component
- `frontend/src/hooks/useAdminMatches.ts` - TanStack Query hooks for admin

### Athlete Gym Linking
Athletes can be linked to a `MasterGym` via the `masterGymId` field, allowing cross-org gym association.

## Design Decisions

1. **Planner-first flow:** Anonymous users can fill athlete info and see tournaments before creating account
2. **Single-table DynamoDB:** All entities in one table with PK/SK patterns
3. **Cognito for auth:** Managed user pools, JWT tokens for API auth
4. **App Router:** Next.js 15 with route groups for auth/protected pages
5. **Gym unification:** Fuzzy matching to unify gyms across orgs with admin review for edge cases

## UI/UX Standards (CRITICAL)

### Form Input Contrast
**ALWAYS ensure proper contrast on ALL form inputs - never use white text on white background:**

```tsx
// ✅ CORRECT - Visible contrast (example with white bg and dark text)
<input
  type="text"
  className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 border-gray-300"
/>

// ✅ ALSO CORRECT - Dark theme with proper contrast
<input
  type="text"
  className="w-full px-3 py-2 border rounded-md bg-gray-800 text-white border-gray-600"
/>

// ❌ WRONG - No explicit colors = potential white on white
<input
  type="text"
  className="w-full px-3 py-2 border rounded-md border-gray-300"
/>
```

**Key Rule:** Always specify BOTH background AND text colors on inputs/selects to ensure readability. The specific colors can vary based on design needs, just ensure they contrast.

### Date Inputs
**ALWAYS use native HTML5 date pickers:**

```tsx
// ✅ CORRECT - type="date" provides native date picker
<input
  type="date"
  value={dateValue}
  onChange={(e) => handleChange(e.target.value)}
  className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 border-gray-300"
/>

// ❌ WRONG - type="text" forces manual entry
<input
  type="text"
  placeholder="YYYY-MM-DD"
  className="..."
/>
```

### Dropdown Requirements
1. **Always include a placeholder option:** `<option value="">Select option</option>`
2. **Ensure readable contrast:** Specify both background and text colors
3. **Options inherit:** No need to style individual `<option>` elements
