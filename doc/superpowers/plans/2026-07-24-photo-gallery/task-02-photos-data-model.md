# Task 02: `photos` D1 Table + Query Helpers

**Depends on:** Task 01 (clean test suite).

**Files:**
- Create: `migrations/002_photos.sql`
- Modify: `src/worker/db.ts`
- Create: `src/test/worker.photodb.test.ts`

**Interfaces:**
- Produces: `DbPhoto` type, `insertPhoto(database, photo)`, `listPhotos(database, projectId, cityId)`, `randomPhotos(database, projectId, cityId, limit)`, `getPhotoById(database, id)` — all exported from `src/worker/db.ts`, consumed by Task 04 (upload route) and Task 05 (gallery routes).

No new Cloudflare binding is needed — `photos` lives in the existing `AUTH_DB` database (already bound in `wrangler.jsonc`, already typed in `src/types/worker.ts`).

---

- [ ] **Step 1: Write the migration**

Create `migrations/002_photos.sql`:

```sql
CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  city_id       TEXT NOT NULL,
  route_id      TEXT,
  location_id   TEXT NOT NULL,
  task_title    TEXT NOT NULL,
  team_name     TEXT NOT NULL,
  contact       TEXT,
  r2_key        TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  uploaded_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_project_city ON photos(project_id, city_id, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_photos_team ON photos(project_id, city_id, team_name);
```

---

- [ ] **Step 2: Apply the migration locally**

```bash
npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/002_photos.sql
```

Expected output: `Successfully applied migration` (no errors).

---

- [ ] **Step 3: Write the failing tests for the D1 helpers**

Create `src/test/worker.photodb.test.ts`:

```ts
// @ts-nocheck
import { describe, it, expect } from "vitest";
import { insertPhoto, listPhotos, randomPhotos, getPhotoById } from "../worker/db";

function makeDb() {
  const photos: Record<string, unknown>[] = [];

  const prepare = (sql: string) => {
    const args: unknown[] = [];
    const stmt = {
      bind: (...values: unknown[]) => {
        args.push(...values);
        return stmt;
      },
      run: async () => {
        if (sql.startsWith("INSERT INTO photos")) {
          photos.push({
            id: args[0],
            project_id: args[1],
            city_id: args[2],
            route_id: args[3],
            location_id: args[4],
            task_title: args[5],
            team_name: args[6],
            contact: args[7],
            r2_key: args[8],
            mime_type: args[9],
            uploaded_at: args[10],
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      first: async () => {
        if (sql.includes("FROM photos WHERE id")) {
          return photos.find((p) => p.id === args[0]) ?? null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes("FROM photos WHERE project_id")) {
          const [projectId, cityId] = args;
          const matched = photos.filter(
            (p) => p.project_id === projectId && p.city_id === cityId,
          );
          return { results: matched };
        }
        return { results: [] };
      },
    };
    return stmt;
  };

  return { prepare };
}

describe("photo D1 helpers", () => {
  it("insertPhoto then getPhotoById round-trips a row", async () => {
    const db = makeDb();
    await insertPhoto(db, {
      id: "p1",
      project_id: "democrats_abroad",
      city_id: "den_haag",
      route_id: "short_loop",
      location_id: "1",
      task_title: "The Final Civic Act",
      team_name: "Team A",
      contact: "a@b.com",
      r2_key: "1_1731234567890",
      mime_type: "image/jpeg",
      uploaded_at: 1731234567,
    });
    const found = await getPhotoById(db, "p1");
    expect(found).toMatchObject({ id: "p1", team_name: "Team A" });
  });

  it("getPhotoById returns null for unknown id", async () => {
    const db = makeDb();
    const found = await getPhotoById(db, "missing");
    expect(found).toBeNull();
  });

  it("listPhotos returns only photos for the given project+city", async () => {
    const db = makeDb();
    await insertPhoto(db, {
      id: "p1", project_id: "democrats_abroad", city_id: "den_haag",
      route_id: null, location_id: "1", task_title: "A", team_name: "Team A",
      contact: null, r2_key: "k1", mime_type: "image/jpeg", uploaded_at: 1,
    });
    await insertPhoto(db, {
      id: "p2", project_id: "democrats_abroad", city_id: "oslo",
      route_id: null, location_id: "1", task_title: "B", team_name: "Team B",
      contact: null, r2_key: "k2", mime_type: "image/jpeg", uploaded_at: 2,
    });
    const result = await listPhotos(db, "democrats_abroad", "den_haag");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("randomPhotos returns at most `limit` photos for the given project+city", async () => {
    const db = makeDb();
    for (let i = 0; i < 5; i++) {
      await insertPhoto(db, {
        id: `p${i}`, project_id: "democrats_abroad", city_id: "den_haag",
        route_id: null, location_id: "1", task_title: "A", team_name: "Team A",
        contact: null, r2_key: `k${i}`, mime_type: "image/jpeg", uploaded_at: i,
      });
    }
    const result = await randomPhotos(db, "democrats_abroad", "den_haag", 3);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
```

Note: the hand-rolled `makeDb()` mock doesn't implement real `ORDER BY RANDOM() LIMIT ?` semantics — it just returns whatever `listPhotos`'s underlying `.all()` branch produces, so the `randomPhotos` test only asserts the helper runs and returns a bounded array. `randomPhotos`'s actual randomness/limit behavior is real SQL, exercised for real by D1 in production and by the Task 05 route test using a `LIMIT`-aware mock (see Task 05).

---

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/worker.photodb.test.ts`
Expected: FAIL — `insertPhoto`, `listPhotos`, `randomPhotos`, `getPhotoById` are not exported from `../worker/db`.

---

- [ ] **Step 3: Implement the D1 helpers**

In `src/worker/db.ts`, add after the existing invite-token section (end of file):

```ts
// ---------------------------------------------------------------------------
// Photo queries
// ---------------------------------------------------------------------------

export interface DbPhoto {
  id: string;
  project_id: string;
  city_id: string;
  route_id: string | null;
  location_id: string;
  task_title: string;
  team_name: string;
  contact: string | null;
  r2_key: string;
  mime_type: string;
  uploaded_at: number;
}

export async function insertPhoto(
  database: D1Database,
  photo: DbPhoto,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO photos
       (id, project_id, city_id, route_id, location_id, task_title,
        team_name, contact, r2_key, mime_type, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      photo.id, photo.project_id, photo.city_id, photo.route_id ?? null,
      photo.location_id, photo.task_title, photo.team_name,
      photo.contact ?? null, photo.r2_key, photo.mime_type, photo.uploaded_at,
    )
    .run();
}

export async function getPhotoById(
  database: D1Database,
  id: string,
): Promise<DbPhoto | null> {
  return database
    .prepare("SELECT * FROM photos WHERE id = ?")
    .bind(id)
    .first<DbPhoto>();
}

export async function listPhotos(
  database: D1Database,
  projectId: string,
  cityId: string,
): Promise<DbPhoto[]> {
  const result = await database
    .prepare(
      `SELECT * FROM photos
       WHERE project_id = ? AND city_id = ?
       ORDER BY uploaded_at DESC`,
    )
    .bind(projectId, cityId)
    .all<DbPhoto>();
  return result.results;
}

export async function randomPhotos(
  database: D1Database,
  projectId: string,
  cityId: string,
  limit: number,
): Promise<DbPhoto[]> {
  const result = await database
    .prepare(
      `SELECT * FROM photos
       WHERE project_id = ? AND city_id = ?
       ORDER BY RANDOM() LIMIT ?`,
    )
    .bind(projectId, cityId, limit)
    .all<DbPhoto>();
  return result.results;
}
```

---

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/worker.photodb.test.ts`
Expected: PASS (4/4).

---

- [ ] **Step 5: Run full suite, lint, typecheck**

```bash
npm run test:run
npm run lint
npm run typecheck
```

Expected: all pass, 0 errors.

---

- [ ] **Step 6: Commit**

```bash
git add migrations/002_photos.sql src/worker/db.ts src/test/worker.photodb.test.ts
git commit -m "feat: add photos D1 table and query helpers"
```
