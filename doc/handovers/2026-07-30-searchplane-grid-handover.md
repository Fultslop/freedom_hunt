# Handover: Landing page / `SearchPlane` follow-up

**Date:** 2026-07-30
**Branch:** `refactor_upgrade_landing_screen`
**Status:** Verified green, **not yet committed** (on top of `4f5c01e`) — the user says more bugs remain in this area but hadn't itemized them when this handover was written

## What this is

Several rounds of iterative bug-fixing on the new `LandingPage` / `SearchPlane` attract-screen animation (see `doc/superpowers/specs/2026-07-30-landing-join-flow-design.md` for the original design). Most of the round-trip was the user testing in a real browser and reporting visual defects back — I have no browser-automation access in this project (explicitly disallowed except when the user asks), so every fix here was verified by unit tests + lint + the user's own screenshots/manual testing, never by me looking at the rendered page directly. Expect more of that pattern next session.

Two commits from earlier rounds are already on the branch: `aa38060 fix: all the things on the landing page` and `4f5c01e fix label color, title`. Everything below **not** in those commits is currently uncommitted working-tree changes.

## Current state

- `npx vitest run` — 935/935 tests pass
- `npm run lint` — clean
- Not typechecked separately this session (no `npm run typecheck` script was run — check before committing if the project has one)

### Files with uncommitted changes right now

`src/components/SearchPlane.css`, `src/pages/LandingPage.css`, `src/styles/global.css`, `src/utils/searchWalk.ts`, `src/test/searchWalk.test.ts`.

## The big one: grid distortion root cause

The single most persistent bug across this session was "the grid/camera looks distorted/rectangular on desktop." It survived **three separate rounds** of me tuning `perspective` and the mask's fade-radius percentages against each other, because I was treating a downstream symptom without finding the actual causes. The user (or a tool they used) eventually sent a precise diagnosis that identified two real, independent bugs:

1. **`perspective` was a fixed pixel value, not scaled to viewport.** Field of view is roughly `perspective ÷ how much world the viewport reveals`. Since the grid is fixed-pixel-scale (each cell always 46px regardless of screen size) and a wider viewport always shows *more* of it, a fixed `perspective` becomes progressively more extreme (fisheye-like) as the viewport widens — a normal lens at 320px, absurd at 1870px. Fixed with `perspective: clamp(520px, 160vw, 2400px)` on `.search-plane`, so the relative framing stays constant at every width. **This replaces all the earlier breakpoint-based `perspective` overrides — there should be no `@media` rule setting `perspective` anymore.**

2. **The radial fade mask was very likely resolving to `mask-image: none`.** `--search-fade-solid`/`--search-fade-edge` were only ever supplied as `var(--x, fallback)` fallback values inside the `mask-image` declaration, never declared as real custom properties anywhere. If a browser treats that as "referencing an undefined custom property," the whole `mask-image` declaration goes invalid and drops silently — which would explain the grid's visible edges being hard straight lines converging on the vanishing point (the element's own rectangular boundary, clipped by the ancestor's `overflow: hidden`) rather than a soft circular fade, no matter how I tuned the percentages. Fixed by declaring `--search-fade-solid: 11%; --search-fade-edge: 40%;` as real properties directly on `.search-plane__grid`, with the breakpoint media queries only ever *overriding* an already-declared value. **If you ever see the grid's edge as a hard line instead of a soft fade again, check this first** — it's an easy regression to reintroduce by refactoring the custom-property declarations back into fallback-only form.

Two more changes came from the same diagnosis, both in `.search-plane__grid`:

3. **Grid enlarged to `400vmax` and made asymmetric**, offset via `margin-left: -200vmax; margin-top: -352vmax` (not `left`/`top` — those must stay unset for the margin-based offset to work) so the element's own origin sits ~88% down its height. Reasoning: a plane tilted 58° rises toward the camera at `z ≈ y · sin(58°) ≈ 0.85y`, so anything beyond `perspective / 0.85` in the "near" direction is at-or-past the camera and projects to garbage. That's the bottom of the visible frame — closest to the viewer — so the fix pushes most of the (much bigger) grid element to the *far* side instead of centering it. The mask's circle center (`50% 88%`) must match this 88% offset — **if you change the margin-top percentage, change the mask's `circle at 50% X%` to match, or the fade will be off-center from the actual grid origin.**

4. **`background-size: 46px 86.8px`** (46 ÷ cos(58°)) cancels the tilt's vertical foreshortening so cells read as visually square near the focus point. Further from the focus point, perspective still compresses them — that's expected, and it's also fading out by then.

Given all of this, the fade-radius values at the two breakpoints were restored to their *original* spec values (46%/54%) rather than the smaller compensating values from earlier rounds — those compensations were only ever needed because perspective wasn't scaling correctly in the first place.

**I have not independently re-derived or stress-tested this math beyond what the user's diagnosis specified** — I implemented it faithfully and it was confirmed to fix the visible skew, but if new distortion symptoms show up, don't assume the formulas are unimpeachable. Check with the same rigor (actual trig, actual computed-style inspection in devtools) rather than trial-and-error tuning of percentages, which is exactly what burned three rounds last time.

## Camera-closer vs. scale-up

After the grid fix, the user reported the camera felt too far away again — expected, since normalizing the FOV also removed the "artificially zoomed in" feeling that a too-tight fixed perspective had been giving on wide screens. Rather than touch `perspective` again (real risk of re-breaking the now-fragile-but-correct system above, with no way for me to visually verify), I recommended and the user agreed to scale up the *world* instead — completely orthogonal to the perspective/grid/mask math:

- `edgeLength()` in `searchWalk.ts`: `[68, 94]` → `[204, 282]` (exact 3×)
- `.search-plane__node`: `10px` → `30px` (3×), halo `8px` → `24px` (3×)
- `.search-plane__pin-head`/`.search-plane__pin-stem`: 3× their prior sizes
- `.search-plane__label`: only **1.5×** (14px→21px, 18px→27px at ≥1200px), not the full 3× — literally tripled, labels would render bigger than the 40px page title itself
- The `≥1200px` breakpoint overrides for label/pin size were also bumped up — they'd been tuned against the *old*, smaller base sizes, and left alone would have made things visibly *shrink* at desktop widths relative to the new base. **Any time a base size changes, check the breakpoint overrides for the same property are still bigger, not smaller.**
- `search-plane-pin-drop` keyframe in `global.css` had a fixed `-40px`/`4px` `translateY` — tuned for the old ~21px-tall pin, it made a pin 3× that size look like it was fading in rather than falling. Scaled 3× to `-120px`/`12px`.

**Not touched, deliberately:** the camera's lerp factor (`0.045`/frame in `lerpCamera`). Edge lengths tripled means the camera now has 3× the absolute distance to close per split at the same percentage-per-frame rate, which could make it visibly lag further behind the search head during transitions than before. This wasn't reported as a problem, but if "camera lagging/trailing too far behind" comes up next session, this is the first thing to look at — a `k=1|2|3|4` (see below) fan reaching further per step is the likely mechanism.

## Other fixes from this session (in the two already-committed commits)

For context if similar symptoms reappear — root causes only, see `git show aa38060` and `git show 4f5c01e` for the actual diffs:

- **Hamburger menu items unselectable.** `TitleBar.svelte`'s outside-click-close handler used `event.target instanceof Node && !menuWrapEl.contains(event.target)`. A menu item's own `onclick` that changes `menuView` (e.g. root → "Themes") causes Svelte to synchronously detach that very button from the DOM (its containing `{#if}` block goes false) *before* the click event finishes bubbling to the `window` listener — so `contains()` sees a detached node and reads it as "outside," closing the menu the same click that was meant to open a submenu. Fixed with `event.composedPath().includes(menuWrapEl)`, captured at dispatch time and immune to the subsequent mutation. **If any other outside-click-detection pattern gets added elsewhere in the app, use `composedPath()`, not `.contains(event.target)`, for exactly this reason.**
- **Path branch overlap.** `computeChildHeadings` in `searchWalk.ts` used to fan children symmetrically (mirrored ±spacing) around the parent heading, clamped to a fixed global window — over many splits this let sibling/cousin branches converge on the same heading and visually cross. Rewrote as a one-directional sweep (random turn direction per split, 15–30° per step, re-centered on the parent heading afterward so it doesn't compound into a spiral across many splits) plus a 15% chance of `k=1` (no fork, just continue straight) to thin the tree out.
- **Scrollbar on the landing page.** `TitleBar.svelte` now measures its own rendered height via `ResizeObserver` (it varies with the progress bar / back button) and publishes `--titlebar-height` on `<html>`; `LandingPage.css` uses `height: calc(100dvh - var(--titlebar-height))` instead of `min-height: 100vh`, so the page never exceeds the viewport.
- **Title/subtitle overlap on desktop.** Root cause was probably `.landing-page__content`/`.landing-page__controls` getting flex-compressed on a short (unmaximized) desktop window — `.landing-page` became a fixed-height flex column as part of the scrollbar fix, and flex items default to `flex-shrink: 1`. Added `flex-shrink: 0` to both. Also bumped `.depth-wordmark__line`'s `line-height` from `0.98` to `1.1` as cheap insurance against descender clipping. The very tight `0.98` was a deliberate spec value (see the design spec §6) — if it needs to go back down for some reason, re-verify this doesn't reintroduce the overlap.
- **Mobile CTA/nav cut off on the right.** `.landing-page__controls` had both `max-width` and an explicit `width: 100%` plus horizontal padding, with no `box-sizing: border-box` anywhere in the project's global reset. Under default `content-box` sizing, `width: 100%` + padding exceeds 100%, pushing the button ~48px past the viewport edge on narrow screens. Fixed by deleting the redundant `width: 100%` — `max-width` + `margin-inline: auto` on an auto-width block already centers and self-corrects for padding (the same pattern `.landing-page__content` already used without issue).
- **Labels rendered on top of pins.** Moved from `top: y - 16` (inside the pin's own body) to `top: y + 14` (below the ground point).
- **Missing nav icons.** Added `lucide-svelte`'s `Image`/`History`/`Github` above the Gallery/Past hunts/Self-host labels, matching the icon usage pattern already established in `ChallengeCard.svelte` etc.
- **Default theme.** `DEFAULT_THEME` in `themes.ts` was already `"app"` — no code bug found. If it's reported wrong again, it's almost certainly a stale `themeName` key in the browser's `localStorage` from earlier manual testing, not the code.

## Known limitations / things to watch for

- I have no way to visually verify any of this myself (no Playwright/browser automation without an explicit ask). Everything here is unit-test-and-lint-clean but has only been confirmed correct by the user's own manual testing, round by round. Expect the next session to continue that pattern.
- The perspective/grid-size/mask-radius/background-size system (see "The big one" above) is now internally consistent but tightly coupled — changing any one value without re-deriving the others is the most likely way to reintroduce a regression here.
- `removeAfterSteps` (13 default / 18 at ≥1200px viewports, in `searchWalk.ts`) was not revisited despite the 3× edge-length change — nodes now cover 3× the distance per aging step before pruning, which changes how much of the (now much larger, asymmetric) grid gets visually "used" per prune cycle. Not reported as a problem, but worth knowing if the trail's on-screen density looks off.
- `.landing-page__scrim` height was bumped from 45% to 58% specifically to hide near-camera node/label magnification that isn't otherwise culled by age — a purely visual patch, not a fix to the underlying "near-field elements grow unbounded" mechanism. If it's still visible, the next lever is lowering `removeAfterSteps` rather than extending the scrim further (extending it more starts eating into the searchable/visible area the design wants to show).

## Suggested next steps

1. **Ask the user for the specific list of remaining bugs in this area** — they said more exist but hadn't described them as of this handover.
2. Run `npm run dev`, check at 320px / 768px / 1440px / a very wide window per the original diagnosis's own checklist: cell aspect should look consistent across all four, grid should fade to nothing on all sides with no straight edges anywhere.
3. Decide whether to commit the current uncommitted changes (grid/perspective rewrite + 3× scale-up + pin-drop timing) before starting on new bugs, so there's a clean rollback point if the next round of fixes goes sideways.
4. If "camera closer" comes up a third time, resist the urge to touch `perspective` again — prefer scaling world elements further (nodes/pins/edges are already using round 3× numbers that could go higher) or revisit the camera lerp factor, both of which are isolated from the fragile 3D math.
