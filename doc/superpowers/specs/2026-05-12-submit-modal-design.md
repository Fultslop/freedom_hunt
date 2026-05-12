# Submit Modal — Design Spec

**Date:** 2026-05-12
**Status:** Ready for implementation

## Problem

After pressing "Submit for review" the user waits with no clear feedback and can still interact with the form. There is no escape hatch during submission, no rich status on the location list, and failures are shown inline above the form with no retry path visible from the list.

## Solution

A modal overlay on submit, combined with a richer `status` field on `PendingEntry` that exposes in-flight and failure states on the location list.

---

## 1. Data model — `PendingEntry.status`

Add an explicit `status` field to `PendingEntry` in `editorStorage.ts`:

```typescript
status: "submitting" | "pending" | "up_to_date" | "failed";
```

| Status | Meaning | Draft state |
|---|---|---|
| `"submitting"` | API call in flight | saved locally |
| `"pending"` | PR open, under review | saved locally |
| `"up_to_date"` | PR merged/closed, changes are live | cleared |
| `"failed"` | Last submission failed, local draft still exists | saved locally |

**Backwards compatibility:** existing localStorage entries without a `status` field are read as `"pending"`.

**Lifecycle writes:**

1. Submit pressed → write entry with `status: "submitting"` (and existing `prUrl` if any)
2. API succeeds → overwrite with `status: "pending"` and real `prUrl` from server
3. API fails → overwrite with `status: "failed"` (keep existing `prUrl` if any)
4. PR detected closed/merged → call `prWasClosed(namespace, filename)` → sets `"up_to_date"`, clears draft

`"up_to_date"` is the terminal success state and persists indefinitely.

**New helpers in `editorStorage.ts`:**

- `updatePendingStatus(namespace, filename, status)` — updates only the `status` field of an existing entry in-place.
- `prWasClosed(namespace, filename)` — single call-site for the PR-closed event: calls `updatePendingStatus(..., "up_to_date")` then `clearDraft(draftKey)`. All callers (`syncPending`, `checkDraftStaleness`, `handleDelete`) use this helper so draft-clearing is never forgotten.

---

## 2. New component — `SubmitModal.svelte`

Located at `src/pages/editor/SubmitModal.svelte` with co-located `SubmitModal.css`.

Rendered via portal (same pattern as `AppForm`'s confirm dialog — appended to `document.body`).

### Props

```typescript
{
  state: "submitting" | "success" | "failed";
  prTitle: string;         // "Add location: Binnenhof" or "Edit location: Binnenhof"
  isNewPr: boolean;        // true = first submit for this file, false = updating existing PR
  existingPrUrl?: string;  // known PR URL if isNewPr is false
  newPrUrl?: string;       // PR URL returned by server on success
  error?: string;          // error string shown in failure state
  onBack: () => void;      // navigates to location list
  onRetry: () => void;     // re-attempts submission
}
```

### States

**Submitting:**
- Heading: "Submitting form for review"
- Subtext (monospace, muted): `Opening PR: "<prTitle>"` if `isNewPr`, else `Updating PR #<number>` (number extracted from `existingPrUrl`)
- Progress bar: indeterminate CSS animation (sliding pulse, no real timing)
- Button: "← Back to location list" (secondary style)

**Success:**
- Heading: "Form submitted for review" (green)
- Subtext: link — `"PR #<number> opened →"` or `"PR #<number> updated →"` (using `newPrUrl`)
- Button: "← Back to location list" (primary style)

**Failed:**
- Heading: "Submission failed" (red)
- Error block: monospace box, `user-select: all` so one click selects the entire string for copy-paste
- Buttons: "← Back to list" (secondary) + "↺ Retry" (red, primary)

### Behaviour

- Backdrop covers the entire viewport; the form is visible behind but non-interactive
- Modal does not close on backdrop click — user must use the explicit buttons
- Retry calls `onRetry`, which resets state to `"submitting"` and re-runs the API call
- **Timeout:** if the API call has not resolved within 30 seconds, the modal auto-transitions to `"failed"` with the message `"Request timed out"`. Implemented with `Promise.race` against a 30 s `setTimeout` reject inside `handleSubmit`.

---

## 3. `EditorLocationForm.svelte` changes

### New state variables

```typescript
let showModal = $state(false);
let modalState = $state<"submitting" | "success" | "failed">("submitting");
let modalPrTitle = $state("");
let modalIsNewPr = $state(true);
let modalExistingPrUrl = $state<string | undefined>(undefined);
let modalNewPrUrl = $state<string | undefined>(undefined);
let modalError = $state<string | undefined>(undefined);
```

### `handleSubmit` flow

At the **start** of `handleSubmit` (before the API call):

1. Compute `resolvedFilename` (existing logic)
2. Look up `findPendingByFilename(namespace, resolvedFilename)`:
   - `isNewPr = true` when no entry exists, OR when the entry has `status: "failed"` and no `prUrl`. This prevents a failed first-submit from being treated as an update.
   - `existingPrUrl` = the entry's `prUrl` if `isNewPr` is false
3. Compute `prTitle`: `"Edit location: <title>"` or `"Add location: <title>"`
4. Write `"submitting"` entry to localStorage via `addPending`
5. Open modal: set `showModal = true`, `modalState = "submitting"`, `modalPrTitle`, `modalIsNewPr`, `modalExistingPrUrl`

On **API success**:
- `addPending` with `status: "pending"` and real `prUrl`
- Set `modalNewPrUrl = data.prUrl`
- `onSuccess` fires → `handleSuccess()` sets `modalState = "success"`

On **API failure** (including timeout):
- `updatePendingStatus(namespace, resolvedFilename, "failed")`
- Set `modalError = data.error ?? "Submission failed"`
- Set `modalState = "failed"`
- Still throw — `AppForm.doSubmit` must catch to avoid calling `onSuccess`. The "Try again" button behind the modal is harmlessly hidden.

### Retry

`EditorLocationForm` stores `let lastSubmittedNested = $state<Record<string, unknown>>({})` and sets it at the top of every `handleSubmit` call before doing anything else. `onRetry` resets `modalState = "submitting"` and calls `handleSubmit(lastSubmittedNested)` directly — no AppForm involvement needed.

### Removed

- `submitSuccess` state and the full-page success replacement block
- The `submitError` banner above the form (error is now shown in the modal)

### New location filename on retry

For a **new** location, the draft key is `editor_draft_${namespace}_new` and the pending entry filename is the computed `resolvedFilename` (e.g. `001_loc_binnenhof.yaml`). These are different keys.

- `handleDelete` on the list (for a failed new-location entry) must clear the draft under `..._new`, not under the resolved filename. The pending entry stores `isNew: true` to signal this.
- Retry from the list for a `"failed"` new-location entry navigates to `/editor/locations/${project}/${city}/new/${newId}` (computed fresh from `getNextLocationId` — safe since the failed submission didn't change the GitHub locations list). The draft under `..._new` is still present, so the form restores it.
- Retry from the list for a `"failed"` edit-location entry navigates to `/editor/locations/${project}/${city}/edit/${filename}` as before.

To support this, `PendingEntry` gains one additional field: `isNew?: boolean`. Set to `true` when creating an entry for a new (not-yet-existing) location.

---

## 4. `editorStorage.ts` changes

- Add `status: "submitting" | "pending" | "up_to_date" | "failed"` to `PendingEntry`
- Add `isNew?: boolean` to `PendingEntry`
- Add `updatePendingStatus(namespace, filename, status)` helper
- Add `prWasClosed(namespace, filename)` helper — calls `updatePendingStatus(..., "up_to_date")` + `clearDraft(draftKey)`. All existing callers of the removePending + clearDraft pattern switch to this.

---

## 5. `EditorLocationList.svelte` changes

### Badge rendering per status

| Status | Badge |
|---|---|
| `"submitting"` | `⏱ Submitting…` (purple border) |
| `"pending"` | `⏳ Pending — view PR` (amber, linked) |
| `"up_to_date"` | `✓ Up to date` (green border) |
| `"failed"` | `✕ Submission failed` + inline ↺ Retry button (red border) |

### Retry button behaviour

- `isNew: true` entry → navigate to new route using `getNextLocationId(locations.map(l => l.filename))`
- `isNew: false` (or absent) → navigate to `/editor/locations/${project}/${city}/edit/${filename}`

### Stale `"submitting"` entries

If the user navigated away mid-submission, the entry may be stuck in `"submitting"` after the API call resolved without a page to update it. `syncPending` resolves this:

- If a `"submitting"` entry has a `prUrl` (an existing PR was being updated): fetch its status. If open → `updatePendingStatus(..., "pending")`. If closed → `prWasClosed(...)`.
- If a `"submitting"` entry has **no** `prUrl` (first submit for this file): we cannot easily determine if the PR was created without an extra API call. Use a staleness window instead: if `submittedAt` is more than 5 minutes ago and the entry is still `"submitting"`, auto-demote to `"failed"`. In practice this is the network-timeout or closed-browser case — the 30 s in-modal timeout covers the live case, so any surviving `"submitting"` entry after 5 minutes is genuinely orphaned.

### `"up_to_date"` accumulation

Entries persist indefinitely. Add a **"Clear completed"** button to the list toolbar (visible only when at least one `"up_to_date"` entry exists). Clicking it removes all `"up_to_date"` entries from localStorage via a new `clearCompletedPending(namespace)` helper.

### Merge detection (`syncPending`)

Replace the `removePending` + `clearDraft` pattern with `prWasClosed(namespace, p.filename)`.

### `EditorLocationList.css`

Add badge modifier classes:
- `.loc-list__badge--submitting` (purple border)
- `.loc-list__badge--pending` (amber border, linked)
- `.loc-list__badge--up-to-date` (green border, no link)
- `.loc-list__badge--failed` (red border, with inline Retry button)

---

## 6. Files changed

| File | Change |
|---|---|
| `src/pages/editor/editorStorage.ts` | Add `status`, `isNew` to `PendingEntry`; add `updatePendingStatus`, `prWasClosed`, `clearCompletedPending` |
| `src/pages/editor/SubmitModal.svelte` | **New** — modal component |
| `src/pages/editor/SubmitModal.css` | **New** — modal styles |
| `src/pages/editor/EditorLocationForm.svelte` | Modal state management; remove success screen; retry logic; isNewPr detection fix |
| `src/pages/editor/EditorLocationList.svelte` | Badge variants; retry nav (new vs edit); stale-submitting resolution; "Clear completed" button; `prWasClosed` |
| `src/pages/editor/EditorLocationList.css` | Badge modifier classes |

---

## 7. Out of scope

- Cancelling the in-flight fetch request when navigating away — the Promise continues to resolve and writes to localStorage regardless; this is intentional
- Hard cancellation via `AbortController` — the 30 s timeout covers the hang case
- Persisting `"up_to_date"` entries with timestamps for auto-expiry — "Clear completed" button is sufficient for now
