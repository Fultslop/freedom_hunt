# Scavenger Hunt Code Login Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace project-card browsing with a "Start Hunting" → scavenger-hunt-code → team-name flow, drop the contact-email field from participant login, and prefill/generate team names with a dice-reroll button.

**Architecture:** A new stateless `POST /auth/verify-code` worker endpoint resolves a typed code to either the literal `demo` keyword or a project id (by scanning `AUTH_STORE` KV keys prefixed `auth:`), without creating a session. Two new Svelte pages (`CodeEntryPage`, `JoinTeamPage`) implement the primary two-screen flow; the existing `LoginPage` stays as the single-screen deep-link/session-expiry fallback, losing its contact field and gaining the same team-name prefill/dice behavior. `AppPage` drops its project-card list for a single "Start Hunting" button.

**Tech Stack:** Svelte 5 (runes), TypeScript, Cloudflare Workers + KV (`AUTH_STORE`), Vitest + @testing-library/svelte, lucide-svelte icons.

## Global Constraints

- TypeScript only (`.ts` / `.svelte` with `<script lang="ts">`) — no `.js`/`.jsx`/`.tsx` in `src/`.
- Co-located `.css` per component/page, BEM-like class names (`block__element--modifier`), CSS custom properties for all color — no Tailwind, no CSS modules.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`) — no Svelte 4 `$:`.
- Contact email is fully removed from the shared-password participant flow (`LoginPage`, `JoinTeamPage`, `/auth/verify-code`) — not from `demo`'s own signup/login, which is untouched.
- The `demo` code check is case-insensitive; the scan against `AUTH_STORE` participant passwords is case-sensitive, matching existing password-comparison behavior. No real project's shared password may be the literal string `demo`.
- `sessionStorage` key for the code-verified password handoff: exactly `pendingHuntAuth`, JSON `{ project: string; password: string }`.
- `localStorage` key for the remembered team name: exactly `` `teamName:${project}` ``.
- Word lists: exactly 32 entries each in `TEAM_NAME_ADJECTIVES` and `TEAM_NAME_NOUNS` (`src/utils/teamNameGenerator.ts`).
- Regenerate ("dice") button uses the `Dice5` icon from `lucide-svelte` (confirmed exported from the installed version).
- `POST /auth/verify-code` reuses the existing `checkRateLimit(clientIP, env)` helper from `src/worker/auth.ts`, same as `/auth/login`.
- Test commands: `npm run test:run` (Vitest), `npm run lint` (ESLint), `npm run typecheck` (`tsc --noEmit` + `svelte-check`).

---

### Task 1: Team name generator utility

**Files:**
- Create: `src/utils/teamNameGenerator.ts`
- Test: `src/test/teamNameGenerator.test.ts`

**Interfaces:**
- Produces: `TEAM_NAME_ADJECTIVES: string[]` (32 entries), `TEAM_NAME_NOUNS: string[]` (32 entries), `generateTeamName(): string` returning `` `${adjective} ${noun}` ``. Consumed by Tasks 5, 6, 7.

- [ ] **Step 1: Write the failing test**

```ts
// src/test/teamNameGenerator.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  TEAM_NAME_ADJECTIVES,
  TEAM_NAME_NOUNS,
  generateTeamName,
} from "../utils/teamNameGenerator";

describe("teamNameGenerator", () => {
  it("has exactly 32 adjectives and 32 nouns", () => {
    expect(TEAM_NAME_ADJECTIVES).toHaveLength(32);
    expect(TEAM_NAME_NOUNS).toHaveLength(32);
  });

  it("has no duplicate words within each list", () => {
    expect(new Set(TEAM_NAME_ADJECTIVES).size).toBe(32);
    expect(new Set(TEAM_NAME_NOUNS).size).toBe(32);
  });

  it("generates a name composed of one adjective and one noun", () => {
    const name = generateTeamName();
    const [adjective, noun] = name.split(" ");
    expect(TEAM_NAME_ADJECTIVES).toContain(adjective);
    expect(TEAM_NAME_NOUNS).toContain(noun);
  });

  it("picks the first word of each list when Math.random returns 0", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(generateTeamName()).toBe(
      `${TEAM_NAME_ADJECTIVES[0]} ${TEAM_NAME_NOUNS[0]}`,
    );
    spy.mockRestore();
  });

  it("picks the last word of each list when Math.random returns just under 1", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(generateTeamName()).toBe(
      `${TEAM_NAME_ADJECTIVES[TEAM_NAME_ADJECTIVES.length - 1]} ${TEAM_NAME_NOUNS[TEAM_NAME_NOUNS.length - 1]}`,
    );
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- teamNameGenerator`
Expected: FAIL — `src/utils/teamNameGenerator.ts` does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/utils/teamNameGenerator.ts
export const TEAM_NAME_ADJECTIVES = [
  "Red", "Funny", "Clear", "Bold", "Swift", "Clever", "Jolly", "Sneaky",
  "Bright", "Curious", "Daring", "Eager", "Fuzzy", "Giant", "Happy", "Icy",
  "Jumpy", "Kind", "Lucky", "Mighty", "Nifty", "Orange", "Plucky", "Quick",
  "Rowdy", "Silly", "Tiny", "Upbeat", "Vivid", "Wacky", "Zesty", "Golden",
];

export const TEAM_NAME_NOUNS = [
  "Pyjama", "Car", "Clown", "Team", "Falcon", "Pretzel", "Wizard", "Penguin",
  "Rocket", "Ninja", "Taco", "Panther", "Unicorn", "Otter", "Compass",
  "Dragon", "Marmot", "Biscuit", "Voyager", "Comet", "Lantern", "Wombat",
  "Trailblazer", "Puzzle", "Kangaroo", "Cactus", "Sailor", "Sparrow",
  "Tornado", "Walrus", "Yeti", "Detective",
];

export function generateTeamName(): string {
  const adjective =
    TEAM_NAME_ADJECTIVES[Math.floor(Math.random() * TEAM_NAME_ADJECTIVES.length)];
  const noun =
    TEAM_NAME_NOUNS[Math.floor(Math.random() * TEAM_NAME_NOUNS.length)];
  return `${adjective} ${noun}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- teamNameGenerator`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/teamNameGenerator.ts src/test/teamNameGenerator.test.ts
git commit -m "feat: add random team name generator"
```

---

### Task 2: Backend `POST /auth/verify-code` endpoint

**Files:**
- Modify: `src/worker/routes/authRoutes.ts`
- Test: `src/test/worker.test.ts`

**Interfaces:**
- Consumes: `checkRateLimit(ip, env)`, `KV_PREFIX_PARTICIPANT` from `../auth`; `json`, `checkOrigin` from `../utils`. `env.AUTH_STORE.list({ prefix })` (Cloudflare `KVNamespace.list`, returns `{ keys: { name: string }[] }`).
- Produces: `POST /auth/verify-code` — request `{ code: string }`; response `{ ok: true, mode: "demo" }` | `{ ok: true, mode: "project", project: string }` | `{ ok: false, error?: string }`. Consumed by Task 3's `postVerifyCode`.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/worker.test.ts`, after the existing `describe("/auth/login — admin tier", ...)` block (i.e. right before `describe("/auth/me — isAdmin", ...)`):

```ts
describe("/auth/verify-code", () => {
  const makeEnv = (kvData: Record<string, string>) => ({
    AUTH_STORE: {
      get: async (key: string) => kvData[key] ?? null,
      put: async () => {},
      list: async ({ prefix }: { prefix: string }) => ({
        keys: Object.keys(kvData)
          .filter((k) => k.startsWith(prefix))
          .map((name) => ({ name })),
      }),
    },
    AUTH_SECRET: TEST_SECRET,
  });

  it("returns mode demo for the literal keyword, case-insensitively", async () => {
    const request = new Request("https://example.com/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ code: "DEMO" }),
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.5.5.1" },
    });
    const response = await worker.fetch(request, makeEnv({}));
    const data = await response.json();
    expect(data).toEqual({ ok: true, mode: "demo" });
  });

  it("resolves a project when the code matches its stored participant password", async () => {
    const env = makeEnv({ "auth:democrats_abroad": "letmein" });
    const request = new Request("https://example.com/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ code: "letmein" }),
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.5.5.2" },
    });
    const response = await worker.fetch(request, env);
    const data = await response.json();
    expect(data).toEqual({ ok: true, mode: "project", project: "democrats_abroad" });
  });

  it("trims whitespace before comparing", async () => {
    const env = makeEnv({ "auth:democrats_abroad": "letmein" });
    const request = new Request("https://example.com/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ code: "  letmein  " }),
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.5.5.3" },
    });
    const response = await worker.fetch(request, env);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.project).toBe("democrats_abroad");
  });

  it("returns ok:false with 401 for a code that matches nothing", async () => {
    const env = makeEnv({ "auth:democrats_abroad": "letmein" });
    const request = new Request("https://example.com/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ code: "wrong" }),
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.5.5.4" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.ok).toBe(false);
  });

  it("returns 400 when code is missing", async () => {
    const env = makeEnv({});
    const request = new Request("https://example.com/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.5.5.6" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    const env = {
      AUTH_STORE: {
        get: async (key: string) =>
          key.startsWith("rl:")
            ? JSON.stringify({ count: 5, windowStart: Date.now() })
            : null,
        put: async () => {},
        list: async () => ({ keys: [] }),
      },
      AUTH_SECRET: TEST_SECRET,
    };
    const request = new Request("https://example.com/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ code: "demo" }),
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.5.5.5" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- worker.test`
Expected: FAIL — 404/undefined responses, since `/auth/verify-code` doesn't exist yet.

- [ ] **Step 3: Implement the endpoint**

In `src/worker/routes/authRoutes.ts`, insert this block immediately before the existing `// POST /auth/login` section (i.e. right after the `/auth/participant-signup` block closes):

```ts
  // -------------------------------------------------------------------------
  // POST /auth/verify-code
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/verify-code") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
      if (await checkRateLimit(clientIP, env)) {
        return json({ ok: false, error: "Too many attempts. Please wait a moment." }, 429);
      }

      const { code } = (await request.json()) as { code?: string };
      const trimmed = (code ?? "").trim();
      if (!trimmed) {
        return json({ ok: false, error: "Missing code" }, 400);
      }

      if (trimmed.toLowerCase() === "demo") {
        return json({ ok: true, mode: "demo" });
      }

      const list = await env.AUTH_STORE.list({ prefix: KV_PREFIX_PARTICIPANT });
      for (const key of list.keys) {
        const storedPassword = await env.AUTH_STORE.get(key.name);
        if (storedPassword !== null && storedPassword === trimmed) {
          return json({
            ok: true,
            mode: "project",
            project: key.name.slice(KV_PREFIX_PARTICIPANT.length),
          });
        }
      }

      return json({ ok: false, error: "Invalid code" }, 401);
    } catch {
      return json({ ok: false, error: "Verification failed" }, 500);
    }
  }

```

No import changes are needed — `checkRateLimit`, `KV_PREFIX_PARTICIPANT`, `json`, and `checkOrigin` are already imported at the top of `authRoutes.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- worker.test`
Expected: PASS (all `/auth/verify-code` tests, plus all pre-existing tests in the file still pass)

- [ ] **Step 5: Commit**

```bash
git add src/worker/routes/authRoutes.ts src/test/worker.test.ts
git commit -m "feat: add POST /auth/verify-code for code-to-project resolution"
```

---

### Task 3: `api.ts` client — `postVerifyCode`, optional `contact`

**Files:**
- Modify: `src/utils/api.ts`
- Test: `src/test/api.test.ts`

**Interfaces:**
- Produces: `postVerifyCode(code: string): Promise<VerifyCodeResponse>` where `VerifyCodeResponse = { ok: boolean; mode?: "demo" | "project"; project?: string; error?: string }`. `LoginPayload.contact` becomes optional. Consumed by Task 5 (`CodeEntryPage`) and Tasks 6/7 (`postLogin` calls without `contact`).

- [ ] **Step 1: Write the failing tests**

In `src/test/api.test.ts`, add `postVerifyCode` to the import list at the top:

```ts
import {
  postFormSubmit,
  postPhotoUpload,
  fetchEditorLocation,
  saveEditorLocation,
  fetchEditorLocations,
  fetchPrStatuses,
  postLogin,
  postVerifyCode,
  postLogout,
  fetchAuthMe,
  fetchGalleryPhotos,
  fetchRandomPhotos,
  postDemoSignup,
} from "../utils/api";
```

Then add these tests right after the existing `postLogin returns error message on failure` test:

```ts
test("postVerifyCode POSTs to /auth/verify-code with the code", async () => {
  mockFetch({ ok: true, mode: "project", project: "democrats_abroad" });
  const result = await postVerifyCode("letmein");
  expect(fetch).toHaveBeenCalledWith("/auth/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "letmein" }),
  });
  expect(result.ok).toBe(true);
  expect(result.mode).toBe("project");
  expect(result.project).toBe("democrats_abroad");
});

test("postVerifyCode returns ok:false for an unrecognized code", async () => {
  mockFetch({ ok: false, error: "Invalid code" });
  const result = await postVerifyCode("nope");
  expect(result.ok).toBe(false);
});

test("postLogin omits contact from the request body when not provided", async () => {
  mockFetch({ ok: true, teamName: "Team A", isAdmin: false });
  const payload = { project: "democrats_abroad", teamName: "Team A", password: "secret" };
  await postLogin(payload);
  expect(fetch).toHaveBeenCalledWith("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- api.test`
Expected: FAIL — `postVerifyCode` is not exported yet; the "omits contact" test fails on TypeScript (LoginPayload still requires `contact`) or at minimum is untested behavior.

- [ ] **Step 3: Implement the client changes**

In `src/utils/api.ts`, change:

```ts
export interface LoginPayload {
  project: string;
  teamName: string;
  contact: string;
  password: string;
  email?: string;
}
```

to:

```ts
export interface LoginPayload {
  project: string;
  teamName: string;
  contact?: string;
  password: string;
  email?: string;
}
```

Then add this immediately after the existing `postLogin` function (before `postLogout`):

```ts
export interface VerifyCodeResponse {
  ok: boolean;
  mode?: "demo" | "project";
  project?: string;
  error?: string;
}

export async function postVerifyCode(code: string): Promise<VerifyCodeResponse> {
  const res = await fetch("/auth/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return res.json() as Promise<VerifyCodeResponse>;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- api.test`
Expected: PASS (all `api.test.ts` tests, including the two new ones and the updated one)

- [ ] **Step 5: Commit**

```bash
git add src/utils/api.ts src/test/api.test.ts
git commit -m "feat: add postVerifyCode client and make LoginPayload.contact optional"
```

---

### Task 4: `AppPage` — replace project list with "Start Hunting" button

**Files:**
- Modify: `src/pages/AppPage.svelte`
- Modify: `src/pages/AppPage.css`
- Modify: `src/test/AppPage.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AppPage` navigates to `/start` on button click (route wired in Task 5). No other component depends on `AppPage`'s internals.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/test/AppPage.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import AppPage from "../pages/AppPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    "app.title": "YES. WE. VOTE.",
    "app.tagline": "A scavenger hunt for democracy.",
  }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
});

test("renders the Start Hunting button", async () => {
  render(AppPage);
  expect(
    await screen.findByRole("button", { name: /start hunting/i }),
  ).toBeInTheDocument();
});

test("does not render a project list", async () => {
  render(AppPage);
  await screen.findByRole("button", { name: /start hunting/i });
  expect(screen.queryByText(/democrats abroad/i)).not.toBeInTheDocument();
});

test("navigates to /start when the button is clicked", async () => {
  const { push } = await import("svelte-spa-router");
  render(AppPage);
  await fireEvent.click(
    await screen.findByRole("button", { name: /start hunting/i }),
  );
  expect(push).toHaveBeenCalledWith("/start");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- AppPage.test`
Expected: FAIL — no "Start Hunting" button exists yet; project cards still render.

- [ ] **Step 3: Rewrite `AppPage.svelte`**

Replace the full contents of `src/pages/AppPage.svelte`:

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { themeStore } from "../stores/themeStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { fetchImage } from "../assets/AssetManager";
  import { loadText } from "../utils/loadText";
  import type { ApplicationText } from "../types/data";
  import "./AppPage.css";

  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  themeStore.setThemeName("app");

  let appText = $state<ApplicationText | null>(null);
  let landingImageUrl = $state<string | null>(null);
  let imgHeight = $state(0);

  $effect(() => {
    loadText<ApplicationText>($languageStore.currentLang, "application").then(
      (data) => {
        appText = data;
        if (data) {
          titleBarStore.set({
            title: data["app.title"] ?? "Freedom Hunt",
            progress: null,
            backPath: null,
          });
        }
      },
    );
    fetchImage("landing-page.jpg").then((url) => {
      landingImageUrl = url;
    });
  });

  let contentMarginTop = $derived(
    imgHeight
      ? Math.round(-(imgHeight / 2 - window.innerHeight * 0.2))
      : landingImageUrl
        ? -80
        : 0,
  );
</script>

<div class="app-page">
  {#if landingImageUrl}
    <div
      class="app-page__hero-wrap"
      style={`height: ${imgHeight ? imgHeight / 2 + "px" : "auto"}`}
    >
      <img
        src={landingImageUrl}
        alt=""
        onload={(e) =>
          (imgHeight = (e.target as HTMLImageElement).offsetHeight)}
        class="app-page__hero-img"
      />
      <div class="app-page__hero-gradient"></div>
    </div>
  {/if}

  <div class="app-page__content" style={`margin-top: ${contentMarginTop}px`}>
    {#if appText}
      <div class="app-page__heading">
        <h1 class="app-page__title">{appText["app.title"]}</h1>
        <p class="app-page__tagline">{appText["app.tagline"]}</p>
      </div>
    {/if}

    <button
      type="button"
      class="app-page__start-btn"
      onclick={() => push("/start")}
    >
      Start Hunting
    </button>
  </div>
</div>
```

- [ ] **Step 4: Update `AppPage.css`**

In `src/pages/AppPage.css`, remove these now-unused rules: `.app-page__subtitle`, `.app-page__project-card`, `.app-page__project-card::after`, `.app-page__project-card:hover`, `.app-page__project-card:hover::after`, `.app-page__project-card:active`, `.app-page__project-name`, `.app-page__project-img`, `.app-page__project-body` (everything from `.app-page__subtitle` through the end of the file). Keep everything above that (`.app-page`, `.app-page__hero-wrap`, `.app-page__hero-img`, `.app-page__hero-gradient`, `.app-page__content`, `.app-page__heading`, `.app-page__title`, `.app-page__tagline`). Append this new rule at the end of the file:

```css
.app-page__start-btn {
  width: 100%;
  padding: 14px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: var(--font-size-lg);
  font-weight: 700;
  cursor: pointer;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- AppPage.test`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/pages/AppPage.svelte src/pages/AppPage.css src/test/AppPage.test.ts
git commit -m "feat: replace AppPage project list with a Start Hunting button"
```

---

### Task 5: `CodeEntryPage` — scavenger hunt code screen

**Files:**
- Create: `src/pages/CodeEntryPage.svelte`
- Create: `src/pages/CodeEntryPage.css`
- Create: `src/test/CodeEntryPage.test.ts`
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: `postVerifyCode(code)` from Task 3 (`{ok, mode, project, error}`).
- Produces: on `mode: "demo"`, `push("/login/demo")`. On `mode: "project"`, writes `sessionStorage["pendingHuntAuth"] = JSON.stringify({project, password: code.trim()})` and `push(`/join/${project}`)` — consumed by Task 6's `JoinTeamPage`. Route `/start`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/CodeEntryPage.test.ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import CodeEntryPage from "../pages/CodeEntryPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  postVerifyCode: vi.fn(),
}));

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    "app.title": "YES. WE. VOTE.",
    "app.tagline": "A scavenger hunt for democracy.",
  }),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  sessionStorage.clear();
});

test("renders the scavenger hunt code field", () => {
  render(CodeEntryPage);
  expect(screen.getByLabelText(/scavenger hunt code/i)).toBeInTheDocument();
});

test("navigates to /login/demo when the code resolves to demo mode", async () => {
  const api = await import("../utils/api");
  const { push } = await import("svelte-spa-router");
  vi.mocked(api.postVerifyCode).mockResolvedValue({ ok: true, mode: "demo" });
  render(CodeEntryPage);
  await fireEvent.input(screen.getByLabelText(/scavenger hunt code/i), {
    target: { value: "demo" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login/demo"));
});

test("stashes the password and navigates to /join/:project on a project match", async () => {
  const api = await import("../utils/api");
  const { push } = await import("svelte-spa-router");
  vi.mocked(api.postVerifyCode).mockResolvedValue({
    ok: true,
    mode: "project",
    project: "democrats_abroad",
  });
  render(CodeEntryPage);
  await fireEvent.input(screen.getByLabelText(/scavenger hunt code/i), {
    target: { value: "letmein" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/join/democrats_abroad"));
  expect(JSON.parse(sessionStorage.getItem("pendingHuntAuth")!)).toEqual({
    project: "democrats_abroad",
    password: "letmein",
  });
});

test("shows an error for an invalid code", async () => {
  const api = await import("../utils/api");
  vi.mocked(api.postVerifyCode).mockResolvedValue({ ok: false });
  render(CodeEntryPage);
  await fireEvent.input(screen.getByLabelText(/scavenger hunt code/i), {
    target: { value: "wrong" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  expect(await screen.findByText(/invalid code/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- CodeEntryPage.test`
Expected: FAIL — `src/pages/CodeEntryPage.svelte` does not exist.

- [ ] **Step 3: Create `CodeEntryPage.svelte`**

```svelte
<!-- src/pages/CodeEntryPage.svelte -->
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { fetchImage } from "../assets/AssetManager";
  import { loadText } from "../utils/loadText";
  import { postVerifyCode } from "../utils/api";
  import type { ApplicationText } from "../types/data";
  import "./CodeEntryPage.css";

  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: "/" });

  let appText = $state<ApplicationText | null>(null);
  let landingImageUrl = $state<string | null>(null);
  let imgHeight = $state(0);
  let code = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  $effect(() => {
    loadText<ApplicationText>($languageStore.currentLang, "application").then(
      (data) => {
        appText = data;
        if (data) {
          titleBarStore.set({
            title: data["app.title"] ?? "Freedom Hunt",
            progress: null,
            backPath: "/",
          });
        }
      },
    );
    fetchImage("landing-page.jpg").then((url) => {
      landingImageUrl = url;
    });
  });

  let contentMarginTop = $derived(
    imgHeight
      ? Math.round(-(imgHeight / 2 - window.innerHeight * 0.2))
      : landingImageUrl
        ? -80
        : 0,
  );

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    loading = true;
    try {
      const trimmed = code.trim();
      const data = await postVerifyCode(trimmed);
      if (data.ok && data.mode === "demo") {
        push("/login/demo");
        return;
      }
      if (data.ok && data.mode === "project" && data.project) {
        sessionStorage.setItem(
          "pendingHuntAuth",
          JSON.stringify({ project: data.project, password: trimmed }),
        );
        push(`/join/${data.project}`);
        return;
      }
      error = "Invalid code. Please check and try again.";
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="code-entry-page">
  {#if landingImageUrl}
    <div
      class="code-entry-page__hero-wrap"
      style={`height: ${imgHeight ? imgHeight / 2 + "px" : "auto"}`}
    >
      <img
        src={landingImageUrl}
        alt=""
        onload={(e) =>
          (imgHeight = (e.target as HTMLImageElement).offsetHeight)}
        class="code-entry-page__hero-img"
      />
      <div class="code-entry-page__hero-gradient"></div>
    </div>
  {/if}

  <div
    class="code-entry-page__content"
    style={`margin-top: ${contentMarginTop}px`}
  >
    {#if appText}
      <div class="code-entry-page__heading">
        <h1 class="code-entry-page__title">{appText["app.title"]}</h1>
        <p class="code-entry-page__tagline">{appText["app.tagline"]}</p>
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="code-entry-page__form">
      <div
        class={error
          ? "code-entry-page__field--error"
          : "code-entry-page__field"}
      >
        <label class="code-entry-page__label" for="code"
          >Scavenger hunt code</label
        >
        <input
          id="code"
          type="text"
          bind:value={code}
          required
          autocomplete="off"
          autocapitalize="off"
          placeholder="Enter your code"
          class={`code-entry-page__input${error ? " code-entry-page__input--error" : ""}`}
        />
      </div>

      {#if error}
        <div class="code-entry-page__error">✕ {error}</div>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class={`code-entry-page__submit${loading ? " code-entry-page__submit--loading" : ""}`}
      >
        {loading ? "Checking…" : "Continue"}
      </button>
    </form>
  </div>
</div>
```

- [ ] **Step 4: Create `CodeEntryPage.css`**

```css
/* src/pages/CodeEntryPage.css */

.code-entry-page {
  background: var(--color-background);
  min-height: 100vh;
}

.code-entry-page__hero-wrap {
  background: #ffffff;
  overflow: hidden;
  position: relative;
}

.code-entry-page__hero-img {
  display: block;
  width: 100%;
  transform: translateY(-50%);
}

.code-entry-page__hero-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0),
    var(--color-background)
  );
}

.code-entry-page__content {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-background);
  border-radius: 8px;
  position: relative;
}

.code-entry-page__heading {
  margin-bottom: 32px;
}

.code-entry-page__title {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
}

.code-entry-page__tagline {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin-top: 8px;
}

.code-entry-page__form {
  width: 100%;
}

.code-entry-page__field {
  margin-bottom: 20px;
}

.code-entry-page__field--error {
  margin-bottom: 8px;
}

.code-entry-page__label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.code-entry-page__input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  font-size: var(--font-size-base);
  color: var(--color-text);
  box-sizing: border-box;
}

.code-entry-page__input--error {
  border-color: var(--color-accent);
}

.code-entry-page__error {
  font-size: 12px;
  color: var(--color-accent);
  font-weight: 600;
  margin-bottom: 16px;
}

.code-entry-page__submit {
  width: 100%;
  padding: 12px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.code-entry-page__submit--loading {
  opacity: 0.7;
  cursor: default;
}
```

- [ ] **Step 5: Wire the `/start` route in `App.svelte`**

Add the import alongside the other page imports (after `import LoginPage from "./pages/LoginPage.svelte";`):

```ts
  import CodeEntryPage from "./pages/CodeEntryPage.svelte";
```

Add the route entry immediately before `"/:project": wrap({...})` in the `routes` object (this ordering matters — `/:project` is a one-segment wildcard that would otherwise swallow `/start`):

```ts
    "/start": asRoute(CodeEntryPage),
    "/:project": wrap({
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- CodeEntryPage.test`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add src/pages/CodeEntryPage.svelte src/pages/CodeEntryPage.css src/test/CodeEntryPage.test.ts src/App.svelte
git commit -m "feat: add CodeEntryPage for scavenger hunt code entry"
```

---

### Task 6: `JoinTeamPage` — team name screen

**Files:**
- Create: `src/pages/JoinTeamPage.svelte`
- Create: `src/pages/JoinTeamPage.css`
- Create: `src/test/JoinTeamPage.test.ts`
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: `sessionStorage["pendingHuntAuth"]` written by Task 5; `generateTeamName()`, `TEAM_NAME_ADJECTIVES`, `TEAM_NAME_NOUNS` from Task 1; `postLogin({project, teamName, password})` (no `contact`) from existing `api.ts`; `authStore.loginParticipant`.
- Produces: on successful login, `localStorage["teamName:<project>"] = teamName`, clears `sessionStorage["pendingHuntAuth"]`, `push(isAdmin ? "/editor" : "/"+project)`. Route `/join/:project`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/JoinTeamPage.test.ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import JoinTeamPage from "../pages/JoinTeamPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";
import { authStore } from "../stores/authStore";
import { get } from "svelte/store";
import { TEAM_NAME_ADJECTIVES, TEAM_NAME_NOUNS } from "../utils/teamNameGenerator";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  postLogin: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
  sessionStorage.clear();
});

test("redirects to /login/:project when there's no stashed password", async () => {
  const { push } = await import("svelte-spa-router");
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login/democrats_abroad"));
});

test("prefills a generated team name when none is saved", () => {
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  const input = screen.getByLabelText(/team name/i) as HTMLInputElement;
  expect(input.value.split(" ")).toHaveLength(2);
});

test("prefills the saved team name from localStorage when present", () => {
  localStorage.setItem("teamName:democrats_abroad", "The Tulip Squad");
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  expect(screen.getByLabelText(/team name/i)).toHaveValue("The Tulip Squad");
});

test("regenerates the team name when the dice button is clicked", async () => {
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  const spy = vi.spyOn(Math, "random").mockReturnValue(0);
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  const input = screen.getByLabelText(/team name/i) as HTMLInputElement;
  expect(input.value).toBe(`${TEAM_NAME_ADJECTIVES[0]} ${TEAM_NAME_NOUNS[0]}`);

  spy.mockReturnValue(0.999999);
  await fireEvent.click(
    screen.getByRole("button", { name: /suggest a new team name/i }),
  );
  expect(input.value).toBe(
    `${TEAM_NAME_ADJECTIVES[TEAM_NAME_ADJECTIVES.length - 1]} ${TEAM_NAME_NOUNS[TEAM_NAME_NOUNS.length - 1]}`,
  );
  spy.mockRestore();
});

test("submits project + team name + stashed password, then navigates to the project", async () => {
  const api = await import("../utils/api");
  const { push } = await import("svelte-spa-router");
  vi.mocked(api.postLogin).mockResolvedValue({
    ok: true,
    teamName: "The Tulip Squad",
    isAdmin: false,
  });
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  await fireEvent.input(screen.getByLabelText(/team name/i), {
    target: { value: "The Tulip Squad" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /join the hunt/i }));
  await waitFor(() => {
    expect(api.postLogin).toHaveBeenCalledWith({
      project: "democrats_abroad",
      teamName: "The Tulip Squad",
      password: "secret",
    });
    expect(localStorage.getItem("teamName:democrats_abroad")).toBe("The Tulip Squad");
    expect(sessionStorage.getItem("pendingHuntAuth")).toBeNull();
    expect(push).toHaveBeenCalledWith("/democrats_abroad");
    expect(get(authStore).activeAuth?.kind).toBe("participant");
  });
});

test("shows the server error and does not navigate on failed login", async () => {
  const api = await import("../utils/api");
  const { push } = await import("svelte-spa-router");
  vi.mocked(api.postLogin).mockResolvedValue({ ok: false, error: "Incorrect password" });
  sessionStorage.setItem(
    "pendingHuntAuth",
    JSON.stringify({ project: "democrats_abroad", password: "secret" }),
  );
  render(JoinTeamPage, { props: { params: { project: "democrats_abroad" } } });
  await fireEvent.click(screen.getByRole("button", { name: /join the hunt/i }));
  expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- JoinTeamPage.test`
Expected: FAIL — `src/pages/JoinTeamPage.svelte` does not exist.

- [ ] **Step 3: Create `JoinTeamPage.svelte`**

```svelte
<!-- src/pages/JoinTeamPage.svelte -->
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { Dice5 } from "lucide-svelte";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postLogin } from "../utils/api";
  import { generateTeamName } from "../utils/teamNameGenerator";
  import "./JoinTeamPage.css";

  let { params }: { params: { project: string } } = $props();

  const teamNameKey = `teamName:${params.project}`;

  let teamName = $state(
    localStorage.getItem(teamNameKey) ?? generateTeamName(),
  );
  let error = $state<string | null>(null);
  let loading = $state(false);

  titleBarStore.set({ title: "Join the hunt", progress: null, backPath: null });

  function readPendingPassword(): string | null {
    const raw = sessionStorage.getItem("pendingHuntAuth");
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { project?: string; password?: string };
      if (parsed.project !== params.project || !parsed.password) {
        return null;
      }
      return parsed.password;
    } catch {
      return null;
    }
  }

  $effect(() => {
    if (!readPendingPassword()) {
      push(`/login/${params.project}`);
    }
  });

  function rerollTeamName() {
    teamName = generateTeamName();
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const password = readPendingPassword();
    if (!password) {
      push(`/login/${params.project}`);
      return;
    }
    error = null;
    loading = true;
    try {
      const data = await postLogin({ project: params.project, teamName, password });
      if (data.ok) {
        authStore.loginParticipant(
          params.project,
          data.teamName ?? teamName,
          data.contact ?? "",
          data.isAdmin ?? false,
        );
        localStorage.setItem(teamNameKey, teamName);
        sessionStorage.removeItem("pendingHuntAuth");
        push(data.isAdmin ? "/editor" : `/${params.project}`);
      } else {
        error = data.error || "Something went wrong. Please try again.";
      }
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="join-team-page">
  <div class="join-team-page__header">
    <div class="join-team-page__headline">What's your team name?</div>
    <div class="join-team-page__subtext">
      Pick something your team will recognize on the leaderboard and photo
      gallery. Use the suggestion below or roll the dice for a new one.
    </div>
  </div>

  <form onsubmit={handleSubmit} class="join-team-page__form">
    <div
      class={error ? "join-team-page__field--error" : "join-team-page__field"}
    >
      <label class="join-team-page__label" for="teamName">Team name</label>
      <div class="join-team-page__input-row">
        <input
          id="teamName"
          type="text"
          bind:value={teamName}
          required
          placeholder="Your team name"
          class={`join-team-page__input${error ? " join-team-page__input--error" : ""}`}
        />
        <button
          type="button"
          onclick={rerollTeamName}
          aria-label="Suggest a new team name"
          class="join-team-page__dice-btn"
        >
          <Dice5 size={20} />
        </button>
      </div>
    </div>

    {#if error}
      <div class="join-team-page__error">✕ {error}</div>
    {/if}

    <button
      type="submit"
      disabled={loading}
      class={`join-team-page__submit${loading ? " join-team-page__submit--loading" : ""}`}
    >
      {loading ? "Joining…" : "Join the Hunt"}
    </button>
  </form>
</div>
```

- [ ] **Step 4: Create `JoinTeamPage.css`**

```css
/* src/pages/JoinTeamPage.css */

.join-team-page {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--color-background);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  box-sizing: border-box;
}

.join-team-page__header {
  text-align: center;
  margin-bottom: 28px;
}

.join-team-page__headline {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text);
  margin-bottom: 6px;
}

.join-team-page__subtext {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.join-team-page__form {
  width: 100%;
  max-width: 300px;
}

.join-team-page__field {
  margin-bottom: 20px;
}

.join-team-page__field--error {
  margin-bottom: 8px;
}

.join-team-page__label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.join-team-page__input-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.join-team-page__input {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  font-size: var(--font-size-base);
  color: var(--color-text);
  box-sizing: border-box;
}

.join-team-page__input--error {
  border-color: var(--color-accent);
}

.join-team-page__dice-btn {
  flex: 0 0 auto;
  width: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}

.join-team-page__error {
  font-size: 12px;
  color: var(--color-accent);
  font-weight: 600;
  margin-bottom: 16px;
}

.join-team-page__submit {
  width: 100%;
  padding: 12px;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.join-team-page__submit--loading {
  opacity: 0.7;
  cursor: default;
}
```

- [ ] **Step 5: Wire the `/join/:project` route in `App.svelte`**

Add the import next to the `CodeEntryPage` import added in Task 5:

```ts
  import JoinTeamPage from "./pages/JoinTeamPage.svelte";
```

Add the route entry immediately before `"/:project": wrap({...})`, after the `/start` entry added in Task 5 (this ordering matters — `/:project/:city` is a two-segment wildcard pattern that would otherwise swallow `/join/:project`):

```ts
    "/start": asRoute(CodeEntryPage),
    "/join/:project": asRoute(JoinTeamPage),
    "/:project": wrap({
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- JoinTeamPage.test`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add src/pages/JoinTeamPage.svelte src/pages/JoinTeamPage.css src/test/JoinTeamPage.test.ts src/App.svelte
git commit -m "feat: add JoinTeamPage for team name entry"
```

---

### Task 7: `LoginPage` — drop contact field, add team name prefill + dice

**Files:**
- Modify: `src/pages/LoginPage.svelte`
- Modify: `src/pages/LoginPage.css`
- Modify: `src/test/LoginPage.test.ts`

**Interfaces:**
- Consumes: `generateTeamName()` from Task 1; `postLogin({project, teamName, password})` (no `contact`).
- Produces: no external consumers — this is the terminal deep-link/session-expiry recovery screen.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/test/LoginPage.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import LoginPage from "../pages/LoginPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";
import { TEAM_NAME_ADJECTIVES, TEAM_NAME_NOUNS } from "../utils/teamNameGenerator";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
});

test("renders login form", () => {
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  expect(
    screen.getByRole("button", { name: /join the hunt/i }),
  ).toBeInTheDocument();
});

test("does not render a contact email field", () => {
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  expect(screen.queryByLabelText(/contact email/i)).not.toBeInTheDocument();
});

test("prefills a generated team name when nothing is saved for this project", () => {
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  const input = screen.getByLabelText(/team name/i) as HTMLInputElement;
  expect(input.value.split(" ")).toHaveLength(2);
});

test("prefills the saved team name from localStorage when present", () => {
  localStorage.setItem("teamName:democrats_abroad", "The Tulip Squad");
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  expect(screen.getByLabelText(/team name/i)).toHaveValue("The Tulip Squad");
});

test("regenerates the team name when the dice button is clicked", async () => {
  const spy = vi.spyOn(Math, "random").mockReturnValue(0);
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  const input = screen.getByLabelText(/team name/i) as HTMLInputElement;
  expect(input.value).toBe(`${TEAM_NAME_ADJECTIVES[0]} ${TEAM_NAME_NOUNS[0]}`);

  spy.mockReturnValue(0.999999);
  await fireEvent.click(
    screen.getByRole("button", { name: /suggest a new team name/i }),
  );
  expect(input.value).toBe(
    `${TEAM_NAME_ADJECTIVES[TEAM_NAME_ADJECTIVES.length - 1]} ${TEAM_NAME_NOUNS[TEAM_NAME_NOUNS.length - 1]}`,
  );
  spy.mockRestore();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- LoginPage.test`
Expected: FAIL — contact field still present, no dice button, `teamName` still starts empty.

- [ ] **Step 3: Update `LoginPage.svelte`**

Replace the `<script>` block:

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { Dice5 } from "lucide-svelte";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postLogin } from "../utils/api";
  import { generateTeamName } from "../utils/teamNameGenerator";
  import "./LoginPage.css";

  let { params }: { params: { project: string } } = $props();

  const teamNameKey = `teamName:${params.project}`;

  let teamName = $state(
    localStorage.getItem(teamNameKey) ?? generateTeamName(),
  );
  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);
  let showPassword = $state(false);

  titleBarStore.set({ title: "Sign in", progress: null, backPath: null });

  function rerollTeamName() {
    teamName = generateTeamName();
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    loading = true;
    try {
      const data = await postLogin({
        project: params.project,
        teamName,
        password,
      });
      if (data.ok) {
        authStore.loginParticipant(
          params.project,
          data.teamName ?? teamName,
          data.contact ?? "",
          data.isAdmin ?? false,
        );
        localStorage.setItem(teamNameKey, teamName);
        push(data.isAdmin ? "/editor" : `/${params.project}`);
      } else {
        error = data.error || "Incorrect password. Please try again.";
      }
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      loading = false;
    }
  }
</script>
```

Replace the team-name field block (the first `<div class="login-page__field">...</div>`, which today holds the "Team name" input) and delete the "Contact email" field block entirely, so the form markup becomes:

```svelte
<form
    onsubmit={(e) => {
      e.preventDefault();
      handleSubmit(e);
    }}
    class="login-page__form"
  >
    <div class="login-page__field">
      <label class="login-page__label" for="teamName">Team name</label>
      <div class="login-page__input-row">
        <input
          id="teamName"
          type="text"
          bind:value={teamName}
          required
          placeholder="Your team name"
          class="login-page__input"
        />
        <button
          type="button"
          onclick={rerollTeamName}
          aria-label="Suggest a new team name"
          class="login-page__dice-btn"
        >
          <Dice5 size={20} />
        </button>
      </div>
    </div>

    <div
      class={error
        ? "login-page__field--last-error"
        : "login-page__field--last"}
    >
      <label class="login-page__label" for="password">Password</label>
      <div style="position: relative; width: 100%;">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          bind:value={password}
          required
          placeholder="Event password"
          class={`login-page__input${error ? " login-page__input--error" : ""}`}
          style="width: 100%; padding-right: 40px;"
        />
        <button
          type="button"
          onclick={() => (showPassword = !showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          class="login-page__eye-btn"
        >
          {#if showPassword}
            <!-- EyeOff icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
              /><line x1="1" y1="1" x2="23" y2="23" /></svg
            >
          {:else}
            <!-- Eye icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
                cx="12"
                cy="12"
                r="3"
              /></svg
            >
          {/if}
        </button>
      </div>
    </div>

    {#if error}
      <div class="login-page__error">✕ {error}</div>
    {/if}

    <button
      type="submit"
      disabled={loading}
      class={`login-page__submit${loading ? " login-page__submit--loading" : ""}`}
    >
      {loading ? "Joining…" : "Join the Hunt"}
    </button>
  </form>
```

The `<div class="login-page__header">...</div>` block above the form is unchanged.

- [ ] **Step 4: Update `LoginPage.css`**

Add these rules to `src/pages/LoginPage.css` (near the `.login-page__input` rule):

```css
.login-page__input-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.login-page__input-row .login-page__input {
  min-width: 0;
}

.login-page__dice-btn {
  flex: 0 0 auto;
  width: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- LoginPage.test`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/pages/LoginPage.svelte src/pages/LoginPage.css src/test/LoginPage.test.ts
git commit -m "feat: drop contact field from LoginPage, add team name prefill and dice reroll"
```

---

### Task 8: Documentation updates

**Files:**
- Modify: `doc/architecture.md`
- Modify: `doc/setup.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Update the routing table in `doc/architecture.md`**

In the `## Routing` section's table, change the `/` row and add two new rows immediately after it:

```
| `/`                      | `AppPage`     | Landing page: hero image/title/tagline + a single "Start Hunting" button (no project list) |
| `/start`                 | `CodeEntryPage` | "Scavenger hunt code" field; resolves via `POST /auth/verify-code` to either `/login/demo` or `/join/:project` |
| `/join/:project`         | `JoinTeamPage` | Team name entry (prefilled from `localStorage`, dice button to reroll a suggestion); completes login using the password stashed by `CodeEntryPage` in `sessionStorage` |
| `/login/demo`            | `DemoLoginPage` | Email+password login for the `demo` project only — matched before the `/login/:project` wildcard |
```

Leave the existing `/login/:project` row as-is but append a note to its description: "— also the deep-link/expired-session recovery screen; single combined password + team-name form (no contact field)."

- [ ] **Step 2: Add a short flow paragraph in `doc/architecture.md`**

Immediately below the routing table (before the `### Route entry templates` heading), add:

```markdown
**Participant entry flow.** A participant taps "Start Hunting" on the landing page, types a shared "scavenger hunt code" on `/start`, and is routed based on what the code resolves to: the literal keyword `demo` goes to the existing `demo` email/password login; any other code is checked against every project's shared password (`AUTH_STORE` keys prefixed `auth:`) via `POST /auth/verify-code`, and a match continues to `/join/:project` for team name entry before creating the real session via the existing `POST /auth/login`. `/login/:project` remains as the fallback for deep links and expired sessions, where the project is already known from the URL. Team names are remembered per project in `localStorage` (`teamName:<project>`) and, when absent, suggested via `src/utils/teamNameGenerator.ts` (two random words from fixed 32-entry lists) with a dice button to reroll.
```

- [ ] **Step 3: Add `postVerifyCode` to the API Layer table in `doc/architecture.md`**

In the `## API Layer` table's `Auth` row, change:

```
| Auth | `fetchAuthMe()`, `postLogin(payload)`, `postLogout()` |
```

to:

```
| Auth | `fetchAuthMe()`, `postVerifyCode(code)` → `POST /auth/verify-code` (resolves a code to `demo` or a project id, no session created), `postLogin(payload)`, `postLogout()` |
```

- [ ] **Step 4: Update `doc/setup.md`'s "How it works" section**

Replace the bullet list and surrounding paragraph under `### How it works` in `## Part 3: Login & Authentication`:

```markdown
### How it works

Participants tap "Start Hunting" on the landing page and enter a **scavenger hunt code** — the project password you distribute before the event. A correct code takes them to a **team name** screen (prefilled with a randomly suggested name they can reroll, or their previously used name if they've played before), and then into the project's cities and routes. They're logged in on that device for **30 days** and won't be asked again unless they sign out or the session expires.

If a participant follows a direct deep link (a city or route URL you shared) without an active session, they instead see a combined password + team-name form for that specific project — same underlying login, different entry point.

> **One password, whole project.** A single password (i.e. code) covers the entire project — all cities and routes beneath it. You don't set separate passwords per city.

> **`demo` is reserved.** The literal code `demo` always routes to the separate Demo project's own email/password login, regardless of any project's configured password. Never set a project's password to `demo`.

> **Codes should be unique across live projects.** If two projects happen to share the same password, code resolution isn't guaranteed to pick the one you expect. Pick a distinct password per project.
```

- [ ] **Step 5: Update the "What participants see" section in `doc/setup.md`**

Change the **Profile** bullet from:

```
**Profile** — After logging in, participants can tap ☰ (top-right menu) → **Profile** to see their team name, contact email, and a **Sign out** button.
```

to:

```
**Profile** — After logging in, participants can tap ☰ (top-right menu) → **Profile** to see their team name and a **Sign out** button. Contact email is no longer collected at login (shown as "—" if a session predates this change).
```

- [ ] **Step 6: Commit**

```bash
git add doc/architecture.md doc/setup.md
git commit -m "docs: update architecture and setup docs for the scavenger hunt code login flow"
```

---

### Task 9: Full-suite verification

**Files:** None — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: All test files pass, including every file touched or created in Tasks 1–7.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors — in particular, confirm `LoginPayload.contact` being optional doesn't break any other caller, and `VerifyCodeResponse`/`postVerifyCode` types resolve cleanly.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: Build succeeds — confirms `App.svelte`'s new routes and imports resolve correctly and no dead imports (e.g. removed `ProjectsText`/`MarkdownText` usage in `AppPage.svelte`) were left behind.

- [ ] **Step 5: Manual smoke test (dev server)**

Run: `npm run dev`, then in a browser:
1. Visit `/` — confirm only "Start Hunting" appears, no project cards.
2. Click "Start Hunting" → `/start` — confirm the code field renders with the same hero/heading look as the landing page.
3. Enter `demo` → confirm redirect to the existing Demo email/password login.
4. Go back to `/start`, enter the local dev DA participant password (set via `wrangler kv key put --binding=AUTH_STORE "auth:democrats_abroad" "<password>" --local`, per `doc/setup.md`) → confirm redirect to `/join/democrats_abroad` with a random two-word team name prefilled.
5. Click the dice button a few times — confirm the name changes each time.
6. Submit → confirm redirect into the Democrats Abroad city picker, and that a subsequent visit to `/start` with the same code prefills the just-used team name instead of a new random one.
7. Directly visit a route URL (e.g. `/democrats_abroad/den_haag/short_loop`) in a fresh incognito window → confirm it bounces to `/login/democrats_abroad` showing the combined password+team-name form with **no contact field**.

- [ ] **Step 6: No commit for this task** (verification only — if any step fails, fix the underlying task and re-commit there).
