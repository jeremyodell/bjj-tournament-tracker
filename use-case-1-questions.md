# Use Case 1: Clarifying Questions

Please answer each question below. Write your answer in the **Answer:** field.

---

## Authentication & Identity

### Q1: Authentication Provider
Should we use AWS Cognito (per requirements) or adapt the existing JWT-based auth from the prototype?

**Options:**
- A) Cognito from scratch
- B) Port prototype JWT auth
- C) Cognito with prototype patterns as reference

**Answer:**
C
---

### Q2: Social Login Providers
Which social login providers should be supported for MVP?

**Options:**
- A) Google only
- B) Google + Apple
- C) Google + Apple + Facebook
- D) Email/password only for MVP

**Answer:**
D
---

### Q3: Email Verification
Is email verification required before a user can use the wishlist feature?

**Options:**
- A) Required before any action
- B) Optional (prompt later)
- C) Not required

**Answer:**
C
---

### Q4: Password Requirements
Should passwords have specific complexity requirements?

**Options:**
- A) Standard (8+ chars, mixed case, number, special char)
- B) Minimal (8+ chars only)
- C) NIST guidelines (no complexity rules, 12+ char length only)

**Answer:**
A
---

## User Registration & Onboarding

### Q5: Profile Completion Timing
Can a user wishlist tournaments before completing their full profile (home address, nearest airport)?

**Options:**
- A) Full profile required upfront before any wishlist action
- B) Prompt for address/airport when adding to wishlist
- C) Completely optional for MVP (address/airport not needed)

**Answer:**
C
---

### Q6: Athlete Requirement for Wishlist
Can a user wishlist tournaments before creating any athlete profiles?

**Options:**
- A) Must create at least one athlete first
- B) Can wishlist tournament first, assign athlete later

**Answer:**
A
---

### Q7: Gym Membership Validation
When a parent claims gym membership, is any validation performed?

**Options:**
- A) Pure trust-based (self-declare, no validation)
- B) Email domain matching
- C) Gym owner approval required

**Answer:**
A
---

## Tournament Data

### Q8: Data Source Strategy
Should we use static seeded data or live API fetching for MVP?

**Options:**
- A) Static seed data only (no live fetching)
- B) Live fetching with fallback to seed data
- C) Live fetching only (no seed fallback)

**Answer:**
C
---

### Q9: Tournament Data Fields
The requirements specify fields (registration fees, deadlines, divisions) that the current fetchers don't capture. What's the MVP scope?

**Options:**
- A) Use existing fetcher data only (name, dates, city, venue, gi/nogi)
- B) Enhance fetchers to capture fees and registration deadlines
- C) Manual data entry/curation for missing fields

**Answer:**
A
---

### Q10: Duplicate Tournament Handling
How should we handle tournaments that might exist in both IBJJF and JJWL systems?

**Options:**
- A) Show both as separate entries
- B) Prefer one source over the other
- C) Attempt to merge/deduplicate records

**Answer:**
A
---

### Q11: Pre-computed Travel Data
Should tournament data include pre-computed hotel costs and travel distances for MVP?

**Options:**
- A) Yes, pre-compute for all tournaments
- B) Calculate on-demand when user wishlists
- C) Defer travel/hotel data entirely to Phase 2

**Answer:**
A
---

## Wishlist Behavior

### Q12: Multiple Athletes Same Tournament
Can a parent add the same tournament multiple times for different athletes (e.g., siblings)?

**Options:**
- A) Yes, separate wishlist entry per athlete
- B) No, one entry per tournament with multiple athletes attached

**Answer:**
A
---

### Q13: Anonymous User Wishlist Attempt
What happens when a user who is not logged in tries to add a tournament to their wishlist?

**Options:**
- A) Prompt login/register immediately, lose the action
- B) Store selection in browser (localStorage), sync after login
- C) Show message explaining login required, no storage

**Answer:**
C
---

### Q14: Default Wishlist Status
When adding to wishlist, what should the initial status be?

**Options:**
- A) Always "Interested"
- B) Let user choose (Interested/Registered)
- C) Smart default based on registration dates

**Answer:**
B
---

### Q15: Wishlist Limits
Is there a maximum number of tournaments a user can wishlist?

**Options:**
- A) Unlimited
- B) Free tier limit (specify number: ___)
- C) Per-athlete limit (specify number: ___)

**Answer:**
B
---

### Q16: Wishlist Notes Field
Should wishlist entries include a notes field from day one?

**Options:**
- A) Yes, include notes field
- B) No, defer to later phase

**Answer:**
B
---

## Frontend & UX

### Q17: Responsive Design Approach
Should we design mobile-first or desktop-first?

**Options:**
- A) Mobile-first
- B) Desktop-first
- C) Design system approach (simultaneous)

**Answer:**
C
---

### Q18: UI Component Library
Is there a preferred UI component library or design system?

**Options:**
- A) Tailwind CSS + Headless UI
- B) Material UI (MUI)
- C) shadcn/ui
- D) Chakra UI
- E) Custom from scratch
- F) Other (specify: ___)

**Answer:**
C
---

### Q19: Tournament View Options
Should the tournament list support additional views beyond a list?

**Options:**
- A) List view only for MVP
- B) List + map view
- C) List + calendar view
- D) List + map + calendar views

**Answer:**
A
---

### Q20: List Loading Pattern
How should the tournament list handle large datasets?

**Options:**
- A) Traditional pagination (page 1, 2, 3...)
- B) Infinite scroll
- C) "Load more" button

**Answer:**
B
---

## Security & Compliance

### Q21: COPPA Compliance
Are there COPPA compliance requirements since athletes may be minors?

**Options:**
- A) Yes, full COPPA compliance needed
- B) Parent consent flow only (parent is account holder)
- C) Not applicable (only parent PII stored, athlete data is minimal)

**Answer:**
C
---

### Q22: GDPR Compliance
Is GDPR compliance required for potential EU users?

**Options:**
- A) Yes, full GDPR compliance
- B) Block EU users for MVP
- C) Not required for MVP

**Answer:**
C
---

### Q23: API Rate Limiting
How aggressively should API endpoints be rate-limited?

**Options:**
- A) Aggressive (10 requests/minute per user)
- B) Moderate (60 requests/minute per user)
- C) Light (300 requests/minute per user)
- D) No rate limiting for MVP

**Answer:**
C
---

### Q24: Registration CAPTCHA
Should we implement CAPTCHA for user registration?

**Options:**
- A) Yes, always (reCAPTCHA v3 invisible)
- B) Yes, but only after failed attempts
- C) No CAPTCHA for MVP

**Answer:**
A
---

## Database & Infrastructure

### Q25: Database Choice
Requirements specify DynamoDB. The prototype uses PostgreSQL. Which approach?

**Options:**
- A) DynamoDB single-table design
- B) DynamoDB multi-table design
- C) Aurora PostgreSQL Serverless v2
- D) Standard RDS PostgreSQL

**Answer:**
B
---

### Q26: Compute Architecture
Should we design for serverless (Lambda) or containers?

**Options:**
- A) Lambda + API Gateway (fully serverless)
- B) ECS/Fargate containers
- C) Hybrid (Lambda for async jobs, containers for API)

**Answer:**
C
---

### Q27: File Storage
For future file needs (avatars, PDF exports), confirm storage approach:

**Options:**
- A) S3 only
- B) S3 + CloudFront CDN
- C) Defer file storage decisions to later

**Answer:**
B
---

## Cost Estimation Feature

### Q28: Cost Estimation in MVP
Should the MVP wishlist include cost estimation, or defer to Phase 2?

**Options:**
- A) Basic estimate only (registration fee from tournament data)
- B) Full estimate (registration + travel + hotel)
- C) No cost estimation for MVP

**Answer:**
B
---

### Q29: Travel Cost Source
If cost estimation is included, what's the source for travel/mileage costs?

**Options:**
- A) Google Maps Distance Matrix API
- B) Simple straight-line distance calculation
- C) User manually enters travel cost
- D) N/A (deferring cost estimation)

**Answer:**
A
---

### Q30: Hotel Cost Source
If cost estimation is included, what's the source for hotel costs?

**Options:**
- A) Hotel pricing API (Google, Booking.com, etc.)
- B) Static average per-city data
- C) User manually enters hotel cost
- D) N/A (deferring cost estimation)

**Answer:**
A
---

## Additional Context

### Q31: Any other requirements or constraints not covered above?

**Answer:**

---

### Q32: Target launch timeline or key milestones?

**Answer:**

---

### Q33: Expected initial user volume (helps with infrastructure sizing)?

**Answer:**

---

## Summary Checklist

Once complete, please confirm:

- [ x] All questions answered
- [ x] Ready for technical design phase

