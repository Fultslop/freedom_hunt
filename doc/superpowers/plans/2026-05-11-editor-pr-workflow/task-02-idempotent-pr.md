# Task 02 — Idempotent PR creation (`createFilePR`)

**Files:**
- Modify: `src/worker/github.ts`
- Modify: `src/worker/routes/editorRoutes.ts`
- Modify: `src/test/worker.github.test.ts`

**Context:** Currently `createLocationPR` creates a new branch `editor/{Date.now()}` on every submit. This means re-submitting the same location opens a second PR. The fix: use a deterministic branch name derived from the team name and the full file path, reuse the branch if it exists, and find the open PR for that branch rather than always creating a new one.

The function is also renamed `createFilePR` and takes a single `filePath` string instead of `project + city + filename`, so it will work for future city/route editors without changes.

---

- [ ] **Step 1: Write failing tests for `slugify` and the new function signature**

In `src/test/worker.github.test.ts`, add these test cases after the existing ones:

```ts
import {
  decodeGitHubContent,
  encodeGitHubContent,
  locationFilePath,
  slugify,
  createFilePR,
} from "../worker/github.js";

// ... keep existing tests ...

describe("slugify", () => {
  it("lowercases and replaces non-alphanumeric runs with hyphens", () => {
    expect(slugify("Team Alpha")).toBe("team-alpha");
  });

  it("handles path separators and dots", () => {
    expect(
      slugify("src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml"),
    ).toBe("src-data-text-en-projects-democrats-abroad-den-haag-001-loc-binnenhof-yaml");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });
});

describe("createFilePR", () => {
  const env = {
    GITHUB_REPO: "myorg/myrepo",
    GITHUB_PAT: "ghp_test",
  } as unknown as import("../types/worker").Env;

  const filePath =
    "src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml";

  function mockFetch(responses: Array<{ status: number; body: unknown }>) {
    let callIndex = 0;
    return vi.fn().mockImplementation(() => {
      const r = responses[callIndex++] ?? { status: 200, body: {} };
      return Promise.resolve({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        text: () => Promise.resolve(JSON.stringify(r.body)),
        json: () => Promise.resolve(r.body),
      });
    });
  }

  it("creates a new branch and PR when none exist", async () => {
    const fetch = mockFetch([
      // GET /git/ref/heads/main → sha for branch base
      { status: 200, body: { object: { sha: "mainsha" } } },
      // GET /git/ref/heads/editor/... → 404, branch does not exist
      { status: 404, body: {} },
      // POST /git/refs → create branch
      { status: 201, body: {} },
      // GET /contents/...?ref=branch → 404, new file
      { status: 404, body: {} },
      // PUT /contents/... → create file on branch
      { status: 201, body: {} },
      // GET /pulls?head=...&state=open → empty, no existing PR
      { status: 200, body: [] },
      // POST /pulls → create PR
      { status: 201, body: { html_url: "https://github.com/myorg/myrepo/pull/1" } },
    ]);
    globalThis.fetch = fetch;

    const result = await createFilePR(filePath, "content: test\n", "Team Alpha", env);
    expect(result.prUrl).toBe("https://github.com/myorg/myrepo/pull/1");
  });

  it("reuses an existing branch and returns existing open PR", async () => {
    const fetch = mockFetch([
      // GET /git/ref/heads/main
      { status: 200, body: { object: { sha: "mainsha" } } },
      // GET /git/ref/heads/editor/... → 200, branch exists
      { status: 200, body: { ref: "refs/heads/editor/team-alpha/src-data-..." } },
      // GET /contents/...?ref=branch → file exists on branch
      { status: 200, body: { sha: "filesha", content: "", encoding: "base64" } },
      // PUT /contents/... → update file on branch
      { status: 200, body: {} },
      // GET /pulls?head=...&state=open → existing PR
      { status: 200, body: [{ html_url: "https://github.com/myorg/myrepo/pull/7" }] },
    ]);
    globalThis.fetch = fetch;

    const result = await createFilePR(filePath, "content: updated\n", "Team Alpha", env);
    expect(result.prUrl).toBe("https://github.com/myorg/myrepo/pull/7");
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```
npx vitest run src/test/worker.github.test.ts --reporter=verbose
```

Expected: FAIL — `slugify` and `createFilePR` not exported / don't exist yet.

- [ ] **Step 3: Rewrite `github.ts`**

Replace the entire contents of `src/worker/github.ts` with:

```ts
import yaml from "js-yaml";
import type { Env } from "../types/worker";
import type { Location } from "../types/data";

const LOC_FILE_PATTERN = /^\d+_loc_.*\.yaml$/;
const DATA_PATH = "src/data/text/en/projects";

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  content?: string;
  encoding?: string;
}

interface LocationEntry {
  filename: string;
  sha: string;
  location: Location;
}

interface PRStatus {
  number: number;
  title: string;
  state: string;
  html_url: string;
}

async function githubRequest(
  path: string,
  options: RequestInit = {},
  env: Env,
): Promise<unknown> {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${env.GITHUB_PAT}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "freedom-hunt-editor",
        ...(options.headers ?? {}),
      },
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub ${res.status}: ${err}`);
  }
  return res.json();
}

export function decodeGitHubContent(base64: string): string {
  const raw = atob(base64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeGitHubContent(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function locationFilePath(
  project: string,
  city: string,
  filename: string,
): string {
  return `${DATA_PATH}/${project}/${city}/${filename}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function fetchLocations(
  project: string,
  city: string,
  env: Env,
): Promise<LocationEntry[]> {
  const files = (await githubRequest(
    `/contents/${DATA_PATH}/${project}/${city}`,
    {},
    env,
  )) as GitHubFile[];
  const locationFiles = files.filter((f) => LOC_FILE_PATTERN.test(f.name));
  return Promise.all(
    locationFiles.map((f) => fetchLocation(project, city, f.name, env)),
  );
}

export async function fetchLocation(
  project: string,
  city: string,
  filename: string,
  env: Env,
): Promise<LocationEntry> {
  const file = (await githubRequest(
    `/contents/${locationFilePath(project, city, filename)}`,
    {},
    env,
  )) as GitHubFile;
  const content = file.content
    ? (yaml.load(decodeGitHubContent(file.content)) as Location)
    : ({} as Location);
  return { filename, sha: file.sha, location: content };
}

export async function createFilePR(
  filePath: string,
  content: string,
  teamName: string,
  env: Env,
): Promise<{ prUrl: string }> {
  const repoOwner = env.GITHUB_REPO.split("/")[0];
  const branch = `editor/${slugify(teamName)}/${slugify(filePath)}`;

  // Always get main SHA (needed for branch creation fallback)
  const { object } = (await githubRequest(`/git/ref/heads/main`, {}, env)) as {
    object: { sha: string };
  };

  // Check if our deterministic branch already exists
  let branchExists = false;
  try {
    await githubRequest(`/git/ref/heads/${branch}`, {}, env);
    branchExists = true;
  } catch {
    // 404 = branch doesn't exist yet
  }

  if (!branchExists) {
    await githubRequest(
      `/git/refs`,
      {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: object.sha }),
      },
      env,
    );
  }

  // Get file SHA on the branch (not main) so the commit succeeds
  let currentSha: string | null = null;
  try {
    const existing = (await githubRequest(
      `/contents/${filePath}?ref=${branch}`,
      {},
      env,
    )) as GitHubFile;
    currentSha = existing.sha ?? null;
  } catch {
    // 404 = new file on this branch
  }

  await githubRequest(
    `/contents/${filePath}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: `editor: update ${filePath.split("/").pop()}`,
        content: encodeGitHubContent(content),
        branch,
        ...(currentSha ? { sha: currentSha } : {}),
      }),
    },
    env,
  );

  // Find existing open PR for this branch, or create one
  const openPRs = (await githubRequest(
    `/pulls?head=${repoOwner}:${branch}&state=open`,
    {},
    env,
  )) as Array<{ html_url: string }>;

  if (openPRs.length > 0) {
    return { prUrl: openPRs[0].html_url };
  }

  const pr = (await githubRequest(
    `/pulls`,
    {
      method: "POST",
      body: JSON.stringify({
        title: `editor: update ${filePath.split("/").pop()}`,
        head: branch,
        base: "main",
        body: "Created via editor UI",
      }),
    },
    env,
  )) as { html_url: string };

  return { prUrl: pr.html_url };
}

export async function fetchPRStatuses(
  numbers: string[],
  env: Env,
): Promise<Record<string, string>> {
  const statuses: Record<string, string> = {};
  for (const num of numbers) {
    const pr = (await githubRequest(`/pulls/${num}`, {}, env)) as PRStatus;
    statuses[num] = pr.state;
  }
  return statuses;
}
```

- [ ] **Step 4: Update `editorRoutes.ts` to use `createFilePR`**

In `src/worker/routes/editorRoutes.ts`, update the import and the call inside the `POST /editor/location` handler:

Change the import from:
```ts
import {
  fetchLocations,
  fetchLocation,
  createLocationPR,
  fetchPRStatuses,
} from "../github";
```

To:
```ts
import {
  fetchLocations,
  fetchLocation,
  createFilePR,
  locationFilePath,
  fetchPRStatuses,
} from "../github";
```

Then replace the `createLocationPR` call (around line 119):

**Before:**
```ts
const { prUrl } = await createLocationPR(
  project,
  city,
  filename,
  yamlContent,
  existingSha ?? null,
  env,
);
```

**After:**
```ts
const filePath = locationFilePath(project, city, filename);
const { prUrl } = await createFilePR(
  filePath,
  yamlContent,
  authPayload!.teamName,
  env,
);
```

- [ ] **Step 5: Run the tests to confirm they pass**

```
npx vitest run src/test/worker.github.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 6: Run the full suite**

```
npx vitest run --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```
git add src/worker/github.ts src/worker/routes/editorRoutes.ts src/test/worker.github.test.ts
git commit -m "feat: replace createLocationPR with idempotent createFilePR using deterministic branch names"
```
