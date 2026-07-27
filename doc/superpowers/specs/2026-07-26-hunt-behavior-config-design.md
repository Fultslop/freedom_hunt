# Hunt Behavior Config — Design Spec

**Date:** 2026-07-26
**Status:** Approved

## Overview

Add four project-level config flags that drive form/navigation behavior during a hunt: local persistence of in-progress form answers, whether a form must be completed before advancing, whether an incomplete form can be explicitly skipped, and whether a participant can resubmit answers. Today none of this exists — `ChallengeForm` submits once and permanently hides itself, `RoutePage`'s Next button/swipe is never gated on form state, and no form data survives a reload.

**Scope:** Frontend only. No backend/schema changes — resubmission still appends new rows to `form_submissions` / the Google Sheet rather than updating in place; that's an accepted limitation, not addressed here.

---

## Config Schema

Four optional fields on `<projectId>.yaml` (`ProjectMeta`), each with a default so existing project YAMLs need no changes:

```yaml
project.store_forms_in_local_storage: true   # default true
project.form_required: false                  # default false
project.can_forms_skip: false                 # default false
project.allow_resubmit: true                  # default true
```

`ProjectMeta` stays `Record<string, unknown>` (existing free-form convention). A new `getHuntSettings(meta: ProjectMeta): HuntSettings` helper in `src/utils/huntSettings.ts` centralizes the defaulting logic so every consumer reads consistent values instead of duplicating `?? true` / `?? false` checks.

```ts
interface HuntSettings {
  storeFormsInLocalStorage: boolean;
  formRequired: boolean;
  canFormsSkip: boolean;
  allowResubmit: boolean;
}
```

`RoutePage.svelte` loads `<project>.yaml` via `loadText` (same pattern already used by `GalleryLandingPage` for `organizer_url`) and derives `HuntSettings` once per route load.

---

## Local Storage Persistence (`store_forms_in_local_storage`)

One storage key per location, following the existing `RoutePage` convention for the visited-index key (`${project}/${city}/${route}`):

```
key:   ${project}/${city}/${route}/${locationId}/form
value: FormState = {
  values: Record<string, unknown>;             // AppForm field values, keyed by field id
  uploads: Record<string, PhotoUploadStatus>;   // photo fields only, keyed by field id
  submitted: boolean;                            // last full form POST succeeded
  skipped: boolean;                              // user hit Skip on the incomplete-form toast
}

interface PhotoUploadStatus {
  status: "success" | "error";
  httpCode: number;
}
```

Behavior:

- Only **photo**-type fields get a `PhotoUploadStatus` entry, since they're the only field type that uploads independently (via `AppForm`'s `onPhotoUpload`) ahead of the main form submit. All other field types round-trip through `values` only.
- The actual photo file is never persisted — only the outcome of the last upload attempt. On restore, a `"success"` entry redraws the green check without re-uploading; an `"error"` entry redraws the failed-upload icon and the user can retake/re-select to retry.
- Written on every `values`/upload-status change (plain `localStorage.setItem`, same cost model as the existing `currentIndex` write — no debouncing needed).
- **Kept indefinitely**, not cleared on submit — revisiting a location later still shows what was answered/uploaded/submitted. This is also required for `allow_resubmit`'s "no changes yet" baseline (see below).
- When `store_forms_in_local_storage` is `false`, none of this is written or read. Every reload starts every location's form blank, in-memory only — combined with `form_required`, a reload will re-block Next until the form is resubmitted for the current session.

---

## Form-Required Gating (`form_required`, `can_forms_skip`)

### Data flow

**Bottom-up (status reporting):**

1. `AppForm` gains `onStatusChange?: (status: { satisfied: boolean; missingLabels: string[] }) => void`, fired whenever `values`/`errors` change. `missingLabels` is the current `validateValues()` result mapped to field labels — the same list rendered in the toast.
2. `ChallengeForm` forwards this via `onFormStatusChange`, and additionally reports `satisfied = true` when the user has hit Skip (see below) or when there's no form to fill.
3. `ChallengeCard` forwards further via `onFormStatusChange?: (locationId, status) => void`.
4. `RoutePage` keeps `formStatus: Record<number, { satisfied: boolean }>` keyed by location index, so swiping back to a previously-unsatisfied location still reflects its own state correctly (not just "the current one").

**Top-down (gating):**

- `canAdvance = !formRequired || (formStatus[currentIndex]?.satisfied ?? true)` (locations without a form, or when `form_required` is off, are always satisfied; a location not yet reported by `ChallengeCard` defaults to satisfied so navigation isn't blocked before the form has mounted).
- `RoutePage`'s Next button and swipe-forward handlers are **never** given the `disabled` attribute — a hard-disabled button cannot fire a click, which would make the Skip option unreachable. Instead:
  - When `!canAdvance`, the Next button gets a `route-page__next-btn--pending` modifier class: outline/ghost style instead of solid fill, plus a small pending-indicator dot. This is a "soft-disabled" convention — visually distinct from "ready," but still fully clickable.
  - Clicking Next (or completing a swipe-forward gesture) while `!canAdvance` shows the toast instead of advancing, in both swipe modes (`snap` and drag `strip`).
  - Once `canAdvance` becomes true, the button reverts to its normal solid style and advances normally.

### Toast

New component: `src/components/Toast.svelte` + `.css`. Fixed-position banner (bottom of screen), auto-dismiss after ~4s or manual close.

- Message: `Please complete: {missingLabels.join(", ")}`.
- If `can_forms_skip` is true, an additional **Skip** button is shown. Clicking it sets `skipped = true` for the current location (persisted per the storage schema above, when `store_forms_in_local_storage` is on — otherwise in-memory for the session only) and immediately advances.
- If `can_forms_skip` is false, no Skip button — the toast is purely informational, and the user must complete the form to proceed.

### Required photo fields

Today, `AppForm.canSkipValidation` exempts `photo` (and `boolean`) fields from required-field validation entirely — a required photo can be left empty with no error. This is fixed as part of this work: a required `photo` field now must have `PhotoUploadStatus.status === "success"` to count as filled. Without this fix, `form_required` would be meaningless for the (common) case of a photo-only challenge.

This requires an accompanying fix: `AppForm` currently tracks upload state as a single shared `uploadState`/`fileInput` pair for the *entire form*, not per field — so a form with two photo fields today has one upload indicator and one file input shared between them. This is fixed to be keyed by field id (`uploadStates: Record<string, UploadState>`), which is necessary anyway to know *which* required photo is missing and to persist/restore per-field status.

---

## Completion Marker

So that swiping/navigating back through the route shows at a glance which locations have a completed form, `ChallengeCard`'s existing numbered badge (`cc-badge`) gains a small status overlay rather than a new standalone floating element.

`cc-badge`'s background already comes from `location.themeColor ?? theme.accent` — a per-location color from the data — so the marker must not repurpose that color. Instead, a small circular overlay (~20px) sits on the badge's top-right corner:

| Status | Marker |
|---|---|
| Form submitted successfully | Green (`--color-success`) circle with a checkmark icon |
| Form skipped (via the `can_forms_skip` toast) | Grey/neutral circle with a dash icon |
| No form, or form not yet attempted | No overlay |

This reuses the same per-location `formStatus` (`satisfied`/`submitted`/`skipped`) that `RoutePage` already computes for the Next-button gating — `ChallengeCard` just needs the resolved status passed back down (or read directly from local storage/`FormState`, whichever proves cleaner during implementation) to decide which overlay, if any, to render. Uses `Check` and `Minus` from `lucide-svelte` (already the icon library in use throughout `ChallengeCard`).

---

## Resubmission (`allow_resubmit`)

- `ChallengeForm` no longer permanently replaces the form with a static "Submitted! ✓" message on first success.
- It tracks `hasSubmittedOnce` (restored from the persisted `submitted` flag, when local storage is enabled) and passes `submitLabel={hasSubmittedOnce ? "Re-submit" : "Submit"}` to `AppForm`.
- After a successful submit, `ChallengeForm` updates the `baseValues` it passes to `AppForm` to the just-submitted values. `AppForm`'s existing `hasChanges` derivation (already used elsewhere, e.g. the editor form) then naturally disables the button with "No changes" until the user edits a field again, at which point it flips to "Re-submit".
- If `allow_resubmit` is `false`: unchanged from today — the form is replaced by a static "Submitted! ✓" message, no further edits possible.
- **Known limitation, accepted for now:** the backend does not dedupe or update in place. Each resubmit is a new row in `form_submissions` (or a new Google Sheet append) — resubmission looks like duplicate rows to whoever consumes that data, not an overwrite. Out of scope for this spec.

---

## Files Changed

| File | Change |
|---|---|
| `src/utils/huntSettings.ts` | New — `getHuntSettings()` + `HuntSettings` type |
| `src/utils/formStorage.ts` | New — `buildFormStorageKey()`, `loadFormState()`, `saveFormState()` |
| `src/components/Toast.svelte` / `.css` | New — banner with message + optional Skip action |
| `src/types/data.ts` | Add `HuntSettings`, `FormState`, `PhotoUploadStatus` |
| `src/components/AppForm.svelte` | Per-field upload state (fixes shared-state bug); required-photo validation; `onStatusChange` callback |
| `src/components/ChallengeForm.svelte` | Local storage read/write; `submitLabel`/resubmit logic; forwards status up |
| `src/components/ChallengeCard.svelte` | Threads `onFormStatusChange` through; renders completion/skipped overlay on `cc-badge` |
| `src/components/ChallengeCard.css` | New badge-overlay styles (submitted/skipped circles) |
| `src/pages/RoutePage.svelte` | Loads project settings; `canAdvance` computation; soft-disabled Next button; swipe-forward interception; renders `Toast` |
| `src/pages/RoutePage.css` | New `--pending` button modifier (outline + indicator dot) |

---

## Testing Plan

Matches existing Vitest + Testing Library conventions:

- `huntSettings.test.ts` — default values, explicit overrides.
- `formStorage.test.ts` — round-trip read/write, key structure.
- `AppForm.test.ts` — required-photo validation (blocks until upload success), per-field upload state isolation (two photo fields don't share state), `onStatusChange` firing with correct `missingLabels`.
- `ChallengeForm.test.ts` — resubmit label swap, `hasChanges` reset after submit, local-storage restore of prior answers/upload status/submitted flag.
- `RoutePage.test.ts` — Next button intercepted when `form_required` + unsatisfied (button click shows toast, doesn't advance); swipe-forward intercepted identically; Skip button in toast advances and persists; reload with a previously-submitted/skipped location correctly allows advancing without re-prompting.
- `ChallengeCard.test.ts` — renders submitted-checkmark overlay, skipped-dash overlay, and no overlay (no form / not attempted) on the badge; per-location themeColor on `cc-badge` itself is unaffected by status.

---

## Out of Scope

- Backend resubmission dedup/update-in-place (`form_submissions` table, Google Sheet).
- Per-city or per-route overrides of these settings (project-level only, for now).
- Non-photo per-field upload semantics — only photo fields have an independent upload step today.
