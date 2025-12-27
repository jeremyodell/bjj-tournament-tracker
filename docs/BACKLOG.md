# Project Backlog

Central location for planned work across the BJJ Tournament Tracker project.

> **Usage:** Transfer items to your project management tool (Linear, GitHub Issues, etc.) as needed. Check off items here when tickets are created or work is complete.

---

## Lambda & Testing

*Source: [LAMBDA-TESTING.md](./LAMBDA-TESTING.md)*

### High Priority

- [x] **Unit tests for tournament handler** - ✅ Complete (2025-12-24): Comprehensive tests for GET /tournaments and GET /tournaments/:id with mocked services
- [x] **Test utilities** - ✅ Complete (2025-12-24): Created mockAPIGatewayEvent, mockContext, mockTournamentResponse helpers in `backend/src/__tests__/utils/testHelpers.ts`
- [x] **SAM template** - ✅ Complete (2025-12-24): Created `backend/template.yaml` with TournamentsFunction, SyncFunction, DynamoDB, API Gateway

### Medium Priority

- [x] **Sample event files** - ✅ Complete (2025-12-24): Created `backend/events/*.json` for SAM local invoke
- [x] **Integration tests** - ✅ Complete (2025-12-24): 15 passing tests with DynamoDB Local
- [x] **CI/CD pipeline** - ✅ Complete (2025-12-24): GitHub Actions workflow for test + deploy to AWS

### Low Priority

- [ ] **SAM Local documentation** - Add SAM Local commands to LOCAL-DEV.md
- [ ] **Performance testing** - Cold start benchmarks, memory optimization
- [ ] **Canary deployments** - Gradual rollout strategy

---

## Data Fetchers

*Source: Backend fetchers for tournament data*

### Investigation Findings (2025-12-24)

**IBJJF Fetcher (`backend/src/fetchers/ibjjfFetcher.ts`)**

| Item | Details |
|------|---------|
| Endpoint | `https://ibjjf.com/api/v1/events/calendar.json` (correct) |
| Error | HTTP 406 with `{"error":"Denied"}` |
| Root Cause | Bot protection blocks non-browser requests. Works in browser but fails from curl/axios even with identical headers and session cookies. Likely TLS fingerprinting or JavaScript challenge verification. |
| Options | 1) Use headless browser (Puppeteer/Playwright) 2) Use browser automation service 3) Contact IBJJF for API access 4) Scrape HTML calendar page directly |

**JJWL Fetcher (`backend/src/fetchers/jjwlFetcher.ts`)**

| Item | Details |
|------|---------|
| Old Endpoint | `https://www.jjworldleague.com/ajax/new_load_events.php` |
| Error | Returns `null` with HTTP 200 (causes `null.map()` TypeError) |
| Root Cause | API endpoint deprecated or moved. Site now references `https://hermes.jjworldleague.com/endpoint2/` for event data. |
| Options | 1) Find correct Hermes API parameters 2) Scrape HTML from homepage 3) Reverse-engineer frontend JS to find API calls |

### High Priority

- [x] **Fix IBJJF fetcher** - ✅ RESOLVED: Using Puppeteer to intercept API response (558 tournaments)
- [x] **Fix JJWL fetcher** - ✅ RESOLVED: Using Puppeteer with HTML scraping fallback (40 tournaments)

### Medium Priority

- [ ] **Add fetcher retry logic** - Exponential backoff for transient failures
- [ ] **Add fetcher caching** - Cache responses to reduce API calls
- [ ] **Scheduled refresh** - Lambda to refresh tournament data periodically
- [ ] **Null response handling** - Gracefully handle null/empty API responses without throwing

---

## Bugs

*Assigned to: Carson*

### High Priority

- [ ] **Show year on tournament cards** - The date display is missing the year, making it unclear which year tournaments are in
- [ ] **JJWL tournaments not showing** - Investigate why JJWL tournaments are not appearing in the UI (fetcher working? data in DB?)
- [ ] **Filter to future tournaments only** - Add API endpoint/filter to only return upcoming tournaments, exclude past events from default view

---

## Frontend

*Source: [Implementation Plan](./plans/2025-12-24-implementation-plan.md)*

### High Priority

- [x] **Error states** - ✅ Complete (2025-12-24): Created ErrorState and EmptyState components with retry functionality
- [x] **Loading skeletons** - ✅ Complete (2025-12-24): Created TournamentCardSkeleton that matches card structure
- [x] **Mobile responsive** - ✅ Complete (2025-12-24): Updated TournamentCard, TournamentFilters, TournamentList with responsive layouts

### Medium Priority

- [ ] **Tournament detail page** - `/tournaments/:id` with full info
- [ ] **Filter persistence** - Remember filters in URL/localStorage
- [ ] **Search debouncing** - Avoid excessive API calls while typing

### Low Priority

- [ ] **Dark mode** - Theme toggle
- [ ] **PWA support** - Offline access, install prompt

---

## Authentication

*Source: [Design Doc](./plans/2025-12-24-bjj-tournament-tracker-design.md), [Paid Features Plan](./plans/2025-12-27-paid-features-implementation.md)*

### Completed (2025-12-27)

- [x] **Cognito SDK integration** - Added @aws-amplify/auth to frontend
- [x] **Auth store** - Zustand store with persist middleware for auth state
- [x] **Login/Register UI** - Login, register, and email confirmation pages
- [x] **Protected routes** - Auth guard layout for /wishlist, /profile, /planner
- [x] **Dev mode** - Local testing without Cognito (NEXT_PUBLIC_DEV_MODE=true)

### Pending

- [ ] **Cognito User Pool setup** - Create User Pool in AWS Console or via CloudFormation
- [ ] **Password reset flow** - Forgot password UI and Cognito integration
- [ ] **Social login** - Google/Apple sign-in options

---

## Wishlist Feature

*Source: [Design Doc](./plans/2025-12-24-bjj-tournament-tracker-design.md), [Paid Features Plan](./plans/2025-12-27-paid-features-implementation.md)*

### Completed (2025-12-27)

- [x] **Wishlist data model** - DynamoDB schema using USER#userId PK, WISH#tournamentPK SK
- [x] **Wishlist API** - Lambda handler for GET/POST/PUT/DELETE /wishlist
- [x] **Wishlist UI** - Heart icon on tournament cards, dedicated wishlist page
- [x] **Athlete tracking** - Athletes can be associated with wishlist items

---

## Athlete Management

*Source: [Paid Features Plan](./plans/2025-12-27-paid-features-implementation.md)*

### Completed (2025-12-27)

- [x] **Athletes data model** - DynamoDB schema using USER#userId PK, ATHLETE#athleteId SK
- [x] **Athletes API** - Lambda handler for GET/POST/PUT/DELETE /athletes
- [x] **Profile page** - View/add/edit/delete athletes with belt color display

---

## Season Planner (Paid Feature)

*Source: [Paid Features Plan](./plans/2025-12-27-paid-features-implementation.md)*

### Completed (2025-12-27)

- [x] **Planner store** - Zustand store for config, plan, must-go tournaments
- [x] **Planner UI** - Split-screen layout with config panel and results
- [x] **Plan generator** - Client-side algorithm with Haversine distance, cost estimation
- [x] **Upgrade modal** - Paywall UI with pricing options
- [x] **Paywall check** - Shows upgrade modal for non-Pro users

### High Priority - Security

- [ ] **Backend subscription verification** - ⚠️ SECURITY: Current paywall is client-side only and can be bypassed via localStorage. For production, must implement:
  1. Store subscription status in DynamoDB (linked to Cognito user ID)
  2. Create `/api/subscription/status` endpoint to verify subscription
  3. Move plan generation to backend Lambda that checks subscription
  4. Integrate Stripe webhooks to update subscription status on payment events

### Medium Priority

- [ ] **Stripe integration** - Payment processing for Pro subscriptions
- [ ] **"Add from wishlist" button** - Currently a stub, needs to open wishlist selector modal
- [ ] **Swap tournament feature** - Show alternative tournaments at similar cost

---

## Environment Management

*Source: Feature branch work (2025-12-27)*

### High Priority

- [ ] **Environment configuration strategy** - Investigate and document approach for managing:
  - Development (local with Docker, dev mode auth)
  - Staging (AWS with test Cognito pool, test Stripe)
  - Production (AWS with production Cognito, production Stripe)

- [ ] **Environment variables documentation** - Document all required env vars:
  - Frontend: NEXT_PUBLIC_COGNITO_USER_POOL_ID, NEXT_PUBLIC_COGNITO_CLIENT_ID, NEXT_PUBLIC_DEV_MODE, NEXT_PUBLIC_API_URL
  - Backend: DYNAMODB_TABLE, COGNITO_USER_POOL_ARN

- [ ] **SAM parameter management** - Strategy for different SAM configs per environment (samconfig.toml profiles or separate files)

- [ ] **Secrets management** - Decide on approach: AWS Secrets Manager, SSM Parameter Store, or environment-specific .env files

---

## Infrastructure

### Medium Priority

- [ ] **AWS deployment** - Deploy to Lambda + API Gateway + DynamoDB
- [ ] **Environment configs** - Dev, staging, production
- [ ] **Monitoring** - CloudWatch dashboards, alarms
- [ ] **Logging** - Structured logging, log aggregation

### Low Priority

- [ ] **Cost optimization** - Reserved capacity, caching strategy
- [ ] **Multi-region** - Disaster recovery considerations
- [ ] **Load testing** - Verify performance under load

---

## Documentation

### Low Priority

- [ ] **API documentation** - OpenAPI/Swagger spec
- [ ] **Architecture diagram** - Visual system overview
- [ ] **Runbook** - Operational procedures, incident response

---

## Legend

| Priority | Meaning |
|----------|---------|
| **High** | Blocking or critical path |
| **Medium** | Important but not blocking |
| **Low** | Nice to have |
| **Deferred** | Phase 2+ work, not current focus |
