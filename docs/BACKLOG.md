# Project Backlog

Central location for planned work across the BJJ Tournament Tracker project.

> **Usage:** Transfer items to your project management tool (Linear, GitHub Issues, etc.) as needed. Check off items here when tickets are created or work is complete.

---

## Lambda & Testing

*Source: [LAMBDA-TESTING.md](./LAMBDA-TESTING.md)*

### High Priority

- [ ] **Unit tests for tournament handler** - Write tests for GET /tournaments and GET /tournaments/:id with mocked DynamoDB
- [ ] **Test utilities** - Create mockAPIGatewayEvent and mockContext helpers
- [ ] **SAM template** - Create template.yaml with Lambda function and API Gateway definitions

### Medium Priority

- [ ] **Sample event files** - Create JSON files for testing with SAM local invoke
- [ ] **Integration tests** - Tests that run against local DynamoDB
- [ ] **CI/CD pipeline** - GitHub Actions workflow for test + deploy

### Low Priority

- [ ] **SAM Local documentation** - Add SAM Local commands to LOCAL-DEV.md
- [ ] **Performance testing** - Cold start benchmarks, memory optimization
- [ ] **Canary deployments** - Gradual rollout strategy

---

## Data Fetchers

*Source: Backend fetchers for tournament data*

### High Priority

- [ ] **Fix IBJJF fetcher** - Currently returns 406 error, needs updated headers/approach
- [ ] **Fix JJWL fetcher** - Currently returns null, API may have changed

### Medium Priority

- [ ] **Add fetcher retry logic** - Exponential backoff for transient failures
- [ ] **Add fetcher caching** - Cache responses to reduce API calls
- [ ] **Scheduled refresh** - Lambda to refresh tournament data periodically

---

## Frontend

*Source: [Implementation Plan](./plans/2025-12-24-implementation-plan.md)*

### High Priority

- [ ] **Error states** - Show user-friendly errors when API fails
- [ ] **Loading skeletons** - Improve perceived performance
- [ ] **Mobile responsive** - Test and fix mobile layouts

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
