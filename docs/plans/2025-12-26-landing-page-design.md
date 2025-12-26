# BJJComps Landing Page Design

> **For Claude:** Use the frontend-design skill to implement this design. All decisions are finalized - no clarifying questions needed.

## Brand Identity

**Domain:** bjjcomps.com

**Logo:**
- Abstract belt weave pattern (geometric, modern interpretation of how belts cross/tie)
- Dark/charcoal base
- Gold accent color
- Wordmark: "BJJComps" alongside the icon

**Logo Generation Prompt (for Midjourney/DALL-E):**
```
Minimal abstract logo icon for "BJJComps", a Brazilian Jiu-Jitsu tournament finder app.

Design: Geometric pattern inspired by how martial arts belts cross and weave when tied. Abstract, not literal. Clean lines forming an interlocking weave or knot pattern.

Style: Modern, premium, minimal. Single color (gold/champagne) on transparent or dark charcoal background.

Mood: Professional, refined, athletic. Should work as app icon and favicon.

NOT: Literal belt buckles, people, text, gradients, 3D effects, or busy details. Keep it simple and iconic.

Format: Vector-style, symmetrical or near-symmetrical, works at 32x32px.
```

**Color Palette:**
- Primary: Black/charcoal (`#0a0a0a` or similar dark from existing theme)
- Accent: Gold gradient (warm `#d4af37` → cooler `#c9a227`) with soft glow
- Text: White/light gray
- Gold overlays: 5-10% transparency for depth

**Typography:**
- Display/Headlines: Clash Display, Cabinet Grotesk, or Instrument Serif (bold, editorial presence)
- Body: Satoshi (already in use)

---

## The Memorable Thing

**Living Belt Weave Background**

The abstract belt weave pattern isn't just the logo - it's a subtle animated background element. Thin gold lines slowly weaving/crossing behind the hero content. This becomes the signature visual that no other BJJ site has.

---

## Target Audience

**Primary:** Parents of kid competitors - decision makers navigating BJJ tournaments for their children

**Secondary:** Gym owners/coaches - planning team travel and competition schedules (multiplier effect, brings in more parents)

## Key Value Proposition

Budget-conscious tournament planning with a unified view across IBJJF and JJWL. Helps families answer: "Which tournaments should we invest in this season?"

---

## Landing Page Structure

### Navigation Bar

- Logo (belt weave icon + "BJJComps" wordmark) on left
- "Browse Tournaments" link/button on right
- Transparent over hero, minimal

---

### Hero Section

**Layout:**
- Full-width dark hero with animated belt weave pattern background
- **Asymmetric layout** - break the typical 50/50 split
- Left side: Headline + subheadline + CTA button
- Right side: Screenshot at **dramatic 12-15° angle**, overlapping the fold, casting a long gold-tinted shadow

**Copy:**
- Headline: "Find your next competition" (large, display font, editorial scale)
- Subheadline: "IBJJF and JJWL tournaments in one place. Plan your season, budget smarter."
- CTA Button: "Browse Tournaments" → links to `/tournaments`

**Visual Details:**
- Gold gradient CTA button with soft glow/bloom effect
- Screenshot framed in browser chrome or device mockup
- Subtle frosted glass border on screenshot (not hard edge)
- Optional: subtle animation in screenshot (cursor moving, filter being applied)
- Headline should feel like a statement, not a label

**Mobile:**
- Stack headline above screenshot
- Screenshot bleeds off-screen for drama
- Full-width CTA button

---

### Value Props Section

**Layout:**
- 3-column grid on desktop, stacked on mobile
- Cards have subtle border, slight elevation
- **Cards overlap slightly** instead of perfect grid alignment
- **Staggered reveal animation** as user scrolls into view (animation-delay per card)

**Props:**

| Icon | Headline | Description |
|------|----------|-------------|
| Calendar with merged layers | "One calendar, all orgs" | IBJJF and JJWL schedules unified. No more tab-switching. |
| Map pin / route | "Find comps near you" | Filter by location and see what's worth the drive. |
| Sparkle / AI icon | "Plan your season" | AI helps you build the optimal tournament schedule for your budget. |

**Visual Details:**
- Icons are line-style, gold color with subtle shimmer on hover
- Text is white/light gray on dark
- Minimal - no long paragraphs, just scannable
- Cards fade/slide in with staggered timing

---

### Bottom CTA Section

**Layout:**
- Centered CTA block after value props
- Generous whitespace above and below

**Copy:**
- Headline: "Ready to plan your comp season?"
- Button: "Browse Tournaments" (gold gradient with glow, same as hero)

---

### Footer

**Layout:**
- Single row, minimal
- Dark, doesn't distract

**Content:**
- Logo (small) | © 2025 BJJComps | Contact link

---

## Animation & Motion Notes

| Element | Animation |
|---------|-----------|
| Belt weave background | Slow continuous weave motion (CSS or canvas) |
| Hero content | Fade in + slight upward slide on load |
| Screenshot | Fade in with slight scale (0.95 → 1) after hero text |
| Value prop cards | Staggered fade + slide on scroll-trigger |
| Icons | Subtle gold shimmer on hover |
| CTA buttons | Soft glow pulse on hover |

---

## Technical Notes

- Reuse existing: AnimatedBackground (enhance with weave pattern), Satoshi font, dark theme
- Add display font: Clash Display or Cabinet Grotesk (via Google Fonts or local)
- New components needed:
  - `LandingNav` - transparent nav bar
  - `LandingHero` - asymmetric hero with angled screenshot
  - `BeltWeaveBackground` - animated gold weave pattern
  - `ValueProps` - staggered reveal cards
  - `BottomCTA` - centered call to action
  - `Footer` - minimal footer
- Screenshot: can be real screenshot, styled mock component, or subtle video/gif
- Mobile-responsive: stack hero vertically, full-bleed screenshot, stack value props

---

## Implementation Checklist

- [ ] Generate logo via image AI (use prompt above)
- [ ] Add display font (Clash Display or similar)
- [ ] Create BeltWeaveBackground component (animated gold lines)
- [ ] Create LandingNav component
- [ ] Create LandingHero component (asymmetric, angled screenshot)
- [ ] Create ValueProps component (staggered scroll animation)
- [ ] Create BottomCTA component
- [ ] Create Footer component
- [ ] Update page.tsx to render landing page instead of redirect
- [ ] Add navigation from landing to /tournaments
- [ ] Mobile responsive pass
- [ ] Performance check (animations smooth at 60fps)
