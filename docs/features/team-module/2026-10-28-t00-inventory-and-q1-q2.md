# T00: Inventory and Q1/Q2 options (team module)

Status: **proposal, awaiting Jeremy's decisions on Q1 and Q2.** Nothing here is decided.
Date: 2026-10-28. Base: `master` at `fd87038`, plus the R0–R2 hotfix (PR #25).

> **Source gap.** The plan documents this task points to are not in this repository, in any branch, or on the build machine:
> `Pablo-Silva-Tournament-Tracker-CEO-Plan.md` and `Pablo-Silva-Tournament-Tracker-Plan-Reviewed.md` (expected in this folder).
>
> So this doc **cannot** confirm the plan's §5 reuse table line by line, and it does not use the plan's D/S/E/W/X decision IDs. The inventory below is taken from the code. Diff it against §5 once the plan docs are committed here.

## 1. Inventory: what exists that a team module can reuse

| Piece | Where | State | Reuse notes |
|---|---|---|---|
| Auth: Cognito user pool, hosted UI, Google IdP | `backend/template.yaml` (`UserPool`, `CognitoAuthorizer`), `handlers/middleware/authMiddleware.ts` | Live | Reuse as is. JWT `sub` is the user id. **No role or group model:** `/admin/*` routes accept any signed-in user (see §4). |
| Users and athletes (DynamoDB) | `db/types.ts` `AthleteItem` (`USER#<sub>` / `ATHLETE#<ulid>`), `handlers/athletes.ts`, `handlers/onboarding.ts`, `services/onboardingService.ts` | Live | Athletes are owned by a parent account. They carry `gymSourceId` and `masterGymId`. This is the record Q2 is about. |
| Gym directory | `SourceGymItem`, `MasterGymItem`, `services/gymMatchingService.ts`, `handlers/masterGyms.ts`, `handlers/gyms.ts` | Live (read). Sync paused by R1 | Public catalog of gym names and locations. Usable as the "which gym is this team" key. |
| Gym rosters scraped from JJWL | `TournamentGymRosterItem` (`GYMROSTER#`), `fetchers/jjwlRosterFetcher.ts`, `services/rosterSyncService.ts`, `handlers/rosterSync.ts` | Public route removed (R0); schedule off (R1); **cached items still in DynamoDB** | Holds minors' data from a third party. Don't build on it until the data policy says so. |
| Tournament catalog | `TournamentItem`, `fetchers/ibjjfFetcher.ts`, `fetchers/jjwlFetcher.ts`, `services/syncService.ts` | Live (read). Sync paused by R1 | Public catalog. The tournament ids teams would plan against. |
| Wishlist / season plan | `WishlistItem`, `handlers/wishlist.ts` | Live | Per-user tournament list. A team plan could extend it or sit beside it. |
| Calendar export | `frontend/src/lib/calendar.ts` | Live | Writes **all-day events only** (`DTSTART;VALUE=DATE`, `DTEND` = start + 1 day). There are no timed events (weigh-ins, bracket times) and no feed URL. |
| Live updates (WebSocket) | `FlightPriceWebSocketApi`, `handlers/websocket.ts`, `db/wsConnectionQueries.ts` | **Behind `EnableFlightPrices=false`, not deployed** | `$connect` is `AuthorizationType: NONE` and trusts a `userId` query parameter, so anyone can subscribe as anyone. The R2 gate fails if it is enabled like this. |
| Queue / events | `FlightPriceQueue` + DLQ (SQS), `FlightPriceEventBus` (EventBridge), `services/eventBridgeService.ts` | **Behind `EnableFlightPrices=false`** | A working SQS + DLQ + EventBridge pattern to copy. |
| Amadeus flight prices | `services/amadeusClient.ts`, `services/flightPriceService.ts`, `handlers/flightPriceFetcher.ts`, `handlers/flightPrices.ts`, `handlers/airports.ts` | **Fetcher and schedule behind `EnableFlightPrices=false`.** The `/flight-prices` and `/airports` routes are deployed (Cognito) | Out of scope for the team module. |
| CI | `.github/workflows/deploy.yml` | Test job red since 2026-01-09 (7 tests). Deploys only dev. Prod deploys by hand | PR #25 adds `check:policy`. Prod-CI proposal is in PR #25. |

## 2. Q1: platform for the new relational data

Constraint from the brief: Postgres reachable from Lambda **without a VPC**. Today nothing in the stack runs in a VPC. Adding one brings NAT cost and cold-start work.

### 2a. Postgres hosting

| Option | No-VPC access from Lambda | Cost at our scale | Notes |
|---|---|---|---|
| **A. Neon** (serverless Postgres, AWS us-east-1) | Yes: TLS public endpoint, HTTP/WebSocket driver (`@neondatabase/serverless`) built for Lambda, built-in pooler | Free tier, then low and usage-based; scales to zero | Branch per PR for previews and tests. Data sits with a third party (DPA needed for minors' data). |
| B. Aurora Serverless v2 PostgreSQL + **RDS Data API** | Yes: Data API is HTTPS + IAM, no VPC on the Lambda side | Minimum ACU can be 0 (auto-pause), but resume takes seconds. Otherwise ~0.5 ACU always on | Data stays in our AWS account, under IAM, with no extra vendor. Data API adds latency and restricts drivers (Drizzle and Kysely have Data API adapters). |
| C. Supabase Postgres | Yes: public endpoint + Supavisor pooler | Free tier, then $25/mo per project | Also brings auth, storage and realtime we'd mostly not use (we have Cognito). A third party holds the data. |
| D. RDS PostgreSQL + RDS Proxy | **No**: Proxy needs a VPC | Always-on instance | Rejected under the no-VPC constraint. |

**Recommendation: B (Aurora Serverless v2 + Data API)**, if keeping minors' data inside the AWS account matters (I expect it does, given the data policy work in R0–R2). Otherwise **A (Neon)**, for the better developer loop and lower idle cost. **This choice is Jeremy's.** The only deciding question is "may a third-party DB vendor hold minors' records?"

### 2b. Runtime

- Lambda `nodejs20.x` today. Node 20 reached end of life in April 2026.
- **Recommendation:** move all functions to `nodejs22.x` in a small standalone PR before T02. The `Globals.Runtime` line and the esbuild `Target` change. Consider `nodejs24.x` if the SAM CLI in use supports it.
- Keep TypeScript and esbuild. Use a thin query builder (Drizzle or Kysely, both of which support Neon and the Data API) rather than an ORM with a native engine. That keeps bundles small and portable between options A and B.

### 2c. Queue

| Option | Notes |
|---|---|
| **SQS + DLQ** (pattern already in the template) | Managed, at-least-once, per-message retries; idle cost ~0. |
| EventBridge (bus + rules) → SQS | Fan-out when several consumers react to one event. Already templated for flight prices. |
| pg-boss / Postgres-backed queue | Transactional enqueue with the write. Polls the DB. A poor fit for scale-to-zero DBs. |

**Recommendation:** SQS + DLQ, with EventBridge in front only where an event has more than one consumer. Reuse the flight-price resources as the template, not the resources themselves.

### 2d. Live-update transport

| Option | Notes |
|---|---|
| **Polling** (TanStack Query `refetchInterval`) | Zero infra and works today. Fine at tens of seconds of latency for the update types we know of. |
| AWS AppSync Events | Managed pub/sub over WebSockets with Cognito auth built in. No connection table to run. |
| API Gateway WebSocket (existing, behind flag) | We'd own the connection table, fan-out and auth. `$connect` needs a Cognito authorizer first (see §1). |
| SSE via Lambda response streaming (Function URL) | One-way. Function URLs need their own auth story, and long-held Lambdas cost money. |

**Recommendation:** start with polling. Move to **AppSync Events** only if a measured need appears (for example, live mat-side updates). Don't revive the custom WebSocket stack.

## 3. Q2: where athlete records live

| Option | Pros | Cons |
|---|---|---|
| **A. Move athletes to Postgres** (one-time backfill from DynamoDB, then DynamoDB athlete items removed) | One source of truth for minors' data. Foreign keys to teams, memberships and guardians. Deletion and retention requests handled in one place | Migration work. The athletes, onboarding and profile handlers change |
| B. Keep athletes in DynamoDB; Postgres stores `athlete_id` references | No migration now | Two stores for one child's data: no FKs, dual deletes, cross-store joins in code |
| C. No Postgres; model teams in DynamoDB too | One store, no new vendor | Memberships, permissions and roster queries are relational. Single-table access patterns get hard to change |

**Recommendation: A**, if Q1 adopts Postgres. Do the move in the same slice that introduces the first Postgres-backed team table, so there is never a period with athletes split across stores. If Q1 ends up "no Postgres", then C, and Q2 is moot.

## 4. Findings for Jeremy (outside T00 scope, not fixed)

1. **`/admin/*` has no role check.** `adminMatches.ts` and `adminGymSubmissions.ts` accept any Cognito user, so a self-signup account can approve or reject gym matches. Fix: a Cognito `admins` group, checked in the handler.
2. **Cached JJWL roster items (`GYMROSTER#`) remain in prod DynamoDB** after R0. Keeping or purging them is a data-policy decision.
3. **CI on `master` has been red since 2026-01-09.** The cause is 7 tests in `flightPriceFetcher.test.ts` (a hard-coded "future" date that is now past) and `gymSyncService.test.ts`. As a result the dev auto-deploy has not run since then.
4. **The WebSocket `$connect` trusts `?userId=`.** That's harmless while `EnableFlightPrices=false`, but it must get an authorizer before any reuse.
