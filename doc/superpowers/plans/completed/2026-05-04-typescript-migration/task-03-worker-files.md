# Task 03: Worker Files

**Files (rename + retype, 8 files):**
- `src/worker/utils.js` → `src/worker/utils.ts`
- `src/worker/auth.js` → `src/worker/auth.ts`
- `src/worker/github.js` → `src/worker/github.ts`
- `src/worker/routes/authRoutes.js` → `src/worker/routes/authRoutes.ts`
- `src/worker/routes/uploadRoute.js` → `src/worker/routes/uploadRoute.ts`
- `src/worker/routes/formSubmitRoute.js` → `src/worker/routes/formSubmitRoute.ts`
- `src/worker/routes/editorRoutes.js` → `src/worker/routes/editorRoutes.ts`
- `src/worker.js` → `src/worker.ts`

For each file: rename it (use `git mv old new`), then replace its contents with the typed version below. Update internal `.js` import extensions to `.ts`.

---

- [ ] **Step 1: Convert `src/worker/utils.ts`**

```typescript
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
```

---

- [ ] **Step 2: Convert `src/worker/auth.ts`**

```typescript
import type { Env, TokenPayload } from "../types/worker";

export const COOKIE_NAME = "freedom_hunt_auth";
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const AUTH_COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Strict; Path=/";
export const KV_PREFIX_ADMIN = "admin:";
export const KV_PREFIX_PARTICIPANT = "auth:";

const AUTH_ALGO: HmacKeyGenParams = { name: "HMAC", hash: "SHA-256" };
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_TTL_SECONDS = 60;

function b64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str: string): string {
  return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
}

export async function createToken(
  payload: TokenPayload,
  secret: string,
): Promise<string> {
  const encoded = b64urlEncode(JSON.stringify(payload));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    AUTH_ALGO,
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    AUTH_ALGO.name,
    key,
    enc.encode(encoded),
  );
  const sigB64 = b64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
  return `${encoded}.${sigB64}`;
}

// Returns null instead of throwing so callers can treat any invalid token as unauthenticated.
export async function verifyToken(
  token: string,
  secret: string,
): Promise<TokenPayload | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const encoded = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      AUTH_ALGO,
      false,
      ["verify"],
    );
    const sigBytes = Uint8Array.from(b64urlDecode(sigB64), (c) =>
      c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      AUTH_ALGO.name,
      key,
      sigBytes,
      enc.encode(encoded),
    );
    if (!valid) return null;
    const payload = JSON.parse(b64urlDecode(encoded)) as TokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

// Sliding window: resets the counter when more than RATE_LIMIT_WINDOW_MS has passed since windowStart.
// Returns true if the request should be blocked.
export async function checkRateLimit(ip: string, env: Env): Promise<boolean> {
  const key = `rl:${ip}`;
  const raw = await env.AUTH_STORE.get(key);
  const now = Date.now();
  let record: RateLimitRecord = raw
    ? (JSON.parse(raw) as RateLimitRecord)
    : { count: 0, windowStart: now };
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    record = { count: 0, windowStart: now };
  }
  record.count++;
  await env.AUTH_STORE.put(key, JSON.stringify(record), {
    expirationTtl: RATE_LIMIT_TTL_SECONDS,
  });
  return record.count > RATE_LIMIT_MAX;
}

export async function requireAuth(
  request: Request,
  env: Env,
): Promise<TokenPayload | null> {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1], env.AUTH_SECRET);
}
```

---

- [ ] **Step 3: Convert `src/worker/github.ts`**

Replace the file with identical logic, adding type annotations. Key signatures only shown below — all internal logic stays the same.

```typescript
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
  return files
    .filter((f) => LOC_FILE_PATTERN.test(f.name))
    .map((f) => {
      const content = f.content
        ? (yaml.load(decodeGitHubContent(f.content)) as Location)
        : ({} as Location);
      return { filename: f.name, sha: f.sha, location: content };
    });
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
  return { filename: file.name, sha: file.sha, location: content };
}

export async function createLocationPR(
  project: string,
  city: string,
  filename: string,
  content: string,
  sha: string | null,
  env: Env,
): Promise<unknown> {
  const branch = `editor/${Date.now()}`;
  const path = locationFilePath(project, city, filename);
  const defaultBranch = (
    (await githubRequest("", {}, env)) as { default_branch: string }
  ).default_branch;
  const ref = (
    (await githubRequest(`/git/ref/heads/${defaultBranch}`, {}, env)) as {
      object: { sha: string };
    }
  ).object.sha;

  await githubRequest(
    `/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: ref }),
    },
    env,
  );

  await githubRequest(
    `/contents/${path}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: `editor: update ${filename}`,
        content: encodeGitHubContent(content),
        branch,
        ...(sha ? { sha } : {}),
      }),
    },
    env,
  );

  return githubRequest(
    `/pulls`,
    {
      method: "POST",
      body: JSON.stringify({
        title: `editor: update ${filename}`,
        head: branch,
        base: defaultBranch,
        body: "Created via editor UI",
      }),
    },
    env,
  );
}

export async function fetchPRStatuses(env: Env): Promise<PRStatus[]> {
  const prs = (await githubRequest(
    `/pulls?state=open&per_page=100`,
    {},
    env,
  )) as PRStatus[];
  return prs.filter((pr) => pr.title.startsWith("editor:"));
}
```

---

- [ ] **Step 4: Convert route handlers**

All four route files follow the same signature. The only change from JS is:
1. Add `import type { Env } from "../types/worker.ts"`
2. Import `type { TokenPayload }` where used
3. Annotate function parameters

**`src/worker/routes/authRoutes.ts`** — change only the function signature:

```typescript
import type { Env } from "../types/worker.ts";
// ... existing imports unchanged ...

export async function handleAuthRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  // ... all existing body unchanged ...
}
```

**`src/worker/routes/uploadRoute.ts`** — change only the function signature and `buildR2Key`:

```typescript
import type { Env } from "../types/worker.ts";
// ... existing imports unchanged ...

export function buildR2Key(
  locationId: string,
  mimeType: string,
  timestamp: number,
): string {
  // ... existing body unchanged ...
}

export async function handleUploadRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  // ... all existing body unchanged ...
}
```

**`src/worker/routes/formSubmitRoute.ts`** — change only the function signature:

```typescript
import type { Env } from "../types/worker.ts";
// ... existing imports unchanged ...

export async function handleFormSubmitRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  // ... all existing body unchanged ...
}
```

**`src/worker/routes/editorRoutes.ts`** — change only the function signature:

```typescript
import type { Env } from "../types/worker.ts";
// ... existing imports unchanged ...

export async function handleEditorRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  // ... all existing body unchanged ...
}
```

---

- [ ] **Step 5: Convert `src/worker.ts`**

```typescript
import type { Env } from "./types/worker";
import { handleAuthRoutes } from "./worker/routes/authRoutes";
import { handleUploadRoute } from "./worker/routes/uploadRoute";
import { handleFormSubmitRoute } from "./worker/routes/formSubmitRoute";
import { handleEditorRoutes } from "./worker/routes/editorRoutes";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    return (
      (await handleAuthRoutes(request, url, env)) ??
      (await handleUploadRoute(request, url, env)) ??
      (await handleFormSubmitRoute(request, url, env)) ??
      (await handleEditorRoutes(request, url, env)) ??
      (env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 }))
    );
  },
};
```

---

- [ ] **Step 6: Update internal import extensions**

In each converted file, remove the `.js` extension from imports (extension-free imports are the convention):

```typescript
// Before
import { json } from "../utils.js";
import { requireAuth } from "../auth.js";

// After
import { json } from "../utils";
import { requireAuth } from "../auth";
```

Apply to all 8 converted files.

---

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. Fix any that appear before proceeding.

---

- [ ] **Step 8: Run tests**

```bash
npm run test:run
```

Expected: all tests pass. Worker tests import from the renamed files — if any test uses `from "../worker/auth.js"`, update that import to `.ts` as well.

---

- [ ] **Step 9: Commit**

Stage: all 8 converted worker files
Message: `refactor: convert worker files to TypeScript`
