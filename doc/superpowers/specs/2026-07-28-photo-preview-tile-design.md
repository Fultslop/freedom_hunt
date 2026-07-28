# Photo Field Preview Tile — Design

**Date:** 28/07/2026
**Status:** Draft

## Problem

The `photo` form field ([AppForm.svelte:358-384](../../../src/components/AppForm.svelte#L358-L384))
renders as a small pill-shaped `<button>` (camera icon + "Take a photo" /
"Uploading…" / "Photo uploaded ✓" text) with no visual feedback about *what*
was actually uploaded. A participant who's uploaded a photo and swipes to an
adjacent stop and back sees the same generic "Photo uploaded ✓" text — no way
to confirm at a glance which photo is attached, or notice they grabbed the
wrong one.

This spec replaces that button with a square preview tile: a gray
photo-icon placeholder before upload, replaced by the actual photo once
uploaded. The preview must survive navigating away and back, which — since
`RoutePage`'s carousel/peek swipe strip keeps the prev/current/next cards
permanently mounted, each with its own `ChallengeForm` reading its own
`localStorage`-backed `FormState` — means storing a compressed thumbnail in
the same place upload status already persists.

## Components

- **New file `src/utils/photoPreview.ts`** — `createPhotoPreview(file: File): Promise<string>`.
  Pure client-side canvas resize/compress, returns a JPEG data URL. No
  component/store dependencies — same "isolated, independently mockable"
  shape as `src/actions/leafletMap.ts`, which `AppForm.test.ts` already mocks
  via `vi.mock("../actions/leafletMap", ...)`.
- **`src/types/data.ts`** — `PhotoUploadStatus` ([data.ts:112-115](../../../src/types/data.ts#L112-L115))
  gains one new optional field:

  ```ts
  export interface PhotoUploadStatus {
    status: "success" | "error";
    httpCode: number;
    previewDataUrl?: string;
  }
  ```

- **`AppForm.svelte`** — the `field.type === "photo"` branch's `<button
  class="af-photo-btn">` is restyled to `<button class="af-photo-tile">`,
  rendering different content depending on `upload?.status` (placeholder
  icon / spinner / `<img>` / checkmark). The hidden file `<input
  id={domId}>` and the button's `onclick={() =>
  document.getElementById(domId)?.click()}` wiring — from the id-collision
  fix — are otherwise unchanged. The `Camera` lucide import
  ([AppForm.svelte:3](../../../src/components/AppForm.svelte#L3)) is only
  used by the button being replaced, so it's dropped in favor of new
  `Image` and `Check` imports (see Visual section).

## Visual / CSS (`AppForm.css`)

New class `.af-photo-tile`, replacing `.af-photo-btn` (kept only if still
referenced elsewhere — grep confirms it isn't, so it's removed):

- 112×112px, `border-radius: 12px`, `overflow: hidden` (so the `<img>` clips
  to the rounded corners).
- **Idle / error:** `background: var(--color-surface)`, `border: 1px solid
  var(--color-border)`, a centered lucide `Image` icon (32px,
  `var(--color-text-muted)`).
- **Uploading:** same placeholder, `opacity: 0.6`, a small centered spinner.
  `global.css` ([global.css:12-70](../../../src/styles/global.css#L12-L70))
  has no existing spin keyframe (`fadeInUp`/`slideInFromRight`/
  `slideInFromLeft`/`confettiFall`/`shootingStarStreak`/`fireworkBurst`, none
  of them a simple rotation) — add a small `@keyframes af-spin` co-located in
  `AppForm.css`, applied to a plain bordered circle div (no new icon import
  needed for the spinner itself).
- **Success:** `<img src={previewDataUrl} alt={field.label} />` filling the
  tile, `object-fit: cover`. Tapping it re-opens the file picker (same
  `disabled={upload?.status === "uploading"}` guard as today).
- **Success, no `previewDataUrl`** (canvas failed but upload succeeded —
  see Edge Cases): a centered lucide `Check` icon (already imported
  elsewhere in this codebase, e.g. `ChallengeCard.svelte`) on the idle-style
  gray background, instead of a broken/missing image.
- `field.subtext` ([AppForm.svelte:372](../../../src/components/AppForm.svelte#L372))
  and the `.af-photo-error` "Upload failed. Try again." paragraph
  ([AppForm.svelte:382](../../../src/components/AppForm.svelte#L382)) keep
  their current position, below the tile, unchanged.
- Accessible name moves from visible text to a state-dependent `aria-label`
  on the button: `"Take a photo"` (idle) / `"Uploading photo…"` (uploading) /
  `"Retake photo"` (success) / `field.label` as a fallback prefix in each
  case so multi-photo forms stay distinguishable. This preserves
  `getByRole("button", { name: ... })`-style test queries — just matching
  `aria-label` instead of innerText now.

## Data flow, compression, persistence

In `handleFileChange` ([AppForm.svelte:190-206](../../../src/components/AppForm.svelte#L190-L206)):

1. On file select, set `uploadStates[fieldId] = { status: "uploading" }`
   (unchanged from today).
2. Run `createPhotoPreview(file)` and `onPhotoUpload(file)` concurrently
   (`Promise.allSettled`, not `Promise.all` — a preview-generation failure
   must not turn an otherwise-successful upload into an error).
3. If `onPhotoUpload` resolves `{ ok: true, httpCode }`:
   `uploadStates[fieldId] = { status: "success", httpCode, previewDataUrl:
   <result if createPhotoPreview succeeded, else undefined> }`.
4. If `onPhotoUpload` resolves `{ ok: false, ... }` or rejects: `uploadStates[fieldId]
   = { status: "error", httpCode }` — no `previewDataUrl` stored, regardless
   of whether preview generation itself succeeded (matches "revert to
   placeholder on failure").

`createPhotoPreview` internals: draw the file to an offscreen canvas via
`createImageBitmap(file)`, center-crop to a square (using
`min(width, height)` as the crop side), draw scaled to a fixed 200×200
target, then `canvas.toDataURL("image/jpeg", 0.6)`. 200×200 keeps a 112px
CSS tile crisp at up to ~1.8x pixel density; 0.6 JPEG quality on a
200×200 photo typically lands in the 5–15KB range — a full route's worth of
photos (this app's routes top out around 10-15 location stops) stays well
under any browser's localStorage quota (typically 5MB+ per origin).

**No new persistence plumbing.** `previewDataUrl` rides the *existing*
pipeline unchanged:
`AppForm`'s `onUploadsChange` effect ([AppForm.svelte:131-139](../../../src/components/AppForm.svelte#L131-L139))
already forwards the full settled `PhotoUploadStatus` object (now including
`previewDataUrl`) → `ChallengeForm.handleUploadsChange`
([ChallengeForm.svelte:63-66](../../../src/components/ChallengeForm.svelte#L63-L66))
→ `persist()` → `saveFormState()` ([formStorage.ts:37-39](../../../src/utils/formStorage.ts#L37-L39))
→ `localStorage`, keyed per-location. `initialUploads`/`baseUploads`
already restore whatever's in that object on mount — which is what makes
the preview reappear when swiping back to an already-visited card, since
each of RoutePage's three simultaneously-mounted carousel slots is an
independent `ChallengeForm` reading its own location's `FormState` on
mount.

## Edge cases

- **Canvas can't decode the file** (corrupt file, format `createImageBitmap`
  rejects): `createPhotoPreview` rejects, caught by `Promise.allSettled`;
  upload still succeeds/fails independently. Tile shows the checkmark
  fallback on success (see Visual section).
- **Old `localStorage` entries from before this feature** (`previewDataUrl`
  absent): optional field, falls back to the checkmark treatment — no
  migration needed.
- **Re-upload (`allowResubmit`)**: tapping an already-successful tile opens
  the picker again; a new upload overwrites `uploadStates[fieldId]` (and
  thus the persisted preview) exactly like today's overwrite-on-reselect
  behavior, just now also replacing the stored thumbnail.
- **Very large source photos** (12MP+ phone camera output): `createImageBitmap`
  + canvas draw is a one-time, already-decoded-by-the-browser operation;
  no extra handling needed beyond what today's `generateVariants` server-side
  path already assumes about input size.

## Testing

- **`AppForm.test.ts`**: add `vi.mock("../utils/photoPreview", () => ({
  createPhotoPreview: vi.fn().mockResolvedValue("data:image/jpeg;base64,...") }))`,
  matching the existing `leafletMap`/`images` mock pattern. New tests:
  - Idle state renders the placeholder icon, not an `<img>`.
  - After a successful upload, an `<img>` with the mocked `previewDataUrl`
    as `src` appears.
  - After a failed upload, the tile reverts to the placeholder (no `<img>`),
    and the existing "Upload failed. Try again." text still shows.
  - `previewDataUrl` shows up in the object passed to `onUploadsChange`.
  - A resolved-but-`ok:false` upload with `createPhotoPreview` still
    succeeding does **not** persist a `previewDataUrl` (failure discards the
    preview even if generation itself worked).
- Existing tests asserting visible "Take a photo"/"Photo uploaded ✓" text
  (`AppForm.test.ts`, several) are updated to query by `aria-label` instead.
- **Not covered by the automated suite:** real canvas resize/compression
  behavior — happy-dom has no canvas implementation. `photoPreview.ts`'s
  actual visual output (crop framing, JPEG quality/size) is a manual,
  visual sanity check, done by the user locally (no Playwright, per
  standing project instruction).

## Non-goals (v1)

Editing/cropping the photo before upload; multiple photos per field;
configurable preview dimensions/quality per field; a lightbox/full-size view
of the preview tile; retrying a failed upload automatically (the existing
"tap again to reselect" flow is unchanged); changing anything about the
server-side upload/variant pipeline (`uploadRoute.ts`) — this is a
client-only, additive change.

## Acceptance criteria

- [ ] Idle photo field shows a 112px gray rounded-corner tile with a
      centered photo icon.
- [ ] Selecting a file shows an "uploading" state (dimmed tile + spinner)
      then, on success, the actual photo filling the tile.
- [ ] The preview persists in `localStorage` and reappears when swiping to
      an adjacent already-visited card and back, without a network refetch.
- [ ] A failed upload reverts the tile to the placeholder and still shows
      "Upload failed. Try again." below it.
- [ ] Tapping a successful tile reopens the file picker and replaces both
      the server-side upload and the stored preview.
- [ ] Stored preview data URLs are small (roughly 5-15KB each) — verified
      manually by inspecting `localStorage` after a real upload.
- [ ] All existing `AppForm.test.ts`/`ChallengeForm.test.ts`/
      `ChallengeCard.test.ts`/`RouteScreen.test.ts` photo-related tests pass
      with queries updated to `aria-label`.
