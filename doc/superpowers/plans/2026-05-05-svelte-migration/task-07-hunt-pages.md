# Task 07 — Hunt Pages

**Files:**
- Replace: `src/pages/AppPage.svelte` (stub → real)
- Replace: `src/pages/LoginPage.svelte` (stub → real)
- Replace: `src/pages/ProjectPage.svelte` (stub → real)
- Replace: `src/pages/CityPage.svelte` (stub → real)
- Replace: `src/pages/RoutePage.svelte` (stub → real)
- Test: `src/test/AppPage.test.ts`
- Test: `src/test/LoginPage.test.ts`
- Test: `src/test/ProjectPage.test.ts`
- Test: `src/test/CityPage.test.ts`
- Test: `src/test/RoutePage.test.ts`

CSS files (`AppPage.css`, etc.) are kept unchanged.

For each page, read the existing React `.tsx` file first to verify class names and data structures before implementing the Svelte version.

---

## AppPage

- [ ] **Step 1: Write failing AppPage test**

Create `src/test/AppPage.test.ts`:

```typescript
import { render, screen } from "@testing-library/svelte";
import AppPage from "../pages/AppPage.svelte";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    items: [
      { id: "democrats_abroad", name: "Democrats Abroad", description: "DA desc" },
    ],
  }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

test("renders project list", async () => {
  render(AppPage);
  expect(await screen.findByText("Democrats Abroad")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test:run -- src/test/AppPage.test.ts
```

- [ ] **Step 3: Create `src/pages/AppPage.svelte`**

Read `src/pages/AppPage.tsx` to confirm CSS class names, then implement:

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { loadText } from "../utils/loadText";
  import type { ProjectsText, ApplicationText } from "../types/data";
  import "./AppPage.css";

  titleBarStore.set({ title: "YES. WE. VOTE.", progress: null, backPath: null });

  let projects = $state<ProjectsText | null>(null);
  let appText = $state<ApplicationText | null>(null);

  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<ApplicationData>(lang, "application").then((data) => {
      appText = data;
      if (data) titleBarStore.set({ title: data["app.title"], progress: null, backPath: null });
    });
    loadText<ProjectsData>(lang, "projects/projects").then((data) => {
      projects = data;
    });
  });
</script>

<div class="app-page">
  {#if appText}
    <h1 class="app-page__tagline">{appText["app.tagline"]}</h1>
  {/if}

  {#if projects}
    <ul class="app-page__projects">
      {#each projects.items as project (project.id)}
        <li>
          <button
            class="app-page__project-btn"
            onclick={() => push(`/${project.id}`)}
          >
            <div class="app-page__project-name">{project.name}</div>
            <p class="app-page__project-desc">{project.description}</p>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="app-page__loading">Loading…</p>
  {/if}
</div>
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/test/AppPage.test.ts
```

---

## LoginPage

- [ ] **Step 5: Write failing LoginPage test**

Create `src/test/LoginPage.test.ts`:

```typescript
import { render, screen, fireEvent } from "@testing-library/svelte";
import LoginPage from "../pages/LoginPage.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.spyOn(global, "fetch").mockResolvedValue({
  json: async () => ({ ok: true, teamName: "Team A", project: "proj", isAdmin: false }),
} as Response);

test("renders login form", () => {
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
});

test("submits login form and navigates on success", async () => {
  const { push } = await import("svelte-spa-router");
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  await fireEvent.input(screen.getByPlaceholderText(/team name/i), {
    target: { value: "My Team" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /log in/i }));
  expect(push).toHaveBeenCalledWith("/democrats_abroad");
});
```

- [ ] **Step 6: Run to confirm failure**

```bash
npm run test:run -- src/test/LoginPage.test.ts
```

- [ ] **Step 7: Create `src/pages/LoginPage.svelte`**

Read `src/pages/LoginPage.tsx` first to confirm field structure and POST body, then implement:

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import "./LoginPage.css";

  let { params }: { params: { project: string } } = $props();

  let teamName = $state("");
  let contact = $state("");
  let error = $state<string | null>(null);
  let submitting = $state(false);

  titleBarStore.set({ title: "Sign in", progress: null, backPath: null });

  async function handleLogin() {
    if (!teamName.trim()) {
      error = "Team name is required.";
      return;
    }
    submitting = true;
    error = null;
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: params.project, teamName, contact }),
      });
      const data = (await res.json()) as { ok: boolean; teamName?: string };
      if (data.ok) {
        authStore.login(
          params.project,
          data.teamName ?? teamName,
          contact,
        );
        push(`/${params.project}`);
      } else {
        error = "Login failed. Check your team name and try again.";
      }
    } catch {
      error = "Network error. Please try again.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="login-page">
  <h1 class="login-page__title">Welcome</h1>
  <form class="login-page__form" onsubmit={(evt) => { evt.preventDefault(); handleLogin(); }}>
    <label class="login-page__label" for="teamName">Team name</label>
    <input
      id="teamName"
      type="text"
      class="login-page__input"
      placeholder="Team name"
      bind:value={teamName}
      required
    />
    <label class="login-page__label" for="contact">Contact (optional)</label>
    <input
      id="contact"
      type="text"
      class="login-page__input"
      placeholder="Email or phone"
      bind:value={contact}
    />
    {#if error}
      <p class="login-page__error">{error}</p>
    {/if}
    <button type="submit" class="login-page__submit" disabled={submitting}>
      {submitting ? "Signing in…" : "Log in"}
    </button>
  </form>
</div>
```

- [ ] **Step 8: Run to confirm pass**

```bash
npm run test:run -- src/test/LoginPage.test.ts
```

---

## ProjectPage

- [ ] **Step 9: Write failing ProjectPage test**

Create `src/test/ProjectPage.test.ts`:

```typescript
import { render, screen } from "@testing-library/svelte";
import ProjectPage from "../pages/ProjectPage.svelte";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    items: [{ id: "den_haag", name: "Den Haag", country: "Netherlands", description: "desc", image: null }],
  }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

test("renders city list", async () => {
  render(ProjectPage, { props: { params: { project: "democrats_abroad" } } });
  expect(await screen.findByText("Den Haag")).toBeInTheDocument();
});
```

- [ ] **Step 10: Run to confirm failure**

```bash
npm run test:run -- src/test/ProjectPage.test.ts
```

- [ ] **Step 11: Create `src/pages/ProjectPage.svelte`**

Read `src/pages/ProjectPage.tsx` first, then implement:

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { loadText } from "../utils/loadText";
  import CitySelector from "../components/CitySelector.svelte";
  import type { CitiesText } from "../types/data";
  import "./ProjectPage.css";

  let { params }: { params: { project: string } } = $props();

  let cities = $state<CitiesText | null>(null);

  $effect(() => {
    titleBarStore.set({ title: params.project.replace(/_/g, " "), progress: null, backPath: "/" });
    loadText<CitiesData>(
      $languageStore.currentLang,
      `projects/${params.project}/cities`,
    ).then((data) => {
      cities = data;
    });
  });
</script>

<div class="project-page">
  {#if cities}
    <div class="project-page__cities">
      {#each cities.items as city (city.id)}
        <CitySelector
          {city}
          onClick={(id) => push(`/${params.project}/${id}`)}
        />
      {/each}
    </div>
  {:else}
    <p class="project-page__loading">Loading…</p>
  {/if}
</div>
```

- [ ] **Step 12: Run to confirm pass**

```bash
npm run test:run -- src/test/ProjectPage.test.ts
```

---

## CityPage

- [ ] **Step 13: Write failing CityPage test**

Create `src/test/CityPage.test.ts`:

```typescript
import { render, screen } from "@testing-library/svelte";
import CityPage from "../pages/CityPage.svelte";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    short_loop: { description: "2.5h route", locations: ["001", "002"] },
  }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

test("renders route list", async () => {
  render(CityPage, { props: { params: { project: "democrats_abroad", city: "den_haag" } } });
  expect(await screen.findByText(/2\.5h route/)).toBeInTheDocument();
});
```

- [ ] **Step 14: Run to confirm failure**

```bash
npm run test:run -- src/test/CityPage.test.ts
```

- [ ] **Step 15: Create `src/pages/CityPage.svelte`**

Read `src/pages/CityPage.tsx` first, then implement:

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { loadText } from "../utils/loadText";
  import RouteSelector from "../components/RouteSelector.svelte";
  import type { RoutesData } from "../types/data";
  import "./CityPage.css";

  let { params }: { params: { project: string; city: string } } = $props();

  let routes = $state<RoutesData | null>(null);

  $effect(() => {
    titleBarStore.set({
      title: params.city.replace(/_/g, " "),
      progress: null,
      backPath: `/${params.project}`,
    });
    loadText<RoutesData>(
      $languageStore.currentLang,
      `projects/${params.project}/${params.city}/routes`,
    ).then((data) => {
      routes = data;
    });
  });
</script>

<div class="city-page">
  {#if routes}
    <div class="city-page__routes">
      {#each Object.entries(routes) as [routeId, routeData] (routeId)}
        <RouteSelector
          {routeId}
          {routeData}
          onClick={(rid) => push(`/${params.project}/${params.city}/${rid}`)}
        />
      {/each}
    </div>
  {:else}
    <p class="city-page__loading">Loading…</p>
  {/if}
</div>
```

- [ ] **Step 16: Run to confirm pass**

```bash
npm run test:run -- src/test/CityPage.test.ts
```

---

## RoutePage

- [ ] **Step 17: Write failing RoutePage test**

Create `src/test/RoutePage.test.ts`:

```typescript
import { render, screen } from "@testing-library/svelte";
import { authStore } from "../stores/authStore";
import RoutePage from "../pages/RoutePage.svelte";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    short_loop: {
      description: "2.5h route",
      locations: ["projects/democrats_abroad/den_haag/001_loc_binnenhof"],
    },
  }),
}));

vi.mock("../utils/loadLocations", () => ({
  loadLocations: vi.fn().mockResolvedValue([
    {
      locationId: 1,
      title: "Binnenhof",
      image: null,
      name: { label: "", value: "Binnenhof" },
      address: "Binnenhof 1",
      coordinates: { latitude: 52.0799, longitude: 4.3133 },
      storyline: "Historic place",
      breadcrumb: "Find the gate",
      challenge: { name: "", description: "Find the plaque", notes: "", form: [] },
    },
  ]),
}));

vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  authStore.login("democrats_abroad", "Team A", "t@a.com");
});

test("renders first location title", async () => {
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Binnenhof")).toBeInTheDocument();
});
```

- [ ] **Step 18: Write failing swipe navigation test**

Create `src/test/RoutePage.swipe.test.ts` (overwrites the existing `.ts` file which was testing React hooks):

```typescript
import { clampedNext, clampedPrev } from "../pages/RoutePage.svelte";

test("clampedNext advances index", () => {
  expect(clampedNext(0, 3)).toBe(1);
});

test("clampedNext clamps at last", () => {
  expect(clampedNext(2, 3)).toBe(2);
});

test("clampedPrev retreats index", () => {
  expect(clampedPrev(2)).toBe(1);
});

test("clampedPrev clamps at zero", () => {
  expect(clampedPrev(0)).toBe(0);
});
```

- [ ] **Step 19: Run to confirm failures**

```bash
npm run test:run -- src/test/RoutePage.test.ts src/test/RoutePage.swipe.test.ts
```

- [ ] **Step 20: Create `src/pages/RoutePage.svelte`**

```svelte
<script lang="ts" module>
  export function clampedNext(current: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(current + 1, total - 1);
  }

  export function clampedPrev(current: number): number {
    return Math.max(current - 1, 0);
  }
</script>

<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { loadText } from "../utils/loadText";
  import { loadLocations } from "../utils/loadLocations";
  import { swipe } from "../actions/swipe";
  import ChallengeCard from "../components/ChallengeCard.svelte";
  import { ChevronLeft, ChevronRight } from "lucide-svelte";
  import type { RoutesData, Location } from "../types/data";
  import "./RoutePage.css";

  let {
    params,
  }: { params: { project: string; city: string; route: string } } = $props();

  const storageKey = `${params.project}/${params.city}/${params.route}`;

  let locations = $state<Location[]>([]);
  let loading = $state(true);

  let currentIndex = $state<number>(() => {
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? parseInt(saved, 10) : 0;
    return isNaN(parsed) ? 0 : parsed;
  });

  let direction = $state<"next" | "prev">("next");

  $effect(() => {
    titleBarStore.set({
      title: params.route.replace(/_/g, " "),
      progress:
        locations.length > 0
          ? { current: currentIndex + 1, total: locations.length }
          : null,
      backPath: `/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    localStorage.setItem(storageKey, String(currentIndex));
  });

  $effect(() => {
    loading = true;
    loadText<RoutesData>(
      $languageStore.currentLang,
      `projects/${params.project}/${params.city}/routes`,
    ).then((routesData) => {
      const routeEntry = routesData?.[params.route];
      if (!routeEntry) {
        loading = false;
        return;
      }
      const paths = routeEntry.locations.map(
        (id) => `projects/${params.project}/${params.city}/${id}`,
      );
      return loadLocations($languageStore.currentLang, paths).then((locs) => {
        locations = locs;
        loading = false;
      });
    });
  });

  function goNext() {
    direction = "next";
    currentIndex = clampedNext(currentIndex, locations.length);
  }

  function goPrev() {
    direction = "prev";
    currentIndex = clampedPrev(currentIndex);
  }
</script>

{#if loading}
  <div style="padding: 24px; background: var(--color-background); color: var(--color-text)">
    Loading…
  </div>
{:else if locations.length === 0}
  <div style="padding: 24px; background: var(--color-background); color: var(--color-text)">
    Route not found.
  </div>
{:else}
  {@const location = locations[currentIndex]}
  <div
    class="route-page"
    use:swipe={{ onSwipeLeft: goNext, onSwipeRight: goPrev }}
  >
    <div class="route-page__cards">
      <div
        key={currentIndex}
        style="animation: {direction === 'next' ? 'slideInFromRight' : 'slideInFromLeft'} 250ms ease-out"
      >
        <ChallengeCard
          {location}
          isLast={currentIndex === locations.length - 1}
          index={currentIndex + 1}
          routeId={params.route}
        />
      </div>
    </div>

    <div class="route-page__nav">
      <div class="route-page__nav-slot">
        {#if currentIndex > 0}
          <button
            aria-label="Previous stop"
            onclick={goPrev}
            class="route-page__prev-btn"
          >
            <ChevronLeft size={16} aria-hidden /> Prev
          </button>
        {/if}
      </div>

      <button
        onclick={() => push(`/${params.project}/${params.city}`)}
        class="route-page__exit-btn"
      >
        Exit
      </button>

      <div class="route-page__nav-slot--right">
        {#if currentIndex < locations.length - 1}
          <button
            aria-label="Next stop"
            onclick={goNext}
            class="route-page__next-btn"
          >
            Next <ChevronRight size={16} aria-hidden />
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 21: Run to confirm pass**

```bash
npm run test:run -- src/test/RoutePage.test.ts src/test/RoutePage.swipe.test.ts
```

Expected: PASS.

- [ ] **Step 22: Run full test suite**

```bash
npm run test:run
```

Expected: all hunt page tests pass, worker tests pass.

- [ ] **Step 23: Commit**

```bash
git add src/pages/AppPage.svelte src/pages/LoginPage.svelte src/pages/ProjectPage.svelte \
  src/pages/CityPage.svelte src/pages/RoutePage.svelte \
  src/test/AppPage.test.ts src/test/LoginPage.test.ts src/test/ProjectPage.test.ts \
  src/test/CityPage.test.ts src/test/RoutePage.test.ts src/test/RoutePage.swipe.test.ts
git commit -m "feat: migrate all hunt pages to Svelte 5"
```
