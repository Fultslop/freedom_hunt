# `video` Form Field — Design

## Problem

`005_loc_malieveld.yaml`'s challenge invites teams to produce a "10-second video" as one option for their feminist/pro-democracy message, but there is currently no way to capture or submit video anywhere in the app — the only media field type is `photo`, and `005_form_malieveld.yaml` today is just a `textarea`. Before wiring this up, the open question was feasibility: would teams uploading arbitrary phone-camera video risk blowing through the Cloudflare R2 free tier (10GB storage)? Raw camera-native clips (4K on modern iPhones) can be 50-200MB for 10 seconds, which would not be safe at any real scale.

## Approach

Add a new reusable `video` form field type (mirrors `photo`'s place in the existing extensible field-type system) that **records in-app** rather than accepting an arbitrary file from the OS camera roll/app. The page opens the camera itself via `getUserMedia`, records through `MediaRecorder` with a capped bitrate and a hard auto-stop duration, and extracts a poster frame client-side. This bounds every clip to a small, predictable size (bitrate × duration, roughly 1-1.5MB including poster images) regardless of the device's native camera settings — solving the cost concern by construction rather than by hoping teams behave or building server-side video transcoding (which Cloudflare Workers' CPU/memory limits make risky in the first place).

At the target scale (~10-30 teams/hunt, a handful of hunts/year), this comes to well under 1GB/year of storage, against a 10GB free tier that also has zero egress fees on R2 (unlike S3) — so gallery playback bandwidth is free regardless.

### Alternatives considered

- **Plain file picker (`<input type="file" accept="video/*" capture="environment">`), mirroring the photo field exactly:** rejected — file size is entirely up to the phone's default camera settings (a 10-second 4K/60fps clip can be 50-200MB), and unlike images there's no simple client-side re-encode trick (`createImageBitmap`/canvas) for video; a real fix would need `ffmpeg.wasm` or similar, which is heavy for both the client bundle and mobile CPU/battery.
- **Server-side video transcoding** (compress/resize uploaded clips the way `imageProcessing.ts` does for photos): rejected — Cloudflare Workers has no equivalent to Photon for video, and CPU-time/memory limits make in-Worker video encoding unreliable; bounding size at capture time is simpler and cheaper.
- **Offload to an external service** (teams post to Instagram/WhatsApp and paste a link): rejected per product decision — breaks the unified gallery experience the app already provides for photos, and adds a manual verification step for organizers.

## Data Model Changes

`src/types/data.ts`:
- `FormFieldType` gains `"video"`.
- No new properties needed on `FormField` — a `video` field behaves like `photo` (no `options`/`values`/`config` needed).

`src/data/schemas/form.schema.json`:
- Add `"video"` to the `type` enum.

## Capture UI — `AppForm.svelte`

- Add `STR_VIDEO = "video"` alongside the other type constants; add it to `VALID_TYPES`.
- New template branch (`{:else if field.type === "video"}`), following the existing `photo` field's states (idle / recording / uploading / success / error), styled as a tile consistent with the photo preview tile.
- **Idle → recording:** tapping the tile calls `getUserMedia({ video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }, audio: true })`, shows a live `<video>` preview, and starts a `MediaRecorder`:
  - `mimeType` chosen via `MediaRecorder.isTypeSupported()` against a preference list (`video/mp4;codecs=avc1...` for Safari/iOS, `video/webm;codecs=vp8,opus` elsewhere).
  - `videoBitsPerSecond` capped around 800kbps, `audioBitsPerSecond` around 64kbps.
  - A hard timer auto-stops recording at `MAX_RECORD_MS` (12000ms); a visible manual stop button allows stopping sooner.
- **Recording → stopped:** on stop, the recorded `Blob` is kept in memory; a poster frame is captured by seeking the (now-static) preview `<video>` element to its first frame and drawing it to a canvas (same technique as `photoPreview.ts`), producing a JPEG blob.
- **Upload:** both blobs are sent as a single `multipart/form-data` POST (`video` + `poster` fields, alongside the existing `locationId`/`cityId`/`routeId`/`taskTitle` fields already sent for photos) to a new `/upload-video` route. Upload state (`idle`/`uploading`/`success`/`error`) follows the same pattern as the photo field's `PhotoUploadStatus`, riding the same `onUploadsChange` → `ChallengeForm.persist()` → `localStorage` pipeline so it survives carousel swipes.
- **Error states:**
  - `getUserMedia` permission denied or `MediaRecorder`/`getUserMedia` unsupported (feature-detected on mount) → inline error message ("Camera/microphone access needed to record"), no broken recording UI shown.
  - Upload failure → same Retry-button pattern as the photo field.

## Server Changes

### Storage: reuse the `photos` table

Add a `kind TEXT NOT NULL DEFAULT 'photo'` column to `photos` via a new migration (`005_add_photo_kind.sql` or next available number). A video submission writes one `photos` row with `kind = 'video'` and `mime_type` set to the recorded clip's actual mime type (`video/webm` or `video/mp4`).

Rationale for reusing the table rather than a parallel `videos` table: gallery listing/filtering logic (`listPhotos`, `randomPhotos`) stays unified, and the only structurally new thing a video row needs is the discriminator column.

### R2 layout

Reuse `buildR2KeyPrefix(locationId, timestamp)` for the shared prefix. Two kinds of objects land under it:
- Poster frame: run through the **existing** `generateVariants()` image pipeline unchanged, producing `{prefix}/thumb.jpg`, `{prefix}/medium.jpg`, `{prefix}/full.jpg` — no new image code.
- Raw video clip: stored as `{prefix}/video.webm` or `{prefix}/video.mp4` (extension derived from the recorded mime type). `photoKeys.ts` needs a small addition — a `buildVideoKey(prefix, mimeType)` function alongside the existing `buildVariantKey`.

### New route: `handleUploadVideoRoute` (`src/worker/routes/uploadVideoRoute.ts`)

Mirrors `uploadRoute.ts`:
- `requireAuth` + `isParticipantToken`, same as `/upload`.
- Reads `video` and `poster` files plus the same `locationId`/`cityId`/`routeId`/`taskTitle` fields.
- Rejects (400) if the video exceeds a `MAX_VIDEO_BYTES` cap (e.g. 15MB) — a sanity backstop in case a browser ignores the bitrate cap; this is far above the ~1.5MB expected size, so it should only ever trip on a genuine anomaly.
- Runs the poster bytes through `generateVariants()` exactly like `/upload` does for photos (same try/catch fallback to storing the raw poster only if decoding fails).
- Writes the raw video bytes to R2 under `buildVideoKey(...)`, and the poster variants under `buildVariantKey(...)`.
- Inserts one `photos` row (`kind: 'video'`, `r2_key: keyPrefix`, `mime_type: <video mime type>`).
- Returns `{ ok: true, id, key }`, matching `/upload`'s response shape.

### Gallery

- `DbPhoto`/`GalleryPhoto` gain a `kind: 'photo' | 'video'` field; `toGalleryPhoto` in `galleryRoutes.ts` passes it through.
- `galleryRoutes.ts`'s `photoMatch` route (`/photos/:id/:variant`) gains a `"video"` variant alongside `thumb`/`medium`/`full`, serving the raw R2 object with the stored `mime_type` as `Content-Type`. No HTTP Range support in v1 — clips are small enough (~1-1.5MB) to load in full without needing to seek before playback starts.
- `PhotoThumb`/`PhotoLightbox` branch on `kind`: the grid tile always renders the poster JPEG (identical to a photo tile today); the lightbox/expanded view renders a `<video controls poster={mediumUrl} src={videoUrl}>` instead of an `<img>` when `kind === 'video'`.

## Data Files

`005_form_malieveld.yaml` gains a `video` field alongside the existing `manifesto` textarea (exact copy/requiredness TBD by whoever authors the final form — out of scope for this design, which covers the mechanism, not the specific challenge's field list).

## Testing

- **Client capture** (`AppForm.test.ts` or a new `videoCapture.test.ts`): mock `getUserMedia`/`MediaRecorder` (similar to how `photoUpload.test.ts` mocks `createImageBitmap`) to assert: recording auto-stops at the duration cap, a poster frame blob is produced on stop, permission-denied surfaces the inline error state, and upload failure shows the Retry button.
- **Server route** (new `worker.uploadVideoRoute.test.ts`, mirrors `worker.uploadRoute.test.ts`): auth required, R2 writes happen for both video and poster variants, DB row inserted with `kind: 'video'`, oversized video rejected with 400 before any R2 write.
- **Gallery**: extend existing gallery component tests to assert a `kind: 'video'` item renders a `<video>` element (not `<img>`) with the correct poster/src URLs.

## Out of Scope

- HTTP Range/seeking support for video playback (clips are small enough that full-file load is fine for v1).
- Editing/trimming the recorded clip client-side beyond the hard duration cap.
- Re-recording UX beyond a simple Replace/Remove pair (can mirror the photo field's existing Replace/Remove buttons).
- Admin/editor authoring UI for `video` fields (same gap as other recently-added field types — the editor doesn't cover every type yet).
- Deciding the exact `005_form_malieveld.yaml` field copy/requiredness — a follow-up content decision, not a mechanism decision.
