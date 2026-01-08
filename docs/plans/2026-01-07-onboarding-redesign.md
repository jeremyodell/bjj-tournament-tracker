# Onboarding Form Redesign Plan
**Date:** 2026-01-07
**Status:** Ready to Implement
**Design Direction:** Digital Roster Entry - Tournament Scoreboard Aesthetic

## Problem Statement
The current onboarding form uses bright white backgrounds that clash with the dark scoreboard aesthetic of the main site. It feels generic and disconnected from the brand.

## Design Philosophy
Transform the onboarding flow into a **"Digital Roster Entry"** experience - like entering athlete data into a tournament scoreboard system:
- Dark glass panels (scoreboard display aesthetic)
- Glowing cyan/yellow accents (LED indicators)
- Monospace typography for labels (digital readout)
- Smooth animations (data loading into system)
- LED status indicators for validation

---

## Files to Modify

### 1. RoleSelectionStep.tsx
**Current Issues:**
- Generic gray borders
- Blue hover states don't match brand
- No glass effect
- Missing typography hierarchy

**Changes:**
```tsx
// Container
- Add: glass-card styling
- Add: fade-in animation
- Add: LED status indicator at top

// Role cards
- Replace: border-gray-300 → border-white/20
- Replace: hover:border-blue-500 → hover:border-accent-ibjjf
- Replace: hover:bg-blue-50 → hover:bg-white/5
- Add: backdrop-blur-sm
- Add: glow effect on hover
- Add: IBM Plex Mono for card titles
- Add: smooth scale transition

// Heading
- Add: IBM Plex Mono font
- Add: LED "SETUP" status badge
- Add: gradient text effect
```

### 2. AthleteFormStep.tsx
**Current Issues:**
- White input backgrounds (bg-white text-gray-900)
- Generic blue buttons
- No glass effects
- Labels are plain
- No visual hierarchy

**Changes:**
```tsx
// Container
- Add: glass-card with rounded-xl
- Add: subtle glow border
- Add: slide-in animation

// All Input Fields (text, date, number, select)
- Replace: bg-white text-gray-900 → bg-white/8 text-white
- Replace: border-gray-300 → border-white/20
- Add: backdrop-blur-sm
- Add: focus:border-accent-ibjjf
- Add: focus:ring-2 focus:ring-accent-ibjjf/30
- Add: focus:shadow-[0_0_20px_rgba(0,240,255,0.2)]
- Add: placeholder:text-white/40
- Add: transition-all duration-200

// Select dropdowns
- Add: [color-scheme:dark] for better browser rendering
- Style: option elements with bg-[#0A1128] text-white

// Date input
- Add: [color-scheme:dark] to make native picker dark

// Labels
- Add: IBM Plex Mono font (var(--font-mono-display))
- Add: uppercase tracking-wide
- Replace: text-sm font-medium → text-xs font-semibold
- Add: text-white/80

// Error messages
- Keep: text-red-500 → use text-destructive instead
- Add: subtle glow on error state
```

### 3. OnboardingPage.tsx (page.tsx)
**Current Issues:**
- Generic gray/blue buttons
- Plain review cards
- No animations
- Missing visual feedback

**Changes:**
```tsx
// Navigation Buttons (Back, Skip to Review)
- Replace: border-gray-300 hover:bg-gray-50 →
  bg-white/5 border-white/20 hover:bg-white/10 backdrop-blur-sm
- Add: text-white
- Add: transition-all

// Primary CTA Buttons (Next, Add Another, Complete Setup)
- Replace: bg-blue-600 hover:bg-blue-700 →
  bg-scoreboard-yellow text-black font-bold
- Add: hover:shadow-[0_0_30px_rgba(255,215,0,0.4)]
- Add: IBM Plex Mono font
- Add: uppercase tracking-wide
- Add: transition-all duration-200

// Disabled state
- Replace: bg-gray-300 → bg-white/10 opacity-50
- Add: cursor-not-allowed

// Review Cards (lines 152)
- Replace: border border-gray-300 rounded-lg →
  glass-card rounded-xl
- Add: hover:bg-white/5 transition-all
- Add: subtle glow border

// Review Card Headers
- Add: IBM Plex Mono font
- Add: text-scoreboard-yellow
- Add: uppercase tracking-wide

// Review Card Content
- Keep readable with text-white/90
- Add: stronger emphasis on labels

// Loading state ("Creating...")
- Add: pulsing animation
- Add: LED-style loading dots
```

### 4. GymSearchWithOther.tsx (needs review)
**Current Issues:**
- Unknown - need to check styling

**Changes:**
- Apply same glass input styling
- Match autocomplete dropdown to theme
- Add hover states with cyan glow
- Custom gym input should match other inputs

---

## Color Reference

### Brand Colors (from globals.css)
```css
--scoreboard-yellow: #FFD700
--scoreboard-yellow-glow: rgba(255, 215, 0, 0.3)
--scoreboard-white: #F8F9FA

--accent-ibjjf: #00F0FF (Electric Cyan)
--accent-jjwl: #FF2D6A (Hot Magenta)

--led-green: #00FF41
--led-red: #FF3131
--led-amber: #FFA500

--background: #0A1128 (Deep Navy)
--destructive: #ff2d6a
```

### Glass Surface Pattern
```tsx
className="bg-white/5 border border-white/20 backdrop-blur-sm"
```

### Focus State Pattern
```tsx
focus:border-accent-ibjjf
focus:ring-2
focus:ring-accent-ibjjf/30
focus:shadow-[0_0_20px_rgba(0,240,255,0.2)]
transition-all duration-200
```

### Primary Button Pattern
```tsx
className="bg-scoreboard-yellow text-black font-bold
           hover:shadow-[0_0_30px_rgba(255,215,0,0.4)]
           transition-all duration-200 uppercase tracking-wide"
style={{ fontFamily: 'var(--font-mono-display)' }}
```

### Secondary Button Pattern
```tsx
className="bg-white/5 text-white border border-white/20
           hover:bg-white/10 backdrop-blur-sm
           transition-all duration-200"
```

---

## Typography Hierarchy

### Headings
- Font: IBM Plex Mono (`var(--font-mono-display)`)
- Style: Uppercase, tracking-wide
- Color: Yellow gradient or white

### Labels
- Font: IBM Plex Mono
- Style: Uppercase, text-xs, font-semibold
- Color: text-white/80

### Body Text
- Font: Instrument Sans (`var(--font-body)`)
- Color: text-white/70

### Placeholder
- Color: text-white/40

---

## Animation Enhancements

### Page Transitions
```tsx
// Role selection step
className="animate-fade-in-up"

// Form step
className="animate-fade-in-up animation-delay-100"

// Review step
className="animate-fade-in-up"
```

### LED Status Indicators
```tsx
// Add to top of each step
<div className="flex items-center gap-2 mb-6">
  <div className="w-2 h-2 rounded-full bg-led-green
                  animate-pulse shadow-[0_0_8px_var(--led-green)]" />
  <span className="text-xs font-bold tracking-widest uppercase text-white/80"
        style={{ fontFamily: 'var(--font-mono-display)' }}>
    {step === 'role' ? 'SETUP' : step === 'athlete-form' ? 'DATA ENTRY' : 'REVIEW'}
  </span>
</div>
```

### Progress Indicator
```tsx
// Show progress between steps
<div className="flex gap-2 mb-8 justify-center">
  <div className={step === 'role' ? 'w-8 h-1 bg-scoreboard-yellow' : 'w-8 h-1 bg-white/20'} />
  <div className={step === 'athlete-form' ? 'w-8 h-1 bg-scoreboard-yellow' : 'w-8 h-1 bg-white/20'} />
  <div className={step === 'review' ? 'w-8 h-1 bg-scoreboard-yellow' : 'w-8 h-1 bg-white/20'} />
</div>
```

### Loading State
```tsx
// Replace "Creating..." with animated dots
{isPending ? (
  <span className="flex items-center gap-2">
    <span>SUBMITTING</span>
    <span className="flex gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse [animation-delay:300ms]" />
    </span>
  </span>
) : 'COMPLETE SETUP'}
```

---

## Validation & Error States

### Error Border Glow
```tsx
// On inputs with errors
className={`... ${
  errors.field
    ? 'border-destructive ring-2 ring-destructive/30 shadow-[0_0_15px_rgba(255,45,106,0.2)]'
    : 'border-white/20'
}`}
```

### Error Message Styling
```tsx
<p className="text-destructive text-sm mt-1 font-medium">
  {errors.name}
</p>
```

### Success State (optional)
```tsx
// When field is filled and valid
className="border-led-green ring-1 ring-led-green/20"
```

---

## Accessibility Considerations

### Color Contrast Ratios
- White text on `rgba(255,255,255,0.08)` = ~15:1 ✅
- Yellow `#FFD700` on `#0A1128` = ~12:1 ✅
- Cyan `#00F0FF` on `#0A1128` = ~11:1 ✅
- All meet WCAG AA standards

### Focus Indicators
- All interactive elements have visible focus rings
- Focus ring uses cyan glow (highly visible)
- Keyboard navigation fully supported

### Screen Readers
- Labels remain properly associated
- Error messages announced
- Status indicators have aria-live regions

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  /* Animations disabled in globals.css */
}
```

---

## Implementation Order

1. **RoleSelectionStep.tsx** (simplest, sets the tone)
2. **AthleteFormStep.tsx** (most complex, all input types)
3. **OnboardingPage.tsx** (buttons and review step)
4. **GymSearchWithOther.tsx** (if needed)
5. **Test entire flow** (all steps, validation, errors)
6. **Polish animations** (timing, delays, smoothness)

---

## Testing Checklist

### Visual
- [ ] All inputs have dark glass backgrounds
- [ ] Focus states show cyan glow
- [ ] Buttons use yellow (primary) and glass (secondary)
- [ ] Typography uses IBM Plex Mono for labels/headings
- [ ] Animations are smooth and purposeful
- [ ] LED indicators pulse correctly

### Functional
- [ ] All form validation still works
- [ ] Error states show proper styling
- [ ] Focus management works with keyboard
- [ ] Placeholder text is visible
- [ ] Date picker displays correctly (dark theme)
- [ ] Dropdown options are readable
- [ ] Loading states show animated feedback

### Responsive
- [ ] Layout works on mobile
- [ ] Touch targets are adequate
- [ ] Text remains readable at all sizes

### Accessibility
- [ ] Tab order is logical
- [ ] Focus indicators are visible
- [ ] Screen reader announces errors
- [ ] Color contrast passes WCAG AA
- [ ] Works with reduced motion

---

## Before/After Comparison

### Before
- White backgrounds on dark page
- Generic blue buttons
- Plain gray borders
- No animations
- Feels disconnected from brand

### After
- Dark glass surfaces with blur
- Yellow/cyan brand accents
- Glowing focus states
- Smooth animations
- LED status indicators
- Feels like tournament scoreboard UI

---

## Notes for Next Session

1. **Start with RoleSelectionStep** - it's the first impression
2. **Test after each file** - ensure styling doesn't break functionality
3. **Check GymSearchWithOther** - might need custom styling
4. **Consider adding sound effects** - subtle beeps on focus/validation (optional)
5. **May need to adjust globals.css** - if new utilities are needed

---

## Success Criteria

✅ Form feels like part of the scoreboard system
✅ All inputs have proper contrast and readability
✅ Brand colors (yellow/cyan) are prominent
✅ Smooth animations enhance UX
✅ LED indicators provide clear feedback
✅ No generic "SaaS admin" vibes
✅ Passes accessibility standards
✅ User can complete flow without confusion
