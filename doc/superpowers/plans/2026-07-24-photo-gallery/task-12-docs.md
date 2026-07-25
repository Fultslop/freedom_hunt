# Task 12: Update `doc/architecture.md`

**Depends on:** Tasks 01-11 (documents the finished feature).

**Files:**
- Modify: `doc/architecture.md`

No tests — documentation only.

---

- [ ] **Step 1: Add the gallery route to the routing table**

In `doc/architecture.md`, find the "Routing" table (the one listing `/`, `/:project`, `/:project/:city`, `/:project/:city/:route`). Add a row after it:

```markdown
| `/:project/:city/gallery` | `GalleryLandingPage` | Read-only post-event photo gallery; hero rotation + filterable grid + lightbox download |
```

---

- [ ] **Step 2: Document the `photos` D1 table**

Find the "Data Model" section. Add a new subsection after the existing YAML-based data model entries:

```markdown
### `photos` table (D1, `AUTH_DB`)

Populated by `POST /upload` (see API Layer below) and by the one-off `scripts/backfill-photos.ts` migration script for pre-existing event photos. Not derived from YAML — this is the only queryable link between an uploaded photo and the team/task/project/city that produced it.

\`\`\`sql
CREATE TABLE photos (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  city_id       TEXT NOT NULL,
  route_id      TEXT,
  location_id   TEXT NOT NULL,
  task_title    TEXT NOT NULL,   -- snapshot of challenge.name at upload time, not a live join
  team_name     TEXT NOT NULL,
  contact       TEXT,
  r2_key        TEXT NOT NULL,   -- R2 key prefix; variants live at {r2_key}/{thumb,medium,full}.jpg
  mime_type     TEXT NOT NULL,
  uploaded_at   INTEGER NOT NULL
);
\`\`\`

**R2 image variants.** Each photo is stored as three capped JPEG variants under a shared key prefix, generated in the Worker via `@cf-wasm/photon` (WASM, no native bindings) since Cloudflare's URL-based Image Resizing isn't available on the current plan:

| Variant | Cap | Purpose |
|---|---|---|
| `thumb` | 300px long edge, quality 0.75 | Hero rotation, gallery grid |
| `medium` | 1200px long edge, quality 0.8 | Lightbox preview |
| `full` | 2048px long edge, quality 0.85 | Download button — **not** the raw uploaded file; always re-encoded and capped so per-photo storage is bounded regardless of source camera resolution |

EXIF orientation is corrected during this same resize step (`src/worker/imageProcessing.ts`), since Photon's resize/re-encode does not preserve EXIF and would otherwise produce sideways thumbnails.
```

---

- [ ] **Step 3: Add the gallery routes to the API Layer table**

Find the "API Layer" table (Challenge / Editor / Auth groups). Add a new row:

```markdown
| Gallery | `fetchGalleryPhotos(project, city, filters?)` → `GET /gallery/:project/:city/photos`; `fetchRandomPhotos(project, city)` → `GET /gallery/:project/:city/photos/random`; photo bytes served via `GET /photos/:id/:variant` |
```

---

- [ ] **Step 4: Document the optional `organizer_url` project YAML field**

Find the section describing `projects/<projectId>/<projectId>.yaml` (or add one near the `cities.yaml`/`projects.yaml` documentation if no dedicated subsection exists yet). Add:

```markdown
**Optional `organizer_url` field.** If present in `<projectId>.yaml`, the gallery landing page (`/:project/:city/gallery`) shows a header link to this URL (opens in a new tab). If absent, no link is rendered — there is no default/placeholder URL.

\`\`\`yaml
organizer_url: "https://your-organization.example.org"
\`\`\`
```

---

- [ ] **Step 5: Verify the doc renders sensibly**

Read back the modified sections of `doc/architecture.md` and confirm the new tables/subsections don't break the existing Markdown table formatting (column counts must match the header row).

---

- [ ] **Step 6: Commit**

```bash
git add doc/architecture.md
git commit -m "docs: document photos D1 table, gallery routes, and R2 variant layout"
```
