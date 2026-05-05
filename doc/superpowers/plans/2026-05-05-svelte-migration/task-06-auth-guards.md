# Task 06 — Auth Route Guards

**Files:**
- Modify: `src/App.svelte`

Replaces: `src/auth/ProtectedRoute.tsx`, `src/auth/AdminRoute.tsx`.

Route guards are implemented using `svelte-spa-router`'s `wrap()` function. This is the idiomatic replacement for React Router's wrapper component pattern. The guards check `authStore` state and redirect using `replace()`. No new component files are created.

---

- [ ] **Step 1: Write failing guard test**

Create `src/test/authGuards.test.ts`:

```typescript
import { get } from "svelte/store";
import { authStore } from "../stores/authStore";
import { replace } from "svelte-spa-router";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
  default: vi.fn(),
}));

// Import the guard functions directly for unit testing.
// These are extracted as named exports from App.svelte's module context
// in Step 2; if your bundler makes that awkward, test them via integration
// in the page tests instead and delete this file.
import { requireAuth, requireAdmin } from "../App.svelte";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAuth", () => {
  it("returns true when authenticated", () => {
    authStore.login("proj", "Team", "t@test.com");
    // @ts-expect-error partial detail
    expect(requireAuth({ params: { project: "proj" } })).toBe(true);
  });

  it("returns true while auth is loading", () => {
    // authStore initial state has authLoading=true
    // @ts-expect-error partial detail
    expect(requireAuth({ params: { project: "proj" } })).toBe(true);
  });

  it("redirects to login and returns false when not authenticated", async () => {
    // Simulate an unauthenticated + loaded state by calling logout
    // (sets activeAuth=null, authLoading=false)
    vi.spyOn(global, "fetch").mockResolvedValue({ json: async () => ({}) } as Response);
    await authStore.logout();
    vi.clearAllMocks();
    // @ts-expect-error partial detail
    const result = requireAuth({ params: { project: "proj" } });
    expect(result).toBe(false);
    expect(replace).toHaveBeenCalledWith("/login/proj");
  });
});

describe("requireAdmin", () => {
  it("returns true when admin", () => {
    authStore.login("proj", "Admin", "a@test.com", true);
    expect(requireAdmin()).toBe(true);
  });

  it("redirects to / and returns false when not admin", () => {
    authStore.login("proj", "Team", "t@test.com", false);
    expect(requireAdmin()).toBe(false);
    expect(replace).toHaveBeenCalledWith("/");
  });
});
```

**Note:** If exporting `requireAuth`/`requireAdmin` from `App.svelte` proves awkward with your bundler, skip this file and rely on the page-level integration tests in Tasks 07–08 to cover guard behaviour.

- [ ] **Step 2: Update `src/App.svelte`** — add `wrap()` guards

```svelte
<script lang="ts" module>
  import { get } from "svelte/store";
  import { replace } from "svelte-spa-router";
  import { authStore } from "./stores/authStore";
  export function requireAuth(detail: { params?: Record<string, string> }): boolean {
    const { activeAuth, authLoading, isLoggingOut } = get(authStore);
    if (authLoading || isLoggingOut) return true;
    if (!activeAuth) {
      replace(`/login/${detail.params?.project ?? ""}`);
      return false;
    }
    return true;
  }

  export function requireAdmin(): boolean {
    const { activeAuth, authLoading, isLoggingOut } = get(authStore);
    if (authLoading || isLoggingOut) return true;
    if (!activeAuth?.isAdmin) {
      replace("/");
      return false;
    }
    return true;
  }
</script>

<script lang="ts">
  import Router from "svelte-spa-router";
  import { wrap } from "svelte-spa-router/wrap";
  import { onMount } from "svelte";
  import { themeStore } from "./stores/themeStore";
  import { fontSizeStore } from "./stores/fontSizeStore";
  import TitleBar from "./components/TitleBar.svelte";
  import AppPage from "./pages/AppPage.svelte";
  import LoginPage from "./pages/LoginPage.svelte";
  import ProjectPage from "./pages/ProjectPage.svelte";
  import CityPage from "./pages/CityPage.svelte";
  import RoutePage from "./pages/RoutePage.svelte";
  import EditorLoginPage from "./pages/editor/EditorLoginPage.svelte";
  import EditorPage from "./pages/editor/EditorPage.svelte";
  import EditorLocationList from "./pages/editor/EditorLocationList.svelte";
  import EditorLocationForm from "./pages/editor/EditorLocationForm.svelte";

  const routes = {
    "/": AppPage,
    "/login/:project": LoginPage,
      "/:project": wrap({ component: ProjectPage, conditions: [requireAuth] }),
    "/:project/:city": wrap({ component: CityPage, conditions: [requireAuth] }),
    "/:project/:city/:route": wrap({ component: RoutePage, conditions: [requireAuth] }),
    "/editor/login": EditorLoginPage,
    "/editor": wrap({ component: EditorPage, conditions: [requireAdmin] }),
    "/editor/locations/:project/:city": wrap({
      component: EditorLocationList,
      conditions: [requireAdmin],
    }),
    "/editor/locations/:project/:city/new": wrap({
      component: EditorLocationForm,
      conditions: [requireAdmin],
    }),
    "/editor/locations/:project/:city/edit/:filename": wrap({
      component: EditorLocationForm,
      conditions: [requireAdmin],
    }),
  };

  $effect(() => {
    const { theme } = $themeStore;
    const root = document.documentElement;
    root.style.setProperty("--font-family", theme.fontFamily);
    root.style.setProperty("--color-background", theme.background);
    root.style.setProperty("--color-surface", theme.surface);
    root.style.setProperty("--color-border", theme.border);
    root.style.setProperty("--color-text", theme.text);
    root.style.setProperty("--color-text-secondary", theme.textSecondary);
    root.style.setProperty("--color-text-muted", theme.textMuted);
    root.style.setProperty("--color-accent", theme.accent);
    root.style.setProperty("--color-bar-background", theme.barBackground);
    root.style.setProperty("--color-bar-border", theme.barBorder);
    root.style.setProperty("--color-bar-text", theme.barText);
    root.style.setProperty("--color-bar-text-secondary", theme.barTextSecondary);
    root.style.setProperty("--color-progress-track", theme.progressTrack);
    root.style.setProperty("--color-progress-fill", theme.progressFill);
    root.style.setProperty("--color-clue-background", theme.clueBackground);
    root.style.setProperty("--color-clue-border-color", theme.clueBorderColor);
    document.body.style.background = theme.background;
  });

  $effect(() => {
    document.documentElement.dataset.fontsize = $fontSizeStore.fontSize;
  });

  onMount(() => {
    authStore.init();
  });
</script>

<TitleBar />
<Router {routes} />
```

**Note on `<script lang="ts" module>`:** Svelte 5 uses `<script module>` (not `context="module"`) for module-level code. The guard functions are exported from the module block so they can be imported by tests.

- [ ] **Step 3: Run auth guard tests**

```bash
npm run test:run -- src/test/authGuards.test.ts
```

Expected: PASS (or skip if module export approach doesn't work with your test setup — covered by page tests in Tasks 07–08).

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Navigate to `#/democrats_abroad` without being logged in. Expected: redirects to `#/login/democrats_abroad`. Navigate to `#/editor` without admin auth. Expected: redirects to `#/`.

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/test/authGuards.test.ts
git commit -m "feat: add svelte-spa-router auth and admin route guards"
```
