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

## Authentication (Phase 2)

*Source: [Design Doc](./plans/2025-12-24-bjj-tournament-tracker-design.md)*

### Deferred

- [ ] **Cognito User Pool** - Set up authentication
- [ ] **Login/Register UI** - Frontend auth flows
- [ ] **Protected routes** - Require auth for wishlist features
- [ ] **User profile** - Basic profile management

---

## Wishlist Feature (Phase 2)

*Source: [Design Doc](./plans/2025-12-24-bjj-tournament-tracker-design.md)*

### Deferred

- [ ] **Wishlist data model** - DynamoDB schema for user wishlists
- [ ] **Wishlist API** - CRUD endpoints for wishlist entries
- [ ] **Wishlist UI** - Add/remove tournaments, view wishlist
- [ ] **Athlete tracking** - Track multiple athletes per wishlist entry

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
