# UI Design: Admin Gym Match Review

## Overview

Admin interface for reviewing and approving gym matches between IBJJF and JJWL databases.

**Route:** `/admin/gym-matches`

## Design Direction

Leverages the existing "Midnight Arena" design system:
- Glassmorphic surfaces with subtle blur
- IBJJF cyan (#00F0FF) and JJWL magenta (#FF2D6A) as org-specific accents
- Gold (#d4af37) for confidence scores (echoing tournament medals)
- Dark theme with noise texture overlay
- Satoshi font family

## Components Created

### `GymMatchCard`
Individual match card displaying:
- Confidence score with color-coded glow (gold 80-89%, emerald 90%+)
- IBJJF gym panel (cyan glow) with name and location
- JJWL gym panel (magenta glow) with name
- Match signals breakdown (name similarity bar, city/affiliation boosts)
- Approve/Reject action buttons (pending matches only)

### `GymMatchesPage`
Main admin page with:
- Stats summary (pending/auto-linked/rejected counts)
- Tab navigation with gradient underline indicator
- Search input for filtering gyms
- Refresh button with loading state
- Staggered card animations on load
- Empty state messaging
- Pagination controls (placeholder)

## File Locations

```
frontend/src/
├── app/admin/gym-matches/
│   └── page.tsx              # Route page with sample data
└── components/admin/
    ├── index.ts              # Exports
    ├── GymMatchCard.tsx      # Individual match card
    └── GymMatchesPage.tsx    # Main page component
```

## Screenshots

To preview: Run `npm run dev` and navigate to `http://localhost:3000/admin/gym-matches`

## Type Definitions

```typescript
interface GymMatch {
  id: string;
  ibjjfGymId: string;
  ibjjfGymName: string;
  ibjjfCity?: string;
  ibjjfCountry?: string;
  jjwlGymId: string;
  jjwlGymName: string;
  confidence: number;
  matchSignals: MatchSignals;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
}

interface MatchSignals {
  nameSimilarity: number;
  cityBoost: number;
  affiliationBoost: number;
}
```

## Future Enhancements

1. Real API integration (replace sample data)
2. Bulk approve/reject actions
3. Confidence threshold adjustment controls
4. Export functionality for match reports
5. Admin authentication gate
