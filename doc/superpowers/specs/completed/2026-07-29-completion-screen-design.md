# Completion Screen — Design

**Date:** 29/07/2026
**Status:** Ready for planning (completes an external partial draft — UI requirement,
choreography timing, and a standalone HTML mockup, all pasted into this conversation —
against this repo's actual components and data model; scope decisions below are
confirmed)

## Problem

The current end-of-hunt screen (`007_splash_completion.yaml`, rendered via
`SplashScreen.svelte`) is full-bleed, illustrated, and maximally saturated where every
other screen in the app is a 480px photographic column in a restrained navy/crimson/white
palette — it doesn't read as the same product. Its headline also sits directly on a busy
image with no contrast guarantee. It has no result (nothing shown from the hours a team
just spent), no next action, and one looping confetti effect.

This spec builds a replacement screen assembled from the stop screen's existing anatomy
(hero + overlapping card + labelled sections), with a choreographed one-shot arrival
sequence, three real stats pulled from data already tracked in this app, and an inline
voter-registration call to action. **The existing file is untouched** — this ships as a
new template-type and a new YAML file; the user wires it into `routes.yaml` themselves.

## Corrections to the partial draft

The partial draft was written with a few assumptions about this repo that don't hold up
against the actual code. None of these change the intent — they change what the
implementation plan needs to build.

1. **No `StatGrid` component exists.** The nearest thing is
   [`StoryStats.svelte`](../../../src/components/StoryStats.svelte) — a narrative
   click-to-reveal widget (`visibility: "click_to_reveal"` items render a "Tap to reveal"
   cover until tapped) used inside the storyline-blocks system
   (`doc/superpowers/specs/completed/2026-07-27-storyline-blocks-design.md`), not a
   passive celebration display, and it has **no count-up animation at all** today —
   values just fade in via a 0.2s opacity keyframe. **Decided with the user:**
   `StoryStats` is the general case this screen's stats are a specific instance of —
   generalize it (new `count_up` visibility mode, see "StoryStats generalization"
   below) rather than building a parallel component.
2. **No voter-registration screen exists anywhere in this codebase.** The partial draft's
   "a separate voter-registration screen currently exists, roll it in?" doesn't match
   the repo — the closest thing is
   [`008_options_end_of_hunt.yaml`](../../../src/data/text/en/projects/democrats_abroad/den_haag/008_options_end_of_hunt.yaml),
   a generic "You're All Set" page with three links (external Democrats Abroad NL link,
   gallery, back-to-project). There is no in-app registration form, check, or embedded
   flow at all, in this project or any other city's data. **Decided with the user:** the
   inline CTA is a prominent link button (same external link 008 already uses, styled as
   the screen's primary action) — not a new interactive registration widget.
3. **The progress bar is already at 100% before this screen can ever be reached.**
   `TitleBar`'s fill is driven by `locationOrdinalAt(entries, currentIndex) /
   locationTotal(entries)` ([`routeEntries.ts`](../../../src/utils/routeEntries.ts)),
   which freezes once the last location-type entry has been passed — true for any
   post-route screen (splash/options), not something this feature changes. There is no
   natural "prior value" left in the data to animate from at the moment this screen
   mounts. Compounding this: the route's final checkpoint
   ([`011_checkpoint_completion.yaml`](../../../src/data/text/en/projects/democrats_abroad/den_haag/011_checkpoint_completion.yaml))
   is `skippable: true`, so a team can reach this screen without every stop's form
   submitted — "all stops complete" isn't even reliably true. **Decided with the user:**
   stage the fill from the real stops-completed fraction up to full, giving the moment
   real meaning instead of a decorative fake. See "Progress bar staged fill" below.
4. **"Gutter arrows" are a global `RoutePage` concern, already hideable per-entry.** The
   floating prev/next circles (`route-page__gutter-arrow*`) are rendered once in
   [`RoutePage.svelte`](../../../src/pages/RoutePage.svelte#L546-L563), gated by
   `navBarVisible`, which reads `entry["nav-bar"]?.visible` via `isNavBarVisible()`
   ([`routeEntries.ts`](../../../src/utils/routeEntries.ts#L23-L28)) — the exact
   mechanism `000_options_eula.yaml` already uses (`nav-bar: { visible: false }`) to
   block navigation on the EULA screen. Setting the same field on the new completion
   entry hides the arrows **and** disables swipe navigation in one existing, tested
   mechanism — no new plumbing needed.
5. **The partial draft's "Related" docs don't exist as files.** No
   `hero-vertical-footprint-requirement.md` or `stop-navigation-requirement.md` exists
   anywhere in `doc/`. The actual precedent for "hero ratio + ceiling" and "card overlaps
   hero" is `ChallengeCard.css`'s `.cc-hero-img`/`.cc-hero-wrap`/`.cc-title-card` rules —
   cited directly below by rule, not by a filename that doesn't exist.
6. **Architecture.md's claim about `splashEffectHistory.ts` is stale.** It says splash
   effect fire-count/cooldown state "lives in RoutePage's `splashEffectHistory`
   (`src/utils/splashEffectHistory.ts`)" — that file does not exist.
   [`SplashScreen.svelte`](../../../src/components/SplashScreen.svelte#L56-L88) handles
   its own cooldown/max-iteration bookkeeping entirely in a local `$effect` keyed off its
   own `isCurrent` prop, with no external persistence. This is good news for this
   feature: the completion screen can copy that same simple, self-contained pattern
   (see "Mount timing" below) rather than building a cross-visit history layer.
7. **"Time on foot" should reuse the submission-timestamp pattern this app already has
   server-side, not invent a route-start marker.** `form_submissions.submitted_at`
   (D1, per `doc/architecture.md`'s data model) already timestamps every submit — the
   local `FormState` persisted by `formStorage.ts` just doesn't carry the same field yet
   (confirmed: `{ values, uploads, submitted, skipped, touchedFields }`, no timestamp,
   [`data.ts:126-132`](../../../src/types/data.ts#L126-L132)). Per the user's correction,
   the right fix is additive, not a new mechanism: give local `FormState` its own
   `submittedAt`, stamped the same moment `ChallengeForm.svelte`'s `handleSuccess()`
   already flips `hasSubmittedOnce` to `true`
   ([`ChallengeForm.svelte:126-132`](../../../src/components/ChallengeForm.svelte#L126-L132)),
   and derive "time on foot" as *(completion screen entered) − (earliest `submittedAt`
   across every location on the route)* — the gap between the first challenge answered
   and the last screen reached, not a synthetic "route opened" timestamp nobody asked
   for. See "Stats data computation" below.
8. **"Photos taken" isn't currently lifted above `AppForm`.** `RoutePage` already lifts
   `submitted`/`skipped` status per location into `formStatusByIndex`
   ([`RoutePage.svelte:269-297`](../../../src/pages/RoutePage.svelte#L269-L297)) by
   reading `loadFormState()` directly — but per-field upload results
   (`FormState.uploads`) are never bubbled up past `AppForm`'s own state. Computing a
   photo count means reading `loadFormState()` per location the same way RoutePage
   already does for form-status restoration, which only works when
   `project.store_forms_in_local_storage` is true (the project default, and den_haag's
   current setting). See "Stats data computation" below for the degrade path.

## Decisions (confirmed with the user)

1. **Registration CTA:** a prominent link button — the primary, full-width, accent-fill
   action — pointing at the same external URL `008_options_end_of_hunt.yaml` already uses
   (`https://www.democratsabroad.org/nl`), authored in the new entry's YAML so it can
   change per-project without a code change. Not an embedded interactive check.
2. **Stats component:** generalize `StoryStats.svelte` (add a `count_up` visibility mode
   and an optional stagger), not a parallel component.
3. **Progress bar:** stage the fill from the real stops-completed fraction up to 100%,
   not a decorative fake and not left alone.
4. **Template-type:** add a 5th route-entry template-type, `completion`, with its own
   schema, component, and `RouteScreen` dispatch case — consistent with how
   `text`/`splash`/`options` were each added (`doc/architecture.md`, "Route entry
   templates").

## Design

### New route-entry template-type: `completion`

Follows the existing four-type pattern exactly (`doc/architecture.md` § Route entry
templates):

- `src/types/data.ts` — new `CompletionEntry` interface, added to the `RouteEntry` union:

  ```ts
  export interface CompletionEntry {
    "template-type": "completion";
    image: string;
    title: string;
    subtitle: string;
    place: string;
    caption?: string;
    closing_text?: string;
    registration: { text: string; url: string };
    hint?: string;
    "nav-bar"?: NavBarConfig; // always { visible: false } in practice — see Corrections #4
  }
  ```

  Deliberately **no `stats` field** — the three stats are computed client-side (see
  "Stats data computation"), never authored. `secondary_action` ("See your answers") is
  not authored either: its destination is always
  `/${project}/${city}/results_download`, an existing route
  ([`App.svelte:78`](../../../src/App.svelte#L78),
  [`ResultsDownloadPage`](../../../doc/architecture.md), architecture.md's routing
  table) — the component builds that URL from the same `project`/`cityId`/`routeId`
  props every other screen already receives, matching how `ChallengeCard` already
  threads those exact props. Only its button label is worth making data-driven, and a
  fixed "See your answers" is fine for v1 — no schema field needed.

- `src/data/schemas/completion.schema.json` (new) — `additionalProperties: false`,
  modeled directly on `options.schema.json`'s shape; required: `image`, `title`,
  `subtitle`, `place`, `registration.text`, `registration.url`; optional: `caption`,
  `closing_text`, `hint`.
- `src/components/RouteScreen.svelte` — new `{:else if entry["template-type"] ===
  "completion"}` branch (alongside the existing four), passing image/title/subtitle/place/
  caption/closing_text/registration plus the new `stats` prop (see below) and
  `project`/`cityId`/`routeId` (already available in this component for the `options`
  branch) into a new `CompletionScreen` component.
- `scripts/validate-yaml.ts` — new `COMPLETION_PATTERN = /^\d+_completion_.*\.yaml$/`,
  `validateCompletion = ajv.compile(loadSchema("completion.schema.json"))`, and a new
  `findFiles(DATA_DIR, COMPLETION_PATTERN).flatMap(...)` block in the `violations` array —
  the same five-line addition every existing template-type already has
  ([`validate-yaml.ts:92-123`](../../../scripts/validate-yaml.ts#L92-L123)).
- Filename convention: `NNN_completion_<slug>.yaml`, parallel to `NNN_splash_`/
  `NNN_options_`. The existing `007_splash_completion.yaml` is untouched; the new file
  gets its own number/slug when the user wires it into `routes.yaml`.
- Matches the existing precedent that "the admin editor does not yet support authoring
  these template types" (architecture.md) — out of scope here too, same as
  text/splash/options.

### Mount timing — choreography must gate on `isCurrent`, not mount

In the non-"snap" swipe mode, `RoutePage` keeps three `RouteScreen` instances mounted at
once (current/prev/next,
[`RoutePage.svelte:500-540`](../../../src/pages/RoutePage.svelte#L500-L540)) and reuses
the same component instance as the carousel scrolls (slots keyed by slot index, not by
location index) — so the completion screen can be sitting mounted as the *next* peeked
slot while the player is still reading the *previous* stop. If the arrival sequence fired
on mount, it would play while off-screen and be over (or stuck) by the time the player
actually swipes to it.

`SplashScreen.svelte` already solves exactly this
([`SplashScreen.svelte:56-88`](../../../src/components/SplashScreen.svelte#L56-L88)): its
effect sequence depends on its own `isCurrent` prop, resets when it goes false, and
replays fresh each time it goes true. `CompletionScreen` copies this pattern verbatim —
the `$effect` driving the staggered `setTimeout` chain depends on `isCurrent`, clears all
pending timers when `isCurrent` goes false (component stays mounted as a peeked slot,
sequence just stops), and restarts from the top whenever it goes true — including
confetti, which is fine to replay on every re-entry since there's no cross-visit history
mechanism anywhere in this codebase to hook into (Corrections #6) and a team swiping back
to reread their stats and then forward again is a real, harmless case, not a bug to guard
against.

### `CompletionScreen.svelte` (+ `.css`) — new component

Structure mirrors `ChallengeCard`'s hero+card anatomy by value, not by import — this
component gets its own co-located CSS (BEM prefix `cmpl-`, per `CLAUDE.md`), copying the
specific rules that make a stop screen recognizable rather than importing
`ChallengeCard.css` wholesale (that file carries form/map/challenge-box rules this screen
has no use for):

- **Hero:** same values as
  [`ChallengeCard.css`'s `.cc-hero-img`](../../../src/components/ChallengeCard.css#L31-L38) —
  `aspect-ratio: 16/9`, `max-height: 35vh`, `object-fit: cover`, capped at
  `--content-max`. Image is `lange-vijverberg.jpg` (already present in
  `src/data/img/`, unused elsewhere — confirmed via `AssetManager.fetchImage`'s existing
  convention, no new asset pipeline work). `object-position: center 55%` (sky-heavy
  crop bias, per the original requirement).
- **Ken Burns**, applied to the hero `<img>` exactly as specified, on its own GPU layer:

  ```css
  .cmpl-hero img {
    transform: translateZ(0) scale(1.04);
    will-change: transform;
    backface-visibility: hidden;
  }
  .cmpl-hero.play img {
    animation: cmpl-ken 14s cubic-bezier(0.15, 0.55, 0.3, 1) forwards;
  }
  @keyframes cmpl-ken {
    from { transform: translateZ(0) scale(1.04); }
    to   { transform: translateZ(0) scale(1.13); }
  }
  ```

  The `.play` class is added only once `isCurrent` is true and (per reduced-motion)
  motion is allowed — this is the most expendable item in the sequence per the original
  requirement; if it ever visibly jitters on a real device, drop the class add entirely
  and the hero simply sits at its base `scale(1.04)`.
- **Card:** overlaps the hero with the same negative top margin / border / radius /
  shadow as `.cc-title-card--shadow`
  ([`ChallengeCard.css:40-70`](../../../src/components/ChallengeCard.css#L40-L70)).
  Badge reuses `.cc-badge`'s exact sizing/color/position (44px, accent background,
  6px radius) with a `Check` icon (`lucide-svelte`, already imported the same way in
  `ChallengeCard.svelte`) instead of a digit; `aria-hidden="true"` on the icon, matching
  every other section-label icon in this codebase — the card's own visible text ("You
  made it.") already carries the meaning for assistive tech, so the icon needs no
  separate label. Title/subtitle/place render as three stacked lines beneath the badge,
  same layout as `.cc-location-title`/`.cc-location-name`/`.cc-location-address`.
- **Sections:** reuse `.cc-section-label`'s uppercase/letter-spacing/muted-color styling
  for the stats section's eyebrow ("YOUR HUNT" or similar), and `--gap-section`/
  `--gap-block` for spacing — same tokens the challenge-form-ui-polish pass already
  introduced app-wide.
- **Stats row:** `<StoryStats>` in `count_up` mode (see "StoryStats generalization"),
  three items: stops completed, photos taken, time on foot (string, unanimated).
- **Caption / closing text:** two plain authored text blocks (`caption`,
  `closing_text`), rendered via `MarkdownText` like every other narrative text in this
  app (`cc-breadcrumb` already does this for the clue section).
- **Actions:** primary button (full-width, accent fill) is a real `<a href={
  registration.url } target="_blank" rel="noopener">` styled as a button, not a JS
  `push()` — it's leaving the app. Secondary is a `push()` button to
  `/${project}/${city}/results_download`. A hint line beneath is plain authored text
  (optional field, e.g. an expected-time note).
- **Confetti:** mounts `<ConfettiEffect />` (unchanged,
  [`ConfettiEffect.svelte`](../../../src/components/effects/ConfettiEffect.svelte)) once
  a `confettiFired` state flag flips true at the 780ms mark; the component's own
  animation is one-shot already (32 particles, each with its own CSS animation, no
  internal loop) — no changes needed there.
- **Haptics:** `if (typeof navigator.vibrate === "function") { navigator.vibrate(40); }`
  at the same 780ms mark — net new to this codebase (no existing usage), feature-detected
  since it's Android-only in practice and must never throw on unsupported browsers.

### Choreography mechanism

A single `$effect` keyed on `isCurrent`, mirroring `SplashScreen`'s existing shape: on
`isCurrent` becoming true, read
`window.matchMedia("(prefers-reduced-motion: reduce)").matches` **once** (this is a
one-shot arrival, not a live-updating persistent state, so no listener is needed) and
either:

- **Reduced motion:** set every reveal flag (`cardIn`, `badgeIn`, `statsIn`,
  `captionIn`, `closerIn`, `actionsIn`) to their final `true` state immediately, skip the
  `.play` Ken Burns class, skip confetti, skip the progress-bar stage (jump straight to
  100%) — matching the acceptance criteria's reduced-motion list item-by-item.
- **Motion allowed:** schedule the offsets from the original requirement's table (120ms
  card, 380ms badge, 500ms progress-bar bump, 780ms confetti+vibrate, 1000/1150/1300ms
  stats cascade via `StoryStats`'s new `staggerMs`, 1520ms caption, 1680ms closer, 1900ms
  actions) as a chain of `setTimeout`s, IDs collected in an array and all cleared in the
  effect's cleanup (fires when `isCurrent` goes false or the component unmounts) —
  preventing a stale timer from flipping a flag on a screen the player has already
  swiped away from.

Each reveal flag maps to a `.cmpl-reveal`/`.cmpl-reveal--in` class pair (opacity +
12px translateY, matching the mockup's `.reveal`/`.reveal.in` primitive reviewed in
conversation) rather than a Svelte transition directive, since the same flag also needs to
gate *when* a child effect starts (e.g., the stats cascade only begins once `statsIn`
flips), not just how it animates in.

### Progress bar staged fill

Ownership stays with `RoutePage`, which already owns all `titleBarStore` writes — no
direct store access from `CompletionScreen` (a leaf component), keeping the existing
boundary (`RoutePage`'s own `$effect` already sets `progress` off `currentIndex`/
`entries`, [`RoutePage.svelte:88-97`](../../../src/pages/RoutePage.svelte#L88-L97)).

- `titleBarStore`'s `progress` shape gains an optional `animateMs?: number` that
  `TitleBar.svelte` reads as an inline `transition-duration` override on
  `.titlebar__progress-fill` (defaults to the existing `0.2s` when unset — fully
  backward compatible with every other screen's instant-feeling bar).
- When `currentEntry["template-type"] === "completion"`, `RoutePage`'s existing progress
  effect sets `{ current: stopsCompleted, total: stopsTotal, animateMs: 900 }`
  immediately (using the real stats computed below, not the frozen `locationOrdinalAt`
  value), then a single `setTimeout(500ms)` — cleared if `currentIndex` changes away
  first — bumps `current` to `stopsTotal`, producing the "closes itself out" moment the
  original requirement wanted, tied to a true number instead of a decorative fake.

### `StoryStats` generalization

Additive only — every existing storyline usage (`visibility: "visible" |
"click_to_reveal"`, no `staggerMs`) is unchanged.

- `src/types/storyline.ts` — `StatVisibility` gains `"count_up"`:
  `"visible" | "click_to_reveal" | "count_up"`.
- `src/data/schemas/stats.schema.json` — `visibility` enum gains `"count_up"`.
- New optional `staggerMs?: number` prop on `StoryStats.svelte` (default `0`): item
  index `i`'s reveal/count-up start is delayed `i * staggerMs`ms — implemented as a
  per-item `setTimeout` inside the component (or a CSS `animation-delay` for the pure
  fade-in, `setTimeout` for the count-up start, since a CSS delay alone can't gate when a
  JS interval begins incrementing).
- Count-up: for a `count_up` item whose `value` is a `number` (string values are never
  animated, unchanged — `display()`'s existing `typeof value === "number"` branch already
  encodes this rule, no change needed there), animate a local `$state` number from `0` to
  `value` over roughly 600ms, formatted through the same `toLocaleString("en-US")` at
  every tick as the resting state already uses; add a `.story-stats__value--pop` class
  (scale-pop keyframe, same shape as the existing `story-stats-reveal` fade-in, per the
  choreography mockup's `.num.pop`) when the count-up lands on its final value.
- Respects `prefers-reduced-motion` the same way the component already does for its
  existing fade-in ([`StoryStats.css:62-66`](../../../src/components/StoryStats.css#L62-L66))
  — under reduced motion, render the final value immediately, no count-up, no pop.
- No new `aria-live` region: the animating number is silent to assistive tech (no
  announcement per intermediate frame), consistent with this being a decorative
  count-up, not a state change a user needs confirmed (the challenge-form-ui-polish
  spec's `aria-live` additions were specifically for submit/error state, a different
  category — see that spec's Accessibility floor).

### Stats data computation (`RoutePage.svelte`)

Three values, computed once `currentEntry` is the completion entry, threaded down
through `RouteScreen` as a single `stats` prop
(`{ stopsCompleted: number; stopsTotal: number; photosCount: number | "—"; timeOnFoot:
string }`):

1. **Stops completed / total.** `stopsTotal = locationTotal(entries)` (existing helper).
   `stopsCompleted = Object.values(formStatusByIndex).filter(s => s.submitted).length +
   skippedIndices.size` — both already-lifted, already-accurate session state in
   `RoutePage` ([`RoutePage.svelte:269-274`](../../../src/pages/RoutePage.svelte#L269-L274)),
   no new tracking needed. **Decision:** a skipped stop counts as "completed" for this
   number, not just a submitted one — skipping is already treated as a resolved state
   elsewhere in this app (the badge shows a grey dash, not a red "incomplete" marker,
   [`ChallengeCard.svelte:90-93`](../../../src/components/ChallengeCard.svelte#L90-L93)),
   and a strictly-submitted-only count would understate a team that walked the whole
   route but waved off one or two challenges.
2. **Photos taken.** `computePhotosTaken(project, city, route, locationIds)` in the same
   new `src/utils/completionStats.ts` (see "Time on foot" below), summing across
   `routeData.locations`:
   `Object.values(loadFormState(buildFormStorageKey(project, city, route, locId)).uploads)
   .filter(u => u.status === "success").length`. Only meaningful when
   `huntSettings.storeFormsInLocalStorage` is true (den_haag's current default,
   architecture.md); when false, pass the literal string `"—"` instead of `0` — `0` would
   read as "you took no photos," which is misleading when the truth is "we didn't keep
   that number." `StoryStats`'s existing string-passthrough (`display()`) already renders
   a string verbatim with no special-casing required in the component.
3. **Time on foot.** Reuses the submission-timestamp pattern (Corrections #7), sharing
   plumbing with photos-taken above — both scan the same per-location `FormState`
   records, so both live in one new file, `src/utils/completionStats.ts`:
   - `FormState` (`src/types/data.ts`) gains `submittedAt?: number` (epoch ms,
     optional — additive, so `formStorage.ts`'s `STORAGE_VERSION` only needs a **minor**
     bump, `"1.1"` → `"1.2"`, per that file's own documented rule
     ([`formStorage.ts:12-19`](../../../src/utils/formStorage.ts#L12-L19)): old records
     without the field stay readable, `loadFormState` already defaults every optional
     field with `??`).
   - `ChallengeForm.svelte`'s `handleSuccess()`
     ([`ChallengeForm.svelte:126-132`](../../../src/components/ChallengeForm.svelte#L126-L132))
     stamps `submittedAt: Date.now()` into the persisted state **only the first time**
     `hasSubmittedOnce` flips true for that location (a local `let submittedAt =
     $state<number | undefined>(stored.submittedAt)` seeded on mount, set once, then
     threaded through every `persist()` call same as `touchedFields` already is) — a
     later re-submit (`allowResubmit`) must not overwrite it, since "time on foot" wants
     the *first* challenge answered, not the most recent edit.
   - `computeElapsedSinceFirstSubmission(project, city, route, locationIds, now: number):
     number | undefined` — reads `loadFormState()` for every location on the route (same
     access pattern `RoutePage` already uses for restoring `formStatusByIndex`,
     [`RoutePage.svelte:276-297`](../../../src/pages/RoutePage.svelte#L276-L297)),
     takes the **minimum** `submittedAt` across all of them (the earliest challenge
     answered, not any single location's), returns `now - earliest`, or `undefined` if no
     location has ever been submitted (e.g. a team skipped every challenge via the
     skippable final checkpoint — Corrections #7). Only meaningful when
     `store_forms_in_local_storage` is true, same gating as photos-taken.
   - `formatElapsed(ms: number): string` — pure function, e.g. `"2h 18m"` / `"45m"` for
     under an hour. Independently unit-testable, matching this codebase's existing
     "pure function over a string/data" utility shape
     (`routeEntries.ts`/`storylineBlocks.ts` precedent).
   - `timeOnFoot = elapsed === undefined ? "—" : formatElapsed(elapsed)`, computed once
     when the completion entry becomes current. Always a string — never animated, per
     the original requirement's explicit rule.

## Accessibility

- Badge checkmark: `aria-hidden="true"` on the icon (see "CompletionScreen" above) — the
  card's own heading text already conveys completion to assistive tech.
- Count-up numbers: no `aria-live` region (see "StoryStats generalization" above) —
  decorative, not a state change.
- Confetti: `aria-hidden="true"`, already present on `ConfettiEffect`, unchanged.
- Primary/secondary actions are real `<a>`/`<button>` elements, matching every other
  interactive element in this app.
- Reduced motion: exhaustive list carried from the original requirement, restated in
  "Choreography mechanism" above — every reveal renders final immediately, no Ken Burns,
  no confetti, no count-up, progress bar renders at 100% with no transition.

## Acceptance criteria

- [ ] New `completion` template-type: type, schema, `RouteScreen` dispatch case, and
      `validate-yaml.ts` wiring all present; `007_splash_completion.yaml` is untouched.
- [ ] Content capped at `--content-max`, uses existing section-label styling and
      `--gap-section`/`--gap-block` tokens; recognisable as the same app as a stop screen.
- [ ] Hero is `16/9`, capped at `35vh`, not full-bleed, using `lange-vijverberg.jpg`.
- [ ] No text renders directly over the hero image; all headline text sits on the card.
- [ ] Card mirrors `ChallengeCard`'s hero-overlap structure, with a ✓ badge in the digit's
      position.
- [ ] `nav-bar: { visible: false }` on the entry hides the gutter arrows and disables
      swipe, via the existing mechanism — no new nav-hiding code.
- [ ] The choreography effect is gated on `isCurrent`, not mount — verified by a test that
      mounts the component as a non-current peeked slot and confirms no timers fire.
- [ ] Arrival sequence runs once per `isCurrent` transition to `true`, in the order and
      offsets given, ~2.4s total under normal motion.
- [ ] Confetti fires once per arrival (not on mount, not looping) via `ConfettiEffect`,
      unchanged.
- [ ] Progress bar is set to the real stops-completed fraction on arrival, then
      transitions to 100% over the `animateMs` window ~500ms later — verified against
      the actual `formStatusByIndex`/`skippedIndices` state, not a hardcoded fraction.
- [ ] The ✓ badge settles off-square (residual `rotate(-1.5deg)` retained after the
      stamp animation).
- [ ] Ken Burns runs on a promoted compositor layer (`translateZ(0)`/`will-change`) with
      no visible jitter, or the `.play` class is simply never added.
- [ ] `StoryStats` gains `count_up` visibility and `staggerMs` without changing any
      existing storyline usage's rendered output (regression check on current
      `visibility: "visible"`/`"click_to_reveal"` items).
- [ ] Stats show stops-completed (submitted-or-skipped / total), photos-taken (or `"—"`
      when local storage is disabled), and time-on-foot (string, never animated).
- [ ] Primary action is a real external link to `registration.url`; secondary links to
      `/${project}/${city}/results_download`.
- [ ] Under `prefers-reduced-motion: reduce`, everything renders in its final state
      immediately and confetti never mounts.

## Out of scope

The landing page's own redesign (Corrections/original draft both flag the illustrated
style as shared with the landing page — not resolved here, since the hero photo decision
only covers this screen); an interactive registration check beyond a link (Decision #1);
removing or rewiring `007_splash_completion.yaml` / `008_options_end_of_hunt.yaml` from
`routes.yaml` (the user is wiring the new entry in themselves); admin-editor support for
authoring the `completion` template-type (matches the existing gap for text/splash/
options); per-stop badge collection; sharing/social features; a cross-visit "don't replay
confetti" mechanism (Corrections #6 — no such mechanism exists anywhere in this codebase
today, and there's no evidence a team re-visiting this screen finds a second confetti
burst annoying enough to justify building one).

## Reference

A standalone HTML mockup (`completion-screen-choreographed.html`) was reviewed inline in
this conversation for structure, CSS values, and timing — its class-toggle sequencing
(`.reveal`/`.reveal.in`, `.badge.in`, `.progress.done`, `.hero.play`) maps directly onto
the `$state`-boolean approach in "Choreography mechanism" above. It is vanilla HTML/CSS/JS
(not Svelte) and its placeholder JPEG is discarded in favor of the already-decided
`lange-vijverberg.jpg` — no code from it is carried over verbatim, and the file itself
isn't persisted into this repo (it's a large single-file mockup with an embedded base64
image, not something future sessions need to re-read; the timing table and CSS values it
confirmed are already captured above).

This spec is ready to hand to `superpowers:writing-plans` for a bite-sized implementation
plan.
