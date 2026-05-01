# Photo Upload — Design Spec
**Date:** 2026-04-30
**Status:** Approved

## Overview

Add a camera button to `ChallengeCard` so participants can submit photo evidence of visiting a location. Photos are stored in a Cloudflare R2 bucket on the same account that hosts the site. Organizers browse submissions via the Cloudflare R2 dashboard.

**Scope:** MVP / proof of concept. 5–10 teams, 15 locations max. No authentication, no team identification, no compression — all stretch goals.

---

## Architecture

Two additions to the existing deployment:

1. **`src/worker.js`** — a Cloudflare Worker script that handles `POST /upload` and delegates everything else to static assets via `env.ASSETS.fetch(request)`.
2. **R2 bucket `gwc-2026-photos`** — created once manually in the Cloudflare dashboard. Bound to the Worker as `PHOTOS`.

`wrangler.jsonc` gains:
- `"main": "src/worker.js"` — activates the Worker script
- `r2_buckets` binding: `{ "binding": "PHOTOS", "bucket_name": "gwc-2026-photos" }`

No other files change outside of `ChallengeCard.jsx` and `wrangler.jsonc`.

---

## Worker Endpoint

**Route:** `POST /upload`

**Request:** `multipart/form-data` with two fields:
- `photo` — the image file (any browser-supported image MIME type)
- `locationId` — string identifying the location (e.g., `"001"`)

**Processing:**
1. Parse form data, extract `photo` and `locationId`
2. Derive extension from `photo.type` (`image/jpeg` → `.jpg`, `image/png` → `.png`, fallback `.jpg`)
3. Build R2 key: `{locationId}_{Date.now()}.{ext}`
4. Write to `env.PHOTOS` with `httpMetadata: { contentType: photo.type }`
5. Return `{ ok: true, key }` as JSON with `Content-Type: application/json`

**Error handling:** If anything throws, return `{ ok: false, error: "Upload failed" }` with HTTP 500.

**All other requests:** delegated to `env.ASSETS.fetch(request)` (serves the React SPA as before).

**Known limitation:** The endpoint is unauthenticated. Any party who discovers the URL can POST to it. Acceptable for a short, supervised event with known teams; add token auth before scaling.

---

## UI — ChallengeCard

**Placement:** A camera button added directly below the challenge description box, inside the Location section (between the challenge box and the section border).

**Implementation:**
- A hidden `<input type="file" accept="image/*" capture="environment" ref={fileInputRef}>` — invisible, triggered programmatically
- A visible styled button that calls `fileInputRef.current.click()` on press
- On mobile, `capture="environment"` launches the rear camera directly
- On desktop, opens the OS file picker

**Button appearance:** Full-width, dark background (`#002868`), white text, camera emoji prefix — `📷 Upload`. Matches existing card button aesthetic.

**Upload states (local `useState`, resets on reload):**

| State | Button label | Interaction |
|---|---|---|
| `idle` | `📷 Upload` | Clickable |
| `uploading` | `Uploading…` | Disabled |
| `success` | — | Button replaced by `✓ Photo submitted` (green) |
| `error` | `📷 Try again` | Clickable; error message shown below |

**Upload logic:** On file selection, build a `FormData` with `photo` (the file) and `locationId` (from `location.locationId`), POST to `/upload`, update state based on response.

---

## File Naming

R2 key format: `{locationId}_{timestamp}.{ext}`

Example: `001_1746012345678.jpg`

- Sortable by location then time
- No team ID for PoC (stretch goal)

---

## Stretch Goals (out of scope for this spec)

- Image compression before upload (reduce mobile photo size from ~8 MB to ~1 MB)
- Team/participant identification attached to each upload
- Upload confirmation persisted across page reloads (localStorage)
- Authenticated upload endpoint (short-lived token per session)
- Custom organizer dashboard replacing R2 dashboard
- Google Drive destination instead of / in addition to R2