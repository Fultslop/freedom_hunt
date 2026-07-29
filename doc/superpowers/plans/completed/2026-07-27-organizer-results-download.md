# Organizer Results Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose D1-stored form-submission data to organizers via a new `/:project/:city/results_download` page — a per-route grid for coverage-scanning, an inline expandable report for reading, and a one-file `.md` export.

**Architecture:** A new worker route (`GET /results/:project/:city/submissions`) returns all `form_submissions` rows for a city, gated the same way as the photo gallery. The frontend loads that plus a route index built from the city's `routes.yaml`/location YAML (mirroring how `RoutePage` already resolves location content), and derives everything else — grid rows, completion counts, the inline report, and the `.md` export — from pure functions over those two in-memory datasets. No new database table.

**Tech Stack:** Svelte 5 (runes), TypeScript, Cloudflare D1/Workers, Vitest + @testing-library/svelte.

## Global Constraints

- TypeScript only; no `.js`/`.jsx`/`.tsx` in `src/`.
- Co-located `.css` per component, `var(--color-*)` tokens, BEM-like class names (`component-name__element--modifier`).
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) — no Svelte 4 `$:`.
- ESLint: `max-len` 100 (except lines starting with `<` in `.svelte` files), `curly: all` (always braces, even one-liners), no bare `return;` (`no-restricted-syntax`), `id-length` min 3 with a small exception list (`id`, `to`, `ok`, and a few single letters — do not rely on unlisted single-letter names), `complexity` max 10 per function, `unused-imports/no-unused-imports` error. Worker route files and `.test.ts` files have `complexity`/`no-useless-return` relaxed; `src/test/worker*.test.ts` is excluded from lint entirely (use `// @ts-nocheck` at the top of new worker test files, matching existing ones).
- Route ordering in `App.svelte` matters: `svelte-spa-router` matches the first pattern that fits, so any literal path segment (e.g. `results_download`) must be declared before the `/:project/:city/:route` wildcard that would otherwise swallow it.
- `location_id` in `form_submissions` is a per-route ordinal (`locationOrdinalAt`'s output), not a stable ID — it must always be resolved as `(routeId, locationId)` together, never alone. See spec section "Why resolution is `(route_id, location_id)`" for the full rationale.

---

### Task 1: `ResultsSubmission` type and `listFormSubmissions` DB query

**Files:**
- Create: `src/types/results.ts`
- Modify: `src/worker/db.ts` (add `listFormSubmissions`, appended after the existing "Form submission queries" section)
- Test: `src/test/worker.formsubmissiondb.test.ts`

**Interfaces:**
- Produces: `ResultsSubmission { id: string; locationId: string; routeId: string | null; teamName: string; answers: Record<string, unknown>; submittedAt: number }` (`src/types/results.ts`)
- Produces: `listFormSubmissions(database: D1Database, projectId: string, cityId: string): Promise<DbFormSubmission[]>` (`src/worker/db.ts`), ordered by `submitted_at ASC`

- [ ] **Step 1: Write `src/types/results.ts`**

```ts
export interface ResultsSubmission {
  id: string;
  locationId: string;
  routeId: string | null;
  teamName: string;
  answers: Record<string, unknown>;
  submittedAt: number;
}
```

- [ ] **Step 2: Write the failing DB test**

Create `src/test/worker.formsubmissiondb.test.ts`:

```ts
// @ts-nocheck
import { describe, it, expect } from "vitest";
import { insertFormSubmission, listFormSubmissions } from "../worker/db";

function makeDb() {
  const submissions: Record<string, unknown>[] = [];

  const prepare = (sql: string) => {
    const args: unknown[] = [];
    const stmt = {
      bind: (...values: unknown[]) => {
        args.push(...values);
        return stmt;
      },
      run: async () => {
        if (sql.startsWith("INSERT INTO form_submissions")) {
          submissions.push({
            id: args[0],
            project_id: args[1],
            city_id: args[2],
            route_id: args[3],
            location_id: args[4],
            team_name: args[5],
            contact: args[6],
            answers: args[7],
            submitted_at: args[8],
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      all: async () => {
        if (sql.includes("FROM form_submissions") && sql.includes("WHERE project_id")) {
          const [projectId, cityId] = args;
          const matched = submissions
            .filter((row) => row.project_id === projectId && row.city_id === cityId)
            .sort((rowA, rowB) => (rowA.submitted_at as number) - (rowB.submitted_at as number));
          return { results: matched };
        }
        return { results: [] };
      },
    };
    return stmt;
  };

  return { prepare };
}

describe("listFormSubmissions", () => {
  it("returns only submissions for the given project+city, ordered by submitted_at ASC", async () => {
    const db = makeDb();
    await insertFormSubmission(db, {
      id: "s2", project_id: "demo", city_id: "paris", route_id: "riverside_route",
      location_id: "1", team_name: "Team B", contact: null,
      answers: JSON.stringify({ found: true }), submitted_at: 200,
    });
    await insertFormSubmission(db, {
      id: "s1", project_id: "demo", city_id: "paris", route_id: "riverside_route",
      location_id: "1", team_name: "Team A", contact: null,
      answers: JSON.stringify({ found: true }), submitted_at: 100,
    });
    await insertFormSubmission(db, {
      id: "s3", project_id: "demo", city_id: "new_york", route_id: "manhattan_route",
      location_id: "1", team_name: "Team C", contact: null,
      answers: JSON.stringify({ found: true }), submitted_at: 50,
    });
    const result = await listFormSubmissions(db, "demo", "paris");
    expect(result.map((row) => row.id)).toEqual(["s1", "s2"]);
  });

  it("returns an empty array when no submissions match", async () => {
    const db = makeDb();
    const result = await listFormSubmissions(db, "demo", "oslo");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:run -- worker.formsubmissiondb`
Expected: FAIL — `listFormSubmissions is not exported` (or similar) from `../worker/db`.

- [ ] **Step 4: Add `listFormSubmissions` to `src/worker/db.ts`**

Append immediately after the existing `insertFormSubmission` function (still inside the "Form submission queries" section):

```ts
export async function listFormSubmissions(
  database: D1Database,
  projectId: string,
  cityId: string,
): Promise<DbFormSubmission[]> {
  const result = await database
    .prepare(
      `SELECT * FROM form_submissions
       WHERE project_id = ? AND city_id = ?
       ORDER BY submitted_at ASC`,
    )
    .bind(projectId, cityId)
    .all<DbFormSubmission>();
  return result.results;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- worker.formsubmissiondb`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/types/results.ts src/worker/db.ts src/test/worker.formsubmissiondb.test.ts
git commit -m "feat: add listFormSubmissions D1 query and ResultsSubmission type"
```

---

### Task 2: `GET /results/:project/:city/submissions` worker route

**Files:**
- Create: `src/worker/routes/resultsRoutes.ts`
- Modify: `src/worker.ts` (wire the new handler into the fetch chain)
- Test: `src/test/worker.results.test.ts`

**Interfaces:**
- Consumes: `listFormSubmissions` and `DbFormSubmission` (Task 1, `src/worker/db.ts`); `ResultsSubmission` (Task 1, `src/types/results.ts`); `requireParticipantForProject` (`src/worker/auth.ts`, existing).
- Produces: `handleResultsRoutes(request: Request, url: URL, env: Env): Promise<Response | null>`, returning `{ ok: true, submissions: ResultsSubmission[] }` on success.

- [ ] **Step 1: Write the failing route test**

Create `src/test/worker.results.test.ts`:

```ts
// @ts-nocheck
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../worker";
import { createToken } from "../worker/auth";
import type { TokenPayload } from "../types/auth";
import type { Env } from "../types/worker";

const TEST_SECRET = "test-secret";
const TEST_PAYLOAD: TokenPayload = {
  project: "demo", teamName: "Team A", contact: "a@b.com",
  isAdmin: false, exp: Math.floor(Date.now() / 1000) + 3600,
};

let authToken: string;
beforeEach(async () => {
  authToken = await createToken(TEST_PAYLOAD, TEST_SECRET);
});

const SAMPLE_SUBMISSIONS = [
  {
    id: "s1", project_id: "demo", city_id: "paris", route_id: "riverside_route",
    location_id: "1", team_name: "Team A", contact: "a@b.com",
    answers: JSON.stringify({ found: true }), submitted_at: 100,
  },
  {
    id: "s2", project_id: "demo", city_id: "paris", route_id: "riverside_route",
    location_id: "1", team_name: "Team B", contact: "b@b.com",
    answers: JSON.stringify({ found: false }), submitted_at: 200,
  },
];

function makeDb(submissions = SAMPLE_SUBMISSIONS) {
  return {
    prepare: (sql: string) => {
      const args: unknown[] = [];
      const stmt = {
        bind: (...values: unknown[]) => { args.push(...values); return stmt; },
        all: async () => {
          if (sql.includes("WHERE project_id = ? AND city_id = ?")) {
            const [project, city] = args;
            return {
              results: submissions.filter(
                (row) => row.project_id === project && row.city_id === city,
              ),
            };
          }
          return { results: [] };
        },
      };
      return stmt;
    },
  };
}

describe("GET /results/:project/:city/submissions", () => {
  it("returns 403 when not authenticated", async () => {
    const request = new Request("https://example.com/results/demo/paris/submissions");
    const response = await worker.fetch(
      request,
      { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env,
    );
    expect(response.status).toBe(403);
  });

  it("returns parsed submissions for the project+city, without contact", async () => {
    const request = new Request("https://example.com/results/demo/paris/submissions", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(
      request,
      { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env,
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.submissions).toHaveLength(2);
    expect(data.submissions[0]).toEqual({
      id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
      answers: { found: true }, submittedAt: 100,
    });
    expect(data.submissions[0].contact).toBeUndefined();
  });

  it("returns 403 when the token's project doesn't match the URL", async () => {
    const otherToken = await createToken({ ...TEST_PAYLOAD, project: "other" }, TEST_SECRET);
    const request = new Request("https://example.com/results/demo/paris/submissions", {
      headers: { Cookie: `freedom_hunt_auth=${otherToken}` },
    });
    const response = await worker.fetch(
      request,
      { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env,
    );
    expect(response.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- worker.results`
Expected: FAIL — request falls through to the 404 handler (route not wired yet), so status is 404, not 403/200.

- [ ] **Step 3: Write `src/worker/routes/resultsRoutes.ts`**

```ts
import type { Env } from "../../types/worker";
import type { DbFormSubmission } from "../db";
import type { ResultsSubmission } from "../../types/results";
import { requireParticipantForProject } from "../auth";
import { json } from "../utils";
import { listFormSubmissions } from "../db";

function toResultsSubmission(submission: DbFormSubmission): ResultsSubmission {
  return {
    id: submission.id,
    locationId: submission.location_id,
    routeId: submission.route_id,
    teamName: submission.team_name,
    answers: JSON.parse(submission.answers) as Record<string, unknown>,
    submittedAt: submission.submitted_at,
  };
}

export async function handleResultsRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "GET") {
    return null;
  }
  const match = url.pathname.match(/^\/results\/([^/]+)\/([^/]+)\/submissions$/);
  if (!match) {
    return null;
  }
  const [, project, city] = match;
  const authPayload = await requireParticipantForProject(request, env, project);
  if (!authPayload) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }
  const submissions = await listFormSubmissions(env.AUTH_DB, project, city);
  return json({ ok: true, submissions: submissions.map(toResultsSubmission) });
}
```

- [ ] **Step 4: Wire the handler into `src/worker.ts`**

```ts
import { handleResultsRoutes } from "./worker/routes/resultsRoutes";
```

Add this import alongside the other route imports, then add the call into the chain (after `handleGalleryRoutes`, before `handleEditorRoutes`):

```ts
      (await handleGalleryRoutes(request, url, env)) ??
      (await handleResultsRoutes(request, url, env)) ??
      (await handleEditorRoutes(request, url, env)) ??
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- worker.results`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/worker/routes/resultsRoutes.ts src/worker.ts src/test/worker.results.test.ts
git commit -m "feat: add GET /results/:project/:city/submissions worker route"
```

---

### Task 3: Frontend API client — `fetchResultsSubmissions`

**Files:**
- Modify: `src/utils/api.ts` (add a "Results" section at the end, mirroring the "Gallery" section)
- Modify: `src/test/api.test.ts` (add tests to a new "Results" section at the end)

**Interfaces:**
- Consumes: `ResultsSubmission` (Task 1, `src/types/results.ts`)
- Produces: `fetchResultsSubmissions(project: string, city: string): Promise<ResultsSubmissionsResponse>`, `ResultsSubmissionsResponse { ok: boolean; submissions?: ResultsSubmission[]; error?: string }`

- [ ] **Step 1: Write the failing test**

Append to `src/test/api.test.ts` (add `fetchResultsSubmissions` to the existing import list at the top, and add this new section at the end of the file):

```ts
// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

test("fetchResultsSubmissions GETs /results/:project/:city/submissions", async () => {
  mockFetch({ ok: true, submissions: [] });
  const result = await fetchResultsSubmissions("demo", "paris");
  expect(fetch).toHaveBeenCalledWith("/results/demo/paris/submissions");
  expect(result.ok).toBe(true);
});

test("fetchResultsSubmissions returns ok: false on server error", async () => {
  mockFetch({ ok: false, error: "Forbidden" });
  const result = await fetchResultsSubmissions("demo", "paris");
  expect(result.ok).toBe(false);
  expect(result.error).toBe("Forbidden");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- api.test`
Expected: FAIL — `fetchResultsSubmissions` is not exported from `../utils/api`.

- [ ] **Step 3: Add `fetchResultsSubmissions` to `src/utils/api.ts`**

Add `import type { ResultsSubmission } from "../types/results";` to the top imports (alongside the existing `GalleryPhoto` import), then append at the end of the file:

```ts
// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface ResultsSubmissionsResponse {
  ok: boolean;
  submissions?: ResultsSubmission[];
  error?: string;
}

export async function fetchResultsSubmissions(
  project: string,
  city: string,
): Promise<ResultsSubmissionsResponse> {
  const res = await fetch(`/results/${project}/${city}/submissions`);
  return res.json() as Promise<ResultsSubmissionsResponse>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- api.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/api.ts src/test/api.test.ts
git commit -m "feat: add fetchResultsSubmissions API client"
```

---

### Task 4: `resultsData.ts` — pure grid, report, and formatting functions

**Files:**
- Create: `src/utils/resultsData.ts`
- Test: `src/test/resultsData.test.ts`

**Interfaces:**
- Consumes: `ResultsSubmission` (Task 1, `src/types/results.ts`); `FormField` (`src/types/data.ts`, existing).
- Produces:
  - `RouteLocationEntry { ordinal: number; name: string; fields: FormField[] }`
  - `RouteIndex = Record<string, RouteLocationEntry[]>`
  - `GridRow { ordinal: number; locationName: string; teamName: string; submission: ResultsSubmission | undefined; submissionCount: number }`
  - `LocationTeamAnswer { teamName: string; submission: ResultsSubmission; submissionCount: number }`
  - `teamsForRoute(submissions: ResultsSubmission[], routeId: string): string[]`
  - `submissionsForCell(submissions: ResultsSubmission[], routeId: string, ordinal: number, teamName: string): ResultsSubmission[]`
  - `latestOf(subs: ResultsSubmission[]): ResultsSubmission | undefined`
  - `earliestOf(subs: ResultsSubmission[]): ResultsSubmission | undefined`
  - `buildRouteGrid(entries: RouteLocationEntry[], teams: string[], submissions: ResultsSubmission[], routeId: string): GridRow[]`
  - `completionCount(entry: RouteLocationEntry, teams: string[], submissions: ResultsSubmission[], routeId: string): { answered: number; total: number }`
  - `buildLocationReport(entry: RouteLocationEntry, teams: string[], submissions: ResultsSubmission[], routeId: string): LocationTeamAnswer[]` (sorted fastest-first by each team's earliest submission at that location)
  - `visibleFields(fields: FormField[]): FormField[]` (drops `section`/`photo` fields)
  - `formatAnswerValue(field: FormField, value: unknown): string`

- [ ] **Step 1: Write the failing tests**

Create `src/test/resultsData.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  teamsForRoute,
  submissionsForCell,
  latestOf,
  earliestOf,
  buildRouteGrid,
  completionCount,
  buildLocationReport,
  visibleFields,
  formatAnswerValue,
  type RouteLocationEntry,
} from "../utils/resultsData";
import type { ResultsSubmission } from "../types/results";
import type { FormField } from "../types/data";

function makeSubmission(overrides: Partial<ResultsSubmission>): ResultsSubmission {
  return {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: {}, submittedAt: 100, ...overrides,
  };
}

const ENTRY: RouteLocationEntry = {
  ordinal: 1,
  name: "Eiffel Tower",
  fields: [
    { id: "found", type: "boolean", label: "Did you find it?" },
    { id: "notes", type: "string", label: "Any notes?" },
  ],
};

describe("teamsForRoute", () => {
  it("returns distinct, sorted team names for the given route only", () => {
    const submissions = [
      makeSubmission({ teamName: "Team B", routeId: "riverside_route" }),
      makeSubmission({ teamName: "Team A", routeId: "riverside_route" }),
      makeSubmission({ teamName: "Team A", routeId: "riverside_route" }),
      makeSubmission({ teamName: "Team C", routeId: "left_bank_route" }),
    ];
    expect(teamsForRoute(submissions, "riverside_route")).toEqual(["Team A", "Team B"]);
  });
});

describe("submissionsForCell", () => {
  it("matches on routeId, locationId (as a number), and teamName together", () => {
    const submissions = [
      makeSubmission({ id: "s1", routeId: "riverside_route", locationId: "1", teamName: "Team A" }),
      makeSubmission({ id: "s2", routeId: "left_bank_route", locationId: "1", teamName: "Team A" }),
      makeSubmission({ id: "s3", routeId: "riverside_route", locationId: "2", teamName: "Team A" }),
      makeSubmission({ id: "s4", routeId: "riverside_route", locationId: "1", teamName: "Team B" }),
    ];
    const result = submissionsForCell(submissions, "riverside_route", 1, "Team A");
    expect(result.map((sub) => sub.id)).toEqual(["s1"]);
  });
});

describe("latestOf / earliestOf", () => {
  const subs = [
    makeSubmission({ id: "s1", submittedAt: 200 }),
    makeSubmission({ id: "s2", submittedAt: 100 }),
    makeSubmission({ id: "s3", submittedAt: 300 }),
  ];

  it("latestOf returns the submission with the greatest submittedAt", () => {
    expect(latestOf(subs)?.id).toBe("s3");
  });

  it("earliestOf returns the submission with the smallest submittedAt", () => {
    expect(earliestOf(subs)?.id).toBe("s2");
  });

  it("both return undefined for an empty array", () => {
    expect(latestOf([])).toBeUndefined();
    expect(earliestOf([])).toBeUndefined();
  });
});

describe("buildRouteGrid", () => {
  it("cross-products teams x entries, with dash-equivalent undefined for missing cells", () => {
    const submissions = [makeSubmission({ teamName: "Team A", locationId: "1" })];
    const rows = buildRouteGrid([ENTRY], ["Team A", "Team B"], submissions, "riverside_route");
    expect(rows).toHaveLength(2);
    const rowA = rows.find((row) => row.teamName === "Team A");
    const rowB = rows.find((row) => row.teamName === "Team B");
    expect(rowA?.submission?.teamName).toBe("Team A");
    expect(rowB?.submission).toBeUndefined();
  });

  it("uses the latest submission and reports the submission count for a resubmitted cell", () => {
    const submissions = [
      makeSubmission({ id: "s1", teamName: "Team A", locationId: "1", submittedAt: 100 }),
      makeSubmission({ id: "s2", teamName: "Team A", locationId: "1", submittedAt: 200 }),
    ];
    const rows = buildRouteGrid([ENTRY], ["Team A"], submissions, "riverside_route");
    expect(rows[0].submission?.id).toBe("s2");
    expect(rows[0].submissionCount).toBe(2);
  });
});

describe("completionCount", () => {
  it("counts teams with at least one submission against the route's total team count", () => {
    const submissions = [makeSubmission({ teamName: "Team A", locationId: "1" })];
    const result = completionCount(ENTRY, ["Team A", "Team B", "Team C"], submissions, "riverside_route");
    expect(result).toEqual({ answered: 1, total: 3 });
  });
});

describe("buildLocationReport", () => {
  it("includes only teams with a submission, ordered by their earliest submission at that location", () => {
    const submissions = [
      makeSubmission({ id: "s1", teamName: "Team A", locationId: "1", submittedAt: 500 }),
      makeSubmission({ id: "s2", teamName: "Team B", locationId: "1", submittedAt: 100 }),
    ];
    const report = buildLocationReport(ENTRY, ["Team A", "Team B", "Team C"], submissions, "riverside_route");
    expect(report.map((row) => row.teamName)).toEqual(["Team B", "Team A"]);
  });

  it("orders by a team's earliest submission even if their latest answer came later", () => {
    const submissions = [
      makeSubmission({ id: "s1", teamName: "Team A", locationId: "1", submittedAt: 50 }),
      makeSubmission({ id: "s2", teamName: "Team A", locationId: "1", submittedAt: 900 }),
      makeSubmission({ id: "s3", teamName: "Team B", locationId: "1", submittedAt: 400 }),
    ];
    const report = buildLocationReport(ENTRY, ["Team A", "Team B"], submissions, "riverside_route");
    expect(report.map((row) => row.teamName)).toEqual(["Team A", "Team B"]);
    expect(report[0].submission.id).toBe("s2");
  });
});

describe("visibleFields", () => {
  it("drops section and photo fields, keeps everything else", () => {
    const fields: FormField[] = [
      { type: "section", label: "Heading" },
      { id: "photo", type: "photo", label: "Upload" },
      { id: "found", type: "boolean", label: "Found it?" },
    ];
    expect(visibleFields(fields).map((field) => field.id)).toEqual(["found"]);
  });
});

describe("formatAnswerValue", () => {
  const boolField: FormField = { id: "found", type: "boolean", label: "Found it?" };
  const multipleField: FormField = { id: "cats", type: "multiple", label: "Categories", options: [] };

  it("renders boolean true/false as Yes/No", () => {
    expect(formatAnswerValue(boolField, true)).toBe("Yes");
    expect(formatAnswerValue(boolField, false)).toBe("No");
  });

  it("joins multiple-select array values with commas", () => {
    expect(formatAnswerValue(multipleField, ["Race", "History"])).toBe("Race, History");
  });

  it("returns 'No answer' for undefined, null, or empty string", () => {
    const strField: FormField = { id: "notes", type: "string", label: "Notes" };
    expect(formatAnswerValue(strField, undefined)).toBe("No answer");
    expect(formatAnswerValue(strField, null)).toBe("No answer");
    expect(formatAnswerValue(strField, "")).toBe("No answer");
  });

  it("stringifies other values as-is", () => {
    const numField: FormField = { id: "count", type: "number", label: "Count" };
    expect(formatAnswerValue(numField, 42)).toBe("42");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- resultsData`
Expected: FAIL — `../utils/resultsData` doesn't exist.

- [ ] **Step 3: Write `src/utils/resultsData.ts`**

```ts
import type { FormField } from "../types/data";
import type { ResultsSubmission } from "../types/results";

export interface RouteLocationEntry {
  ordinal: number;
  name: string;
  fields: FormField[];
}

export type RouteIndex = Record<string, RouteLocationEntry[]>;

export interface GridRow {
  ordinal: number;
  locationName: string;
  teamName: string;
  submission: ResultsSubmission | undefined;
  submissionCount: number;
}

export interface LocationTeamAnswer {
  teamName: string;
  submission: ResultsSubmission;
  submissionCount: number;
}

export function teamsForRoute(submissions: ResultsSubmission[], routeId: string): string[] {
  const names = submissions
    .filter((sub) => sub.routeId === routeId)
    .map((sub) => sub.teamName);
  return [...new Set(names)].sort();
}

export function submissionsForCell(
  submissions: ResultsSubmission[],
  routeId: string,
  ordinal: number,
  teamName: string,
): ResultsSubmission[] {
  return submissions.filter(
    (sub) =>
      sub.routeId === routeId &&
      Number(sub.locationId) === ordinal &&
      sub.teamName === teamName,
  );
}

export function latestOf(subs: ResultsSubmission[]): ResultsSubmission | undefined {
  return subs.reduce<ResultsSubmission | undefined>((latest, sub) => {
    if (!latest || sub.submittedAt > latest.submittedAt) {
      return sub;
    }
    return latest;
  }, undefined);
}

export function earliestOf(subs: ResultsSubmission[]): ResultsSubmission | undefined {
  return subs.reduce<ResultsSubmission | undefined>((earliest, sub) => {
    if (!earliest || sub.submittedAt < earliest.submittedAt) {
      return sub;
    }
    return earliest;
  }, undefined);
}

export function buildRouteGrid(
  entries: RouteLocationEntry[],
  teams: string[],
  submissions: ResultsSubmission[],
  routeId: string,
): GridRow[] {
  const rows: GridRow[] = [];
  for (const entry of entries) {
    for (const teamName of teams) {
      const cellSubs = submissionsForCell(submissions, routeId, entry.ordinal, teamName);
      rows.push({
        ordinal: entry.ordinal,
        locationName: entry.name,
        teamName,
        submission: latestOf(cellSubs),
        submissionCount: cellSubs.length,
      });
    }
  }
  return rows;
}

export function completionCount(
  entry: RouteLocationEntry,
  teams: string[],
  submissions: ResultsSubmission[],
  routeId: string,
): { answered: number; total: number } {
  const answered = teams.filter(
    (teamName) => submissionsForCell(submissions, routeId, entry.ordinal, teamName).length > 0,
  ).length;
  return { answered, total: teams.length };
}

export function buildLocationReport(
  entry: RouteLocationEntry,
  teams: string[],
  submissions: ResultsSubmission[],
  routeId: string,
): LocationTeamAnswer[] {
  const report: LocationTeamAnswer[] = [];
  for (const teamName of teams) {
    const cellSubs = submissionsForCell(submissions, routeId, entry.ordinal, teamName);
    const latest = latestOf(cellSubs);
    if (latest) {
      report.push({ teamName, submission: latest, submissionCount: cellSubs.length });
    }
  }
  return report.sort((rowA, rowB) => {
    const earliestA = submissionsForCell(submissions, routeId, entry.ordinal, rowA.teamName);
    const earliestB = submissionsForCell(submissions, routeId, entry.ordinal, rowB.teamName);
    const timeA = earliestOf(earliestA)?.submittedAt ?? 0;
    const timeB = earliestOf(earliestB)?.submittedAt ?? 0;
    return timeA - timeB;
  });
}

const SKIP_FIELD_TYPES = new Set(["section", "photo"]);

export function visibleFields(fields: FormField[]): FormField[] {
  return fields.filter((field) => !SKIP_FIELD_TYPES.has(field.type));
}

export function formatAnswerValue(field: FormField, value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "No answer";
  }
  if (field.type === "boolean") {
    return value ? "Yes" : "No";
  }
  if (field.type === "radio" || field.type === "multiple") {
    return Array.isArray(value) ? value.join(", ") : String(value);
  }
  return String(value);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- resultsData`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/resultsData.ts src/test/resultsData.test.ts
git commit -m "feat: add pure results-grid, report, and formatting helpers"
```

---

### Task 5: `resultsRouteIndex.ts` — build a `RouteIndex` from a city's YAML

**Files:**
- Create: `src/utils/resultsRouteIndex.ts`
- Test: `src/test/resultsRouteIndex.test.ts`

**Interfaces:**
- Consumes: `loadText` (`src/utils/loadText.ts`, existing); `loadLocations` (`src/utils/loadLocations.ts`, existing); `isLocationEntry` (`src/utils/routeEntries.ts`, existing); `RoutesData` (`src/types/data.ts`, existing); `RouteLocationEntry`, `RouteIndex` (Task 4, `src/utils/resultsData.ts`).
- Produces: `buildRouteIndex(lang: string, project: string, city: string): Promise<RouteIndex>`

- [ ] **Step 1: Write the failing test**

Create `src/test/resultsRouteIndex.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { buildRouteIndex } from "../utils/resultsRouteIndex";
import { loadText } from "../utils/loadText";
import { loadLocations } from "../utils/loadLocations";

vi.mock("../utils/loadText");
vi.mock("../utils/loadLocations");

const ROUTES_DATA = {
  riverside_route: { description: "...", locations: ["001_loc_eiffel", "002_text_bridge", "003_loc_louvre"] },
};

const RIVERSIDE_ENTRIES = [
  {
    "template-type": "location", title: "Eiffel Tower", name: { value: "Eiffel Tower" },
    challenge: { name: "", description: "", form: [{ id: "found", type: "boolean", label: "Found it?" }] },
  },
  { "template-type": "text", title: "Bridge", text: "..." },
  {
    "template-type": "location", title: "Louvre", name: { value: "The Louvre" },
    challenge: { name: "", description: "" },
  },
];

describe("buildRouteIndex", () => {
  it("returns an empty object when the city has no routes.yaml", async () => {
    (loadText as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await buildRouteIndex("en", "demo", "unknown_city");
    expect(result).toEqual({});
  });

  it("only counts location-type entries toward ordinal, skipping non-location entries", async () => {
    (loadText as ReturnType<typeof vi.fn>).mockResolvedValue(ROUTES_DATA);
    (loadLocations as ReturnType<typeof vi.fn>).mockResolvedValue(RIVERSIDE_ENTRIES);
    const result = await buildRouteIndex("en", "demo", "paris");
    // The 3rd yaml file (003_loc_louvre) is the 2nd location-type entry overall
    // (the text entry in between doesn't count), so its ordinal is 2, not 3.
    expect(result.riverside_route.map((entry) => entry.ordinal)).toEqual([1]);
  });

  it("excludes location entries that have no form", async () => {
    (loadText as ReturnType<typeof vi.fn>).mockResolvedValue(ROUTES_DATA);
    (loadLocations as ReturnType<typeof vi.fn>).mockResolvedValue(RIVERSIDE_ENTRIES);
    const result = await buildRouteIndex("en", "demo", "paris");
    expect(result.riverside_route).toHaveLength(1);
    expect(result.riverside_route[0].name).toBe("Eiffel Tower");
  });

  it("passes the correct loadLocations paths for a route", async () => {
    (loadText as ReturnType<typeof vi.fn>).mockResolvedValue(ROUTES_DATA);
    (loadLocations as ReturnType<typeof vi.fn>).mockResolvedValue(RIVERSIDE_ENTRIES);
    await buildRouteIndex("en", "demo", "paris");
    expect(loadLocations).toHaveBeenCalledWith("en", [
      "projects/demo/paris/001_loc_eiffel",
      "projects/demo/paris/002_text_bridge",
      "projects/demo/paris/003_loc_louvre",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- resultsRouteIndex`
Expected: FAIL — `../utils/resultsRouteIndex` doesn't exist.

- [ ] **Step 3: Write `src/utils/resultsRouteIndex.ts`**

```ts
import { loadText } from "./loadText";
import { loadLocations } from "./loadLocations";
import { isLocationEntry } from "./routeEntries";
import type { RoutesData, LocationEntry } from "../types/data";
import type { RouteLocationEntry, RouteIndex } from "./resultsData";

function toRouteLocationEntries(entries: LocationEntry[]): RouteLocationEntry[] {
  const withForm: RouteLocationEntry[] = [];
  entries.forEach((entry, index) => {
    const fields = entry.challenge.form ?? [];
    if (fields.length > 0) {
      withForm.push({ ordinal: index + 1, name: entry.name.value, fields });
    }
  });
  return withForm;
}

export async function buildRouteIndex(
  lang: string,
  project: string,
  city: string,
): Promise<RouteIndex> {
  const routesData = await loadText<RoutesData>(lang, `projects/${project}/${city}/routes`);
  if (!routesData) {
    return {};
  }
  const index: RouteIndex = {};
  for (const [routeId, route] of Object.entries(routesData)) {
    const paths = route.locations.map(
      (locationFile) => `projects/${project}/${city}/${locationFile}`,
    );
    const resolvedEntries = await loadLocations(lang, paths);
    const locationEntries = resolvedEntries.filter(isLocationEntry);
    index[routeId] = toRouteLocationEntries(locationEntries);
  }
  return index;
}
```

The `index + 1` in `toRouteLocationEntries` is deliberate, not an approximation:
`locationEntries` is already filtered down to location-type entries only (via
`isLocationEntry`), so a given entry's position in that filtered array is
exactly what `locationOrdinalAt(fullRouteEntries, rawIndex)` would compute
from the unfiltered array — both count "how many location-type entries have
we seen up to and including this one." Filtering first and indexing after is
just a simpler way to arrive at the same number.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- resultsRouteIndex`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/resultsRouteIndex.ts src/test/resultsRouteIndex.test.ts
git commit -m "feat: build a per-route location+form index from city YAML"
```

---

### Task 6: `resultsMarkdown.ts` — the `.md` export builder

**Files:**
- Create: `src/utils/resultsMarkdown.ts`
- Test: `src/test/resultsMarkdown.test.ts`

**Interfaces:**
- Consumes: `RouteIndex`, `buildLocationReport`, `visibleFields`, `formatAnswerValue`, `teamsForRoute` (Task 4, `src/utils/resultsData.ts`); `ResultsSubmission` (Task 1, `src/types/results.ts`).
- Produces: `buildResultsMarkdown(project: string, city: string, routeIndex: RouteIndex, submissions: ResultsSubmission[]): string`

- [ ] **Step 1: Write the failing test**

Create `src/test/resultsMarkdown.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildResultsMarkdown } from "../utils/resultsMarkdown";
import type { RouteIndex } from "../utils/resultsData";
import type { ResultsSubmission } from "../types/results";

const ROUTE_INDEX: RouteIndex = {
  riverside_route: [
    {
      ordinal: 1,
      name: "Eiffel Tower",
      fields: [{ id: "found", type: "boolean", label: "Found it?" }],
    },
  ],
};

function makeSubmission(overrides: Partial<ResultsSubmission>): ResultsSubmission {
  return {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: { found: true }, submittedAt: 1735300000, ...overrides,
  };
}

describe("buildResultsMarkdown", () => {
  it("includes a title line built from project and city", () => {
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, []);
    expect(doc).toContain("demo / paris Results");
    expect(doc).toContain("=====");
  });

  it("lists every team across all routes, alphabetically, under Teams", () => {
    const submissions = [
      makeSubmission({ teamName: "Team B" }),
      makeSubmission({ teamName: "Team A" }),
    ];
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, submissions);
    const teamsSection = doc.split("## Teams")[1].split("## Answers")[0];
    expect(teamsSection.indexOf("Team A")).toBeLessThan(teamsSection.indexOf("Team B"));
  });

  it("groups Answers by route, then by location, with fastest team first", () => {
    const submissions = [
      makeSubmission({ id: "s1", teamName: "Team A", submittedAt: 500 }),
      makeSubmission({ id: "s2", teamName: "Team B", submittedAt: 100 }),
    ];
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, submissions);
    expect(doc).toContain("### Route: riverside route");
    expect(doc).toContain("#### Location 1 — Eiffel Tower");
    expect(doc.indexOf("*Team*: Team B")).toBeLessThan(doc.indexOf("*Team*: Team A"));
  });

  it("renders each visible field as a Question/Answer pair", () => {
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, [makeSubmission({})]);
    expect(doc).toContain("Question: Found it?");
    expect(doc).toContain("Answer: Yes");
  });

  it("omits teams with no submission at a location entirely", () => {
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, [
      makeSubmission({ teamName: "Team A" }),
    ]);
    expect(doc).not.toContain("Team B");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- resultsMarkdown`
Expected: FAIL — `../utils/resultsMarkdown` doesn't exist.

- [ ] **Step 3: Write `src/utils/resultsMarkdown.ts`**

```ts
import type { ResultsSubmission } from "../types/results";
import {
  type RouteIndex,
  type RouteLocationEntry,
  teamsForRoute,
  buildLocationReport,
  visibleFields,
  formatAnswerValue,
} from "./resultsData";

function renderLocationSection(
  entry: RouteLocationEntry,
  teams: string[],
  submissions: ResultsSubmission[],
  routeId: string,
): string {
  const lines = [
    `#### Location ${entry.ordinal} — ${entry.name}`,
    "",
    "(ordered by date, fastest team first)",
    "",
  ];
  const report = buildLocationReport(entry, teams, submissions, routeId);
  for (const row of report) {
    lines.push(`*Team*: ${row.teamName}`);
    lines.push(`*Time*: ${new Date(row.submission.submittedAt * 1000).toISOString()}`);
    for (const field of visibleFields(entry.fields)) {
      const value = row.submission.answers[field.id ?? ""];
      if (value !== undefined) {
        lines.push(`Question: ${field.label}`);
        lines.push(`Answer: ${formatAnswerValue(field, value)}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderRouteSection(
  routeId: string,
  entries: RouteLocationEntry[],
  submissions: ResultsSubmission[],
): string {
  const teams = teamsForRoute(submissions, routeId);
  const lines = [`### Route: ${routeId.replace(/_/g, " ")}`, ""];
  for (const entry of entries) {
    lines.push(renderLocationSection(entry, teams, submissions, routeId));
  }
  return lines.join("\n");
}

export function buildResultsMarkdown(
  project: string,
  city: string,
  routeIndex: RouteIndex,
  submissions: ResultsSubmission[],
): string {
  const allTeams = [...new Set(submissions.map((sub) => sub.teamName))].sort();
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `${project.replace(/_/g, " ")} / ${city.replace(/_/g, " ")} Results`,
    "=====",
    today,
    "",
    "## Teams (alphabetical order)",
    ...allTeams.map((teamName) => `- ${teamName}`),
    "",
    "## Answers",
    "",
  ];
  for (const [routeId, entries] of Object.entries(routeIndex)) {
    lines.push(renderRouteSection(routeId, entries, submissions));
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- resultsMarkdown`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/resultsMarkdown.ts src/test/resultsMarkdown.test.ts
git commit -m "feat: build route-grouped .md results export"
```

---

### Task 7: `ResultsFilters.svelte` — team/location/missing-only filter controls

**Files:**
- Create: `src/components/ResultsFilters.svelte`
- Create: `src/components/ResultsFilters.css`
- Test: `src/test/ResultsFilters.test.ts`

**Interfaces:**
- Produces props: `{ teams: string[]; locations: { ordinal: number; name: string }[]; selectedTeam: string; selectedOrdinal: string; missingOnly: boolean; onTeamChange: (value: string) => void; onLocationChange: (value: string) => void; onMissingOnlyChange: (value: boolean) => void }`

- [ ] **Step 1: Write the failing test**

Create `src/test/ResultsFilters.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsFilters from "../components/ResultsFilters.svelte";

const LOCATIONS = [{ ordinal: 1, name: "Eiffel Tower" }, { ordinal: 2, name: "Louvre" }];

test("renders team and location options plus a missing-only checkbox", () => {
  render(ResultsFilters, {
    props: {
      teams: ["Team A", "Team B"], locations: LOCATIONS,
      selectedTeam: "", selectedOrdinal: "", missingOnly: false,
      onTeamChange: vi.fn(), onLocationChange: vi.fn(), onMissingOnlyChange: vi.fn(),
    },
  });
  expect(screen.getByRole("option", { name: "Team A" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Louvre" })).toBeInTheDocument();
  expect(screen.getByLabelText(/show only missing/i)).toBeInTheDocument();
});

test("calls onTeamChange when the team select changes", async () => {
  const onTeamChange = vi.fn();
  render(ResultsFilters, {
    props: {
      teams: ["Team A", "Team B"], locations: LOCATIONS,
      selectedTeam: "", selectedOrdinal: "", missingOnly: false,
      onTeamChange, onLocationChange: vi.fn(), onMissingOnlyChange: vi.fn(),
    },
  });
  await fireEvent.change(screen.getByLabelText("Team"), { target: { value: "Team B" } });
  expect(onTeamChange).toHaveBeenCalledWith("Team B");
});

test("calls onMissingOnlyChange when the checkbox is toggled", async () => {
  const onMissingOnlyChange = vi.fn();
  render(ResultsFilters, {
    props: {
      teams: [], locations: LOCATIONS,
      selectedTeam: "", selectedOrdinal: "", missingOnly: false,
      onTeamChange: vi.fn(), onLocationChange: vi.fn(), onMissingOnlyChange,
    },
  });
  await fireEvent.click(screen.getByLabelText(/show only missing/i));
  expect(onMissingOnlyChange).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- ResultsFilters`
Expected: FAIL — `../components/ResultsFilters.svelte` doesn't exist.

- [ ] **Step 3: Write `src/components/ResultsFilters.css`**

```css
.results-filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-end;
  padding: 16px;
}

.results-filters__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
}

.results-filters__label {
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  font-weight: 600;
}

.results-filters__select {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-base);
}

.results-filters__checkbox-field {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text);
  font-size: var(--font-size-base);
}
```

- [ ] **Step 4: Write `src/components/ResultsFilters.svelte`**

```svelte
<script lang="ts">
  import "./ResultsFilters.css";

  let {
    teams,
    locations,
    selectedTeam,
    selectedOrdinal,
    missingOnly,
    onTeamChange,
    onLocationChange,
    onMissingOnlyChange,
  }: {
    teams: string[];
    locations: { ordinal: number; name: string }[];
    selectedTeam: string;
    selectedOrdinal: string;
    missingOnly: boolean;
    onTeamChange: (value: string) => void;
    onLocationChange: (value: string) => void;
    onMissingOnlyChange: (value: boolean) => void;
  } = $props();
</script>

<div class="results-filters">
  <label class="results-filters__field">
    <span class="results-filters__label">Team</span>
    <select
      class="results-filters__select"
      value={selectedTeam}
      onchange={(evt) => onTeamChange((evt.target as HTMLSelectElement).value)}
    >
      <option value="">All teams</option>
      {#each teams as team (team)}
        <option value={team}>{team}</option>
      {/each}
    </select>
  </label>

  <label class="results-filters__field">
    <span class="results-filters__label">Location</span>
    <select
      class="results-filters__select"
      value={selectedOrdinal}
      onchange={(evt) => onLocationChange((evt.target as HTMLSelectElement).value)}
    >
      <option value="">All locations</option>
      {#each locations as location (location.ordinal)}
        <option value={String(location.ordinal)}>{location.name}</option>
      {/each}
    </select>
  </label>

  <label class="results-filters__checkbox-field">
    <input
      type="checkbox"
      checked={missingOnly}
      onchange={(evt) => onMissingOnlyChange((evt.target as HTMLInputElement).checked)}
    />
    Show only missing
  </label>
</div>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- ResultsFilters`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultsFilters.svelte src/components/ResultsFilters.css src/test/ResultsFilters.test.ts
git commit -m "feat: add ResultsFilters team/location/missing-only controls"
```

---

### Task 8: `ResultsAnswerDialog.svelte` — the per-submission Q&A modal

**Files:**
- Create: `src/components/ResultsAnswerDialog.svelte`
- Create: `src/components/ResultsAnswerDialog.css`
- Test: `src/test/ResultsAnswerDialog.test.ts`

**Interfaces:**
- Consumes: `visibleFields`, `formatAnswerValue` (Task 4, `src/utils/resultsData.ts`); `ResultsSubmission` (Task 1, `src/types/results.ts`); `FormField` (`src/types/data.ts`).
- Produces props: `{ submission: ResultsSubmission | null; fields: FormField[]; submissionCount: number; onClose: () => void }`

- [ ] **Step 1: Write the failing test**

Create `src/test/ResultsAnswerDialog.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsAnswerDialog from "../components/ResultsAnswerDialog.svelte";
import type { ResultsSubmission } from "../types/results";
import type { FormField } from "../types/data";

const FIELDS: FormField[] = [
  { id: "found", type: "boolean", label: "Did you find it?" },
  { id: "notes", type: "string", label: "Any notes?" },
  { id: "photo", type: "photo", label: "Upload a photo" },
];

const SUBMISSION: ResultsSubmission = {
  id: "sub-1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
  answers: { found: true }, submittedAt: 1735300000,
};

test("renders nothing when submission is null", () => {
  render(ResultsAnswerDialog, {
    props: { submission: null, fields: FIELDS, submissionCount: 1, onClose: vi.fn() },
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("renders each visible field's question and formatted answer", () => {
  render(ResultsAnswerDialog, {
    props: { submission: SUBMISSION, fields: FIELDS, submissionCount: 1, onClose: vi.fn() },
  });
  expect(screen.getByText("Did you find it?")).toBeInTheDocument();
  expect(screen.getByText("Yes")).toBeInTheDocument();
  expect(screen.getByText("Any notes?")).toBeInTheDocument();
  expect(screen.getByText("No answer")).toBeInTheDocument();
});

test("omits photo fields and shows a note pointing to the Gallery", () => {
  render(ResultsAnswerDialog, {
    props: { submission: SUBMISSION, fields: FIELDS, submissionCount: 1, onClose: vi.fn() },
  });
  expect(screen.queryByText("Upload a photo")).not.toBeInTheDocument();
  expect(screen.getByText(/gallery/i)).toBeInTheDocument();
});

test("shows the submission id and a resubmission note only when submissionCount > 1", () => {
  const { rerender } = render(ResultsAnswerDialog, {
    props: { submission: SUBMISSION, fields: FIELDS, submissionCount: 1, onClose: vi.fn() },
  });
  expect(screen.getByText(/sub-1/)).toBeInTheDocument();
  expect(screen.queryByText(/latest of/i)).not.toBeInTheDocument();

  rerender({ submission: SUBMISSION, fields: FIELDS, submissionCount: 3, onClose: vi.fn() });
  expect(screen.getByText(/latest of 3/i)).toBeInTheDocument();
});

test("clicking the close button calls onClose", async () => {
  const onClose = vi.fn();
  render(ResultsAnswerDialog, {
    props: { submission: SUBMISSION, fields: FIELDS, submissionCount: 1, onClose },
  });
  await fireEvent.click(screen.getByRole("button", { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- ResultsAnswerDialog`
Expected: FAIL — `../components/ResultsAnswerDialog.svelte` doesn't exist.

- [ ] **Step 3: Write `src/components/ResultsAnswerDialog.css`**

```css
.results-answer-dialog {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.results-answer-dialog__backdrop {
  position: absolute;
  inset: 0;
  border: none;
  background: rgba(0, 0, 0, 0.72);
  cursor: pointer;
  padding: 0;
}

.results-answer-dialog__content {
  position: relative;
  z-index: 1;
  background: var(--color-surface);
  border-radius: 8px;
  padding: 20px;
  max-width: min(90vw, 560px);
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.results-answer-dialog__close {
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 16px;
}

.results-answer-dialog__team {
  font-weight: 700;
  color: var(--color-text);
}

.results-answer-dialog__qa {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.results-answer-dialog__question {
  font-weight: 600;
  color: var(--color-text);
}

.results-answer-dialog__answer {
  color: var(--color-text-secondary);
}

.results-answer-dialog__photo-note,
.results-answer-dialog__footer {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}
```

- [ ] **Step 4: Write `src/components/ResultsAnswerDialog.svelte`**

```svelte
<script lang="ts">
  import type { ResultsSubmission } from "../types/results";
  import type { FormField } from "../types/data";
  import { visibleFields, formatAnswerValue } from "../utils/resultsData";
  import "./ResultsAnswerDialog.css";

  let {
    submission,
    fields,
    submissionCount,
    onClose,
  }: {
    submission: ResultsSubmission | null;
    fields: FormField[];
    submissionCount: number;
    onClose: () => void;
  } = $props();

  let hasPhotoField = $derived(fields.some((field) => field.type === "photo"));
</script>

{#if submission}
  <div class="results-answer-dialog" role="dialog" aria-modal="true" aria-label={submission.teamName}>
    <button
      class="results-answer-dialog__backdrop"
      aria-label="Close"
      onclick={onClose}
    ></button>
    <div class="results-answer-dialog__content">
      <button class="results-answer-dialog__close" onclick={onClose} aria-label="Close">✕</button>
      <div class="results-answer-dialog__team">{submission.teamName}</div>

      {#each visibleFields(fields) as field (field.id)}
        <div class="results-answer-dialog__qa">
          <span class="results-answer-dialog__question">{field.label}</span>
          <span class="results-answer-dialog__answer">
            {formatAnswerValue(field, submission.answers[field.id ?? ""])}
          </span>
        </div>
      {/each}

      {#if hasPhotoField}
        <p class="results-answer-dialog__photo-note">
          Photo answers aren't shown here — see the Gallery page for uploaded photos.
        </p>
      {/if}

      <p class="results-answer-dialog__footer">
        Submission: {submission.id}
        {#if submissionCount > 1}
          (latest of {submissionCount})
        {/if}
      </p>
    </div>
  </div>
{/if}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- ResultsAnswerDialog`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultsAnswerDialog.svelte src/components/ResultsAnswerDialog.css src/test/ResultsAnswerDialog.test.ts
git commit -m "feat: add ResultsAnswerDialog Q&A modal"
```

---

### Task 9: `ResultsTable.svelte` — per-route coverage grid

**Files:**
- Create: `src/components/ResultsTable.svelte`
- Create: `src/components/ResultsTable.css`
- Test: `src/test/ResultsTable.test.ts`

**Interfaces:**
- Consumes: `RouteLocationEntry`, `buildRouteGrid`, `GridRow` (Task 4, `src/utils/resultsData.ts`); `ResultsFilters` (Task 7); `ResultsSubmission` (Task 1).
- Produces props: `{ routeId: string; entries: RouteLocationEntry[]; teams: string[]; submissions: ResultsSubmission[]; onView: (submission: ResultsSubmission, entry: RouteLocationEntry, submissionCount: number) => void }`

- [ ] **Step 1: Write the failing test**

Create `src/test/ResultsTable.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsTable from "../components/ResultsTable.svelte";
import type { ResultsSubmission } from "../types/results";
import type { RouteLocationEntry } from "../utils/resultsData";

const ENTRIES: RouteLocationEntry[] = [
  { ordinal: 1, name: "Eiffel Tower", fields: [{ id: "found", type: "boolean", label: "Found?" }] },
];

const SUBMISSIONS: ResultsSubmission[] = [
  {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: { found: true }, submittedAt: 100,
  },
];

test("renders a View button when a submission exists and a dash when it doesn't", () => {
  render(ResultsTable, {
    props: {
      routeId: "riverside_route", entries: ENTRIES, teams: ["Team A", "Team B"],
      submissions: SUBMISSIONS, onView: vi.fn(),
    },
  });
  expect(screen.getAllByRole("button", { name: /view/i })).toHaveLength(1);
  expect(screen.getByText("-")).toBeInTheDocument();
});

test("shows an (edited) tag when a cell has more than one submission", () => {
  const submissions: ResultsSubmission[] = [
    { id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A", answers: {}, submittedAt: 100 },
    { id: "s2", locationId: "1", routeId: "riverside_route", teamName: "Team A", answers: {}, submittedAt: 200 },
  ];
  render(ResultsTable, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A"], submissions, onView: vi.fn() },
  });
  expect(screen.getByText(/edited/i)).toBeInTheDocument();
});

test("clicking View calls onView with the latest submission, its entry, and the submission count", async () => {
  const onView = vi.fn();
  render(ResultsTable, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A"], submissions: SUBMISSIONS, onView },
  });
  await fireEvent.click(screen.getByRole("button", { name: /view/i }));
  expect(onView).toHaveBeenCalledWith(SUBMISSIONS[0], ENTRIES[0], 1);
});

test("'Show only missing' filters out rows that have a submission", async () => {
  render(ResultsTable, {
    props: {
      routeId: "riverside_route", entries: ENTRIES, teams: ["Team A", "Team B"],
      submissions: SUBMISSIONS, onView: vi.fn(),
    },
  });
  expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 data rows
  await fireEvent.click(screen.getByLabelText(/show only missing/i));
  expect(screen.getAllByRole("row")).toHaveLength(2); // header + Team B only
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- ResultsTable`
Expected: FAIL — `../components/ResultsTable.svelte` doesn't exist.

- [ ] **Step 3: Write `src/components/ResultsTable.css`**

```css
.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th,
.results-table td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.results-table__view-button {
  padding: 4px 10px;
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  background: transparent;
  color: var(--color-accent);
  cursor: pointer;
  font-size: var(--font-size-small);
}

.results-table__edited-tag {
  margin-left: 6px;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.results-table__dash {
  color: var(--color-text-muted);
}
```

- [ ] **Step 4: Write `src/components/ResultsTable.svelte`**

```svelte
<script lang="ts">
  import type { ResultsSubmission } from "../types/results";
  import { buildRouteGrid, type RouteLocationEntry, type GridRow } from "../utils/resultsData";
  import ResultsFilters from "./ResultsFilters.svelte";
  import "./ResultsTable.css";

  let {
    routeId,
    entries,
    teams,
    submissions,
    onView,
  }: {
    routeId: string;
    entries: RouteLocationEntry[];
    teams: string[];
    submissions: ResultsSubmission[];
    onView: (submission: ResultsSubmission, entry: RouteLocationEntry, submissionCount: number) => void;
  } = $props();

  let selectedTeam = $state("");
  let selectedOrdinal = $state("");
  let missingOnly = $state(false);

  let allRows = $derived(buildRouteGrid(entries, teams, submissions, routeId));

  let filteredRows = $derived(
    allRows.filter(
      (row) =>
        (selectedTeam === "" || row.teamName === selectedTeam) &&
        (selectedOrdinal === "" || String(row.ordinal) === selectedOrdinal) &&
        (!missingOnly || row.submission === undefined),
    ),
  );

  let filterLocations = $derived(
    entries.map((entry) => ({ ordinal: entry.ordinal, name: entry.name })),
  );

  function entryForOrdinal(ordinal: number): RouteLocationEntry {
    return entries.find((entry) => entry.ordinal === ordinal) as RouteLocationEntry;
  }

  function formatDatetime(seconds: number): string {
    return new Date(seconds * 1000).toLocaleString();
  }

  function handleView(row: GridRow) {
    const entry = entryForOrdinal(row.ordinal);
    onView(row.submission as ResultsSubmission, entry, row.submissionCount);
  }
</script>

<div class="results-table-wrap">
  <ResultsFilters
    teams={teams}
    locations={filterLocations}
    {selectedTeam}
    {selectedOrdinal}
    {missingOnly}
    onTeamChange={(value) => (selectedTeam = value)}
    onLocationChange={(value) => (selectedOrdinal = value)}
    onMissingOnlyChange={(value) => (missingOnly = value)}
  />

  <table class="results-table">
    <thead>
      <tr>
        <th>Team</th>
        <th>Datetime</th>
        <th>Location id</th>
        <th>Location name</th>
        <th>Answers</th>
      </tr>
    </thead>
    <tbody>
      {#each filteredRows as row (`${row.ordinal}-${row.teamName}`)}
        <tr>
          <td>{row.teamName}</td>
          <td>{row.submission ? formatDatetime(row.submission.submittedAt) : "-"}</td>
          <td>{row.ordinal}</td>
          <td>{row.locationName}</td>
          <td>
            {#if row.submission}
              <button
                class="results-table__view-button"
                onclick={() => handleView(row)}
              >
                View
              </button>
              {#if row.submissionCount > 1}
                <span class="results-table__edited-tag">(edited)</span>
              {/if}
            {:else}
              <span class="results-table__dash">-</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- ResultsTable`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultsTable.svelte src/components/ResultsTable.css src/test/ResultsTable.test.ts
git commit -m "feat: add ResultsTable per-route coverage grid"
```

---

### Task 10: `ResultsLocationReports.svelte` — inline reading view

**Files:**
- Create: `src/components/ResultsLocationReports.svelte`
- Create: `src/components/ResultsLocationReports.css`
- Test: `src/test/ResultsLocationReports.test.ts`

**Interfaces:**
- Consumes: `RouteLocationEntry`, `completionCount`, `buildLocationReport`, `visibleFields`, `formatAnswerValue` (Task 4, `src/utils/resultsData.ts`); `ResultsSubmission` (Task 1).
- Produces props: `{ routeId: string; entries: RouteLocationEntry[]; teams: string[]; submissions: ResultsSubmission[] }`

- [ ] **Step 1: Write the failing test**

Create `src/test/ResultsLocationReports.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsLocationReports from "../components/ResultsLocationReports.svelte";
import type { ResultsSubmission } from "../types/results";
import type { RouteLocationEntry } from "../utils/resultsData";

const ENTRIES: RouteLocationEntry[] = [
  { ordinal: 1, name: "Eiffel Tower", fields: [{ id: "found", type: "boolean", label: "Found it?" }] },
];

const SUBMISSIONS: ResultsSubmission[] = [
  {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: { found: true }, submittedAt: 100,
  },
];

test("shows a completion count in the collapsed header", () => {
  render(ResultsLocationReports, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A", "Team B"], submissions: SUBMISSIONS },
  });
  expect(screen.getByText(/1\s*\/\s*2 teams answered/i)).toBeInTheDocument();
});

test("expanding a location renders each answering team's Q&A inline", async () => {
  render(ResultsLocationReports, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A"], submissions: SUBMISSIONS },
  });
  await fireEvent.click(screen.getByText(/Location 1 — Eiffel Tower/i));
  expect(screen.getByText("Team A")).toBeInTheDocument();
  expect(screen.getByText("Found it?")).toBeInTheDocument();
  expect(screen.getByText("Yes")).toBeInTheDocument();
});

test("a team with no submission at that location does not appear when expanded", async () => {
  render(ResultsLocationReports, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A", "Team B"], submissions: SUBMISSIONS },
  });
  await fireEvent.click(screen.getByText(/Location 1 — Eiffel Tower/i));
  expect(screen.queryByText("Team B")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- ResultsLocationReports`
Expected: FAIL — `../components/ResultsLocationReports.svelte` doesn't exist.

- [ ] **Step 3: Write `src/components/ResultsLocationReports.css`**

```css
.results-location-reports__item {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 8px;
  padding: 8px 12px;
}

.results-location-reports__summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--color-text);
}

.results-location-reports__team-block {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.results-location-reports__team-name {
  font-weight: 700;
  color: var(--color-text);
}

.results-location-reports__time {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.results-location-reports__question {
  font-weight: 600;
  color: var(--color-text);
}

.results-location-reports__answer {
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
```

- [ ] **Step 4: Write `src/components/ResultsLocationReports.svelte`**

```svelte
<script lang="ts">
  import type { ResultsSubmission } from "../types/results";
  import {
    completionCount,
    buildLocationReport,
    visibleFields,
    formatAnswerValue,
    type RouteLocationEntry,
  } from "../utils/resultsData";
  import "./ResultsLocationReports.css";

  let {
    routeId,
    entries,
    teams,
    submissions,
  }: {
    routeId: string;
    entries: RouteLocationEntry[];
    teams: string[];
    submissions: ResultsSubmission[];
  } = $props();

  function formatDatetime(seconds: number): string {
    return new Date(seconds * 1000).toLocaleString();
  }
</script>

<div class="results-location-reports">
  {#each entries as entry (entry.ordinal)}
    {@const completion = completionCount(entry, teams, submissions, routeId)}
    {@const report = buildLocationReport(entry, teams, submissions, routeId)}
    <details class="results-location-reports__item">
      <summary class="results-location-reports__summary">
        Location {entry.ordinal} — {entry.name} ({completion.answered}/{completion.total} teams answered)
      </summary>
      {#each report as row (row.teamName)}
        <div class="results-location-reports__team-block">
          <div class="results-location-reports__team-name">{row.teamName}</div>
          <div class="results-location-reports__time">{formatDatetime(row.submission.submittedAt)}</div>
          {#each visibleFields(entry.fields) as field (field.id)}
            <div class="results-location-reports__question">{field.label}</div>
            <div class="results-location-reports__answer">
              {formatAnswerValue(field, row.submission.answers[field.id ?? ""])}
            </div>
          {/each}
        </div>
      {/each}
    </details>
  {/each}
</div>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- ResultsLocationReports`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultsLocationReports.svelte src/components/ResultsLocationReports.css src/test/ResultsLocationReports.test.ts
git commit -m "feat: add ResultsLocationReports inline reading view"
```

---

### Task 11: `ResultsDownloadPage.svelte` — compose everything, wire the download button

**Files:**
- Create: `src/pages/ResultsDownloadPage.svelte`
- Create: `src/pages/ResultsDownloadPage.css`
- Test: `src/test/ResultsDownloadPage.test.ts`

**Interfaces:**
- Consumes: `fetchResultsSubmissions` (Task 3, `src/utils/api.ts`); `buildRouteIndex` (Task 5, `src/utils/resultsRouteIndex.ts`); `buildResultsMarkdown` (Task 6, `src/utils/resultsMarkdown.ts`); `teamsForRoute` (Task 4, `src/utils/resultsData.ts`); `ResultsTable` (Task 9); `ResultsLocationReports` (Task 10); `ResultsAnswerDialog` (Task 8); `titleBarStore` (`src/stores/titleBarStore.ts`, existing); `languageStore` (`src/stores/languageStore.ts`, existing).
- Produces props: `{ params: { project: string; city: string } }`, mounted at `/:project/:city/results_download`.

- [ ] **Step 1: Write the failing test**

Create `src/test/ResultsDownloadPage.test.ts`:

```ts
import { render, screen, waitFor, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsDownloadPage from "../pages/ResultsDownloadPage.svelte";
import { fetchResultsSubmissions } from "../utils/api";
import { buildRouteIndex } from "../utils/resultsRouteIndex";

vi.mock("../utils/api", () => ({
  fetchResultsSubmissions: vi.fn(),
}));
vi.mock("../utils/resultsRouteIndex", () => ({
  buildRouteIndex: vi.fn(),
}));

const ROUTE_INDEX = {
  riverside_route: [
    { ordinal: 1, name: "Eiffel Tower", fields: [{ id: "found", type: "boolean", label: "Found?" }] },
  ],
};

const SUBMISSIONS = [
  {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: { found: true }, submittedAt: 100,
  },
];

beforeEach(() => {
  (buildRouteIndex as ReturnType<typeof vi.fn>).mockResolvedValue(ROUTE_INDEX);
  (fetchResultsSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true, submissions: SUBMISSIONS,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders a route section heading and the grid/report once loaded", async () => {
  render(ResultsDownloadPage, { props: { params: { project: "demo", city: "paris" } } });
  await waitFor(() => expect(screen.getByText(/riverside route/i)).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
});

test("shows an empty state when there are no submissions at all", async () => {
  (fetchResultsSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, submissions: [] });
  render(ResultsDownloadPage, { props: { params: { project: "demo", city: "paris" } } });
  await waitFor(() => expect(screen.getByText(/no results yet/i)).toBeInTheDocument());
});

test("clicking View opens the answer dialog for that submission", async () => {
  render(ResultsDownloadPage, { props: { params: { project: "demo", city: "paris" } } });
  await waitFor(() => expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument());
  await fireEvent.click(screen.getByRole("button", { name: /view/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("renders a Download button that can be clicked without throwing", async () => {
  // Matches the existing project convention (see PhotoLightbox.test.ts's download
  // button test): the underlying Blob/anchor-click mechanics aren't deeply asserted.
  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL, so both are
  // stubbed here purely so clicking Download doesn't throw during the test.
  const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(ResultsDownloadPage, { props: { params: { project: "demo", city: "paris" } } });
  const downloadButton = await screen.findByRole("button", { name: /download/i });
  await fireEvent.click(downloadButton);
  expect(clickSpy).toHaveBeenCalled();
  clickSpy.mockRestore();
  createUrlSpy.mockRestore();
  revokeUrlSpy.mockRestore();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- ResultsDownloadPage`
Expected: FAIL — `../pages/ResultsDownloadPage.svelte` doesn't exist.

- [ ] **Step 3: Write `src/pages/ResultsDownloadPage.css`**

```css
.results-download-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.results-download-page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.results-download-page__download-button {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  background: var(--color-accent);
  color: var(--color-background);
  font-weight: 600;
  cursor: pointer;
}

.results-download-page__route-heading {
  font-size: var(--font-size-large);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.results-download-page__empty {
  color: var(--color-text-secondary);
  padding: 16px;
}
```

- [ ] **Step 4: Write `src/pages/ResultsDownloadPage.svelte`**

```svelte
<script lang="ts">
  import { languageStore } from "../stores/languageStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { fetchResultsSubmissions } from "../utils/api";
  import { buildRouteIndex } from "../utils/resultsRouteIndex";
  import { buildResultsMarkdown } from "../utils/resultsMarkdown";
  import { teamsForRoute, type RouteIndex, type RouteLocationEntry } from "../utils/resultsData";
  import type { ResultsSubmission } from "../types/results";
  import type { FormField } from "../types/data";
  import ResultsTable from "../components/ResultsTable.svelte";
  import ResultsLocationReports from "../components/ResultsLocationReports.svelte";
  import ResultsAnswerDialog from "../components/ResultsAnswerDialog.svelte";
  import "./ResultsDownloadPage.css";

  let { params }: { params: { project: string; city: string } } = $props();

  let submissions = $state<ResultsSubmission[]>([]);
  let routeIndex = $state<RouteIndex>({});
  let loaded = $state(false);
  let dialogSubmission = $state<ResultsSubmission | null>(null);
  let dialogFields = $state<FormField[]>([]);
  let dialogCount = $state(0);

  $effect(() => {
    titleBarStore.set({
      title: `${params.city.replace(/_/g, " ")} Results`,
      progress: null,
      backPath: `/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    const lang = $languageStore.currentLang;
    Promise.all([
      fetchResultsSubmissions(params.project, params.city),
      buildRouteIndex(lang, params.project, params.city),
    ]).then(([submissionsRes, index]) => {
      submissions =
        submissionsRes.ok && submissionsRes.submissions ? submissionsRes.submissions : [];
      routeIndex = index;
      loaded = true;
    });
  });

  function openDialog(
    submission: ResultsSubmission,
    entry: RouteLocationEntry,
    submissionCount: number,
  ) {
    dialogSubmission = submission;
    dialogFields = entry.fields;
    dialogCount = submissionCount;
  }

  function closeDialog() {
    dialogSubmission = null;
  }

  function handleDownload() {
    const markdown = buildResultsMarkdown(params.project, params.city, routeIndex, submissions);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${params.project}-${params.city}-results.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="results-download-page">
  <div class="results-download-page__header">
    <h1>{params.city.replace(/_/g, " ")} Results</h1>
    <button class="results-download-page__download-button" onclick={handleDownload}>
      Download
    </button>
  </div>

  {#if loaded && submissions.length === 0}
    <p class="results-download-page__empty">No results yet for this city.</p>
  {:else if loaded}
    {#each Object.entries(routeIndex) as [routeId, entries] (routeId)}
      {@const teams = teamsForRoute(submissions, routeId)}
      <section>
        <h2 class="results-download-page__route-heading">Route: {routeId.replace(/_/g, " ")}</h2>
        <ResultsTable {routeId} {entries} {teams} {submissions} onView={openDialog} />
        <ResultsLocationReports {routeId} {entries} {teams} {submissions} />
      </section>
    {/each}
  {/if}

  <ResultsAnswerDialog
    submission={dialogSubmission}
    fields={dialogFields}
    submissionCount={dialogCount}
    onClose={closeDialog}
  />
</div>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- ResultsDownloadPage`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add src/pages/ResultsDownloadPage.svelte src/pages/ResultsDownloadPage.css src/test/ResultsDownloadPage.test.ts
git commit -m "feat: add ResultsDownloadPage composing table, reports, dialog, and export"
```

---

### Task 12: Wire the route into `App.svelte`, add a routing regression test, update docs

**Files:**
- Modify: `src/App.svelte`
- Create: `src/test/fixtures/ResultsRouteMarker.svelte`
- Modify: `src/test/App.routing.test.ts`
- Modify: `doc/architecture.md`
- Modify: `doc/devlog/_devlog.md`

**Interfaces:**
- Consumes: `ResultsDownloadPage` (Task 11).

- [ ] **Step 1: Write the failing routing test**

Create `src/test/fixtures/ResultsRouteMarker.svelte`:

```svelte
<p>results-route-marker</p>
```

Add this test to `src/test/App.routing.test.ts` (new import at the top alongside the other
fixture imports, new test appended after the existing gallery-ordering test):

```ts
import ResultsRouteMarker from "./fixtures/ResultsRouteMarker.svelte";
```

```ts
test("a literal /:project/:city/results_download route wins over the /:project/:city/:route wildcard", async () => {
  window.location.hash = "#/democrats_abroad/den_haag/results_download";
  render(Router, {
    props: {
      routes: {
        "/:project/:city/results_download": ResultsRouteMarker,
        "/:project/:city/:route": WildcardRouteMarker,
      },
    },
  });
  await waitFor(() => expect(screen.getByText("results-route-marker")).toBeInTheDocument());
  expect(screen.queryByText("wildcard-route-marker")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- App.routing`
Expected: FAIL — `./fixtures/ResultsRouteMarker.svelte` doesn't exist yet (create it in Step 1 if not already done, then re-run — this step is really "confirm the new test fails before the fixture exists"; once the fixture is created the test itself should already pass since it only tests `svelte-spa-router`'s own matching behavior, not `App.svelte`. The real regression protection comes from Step 4.)

- [ ] **Step 3: Wire `ResultsDownloadPage` into `src/App.svelte`**

Add the import alongside the other page imports:

```ts
import ResultsDownloadPage from "./pages/ResultsDownloadPage.svelte";
```

Add the route entry into the `routes` object, after `/:project/:city/gallery` and before
`/:project/:city/:route` (order relative to `gallery` doesn't matter — both are literal
segments — but it must come before the wildcard):

```ts
    "/:project/:city/results_download": wrap({
      component: asRoute(ResultsDownloadPage),
      conditions: [requireAuth],
    }),
```

- [ ] **Step 4: Run the full test suite and typecheck**

Run: `npm run test:run`
Expected: PASS (all files)

Run: `npm run typecheck`
Expected: no errors

Run: `npm run lint`
Expected: no errors

- [ ] **Step 5: Update `doc/architecture.md`**

In the routing table (search for `| Path` header), add a row after the gallery row:

```
| `/:project/:city/results_download` | `ResultsDownloadPage` | Organizer/participant results view: per-route coverage grid, inline location reports, `.md` export |
```

In the "Data Model" section, after the `form_submissions` table documentation, add:

```markdown
**`location_id` is per-route, not global.** `form_submissions.location_id` is the 1-based
ordinal position of that location among location-type entries in whichever route the team was
on (`locationOrdinalAt()`, `src/utils/routeEntries.ts`), set client-side by `RoutePage`. The same
number means different locations in different routes — resolving a submission to a physical
location requires looking up `(route_id, location_id)` together against that route's location
list, never `location_id` alone. `src/utils/resultsRouteIndex.ts` builds this per-route index
from a city's `routes.yaml` and location YAML.
```

In the API Layer table, add a Results row:

```
| Results | `fetchResultsSubmissions(project, city)` → `GET /results/:project/:city/submissions`, same auth as Gallery |
```

- [ ] **Step 6: Add a devlog entry**

Add to the top of `doc/devlog/_devlog.md`, under `## Entries:`:

```markdown
**27/07/2026, Claude**: [FEATURE] Organizer results page — per-route coverage grid, inline reports, .md export.
- New `GET /results/:project/:city/submissions` worker route + `listFormSubmissions` D1 query, same participant-scoped auth as the photo gallery; strips `contact` from the response.
- Discovered `form_submissions.location_id` is a per-route ordinal (`locationOrdinalAt`'s output), not a stable ID — the same number means different locations across different routes (e.g. `demo`'s Paris routes). All resolution goes through `(route_id, location_id)` via a new `resultsRouteIndex.ts` built from each city's `routes.yaml`.
- New `resultsData.ts` (pure grid/report/formatting functions), `resultsMarkdown.ts` (route-grouped `.md` builder), and five new components (`ResultsFilters`, `ResultsAnswerDialog`, `ResultsTable`, `ResultsLocationReports`) composed in `ResultsDownloadPage` at `/:project/:city/results_download`.
- Photo-type form fields are excluded from the Q&A view/export (no reliable link from a submission to a specific uploaded photo) — a note points organizers to the existing Gallery instead.
- Spec: `doc/superpowers/specs/2026-07-27-organizer-results-download-design.md`. Plan: `doc/superpowers/plans/2026-07-27-organizer-results-download.md`.
```

- [ ] **Step 7: Commit**

```bash
git add src/App.svelte src/test/fixtures/ResultsRouteMarker.svelte src/test/App.routing.test.ts doc/architecture.md doc/devlog/_devlog.md
git commit -m "feat: wire ResultsDownloadPage into routing, document location_id per-route semantics"
```
