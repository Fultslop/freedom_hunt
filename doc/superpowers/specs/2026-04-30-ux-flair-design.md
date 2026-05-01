# UX Flair — Design Spec
**Date:** 2026-04-30
**Status:** Approved

## Goal

Add motion, visual hierarchy, and targeted icons to make the app feel like a game rather than a form. No redesign — same dark slate + amber theme, same components. Six targeted improvements plus a lightweight icon library.

## Changes

### 1. Slide transition between stops

**Where:** `RoutePage.jsx`

Track a `direction` state (`'next' | 'prev'`) alongside `currentIndex`. On index change, apply a CSS keyframe animation to the card wrapper: outgoing card translates to `-100vw` (Next) or `+100vw` (Prev) while incoming card slides in from the opposite side. Duration ~250ms, ease-out.

- Add `direction` state, updated in `clampedNext`/`clampedPrev` call sites
- Wrap `<ChallengeCard>` in an animated container keyed to `currentIndex`
- Both button taps and the existing swipe gesture trigger the same state, so both get the animation for free

### 2. Submit button → amber

**Where:** `ChallengeCard.jsx` line ~178

Change `background: '#002868'` to `background: theme.accent` (`#f59e0b`). Text color changes from `#fff` to `#000`. Uploading and error states stay muted (no change). The primary CTA should be the most visually prominent element on the card.

### 3. Progress bar — thicker and glowing

**Where:** `TitleBar.jsx`

- Height: 3px → 6px on both track and fill divs
- Fill: add `box-shadow: 0 0 8px rgba(245,158,11,0.5)` and a subtle gradient (`linear-gradient(90deg, #f59e0b, #fbbf24)`)
- `transition` on width stays as-is

### 4. Location badge uses themeColor

**Where:** `ChallengeCard.jsx` title card section

Change badge background from hardcoded `'#002868'` to `location.themeColor ?? '#002868'`. Each stop has a `themeColor` field in the location data. Verify field name during implementation; fall back to navy if absent.

### 5. Breadcrumb clue fade-in

**Where:** `ChallengeCard.jsx` clue section

Add a `fadeInUp` CSS keyframe via an injected `<style>` block:

```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Apply `animation: fadeInUp 400ms ease-out` to the clue container. The component already re-mounts on location change (keyed in `RoutePage`), so the animation fires automatically on every stop.

### 6. Nav button hierarchy

**Where:** `RoutePage.jsx` bottom bar

| Button | Style |
|--------|-------|
| Next   | Filled amber (`theme.accent`), black text, `border-radius: 8px` |
| Prev   | Border only (`theme.border`), theme text |
| Exit   | No border, muted text (`theme.textMuted`), no background |

### 7. Icons via Lucide React

**Install:** `lucide-react` (already a common dep in Vite/React projects; tree-shakeable)

**Usage — ChallengeCard section headers (14px, same color as label):**

| Section | Icon |
|---------|------|
| Storyline | `BookOpen` |
| Location | `MapPin` |
| Challenge | `Crosshair` |
| Next Clue | `Compass` |

**Usage — RoutePage nav buttons:**
- `ChevronLeft` replaces `← Prev` text
- `ChevronRight` replaces `Next →` text
- Exit stays as text only

**Usage — Submit button:**
- `Camera` icon replaces the 📷 emoji

Total: ~8 icon usages across two files. No icons on city/route selection screens.

## Out of Scope

- No changes to `CityPage`, `AppPage`, or `RouteSelector`
- No changes to the theme colors or theme system
- No new components
- No animation libraries (CSS keyframes only)
