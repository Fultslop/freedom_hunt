# Post-Event Photo Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only post-event photo gallery (`/:project/:city/gallery`) with hero rotation, filterable grid, and single-photo download — built on a new photo metadata model (D1 `photos` table + capped R2 image variants) that the current upload flow doesn't provide.

**Architecture:** `POST /upload` is extended to generate three capped JPEG variants (`thumb`/`medium`/`full`) via an in-Worker WASM image library and write one `photos` row to the existing `AUTH_DB` D1 database. Three new authenticated Worker routes serve the gallery list, a random hero sample, and streamed image bytes. New Svelte components/pages consume these, reusing the existing participant/editor auth guard. A one-off script backfills metadata for photos already uploaded during the Den Haag event by correlating R2 objects against the existing Google Sheet.

**Tech Stack:** Cloudflare D1 (SQLite, existing `AUTH_DB` binding), Cloudflare R2 (existing `PHOTOS` binding), `@cf-wasm/photon` (WASM image resize/encode, workerd entrypoint), Svelte 5 runes, svelte-spa-router, TypeScript, Vitest + `@testing-library/svelte`.

## Global Constraints

- No new Cloudflare bindings required — the `photos` table lives in the existing `AUTH_DB` D1 database; images use the existing `PHOTOS` R2 bucket.
- Stored/downloadable image variant (`full`) is capped at 2048px long edge, JPEG quality 0.85 — never store the raw uploaded file.
- `medium` variant: ~1200px long edge, quality 0.8. `thumb` variant: ~300px long edge, quality 0.75.
- `task_title`, `team_name`, `contact` on a `photos` row are snapshots taken at upload time — never a live join against YAML or the auth token.
- All new gallery/photo routes require an authenticated session (`requireAuth` — participant or editor); photos are never served from a public R2 URL.
- TypeScript only, `.svelte` + `.ts`, co-located `.css` per component, CSS custom properties (`var(--color-*)`), BEM-like class names — per `doc/architecture.md`.
- Every task must leave `npm run test:run`, `npm run lint`, and `npm run typecheck` passing.

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `migrations/002_photos.sql` | `photos` table schema + indexes |
| `src/worker/photoKeys.ts` | R2 key-prefix + variant-key builders, shared by upload/serving/backfill |
| `src/worker/imageProcessing.ts` | EXIF orientation parsing + `generateVariants()` (thumb/medium/full via Photon) |
| `src/worker/routes/galleryRoutes.ts` | `GET /gallery/:project/:city/photos`, `.../photos/random`, `GET /photos/:id/:variant` |
| `src/types/gallery.ts` | Shared `GalleryPhoto` DTO type (worker + frontend) |
| `src/test/worker.imageProcessing.test.ts` | Tests for EXIF parsing + variant generation orchestration |
| `src/test/worker.photodb.test.ts` | Tests for new D1 photo helpers |
| `src/test/worker.gallery.test.ts` | Tests for the 3 new gallery routes |
| `src/components/PhotoHero.svelte` + `.css` | Auto-rotating stacked-Polaroid hero |
| `src/components/PhotoGallery.svelte` + `.css` | Grid of photo thumbnails + owns filter state |
| `src/components/PhotoThumb.svelte` + `.css` | Single grid thumbnail |
| `src/components/GalleryFilters.svelte` + `.css` | Team/task filter inputs |
| `src/components/PhotoLightbox.svelte` + `.css` | Modal preview + download |
| `src/pages/GalleryLandingPage.svelte` + `.css` | Assembles hero + CTAs + gallery on one route |
| `src/test/PhotoHero.test.ts` | Rotation timing, hides below 3-photo threshold |
| `src/test/PhotoGallery.test.ts` | Filter behavior |
| `src/test/PhotoLightbox.test.ts` | Open/close, download link correctness |
| `src/test/GalleryLandingPage.test.ts` | Title rendering, organizer link, CTA scroll/focus behavior |
| `scripts/backfillMatching.ts` | Pure, fully-tested photo-to-sheet-row matching logic used by the backfill script |
| `scripts/backfill-photos.ts` | One-off Den Haag backfill orchestration script (not part of the deployed app; not unit-tested against live services) |
| `scripts/test/backfillMatching.test.ts` | Unit tests for the matching logic |

### Modified files
| File | Change |
|------|--------|
| `src/test/worker.test.ts` | Fix `/auth/logout` global-stub isolation bug (Task 01); rewrite `/upload` describe block for the new multi-variant + D1 flow (Task 04) |
| `src/worker/db.ts` | Add `DbPhoto` type + `insertPhoto`, `listPhotos`, `randomPhotos`, `getPhotoById` |
| `src/worker/routes/uploadRoute.ts` | Accept `cityId`/`routeId`/`taskTitle`; generate variants; insert `photos` row; remove old `buildR2Key` |
| `src/worker.ts` | Import and wire `galleryRoutes` |
| `src/utils/api.ts` | Change `postPhotoUpload` signature; add `fetchGalleryPhotos`, `fetchRandomPhotos` |
| `src/test/api.test.ts` | Update `postPhotoUpload` test for new signature; add tests for new gallery fetch functions |
| `src/components/ChallengeForm.svelte` | Accept `cityId` prop; send `cityId`/`taskTitle` on upload |
| `src/components/ChallengeCard.svelte` | Accept `cityId` prop; pass through to `ChallengeForm` |
| `src/pages/RoutePage.svelte` | Pass `params.city` as `cityId` to `ChallengeCard` |
| `src/test/ChallengeForm.test.ts` | Update for new `cityId` prop + upload payload |
| `src/test/ChallengeCard.test.ts` | Update for new `cityId` prop passthrough |
| `src/App.svelte` | Add `/:project/:city/gallery` route, guarded by existing `requireAuth` |
| `doc/architecture.md` | Document `photos` D1 table, R2 variant layout, gallery routes, gallery route in the routing table |
| `package.json` | Add `@cf-wasm/photon` (Task 03); add `@aws-sdk/client-s3`, `tsx`, and a `backfill-photos` script (Task 11) |

---

## Tasks

| # | Task | File |
|---|------|------|
| 01 | Fix pre-existing test-suite isolation bug (prerequisite) | [task-01-fix-test-suite.md](task-01-fix-test-suite.md) |
| 02 | `photos` D1 table + query helpers | [task-02-photos-data-model.md](task-02-photos-data-model.md) |
| 03 | Image processing — EXIF orientation + variant generation | [task-03-image-processing.md](task-03-image-processing.md) |
| 04 | Upload route rewrite | [task-04-upload-route.md](task-04-upload-route.md) |
| 05 | Gallery API routes (list, random, serving) | [task-05-gallery-api-routes.md](task-05-gallery-api-routes.md) |
| 06 | Frontend API client + upload wiring (cityId/taskTitle threading) | [task-06-frontend-upload-wiring.md](task-06-frontend-upload-wiring.md) |
| 07 | `PhotoHero` component | [task-07-photo-hero.md](task-07-photo-hero.md) |
| 08 | `PhotoGallery` grid + `PhotoThumb` + `GalleryFilters` | [task-08-photo-gallery-grid.md](task-08-photo-gallery-grid.md) |
| 09 | `PhotoLightbox` component | [task-09-photo-lightbox.md](task-09-photo-lightbox.md) |
| 10 | `GalleryLandingPage` + route wiring | [task-10-gallery-landing-page.md](task-10-gallery-landing-page.md) |
| 11 | Backfill script for the Den Haag event | [task-11-backfill-script.md](task-11-backfill-script.md) |
| 12 | Update `doc/architecture.md` | [task-12-docs.md](task-12-docs.md) |
