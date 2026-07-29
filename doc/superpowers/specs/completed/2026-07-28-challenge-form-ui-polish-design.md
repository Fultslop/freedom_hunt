# Challenge & Form Screen UI Polish — Design

**Date:** 28/07/2026
**Status:** Ready for planning (revises an external v0.1 draft, pasted into this conversation from claude.ai, against this repo's actual stack and current component state; scope decisions below are confirmed)

## Problem

The external draft (`P0.1`–`P2` below) reviews the lower half of a stop
screen — challenge text, photo upload, form fields, submit button, section
dividers — and finds two root causes behind five symptoms: no content
measure (text/inputs run full viewport width) and no visible boundaries on
interactive surfaces (inputs and the upload tile read as decorative, not
functional). It also proposes a local-storage draft-autosave feature.

**That feature already exists** — `src/utils/formStorage.ts`
(`buildFormStorageKey`/`loadFormState`/`saveFormState`), wired into
`ChallengeForm.svelte`'s `persist()` and gated by the
`store_forms_in_local_storage` project YAML setting. It's out of scope for
this spec; nothing below touches it.

## Corrections to the original draft

The original draft is written as if reviewing an unfamiliar app from
screenshots. Checked against the actual components, several of its "Now"
descriptions are wrong, already fixed, or measurably worse than stated:

1. **P1.2's "no border" claim is false.** `.af-input`/`.af-textarea`
   ([AppForm.css:85-98](../../../src/components/AppForm.css#L85-L98)) already
   have `border: 1px solid var(--color-border)`. The real defect is contrast,
   not absence — see P1.2 below for measured ratios. The fix is a token
   *value* change (plus splitting a reused token), not adding a missing
   border.
2. **P1.1's photo tile is not the pale-checkmark-square being described —
   it was already redesigned three commits ago today** (see
   [2026-07-28-photo-preview-tile-design.md](2026-07-28-photo-preview-tile-design.md),
   `AppForm.svelte`'s `field.type === "photo"` branch,
   `.af-photo-tile` in [AppForm.css:128-166](../../../src/components/AppForm.css#L128-L166)).
   Current states: idle (gray tile, `Image` icon, solid 1px border, 112×112px),
   uploading (dimmed + spinner), success (actual photo preview fills the
   tile, or a `Check`-icon fallback if preview generation failed), error
   (text below the tile, no distinct border treatment). This is a real gap
   from what P1.1 below asks for (dashed empty state, in-tile label text,
   larger uploaded size, explicit Replace/Remove, error border + Retry
   button) — but it's an *extension* of a change made hours ago, not a
   greenfield build. Flag any redesign here to whoever owns that spec so the
   two don't diverge.
3. **P2's "60–80px per divider" estimate doesn't match the code.** The
   flag-glyph divider itself
   ([ChallengeForm.css:3-8](../../../src/components/ChallengeForm.css#L3-L8))
   is `margin: 20px 0` — modest. The actual vertical bulk comes from
   `.cc-section` padding (16px + 1px border, repeated per section,
   [ChallengeCard.css:104-111](../../../src/components/ChallengeCard.css#L104-L111)),
   `.cc-challenge-box` margin-top (14px), `.af-field` margin-bottom (12px
   per field, [AppForm.css:3-5](../../../src/components/AppForm.css#L3-L5)),
   and `.af-section-heading` margin-top (20px). P2's fix needs to touch
   `ChallengeCard.css` and `AppForm.css`, not just the divider markup in
   `ChallengeForm.svelte`.
4. **P1.2's textarea fix is a one-line data change, not a component
   change.** `textarea` is already a supported `FormFieldType`
   ([types/data.ts:3-14](../../../src/types/data.ts#L3-L14)) with its own
   render branch and `.af-textarea` styling (`min-height: 80px`,
   `resize: vertical`,
   [AppForm.css:105-108](../../../src/components/AppForm.css#L105-L108)).
   The named field —
   `source_of_fear` in
   [001_form_abc.yaml:14-17](../../../src/data/text/en/projects/democrats_abroad/den_haag/001_form_abc.yaml#L14-L17) —
   just has `type: string` where it should have `type: textarea`. No
   component work needed; "auto-growing" is not currently supported
   (`resize: vertical` is manual). **Decided: manual resize is sufficient**
   — no auto-grow JS is in scope for this pass.
5. **P0.1's content-measure gap is real, but the target width needs to
   match the rest of the app, not import a new one.** Every other page
   (`AppPage.css`, `CityPage.css`, `ProjectPage.css`, `LoginPage.css`, etc.)
   already caps at `max-width: 480px` — it's the de facto app-wide
   convention, just never expressed as a token. `RoutePage.svelte`'s
   swipeable card stack, and everything inside it
   (`ChallengeCard`/`ChallengeForm`/`AppForm`), currently has **no**
   max-width at all — confirmed via `RoutePage.css`, which sets `width:
   100vw` on the scroll strip and nothing narrower per-card. That's the
   actual bug: one screen in an otherwise-consistent 480px-capped app has no
   cap. The original draft's `--content-max: 44rem` (~704px) would make
   this screen *wider* than every other screen in the app, not consistent
   with it. **Decided: `--content-max: 480px`**, matching the app-wide
   convention, not 44rem.
6. **The example location currently open in the IDE doesn't exercise this
   screen normally.** `004_lange_voorhout.yaml`'s
   `challenge.form: "004_form_lange_voorhout.yaml"` points at a file shaped
   like a `stats` storyline block (`prompt`/`footnote`/`items`), not a
   `FormField[]` array — it has no working photo/form block today. Use
   `001_loc_binnenhof.yaml` / `001_form_binnenhof.yaml` or
   `001_loc_abc.yaml` / `001_form_abc.yaml` as the real reference/test
   fixture for this spec, not 004.

Everything else in the original draft — the four-item structure, the intent
given first with the treatment as a reference implementation, the
accessibility floor, the acceptance criteria shape — holds up and is kept.

---

## P0.1 — Introduce a content measure

**Intent (unchanged):** comfortable line length at any viewport width, one
column on phone and desktop alike.

**Grounded fix:**

```css
/* src/styles/tokens.css, :root — net new, no existing --content-max */
--content-max: 480px;
--content-pad-sm: 1rem;
--content-pad-lg: 1.5rem;
```

- Apply to `RoutePage`'s card content (`ChallengeCard` + everything it
  renders, including `ChallengeForm`/`AppForm`) via `max-width:
  var(--content-max); margin-inline: auto;` — this is the one place in the
  app currently missing the cap every other page already has.
- **Full-bleed exceptions** (per original draft, still correct): the hero
  image (`PhotoHero.svelte`) and the navy app header/bar only.
- The map (inside `ChallengeCard`'s Location section) goes inside the
  column — same as original draft, no separate width rule for it.
- Do not build a desktop multi-column layout — out of scope, matches the
  original draft's reasoning (would triple design surface across 3 themes
  for a secondary platform).

**Done when:** `ChallengeCard`/`ChallengeForm`/`AppForm` content is capped
at 480px like every other page, and the phone layout (already ≤480px on any
real device) is visually unchanged.

## P0.2 — Fix the submit button

**Intent (unchanged):** label describes the action, state/status describe
the situation.

**Grounded current state** — closer to the target than the original draft
implies: `.af-submit-btn` ([AppForm.svelte:619-632](../../../src/components/AppForm.svelte#L619-L632))
already computes `disabled={submitState === "submitting" || !hasChanges}`
and swaps label between `"Submitting…"` / `"No changes"` / `"Try again"` /
`submitLabel`. What's missing relative to the target table:

| Form state | Label today | Gap |
|---|---|---|
| Empty, never saved | "No changes" | matches target's disabled/quiet row in *behavior* (disabled), but no visual "quiet" style exists — `:disabled` has no CSS rule at all, so it renders as the browser default on top of `.af-submit-btn`'s full accent fill. |
| Dirty | `submitLabel` (e.g. "Submit") | already gets the accent fill (default button style) — but so does every other state via the same class, so dirty isn't visually distinct from idle/disabled. |
| Saving | "Submitting…" | class `.af-submit-btn--submitting` already exists ([AppForm.css:196-200](../../../src/components/AppForm.css#L196-L200)), no spinner. |
| Just saved | n/a | no "Saved ✓" transient state exists; `hasSubmittedOnce` flips `submitLabel` to "Re-submit" instead ([ChallengeForm.svelte:121](../../../src/components/ChallengeForm.svelte#L121)). |
| Saved, no edits | "No changes" | label already correct; no separate status line exists anywhere in `AppForm.svelte`. |

**Fix:**
- Add a `.af-submit-btn:disabled` rule (quiet: `background: var(--color-surface); color: var(--color-text-muted);` — reuses the existing `--submitting` treatment rather than inventing a third gray).
- Add the accent fill only via `:not(:disabled)` (or an explicit `.af-submit-btn--dirty` class) so it's not the default — currently the base class *is* the accent fill and disabled has no override in CSS.
- Add a status paragraph in the field list area (`.af-status-line` or similar), sourced from the same `hasChanges`/`submitState` logic already in `AppForm.svelte`: "Unsaved changes" (dirty) / "All answers saved" (`!hasChanges && hasSubmittedOnce`) / nothing otherwise.
- Constrain button width to the P0.1 content column — already implicit once `AppForm` sits inside the capped column; no separate change needed.
- **Decided: "Saved ✓" is in scope.** `submitState` ([AppForm.svelte](../../../src/components/AppForm.svelte), currently `$state<"idle" | "submitting" | "error">`) gains a fourth value, `"saved"`:
  - On `handleSuccess` (after `onSubmit` resolves), set `submitState = "saved"` instead of leaving it `"idle"`.
  - Start a `setTimeout(() => { submitState = "idle"; }, 3000)` alongside that assignment; clear any prior pending timeout first so rapid submits don't race.
  - Button label: `submitState === "saved" ? "Saved ✓" : ...` inserted ahead of the existing `!hasChanges` branch in the label ternary ([AppForm.svelte:625-631](../../../src/components/AppForm.svelte#L625-L631)).
  - New `.af-submit-btn--saved` class (success-token treatment, e.g. `background: var(--color-success)`), `disabled` stays true for this state (matches the target table: "primary, disabled" while saved).
  - This is genuinely new logic (state value + timer), not a restyle of existing states — size the implementation task accordingly.

## P1.1 — Extend the photo upload control

**Intent (unchanged):** at a glance, tappable, and current attachment state
is legible.

**Baseline:** the 112px `.af-photo-tile` from today's photo-preview-tile
redesign (see Correction 2). Already has: idle placeholder (icon, solid
border), uploading (dim + spinner), success (photo fill or check-fallback),
error (text below, no border change). Already uses `capture="environment"`
on the file input (per
[2026-07-28-photo-preview-tile-design.md](2026-07-28-photo-preview-tile-design.md),
confirmed present in `AppForm.svelte`).

**Remaining gaps against the original draft's four-state ask:**
- **Empty:** solid border → should be dashed; add in-tile label text
  ("Add a photo" + "Take one now, or choose a file") — tile is currently
  icon-only, 112×112, meets the 44×44 minimum tap target already but not
  the "96px tall with label" treatment.
- **Uploaded:** currently the *same* 112px tile as empty/uploading. Original
  draft wants a distinctly larger, non-square-constrained size (~160px
  desktop / comfortable mobile card width) plus explicit **Replace** and
  **Remove** buttons — today, tapping the filled tile just reopens the file
  picker (implicit replace).
  **Decided: Remove is in scope.** Plumbing needed:
  - `AppForm.svelte`: a `removePhoto(fieldId)` handler that clears
    `uploadStates[fieldId]` (delete the key, not just reset to idle) and
    fires the existing `onUploadsChange` callback with the updated map —
    same call site pattern as `handleFileChange`'s existing
    `onUploadsChange` invocation.
  - No new prop needed on `ChallengeForm.svelte` — it already forwards
    `uploadStates` changes through `handleUploadsChange` →
    `persist()` → `saveFormState()` unchanged, so a field disappearing from
    the map persists correctly through the existing pipeline.
  - Server-side: confirm whether Remove should also call a delete endpoint
    for the uploaded file, or just clear local/client state and leave the
    server copy orphaned (matches how re-upload already works today — a
    fresh upload doesn't delete the previous server file either). Recommend
    matching existing behavior (client-state-only) unless told otherwise,
    to avoid adding new server-side scope to a client-focused spec.
- **Error:** currently no border change, no explicit Retry button — just
  the existing "Upload failed. Try again." text below the tile, and tapping
  the tile again re-triggers the file picker. Needs an `--error` border
  variant plus (if adopting a distinct Retry affordance) more than a label
  change, since today's error recovery *is* "tap the tile again."
- Corner success badge over the thumbnail: net new, no current equivalent
  (today's photo success state is just the thumbnail, full stop).

**Net-new engineering, not restyling:** the Remove action (clearing
persisted `PhotoUploadStatus` for one field), the corner badge overlay, and
whatever "Retry" ends up meaning beyond today's tap-to-reselect.

## P1.2 — Field boundary contrast (not absence)

**Intent (unchanged):** every input unambiguously a field, ≥3:1 boundary
contrast per WCAG 1.4.11, in all 3 themes.

**Measured, not assumed** — computed WCAG relative-luminance contrast of
each theme's current `--color-border` against its `--color-background`
(both from [tokens.css](../../../src/styles/tokens.css)):

| Theme | `--color-border` | `--color-background` | Contrast ratio | Passes 3:1? |
|---|---|---|---|---|
| wireframe (default) | `#dddddd` | `#ffffff` | ~1.37:1 | No |
| app | `#334155` | `#0f172a` | ~1.72:1 | No |
| GWC | `#e5e7eb` | `#ffffff` | ~1.24:1 | No |

All three fail today, some badly. This confirms the original draft's WCAG
1.4.11 complaint even though a 1px border already exists structurally
(Correction 1) — the defect is purely a color-value problem.

**Fix — introduce a dedicated token rather than darkening `--color-border`
globally.** `--color-border` is reused well beyond form fields — section
dividers (`.cc-section`), the app bar (`--color-bar-border`), the confirm
dialog, etc. — where a hairline doesn't need 3:1 (WCAG 1.4.11 only applies
to UI-component boundaries, not decorative separators) and darkening it
everywhere would be a bigger, unrelated visual change.

```css
/* tokens.css — net new, per theme */

/* :root (wireframe) — #dddddd only reaches ~1.37:1; #aaaaaa (--color-text-muted)
   only reaches ~2.32:1, still fails. #8a8a8a is a genuinely new value. */
--field-border: #8a8a8a;        /* ~3.45:1 vs #ffffff */
--field-border-focus: var(--color-accent);
--field-radius: 4px;            /* matches existing .af-input radius */
--field-min-height: 2.75rem;    /* 44px — .af-input is already ~36px effective height (8px+8px padding + line-height), currently under this */

/* :root[data-theme="app"] — reuses the existing --color-text-muted value,
   no new hex needed */
--field-border: #64748b;        /* ~3.76:1 vs #0f172a */

/* :root[data-theme="GWC"] — also reuses the existing --color-text-muted value */
--field-border: #6b7280;        /* ~4.83:1 vs #ffffff */
```

- Point `.af-input`/`.af-textarea`/`.af-photo-tile` (idle border) at
  `--field-border` instead of `--color-border`
  ([AppForm.css:90](../../../src/components/AppForm.css#L90),
  [AppForm.css:136](../../../src/components/AppForm.css#L136)).
- Existing focus behavior is border-color-only
  ([AppForm.css:99-103](../../../src/components/AppForm.css#L99-L103)) —
  add a non-color signal too (`box-shadow: 0 0 0 2px var(--field-border-focus)`
  or similar), per the original draft's colour-blind/high-contrast-mode
  requirement.
- **Decided:** per-theme `--field-border` values are the three above,
  computed via the WCAG relative-luminance formula against each theme's
  actual `--color-background` (not eyeballed). Two of the three reuse an
  existing token value (`--color-text-muted` for `app`/`GWC`) rather than
  introducing a fourth hex per theme; wireframe needed a genuinely new
  value since its own `--color-text-muted` (`#aaaaaa`) fails at ~2.32:1.
  These are a first-pass, not a final visual design pass — retune later if
  they look off against real content, as long as the replacement still
  clears 3:1.
- **Scope note:** no `<select>` exists in this codebase (`radio`/`multiple`
  field types render as native checkbox/radio groups,
  [AppForm.svelte:420-491](../../../src/components/AppForm.svelte#L420-L491)),
  which already have OS-rendered visible boundaries unaffected by this
  issue. `--field-border` only needs to apply to `.af-input`/`.af-textarea`/
  `.af-photo-tile`.
- **Textarea content fix:** change `source_of_fear`'s `type: string` to
  `type: textarea` in
  [001_form_abc.yaml:15](../../../src/data/text/en/projects/democrats_abroad/den_haag/001_form_abc.yaml#L15)
  — pure data change (Correction 4), ships independent of every other item
  in this spec.
- Label/help/input grouping gap — see P2, same token family
  (`--gap-field`).

## P2 — Section-boundary spacing rhythm

**Intent (unchanged):** boundaries legible through rhythm, not ornament.

**Grounded fix**, targeting the actual sources of vertical bulk (Correction 3):

```css
/* tokens.css — net new, no spacing scale exists anywhere in this repo today */
--gap-section: 2.5rem;
--gap-block: 1.5rem;
--gap-field: 0.375rem;
```

- Remove the `Flag` icon from `ChallengeForm.svelte`'s two divider blocks
  ([ChallengeForm.svelte:102-106,124-128](../../../src/components/ChallengeForm.svelte#L102-L128))
  — drop the `lucide-svelte` `Flag` import too once unused.
- Replace `.cf-divider`'s `margin: 20px 0` and `.cc-section`'s `padding:
  16px` / `.cc-challenge-box`'s `margin-top: 14px` / `.af-field`'s
  `margin-bottom: 12px` / `.af-section-heading`'s `margin-top: 20px` with
  the two section/block tokens, applied consistently — this spans
  `ChallengeForm.css`, `ChallengeCard.css`, and `AppForm.css`, not just the
  divider.
- Keep a hairline only where ambiguous (e.g. `.cc-section`'s
  `border-bottom` between Storyline/Location/Challenge could likely go once
  spacing alone carries the boundary — judgment call per section, not a
  blanket removal).
- **Cross-cutting per original draft:** apply the same `--gap-section`/
  `--gap-block` tokens to the storyline blocks
  (`doc/superpowers/specs/2026-07-27-storyline-blocks-design.md`) in the
  same pass, since no spacing tokens exist anywhere yet and this is the
  first place introducing them — do it once, not twice.

**Done when:** all divider glyphs removed, `ChallengeCard`/`ChallengeForm`/
`AppForm`/storyline blocks share one spacing-token vocabulary, and the
combined stop screen is measurably shorter on a phone.

---

## Accessibility floor (unchanged from original draft, all currently unmet)

- Upload control and submit are already real `<button>`/`<input>` elements
  — this part is already satisfied.
- Every `.af-input`/`.af-textarea` already has an associated `<label>` —
  verify `aria-describedby` linking to `subtext`/error text is present for
  all field types, not just spot-checked ones.
- **No `aria-live` region exists anywhere in `AppForm.svelte` today** —
  `Saving…`/`Saved ✓`/the new status line (P0.2) need one; currently state
  changes are visual-only.
- Focus-visible: currently color-only (P1.2) — fails "not colour alone" in
  all 3 themes today, not just some.
- Upload errors are shown as text but not in a live region — same gap as
  submit-state announcements.

## Acceptance criteria

- [ ] `ChallengeCard`/`ChallengeForm`/`AppForm` content capped at
      `--content-max` (480px, matching the rest of the app); phone layout
      (already ≤480px) unchanged.
- [ ] Hero image and app header remain the only full-bleed elements.
- [ ] `.af-submit-btn` carries the accent fill only when `hasChanges` is
      true; a `:disabled` quiet style exists and is used for both
      never-saved and no-changes-since-save states; "No changes" is no
      longer the disabled label users read as the primary signal — a status
      line carries that instead.
- [ ] Status line reflects `hasChanges`/`hasSubmittedOnce` state ("Unsaved
      changes" / "All answers saved").
- [ ] On successful submit, the button shows "Saved ✓" (success treatment,
      disabled) for 3 seconds before reverting to its resting state.
- [ ] `.af-photo-tile` idle state has a dashed border, camera icon, and
      in-tile label text; a bare checkmark is never its sole content.
- [ ] Uploaded photo renders larger than 112px with explicit Replace and
      Remove actions (Remove requires new plumbing to clear persisted
      `PhotoUploadStatus`).
- [ ] `--field-border` (new token, distinct from `--color-border`) meets
      3:1 against `--color-background` in all 3 themes — verified by
      contrast calculation, not eyeballed, per the ratios table above.
- [ ] Focus state on `.af-input`/`.af-textarea`/`.af-photo-tile` includes a
      non-color signal (box-shadow or outline), not border-color alone.
- [ ] `source_of_fear` field (`001_form_abc.yaml`) is `type: textarea`.
- [ ] All `Flag`-icon dividers removed; `--gap-section`/`--gap-block`/
      `--gap-field` applied across `ChallengeCard.css`, `ChallengeForm.css`,
      `AppForm.css`, and the storyline blocks.
- [ ] Photo control still opens the camera directly on phone
      (`capture="environment"` — already present, don't regress it).
- [ ] `aria-live` region added for submit-state and upload-error
      announcements (net new — none exists today).
- [ ] `createPhotoPreview` never performs an uncapped decode, regardless of
      whether `normalizePhotoForUpload` succeeded or fell back to the raw
      file (F1) — unit-tested via the capped-decode assertion pattern from
      `photoUpload.test.ts`.
- [ ] `004_form_lange_voorhout.yaml` either holds a real `FormField[]` array
      or `004_lange_voorhout.yaml`'s `challenge.form` no longer points at a
      stats-shaped file (F2).
- [ ] `--field-min-height` (P1.2) and `--gap-field`/`--gap-block` (P2) are
      implemented and visually tuned together, not as separate passes (F3).

## Out of scope

Desktop-specific layouts; storyline block vocabulary/syntax changes beyond
applying the new spacing tokens; the clue block's styling; form schema
changes beyond the single textarea fix; local-storage draft autosave
(already implemented); the photo-preview-tile spec's own scope beyond what
P1.1 explicitly extends.

## Findings from a second review pass

This spec was itself sent out for review (to claude.ai) once drafted. Two of
its corrections surfaced real, separate issues worth folding into the
implementation plan — verified against the current code, not taken at face
value:

### F1 — Photo preview generation has an unguarded decode (real bug, unrelated to styling)

The reviewer's read of Correction 2 — that the Check-icon fallback might not
be a stale-design artifact but an intermittent live failure — checks out.
`createPhotoPreview()` ([photoPreview.ts:5](../../../src/utils/photoPreview.ts#L5))
calls `createImageBitmap(file)` with **no resize options**, an uncapped
full-resolution decode. Its sibling, `normalizePhotoForUpload()`
([photoUpload.ts:27-39](../../../src/utils/photoUpload.ts#L27-L39)), decodes
the exact same class of input (raw phone camera photos, commonly 12-48MP,
sometimes HEIC) but always caps the decode at 2048px via a two-pass
`resizeWidth`/`resizeHeight` — specifically because an uncapped decode of a
real camera photo is a known OOM/decode-failure vector in this codebase
(see today's `[FIX] Real phone camera photos crashed the tab mid-upload`
devlog entry, which fixed exactly this pattern for the upload path only).

The two paths are wired together in
[AppForm.svelte:225-229](../../../src/components/AppForm.svelte#L225-L229):

```ts
const uploadFile = await normalizePhotoForUpload(file).catch(() => file);
const [uploadResult, previewResult] = await Promise.allSettled([
  onPhotoUpload(uploadFile),
  createPhotoPreview(uploadFile),
]);
```

When `normalizePhotoForUpload` succeeds, `createPhotoPreview` receives an
already-capped 2048px-max JPEG — fine. When it *fails* (some HEIC variant
`createImageBitmap` won't decode, an encoding error, etc.), `.catch(() =>
file)` falls back to the **original raw file**, and `createPhotoPreview`
then attempts the same uncapped decode on the same problem input —
compounding rather than isolating the failure. `Promise.allSettled` catches
the rejection gracefully, so the upload can still succeed (`postPhotoUpload`
just sends bytes, no client-side decode) while the preview silently fails,
leaving `previewDataUrl` undefined and the tile showing the `Check`-icon
fallback instead of the actual photo — matching the reported symptom
(intermittent, same stop, upload succeeded either way) exactly. Confirmed by
reading current source, not assumed: neither `photoPreview.ts` nor
`photoPreview.test.ts` has any resize/cap logic or test coverage for one,
unlike `photoUpload.ts`/`photoUpload.test.ts`.

**Fix (root cause, not styling):** give `createPhotoPreview` its own capped
decode, independent of whether upload-side normalization succeeded —
mirroring `normalizePhotoForUpload`'s proven two-pass
`resizeWidth`/then-`resizeHeight`-if-still-over-cap pattern, at a smaller
cap appropriate for a 200×200 output (e.g. 800px long edge — plenty of
headroom for the center-crop, far cheaper than a full-resolution decode).
This decouples preview safety from the upload-normalization fallback
entirely, so a photo that fails one no longer double-fails the other.

This is a **separate, unrelated-to-styling bug fix** — treat it as its own
task in the implementation plan, not folded into P1.1's styling changes.
Since it can't be reproduced in this environment (device/format-dependent,
and per project policy no browser automation is used here — verification is
manual, by the user, on a real phone), the plan should include a unit test
mirroring `photoUpload.test.ts`'s capped-decode tests (asserting
`createImageBitmap` is always called with `resizeWidth`/`resizeHeight`,
never bare) as the automated proof, with real-device confirmation left to
the user.

### F2 — `004_form_lange_voorhout.yaml` content mismatch (Correction 6, now traced to its source)

Confirmed root cause: `004_lange_voorhout.yaml`'s `challenge.form` points at
`004_form_lange_voorhout.yaml`, which is shaped like a `stats` storyline
block (`prompt`/`footnote`/`items`) rather than a `FormField[]` array — this
location has no working form/photo block today. Fix at the content level
(either give it a real `FormField[]` array matching the sibling
`00N_form_*.yaml` shape, or point `challenge.form` elsewhere / remove it, per
what the Lange Voorhout stop actually needs — a content decision, not a code
one). Also worth a CI-level guard: `scripts/validate-yaml.js` (Layer 3 per
`doc/architecture.md`) currently validates YAML shape but evidently doesn't
catch a `form:` target that parses as some *other* known shape
(`stats`-block fields) instead of `FormField[]` — add a check that rejects
that specific confusion at validation time, not just missing/malformed
fields.

### F3 — Sequencing: field height and spacing tokens touch the same rhythm

`--field-min-height: 2.75rem` (P1.2) raises `.af-input`'s effective height
from ~36px to 44px. `--gap-field`/`--gap-block` (P2) retune the vertical
rhythm around those same inputs. Doing these in separate implementation
tasks means tuning the same visual spacing twice — sequence P1.2's height
change and P2's spacing tokens as one implementation task (or immediately
back-to-back with the same visual check), not as independently-planned,
independently-reviewed items.

## Decisions

All scope questions raised while drafting this spec are resolved:

1. **`--content-max`: 480px**, matching the rest of the app (not the
   original draft's 44rem/704px) — Correction 5.
2. **"Saved ✓" transient state: in scope.** New `submitState === "saved"`
   value plus a 3s revert timer — see P0.2.
3. **Photo Remove action: in scope.** New `removePhoto(fieldId)` handler in
   `AppForm.svelte`, no new prop needed on `ChallengeForm.svelte` — see
   P1.1. Server-side delete is explicitly *not* in scope (matches existing
   re-upload behavior, which also doesn't clean up the previous file).
4. **Auto-growing textarea: not in scope.** `resize: vertical` (already
   present) is sufficient; only the `type: textarea` data fix ships.
5. **Per-theme `--field-border` values: set** (wireframe `#8a8a8a`, app
   `#64748b`, GWC `#6b7280`) — computed to individually clear 3:1 against
   each theme's `--color-background`, see P1.2. First-pass values, safe to
   retune visually later as long as 3:1 is preserved.

This spec is ready to hand to `superpowers:writing-plans` for a bite-sized
implementation plan.
