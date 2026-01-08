# Phase 2: Calendar Export & Visual Enhancements - Design

**Date:** 2026-01-06
**Status:** Ready for implementation
**Context:** Phase 1 complete (wishlist page, tracked filter, tests). This phase adds calendar export and improves visual distinction for tracked tournaments.

---

## Goals

1. **Calendar Export** - Allow users to export tracked tournaments to calendar apps
2. **Visual Enhancements** - Make tracked tournaments more visually distinct

---

## Feature 1: Calendar Export (.ics Generation)

### Requirements

- Individual export: "Add to Calendar" button on each tracked tournament
- Bulk export: "Export All to Calendar" button on wishlist page
- Support standard calendar apps (Google Calendar, Apple Calendar, Outlook)
- Generate valid .ics files with tournament details

### Implementation

#### Core Library: `frontend/src/lib/calendar.ts`

**Functions:**

```typescript
generateTournamentICS(tournament: Tournament): string
```
- Generates .ics content for a single tournament
- VEVENT with: name, dates, location, description, registration URL
- All-day event format (DTSTART;VALUE=DATE)
- Unique UID based on tournament PK
- Returns formatted .ics string

```typescript
generateBulkICS(tournaments: Tournament[]): string
```
- Generates one .ics with multiple VEVENT entries
- Wraps all tournaments in single VCALENDAR
- Sorted by date (earliest first)
- Returns formatted .ics string

```typescript
downloadICS(content: string, filename: string): void
```
- Creates Blob with .ics MIME type
- Triggers browser download
- Handles cleanup of object URL

**ICS Format Details:**

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BJJ Tournament Tracker//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:{tournamentPK}@bjjcomps.com
DTSTAMP:{current-utc-timestamp}
DTSTART;VALUE=DATE:{tournament-start-yyyymmdd}
DTEND;VALUE=DATE:{tournament-end-or-start+1-yyyymmdd}
SUMMARY:{tournament.name}
LOCATION:{tournament.city}, {tournament.country}
DESCRIPTION:{tournament.org} Tournament\n{registration-url}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR
```

**Key Decisions:**
- All-day events (VALUE=DATE) since we don't have specific times
- DTEND is start date + 1 day (required by spec, represents end of event)
- Use tournament PK as UID for uniqueness
- Include org and registration URL in description

#### UI: Individual Export in ScoreboardTournamentCard

**Location:** Bottom bar, between track button and registration link

**Component Changes:**
- Import `Calendar` icon from lucide-react
- Import calendar utilities
- Add calendar button (only shown for tracked tournaments)
- On click: generate ICS and download

**Visual Style:**
- Match existing icon button (registration arrow)
- Org-based accent color background
- Tooltip/accessible label: "Add to Calendar"
- Size: w-4 h-4 icon, p-2.5 padding

**Behavior:**
- Only visible when `isTracked === true`
- Clicking downloads `{tournament-slug}.ics`
- No loading state needed (instant download)

#### UI: Bulk Export in WishlistPage

**Location:** Page header, next to title/count

**Component:**
- Button with Calendar icon + "Export All to Calendar" text
- Only shows when wishlistedTournaments.length > 0
- On click: generate bulk ICS with all tournaments and download

**Visual Style:**
- Primary action button (yellow accent)
- Icon + text label
- Positioned in header flex container

**Behavior:**
- Clicking downloads `my-tournament-schedule.ics`
- Includes all currently tracked tournaments
- Sorted by date (earliest first)

---

## Feature 2: Visual Enhancements (Star Badge)

### Requirements

- More prominent visual indicator for tracked tournaments
- Should not compete with existing LED indicator (top-right)
- Should be immediately recognizable at a glance

### Implementation

#### Star Badge in ScoreboardTournamentCard

**Location:** Top-left corner (absolute positioning)

**Component Changes:**
- Import `Star` icon from lucide-react (filled variant)
- Add conditional render when `isTracked === true`
- Position: `absolute top-3 left-3`

**Visual Details:**

```tsx
{isTracked && (
  <div className="absolute top-3 left-3 z-10">
    <div className="flex items-center justify-center w-7 h-7 rounded-full"
      style={{
        background: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid var(--scoreboard-yellow)',
      }}
    >
      <Star
        className="w-4 h-4 fill-current"
        style={{
          color: 'var(--scoreboard-yellow)',
          filter: 'drop-shadow(0 0 8px var(--scoreboard-yellow-glow))',
        }}
      />
    </div>
  </div>
)}
```

**Key Decisions:**
- Dark semi-transparent circle background for contrast
- Filled star (not outline) for more prominence
- Glow effect matches the card border glow
- Top-left to balance LED in top-right
- z-10 to ensure it's above card content

**Existing Enhancement:**
- Keep the yellow border glow (line 69 in current code)
- Star adds at-a-glance recognition
- Combined effect: glow + badge = very clear indicator

---

## Files to Create/Modify

### Create:
```
frontend/src/lib/calendar.ts          (NEW - ICS generation utilities)
```

### Modify:
```
frontend/src/components/tournaments/ScoreboardTournamentCard.tsx
  - Add star badge for tracked tournaments (top-left)
  - Add "Add to Calendar" button (bottom bar)

frontend/src/components/tournaments/WishlistPage.tsx
  - Add "Export All to Calendar" button in header
```

---

## Testing Approach

### Manual Testing:
1. **Individual Export:**
   - Track a tournament
   - Click "Add to Calendar" button
   - Verify .ics downloads
   - Import into Google Calendar / Apple Calendar
   - Verify event details are correct

2. **Bulk Export:**
   - Track 3+ tournaments
   - Go to wishlist page
   - Click "Export All to Calendar"
   - Verify .ics downloads with all events
   - Import and verify all tournaments appear

3. **Visual Badge:**
   - Track/untrack tournaments
   - Verify star appears/disappears
   - Check positioning doesn't overlap other elements
   - Test on mobile/tablet/desktop

### Edge Cases:
- Tournament with missing country field
- Tournament with very long name
- Tournament with no registration URL
- Export with 0 tournaments (button should be hidden)
- Export with 1 tournament
- Export with 20+ tournaments

---

## Success Criteria

- [ ] Users can export individual tournaments to calendar
- [ ] Users can export all tracked tournaments at once
- [ ] .ics files import correctly into major calendar apps
- [ ] Star badge is clearly visible on tracked tournaments
- [ ] Star badge doesn't overlap or interfere with other UI elements
- [ ] All existing tests still pass
- [ ] Frontend build succeeds with no errors
- [ ] No console errors when using export features

---

## Out of Scope

- ~~Tournament comparison feature~~ (removed - doesn't add value)
- Calendar sync/integration (OAuth to write directly to calendar)
- Recurring events or multi-day tournament handling
- Reminder/alarm fields in .ics
- Custom calendar colors or categories

---

## Implementation Notes

### ICS Spec References:
- RFC 5545: Internet Calendaring and Scheduling Core Object Specification
- DTSTART/DTEND must be valid date/datetime values
- All-day events use `VALUE=DATE` parameter
- DTEND is exclusive (event ends at start of that day)

### Browser Compatibility:
- Blob download works in all modern browsers
- .ics MIME type: `text/calendar;charset=utf-8`
- Fallback not needed for supported browsers (Chrome, Firefox, Safari, Edge)

### Date Handling:
- Tournaments stored as YYYY-MM-DD strings
- Convert to YYYYMMDD for .ics format
- Assume tournament is in local timezone (no conversion needed)
- End date = start date + 1 day (standard all-day event)

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Export approach | Individual + Bulk | Maximum flexibility |
| Badge design | Star icon top-left | Clean, doesn't compete with LED |
| ICS format | All-day events | No specific times available |
| Button placement | Bottom bar (individual), Header (bulk) | Natural fit with existing UI |
| Star styling | Filled with glow | Most prominent, matches theme |

---

## Next Steps

1. Create `calendar.ts` library
2. Add individual export to ScoreboardTournamentCard
3. Add bulk export to WishlistPage
4. Add star badge to ScoreboardTournamentCard
5. Manual test exports in calendar apps
6. Run frontend tests and build
7. Commit with message: "feat(frontend): add calendar export and star badge for tracked tournaments"
