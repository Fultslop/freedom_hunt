# Task 11: Backfill Script for the Den Haag Event

**Depends on:** Task 02 (photos table schema), Task 03 (variant sizing/quality constants — duplicated here, see note below).

**Files:**
- Create: `scripts/backfillMatching.ts` — pure matching logic (fully unit-tested)
- Create: `scripts/backfill-photos.ts` — orchestration script (manually run once, not unit-tested against live services)
- Create: `scripts/test/backfillMatching.test.ts`
- Modify: `package.json` (add `@aws-sdk/client-s3` and `tsx` as devDependencies, add an `npm run backfill-photos` script)

**Not part of the deployed app** — this runs once, locally, against production R2/D1/Sheet data, by whoever operates the migration. It is not imported by any Worker or frontend code.

**Why a new dependency (`@aws-sdk/client-s3`) instead of the `wrangler` CLI already in `devDependencies`:** verified against the installed wrangler version (`npx wrangler r2 object --help`) — `wrangler r2 object` only supports `get`/`put`/`delete` of a single, already-known key. There is no `list` subcommand, and R2 object listing is not exposed via the Cloudflare REST API either — only via a Worker's `env.PHOTOS.list()` binding (not available to an external script) or R2's S3-compatible API. `@aws-sdk/client-s3` against R2's S3-compatible endpoint is Cloudflare's documented way to list/get/put R2 objects from outside a Worker.

**Why the image-variant generation is duplicated here rather than reusing `src/worker/imageProcessing.ts`:** that module imports `@cf-wasm/photon/workerd`, which only initializes correctly inside the actual Workers runtime. This script runs in plain Node, so it uses the package's `@cf-wasm/photon/node` entrypoint instead — a different module with the same `PhotonImage`/`resize`/`rotate`/`fliph`/`flipv` API shape, per the package's own per-runtime entrypoints. Sharing one implementation would mean threading the Photon module in as a parameter for a script that runs exactly once — not worth the abstraction (YAGNI); the EXIF-orientation and dimension-capping constants are kept identical to Task 03 by inspection, not by import.

**Required environment variables** (read via `process.env`, not committed anywhere):
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account id
- `CLOUDFLARE_API_TOKEN` — API token with D1 edit permission on `scavenger_hunt_auth`
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — R2 API token credentials (Cloudflare dashboard → R2 → Manage R2 API Tokens), used for the S3-compatible endpoint
- `FORM_SCRIPT_URL` — same Google Apps Script deployment URL already used by the app's `/form-submit` route (has a `doGet` handler per `doc/superpowers/plans/2026-05-02-dashboard-02-sheet-read.md`)

---

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev @aws-sdk/client-s3 tsx
```

Add to `package.json` `"scripts"`:

```json
"backfill-photos": "tsx scripts/backfill-photos.ts"
```

---

- [ ] **Step 2: Write the failing tests for the matching logic**

Create `scripts/test/backfillMatching.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseR2Key, matchPhotoToSheetRow, type SheetRow } from "../backfillMatching";

describe("parseR2Key", () => {
  it("parses the old {locationId}_{timestamp}.{ext} key format", () => {
    expect(parseR2Key("1_1731234567890.jpg")).toEqual({
      key: "1_1731234567890.jpg",
      locationId: "1",
      timestamp: 1731234567890,
    });
  });

  it("returns null for a key that doesn't match the expected format", () => {
    expect(parseR2Key("not-a-valid-key")).toBeNull();
  });
});

describe("matchPhotoToSheetRow", () => {
  const photo = { key: "1_1731234567890.jpg", locationId: "1", timestamp: 1731234567890 };

  it("matches the sheet row with the same locationId and closest timestamp", () => {
    const rows: SheetRow[] = [
      { timestamp: "1731234000000", routeId: "short_loop", locationId: "1", teamName: "Team A", email: "a@b.com", fields: "{}" },
      { timestamp: "1731234567900", routeId: "short_loop", locationId: "1", teamName: "Team B", email: "b@c.com", fields: "{}" },
      { timestamp: "1731234567890", routeId: "extended_route", locationId: "2", teamName: "Team C", email: "c@d.com", fields: "{}" },
    ];
    const result = matchPhotoToSheetRow(photo, rows);
    expect(result).toMatchObject({ matched: true, teamName: "Team B", routeId: "short_loop", contact: "b@c.com" });
  });

  it("ignores rows for a different locationId even if the timestamp is closer", () => {
    const rows: SheetRow[] = [
      { timestamp: "1731234567890", routeId: "extended_route", locationId: "2", teamName: "Team C", email: "c@d.com", fields: "{}" },
    ];
    const result = matchPhotoToSheetRow(photo, rows);
    expect(result.matched).toBe(false);
    expect(result.teamName).toBe("Unknown");
  });

  it("does not match a row outside the 10-minute window even with the same locationId", () => {
    const rows: SheetRow[] = [
      { timestamp: String(1731234567890 - 11 * 60 * 1000), routeId: "short_loop", locationId: "1", teamName: "Team A", email: "a@b.com", fields: "{}" },
    ];
    const result = matchPhotoToSheetRow(photo, rows);
    expect(result.matched).toBe(false);
    expect(result.teamName).toBe("Unknown");
  });

  it("returns an Unknown-team match when there are no candidate rows at all", () => {
    const result = matchPhotoToSheetRow(photo, []);
    expect(result).toMatchObject({ matched: false, teamName: "Unknown", routeId: null, contact: null });
  });

  it("ignores rows with a non-numeric timestamp", () => {
    const rows: SheetRow[] = [
      { timestamp: "not-a-number", routeId: "short_loop", locationId: "1", teamName: "Team A", email: "a@b.com", fields: "{}" },
    ];
    const result = matchPhotoToSheetRow(photo, rows);
    expect(result.matched).toBe(false);
  });
});
```

---

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run scripts/test/backfillMatching.test.ts`
Expected: FAIL — `../backfillMatching` doesn't exist.

---

- [ ] **Step 4: Implement `backfillMatching.ts`**

Create `scripts/backfillMatching.ts`:

```ts
export interface SheetRow {
  timestamp: string;
  routeId: string;
  locationId: string;
  teamName: string;
  email: string;
  fields: string;
}

export interface R2ObjectRef {
  key: string;
  locationId: string;
  timestamp: number;
}

export interface BackfillMatch {
  key: string;
  locationId: string;
  timestamp: number;
  teamName: string;
  routeId: string | null;
  contact: string | null;
  matched: boolean;
}

const MATCH_WINDOW_MS = 10 * 60 * 1000;

/** Parses the pre-Task-04 key format: `{locationId}_{timestamp}.{ext}`. */
export function parseR2Key(key: string): R2ObjectRef | null {
  const parsed = key.match(/^(.+)_(\d+)\.(jpg|png)$/);
  if (!parsed) {
    return null;
  }
  return { key, locationId: parsed[1], timestamp: Number(parsed[2]) };
}

export function matchPhotoToSheetRow(
  photo: R2ObjectRef,
  sheetRows: SheetRow[],
): BackfillMatch {
  const candidates = sheetRows
    .filter((row) => row.locationId === photo.locationId)
    .map((row) => ({ row, delta: Math.abs(Number(row.timestamp) - photo.timestamp) }))
    .filter((entry) => !Number.isNaN(entry.delta));

  const best = candidates.reduce<{ row: SheetRow; delta: number } | null>(
    (closest, entry) => (!closest || entry.delta < closest.delta ? entry : closest),
    null,
  );

  if (best && best.delta <= MATCH_WINDOW_MS) {
    return {
      key: photo.key,
      locationId: photo.locationId,
      timestamp: photo.timestamp,
      teamName: best.row.teamName || "Unknown",
      routeId: best.row.routeId || null,
      contact: best.row.email || null,
      matched: true,
    };
  }

  return {
    key: photo.key,
    locationId: photo.locationId,
    timestamp: photo.timestamp,
    teamName: "Unknown",
    routeId: null,
    contact: null,
    matched: false,
  };
}
```

---

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run scripts/test/backfillMatching.test.ts`
Expected: PASS, all 6 tests.

---

- [ ] **Step 6: Write the orchestration script**

Create `scripts/backfill-photos.ts`. This step is not TDD'd against live services — it's exercised via the dry run in Step 7, against real (but low-risk, inspectable) production data.

```ts
#!/usr/bin/env node
import { writeFileSync } from "fs";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  PhotonImage,
  SamplingFilter,
  resize,
} from "@cf-wasm/photon/node";
import { parseR2Key, matchPhotoToSheetRow, type SheetRow, type R2ObjectRef } from "./backfillMatching";

const PROJECT_ID = "democrats_abroad";
const CITY_ID = "den_haag";
const BUCKET_NAME = "gwc-2026-photos";
const THUMB_MAX_DIMENSION = 300;
const MEDIUM_MAX_DIMENSION = 1200;
const FULL_MAX_DIMENSION = 2048;
const THUMB_QUALITY = 0.75;
const MEDIUM_QUALITY = 0.8;
const FULL_QUALITY = 0.85;

const DRY_RUN = process.argv.includes("--dry-run");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function scaledDimensions(width: number, height: number, maxDimension: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function generateVariants(bytes: Uint8Array) {
  const source = PhotonImage.new_from_byteslice(bytes);
  const fullDims = scaledDimensions(source.get_width(), source.get_height(), FULL_MAX_DIMENSION);
  const fullImage = resize(source, fullDims.width, fullDims.height, SamplingFilter.Lanczos3);
  const fullBytes = fullImage.get_bytes_jpeg(FULL_QUALITY);

  const mediumDims = scaledDimensions(fullImage.get_width(), fullImage.get_height(), MEDIUM_MAX_DIMENSION);
  const mediumImage = resize(fullImage, mediumDims.width, mediumDims.height, SamplingFilter.Lanczos3);
  const mediumBytes = mediumImage.get_bytes_jpeg(MEDIUM_QUALITY);

  const thumbDims = scaledDimensions(mediumImage.get_width(), mediumImage.get_height(), THUMB_MAX_DIMENSION);
  const thumbImage = resize(mediumImage, thumbDims.width, thumbDims.height, SamplingFilter.Lanczos3);
  const thumbBytes = thumbImage.get_bytes_jpeg(THUMB_QUALITY);

  source.free();
  fullImage.free();
  mediumImage.free();
  thumbImage.free();

  return { full: fullBytes, medium: mediumBytes, thumb: thumbBytes };
}

async function fetchSheetRows(formScriptUrl: string): Promise<SheetRow[]> {
  const res = await fetch(formScriptUrl);
  const data = (await res.json()) as { ok: boolean; rows?: SheetRow[] };
  if (!data.ok || !data.rows) {
    throw new Error("Failed to read rows from FORM_SCRIPT_URL");
  }
  return data.rows;
}

async function runD1Insert(
  accountId: string,
  apiToken: string,
  photo: { id: string; teamName: string; routeId: string | null; locationId: string; contact: string | null; r2Key: string; uploadedAt: number },
) {
  const sql = `INSERT INTO photos
    (id, project_id, city_id, route_id, location_id, task_title, team_name, contact, r2_key, mime_type, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'image/jpeg', ?)`;
  const params = [
    photo.id, PROJECT_ID, CITY_ID, photo.routeId, photo.locationId,
    `Location ${photo.locationId}`, photo.teamName, photo.contact, photo.r2Key, photo.uploadedAt,
  ];
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/scavenger_hunt_auth/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const data = (await res.json()) as { success: boolean; errors?: unknown[] };
  if (!data.success) {
    throw new Error(`D1 insert failed: ${JSON.stringify(data.errors)}`);
  }
}

async function main() {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const formScriptUrl = requireEnv("FORM_SCRIPT_URL");

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  console.log("Fetching sheet rows...");
  const sheetRows = await fetchSheetRows(formScriptUrl);
  console.log(`Loaded ${sheetRows.length} sheet rows.`);

  console.log("Listing existing R2 objects...");
  const listResult = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME }));
  const objectKeys = (listResult.Contents ?? [])
    .map((obj) => obj.Key)
    .filter((key): key is string => !!key && !key.includes("/")); // skip already-migrated keys (they contain "/")

  console.log(`Found ${objectKeys.length} legacy objects to process.`);

  const report: { key: string; status: string; detail?: string }[] = [];

  const parsedRefs = objectKeys.map((key) => ({ key, ref: parseR2Key(key) }));
  parsedRefs
    .filter((entry) => !entry.ref)
    .forEach((entry) => {
      report.push({ key: entry.key, status: "skipped", detail: "key did not match expected format" });
    });
  const validRefs = parsedRefs.filter(
    (entry): entry is { key: string; ref: R2ObjectRef } => !!entry.ref,
  );

  for (const { key, ref: photoRef } of validRefs) {
    try {
      const match = matchPhotoToSheetRow(photoRef, sheetRows);
      const getResult = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      const bytes = new Uint8Array(await getResult.Body!.transformToByteArray());

      const variants = generateVariants(bytes);
      const newPrefix = `${photoRef.locationId}_${photoRef.timestamp}`;
      const photoId = crypto.randomUUID();

      if (!DRY_RUN) {
        await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: `${newPrefix}/full.jpg`, Body: variants.full, ContentType: "image/jpeg" }));
        await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: `${newPrefix}/medium.jpg`, Body: variants.medium, ContentType: "image/jpeg" }));
        await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: `${newPrefix}/thumb.jpg`, Body: variants.thumb, ContentType: "image/jpeg" }));
        await runD1Insert(accountId, apiToken, {
          id: photoId,
          teamName: match.teamName,
          routeId: match.routeId,
          locationId: photoRef.locationId,
          contact: match.contact,
          r2Key: newPrefix,
          uploadedAt: Math.floor(photoRef.timestamp / 1000),
        });
      }

      report.push({ key, status: match.matched ? "migrated" : "migrated-unmatched" });
    } catch (error) {
      report.push({ key, status: "failed", detail: error instanceof Error ? error.message : String(error) });
    }
  }

  const reportPath = `backfill-report-${Date.now()}.json`;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Done${DRY_RUN ? " (dry run, no writes performed)" : ""}. Report: ${reportPath}`);
  console.log(`  migrated: ${report.filter((r) => r.status === "migrated").length}`);
  console.log(`  migrated-unmatched: ${report.filter((r) => r.status === "migrated-unmatched").length}`);
  console.log(`  failed: ${report.filter((r) => r.status === "failed").length}`);
  console.log(`  skipped: ${report.filter((r) => r.status === "skipped").length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Note: `task_title` is written as the placeholder `Location ${locationId}` here rather than looked up from YAML — resolving the real title requires knowing which route/city YAML file corresponds to each numeric `locationId`, which the sheet data alone doesn't disambiguate cleanly across routes. If precise historical titles matter, look up `location.challenge.name` per `locationId` from `src/data/text/en/projects/democrats_abroad/den_haag/*_loc_*.yaml` by hand (there are only a handful of locations) and hardcode a `locationId -> title` map at the top of this script before running for real — do not skip this silently; confirm with the user whether the placeholder is acceptable or whether real titles are needed before running the real (non-dry-run) migration.

---

- [ ] **Step 7: Dry run against production data**

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... FORM_SCRIPT_URL=... npm run backfill-photos -- --dry-run
```

Inspect the generated `backfill-report-*.json`. Confirm the counts look sane (roughly: `migrated` + `migrated-unmatched` + `skipped` ≈ total legacy photo count you expect from the event; `failed` should be 0 or explainable). Do not proceed to a real run until this looks right — flag anything surprising to the user rather than guessing.

---

- [ ] **Step 8: Real run**

Re-run the same command without `--dry-run`. Confirm via the gallery page (once Task 10 is deployed) or a direct D1 query (`npx wrangler d1 execute scavenger_hunt_auth --remote --command="SELECT COUNT(*) FROM photos"`) that the expected number of rows landed.

---

- [ ] **Step 9: Run full suite, lint, typecheck**

```bash
npm run test:run
npm run lint
npm run typecheck
```

Expected: all pass, 0 errors.

---

- [ ] **Step 10: Commit**

```bash
git add package.json scripts/backfillMatching.ts scripts/backfill-photos.ts scripts/test/backfillMatching.test.ts
git commit -m "feat: add one-off backfill script for Den Haag event photo metadata"
```
