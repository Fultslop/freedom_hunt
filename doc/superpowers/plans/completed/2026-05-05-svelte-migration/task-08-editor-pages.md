# Task 08 — Editor Pages

**Files:**
- Replace: `src/pages/editor/EditorLoginPage.svelte` (stub → real)
- Replace: `src/pages/editor/EditorPage.svelte` (stub → real)
- Replace: `src/pages/editor/EditorLocationList.svelte` (stub → real)
- Replace: `src/pages/editor/EditorLocationForm.svelte` (stub → real)
- Test: `src/test/EditorLoginPage.test.ts`
- Test: `src/test/EditorPage.test.ts`
- Test: `src/test/EditorLocationList.test.ts`
- Test: `src/test/EditorLocationForm.test.ts`

`src/pages/editor/editorStorage.ts` is unchanged.

**Before implementing each page:** read the corresponding React `.tsx` file to understand props, fetch calls, and class names. The implementations below are complete but cross-reference the original for any CSS class names not shown.

---

## EditorLoginPage

- [ ] **Step 1: Write failing test**

Create `src/test/EditorLoginPage.test.ts`:

```typescript
import { render, screen, fireEvent } from "@testing-library/svelte";
import EditorLoginPage from "../pages/editor/EditorLoginPage.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.spyOn(global, "fetch").mockResolvedValue({
  json: async () => ({ ok: true, isAdmin: true }),
} as Response);

test("renders password field", () => {
  render(EditorLoginPage);
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

test("navigates to /editor on successful login", async () => {
  const { push } = await import("svelte-spa-router");
  render(EditorLoginPage);
  await fireEvent.input(screen.getByLabelText(/password/i), {
    target: { value: "secret" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /log in/i }));
  expect(push).toHaveBeenCalledWith("/editor");
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test:run -- src/test/EditorLoginPage.test.ts
```

- [ ] **Step 3: Read `src/pages/editor/EditorLoginPage.tsx`, then create `src/pages/editor/EditorLoginPage.svelte`**

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../../stores/authStore";
  import { titleBarStore } from "../../stores/titleBarStore";

  let password = $state("");
  let error = $state<string | null>(null);
  let submitting = $state(false);

  titleBarStore.set({ title: "Editor Login", progress: null, backPath: null });

  async function handleLogin() {
    if (!password.trim()) {
      error = "Password required.";
      return;
    }
    submitting = true;
    error = null;
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; isAdmin?: boolean };
      if (data.ok && data.isAdmin) {
        authStore.login("editor", "Admin", "", true);
        push("/editor");
      } else {
        error = "Invalid password.";
      }
    } catch {
      error = "Network error.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="editor-login-page">
  <h1>Editor Login</h1>
  <form onsubmit={(evt) => { evt.preventDefault(); handleLogin(); }}>
    <label for="password">Password</label>
    <input
      id="password"
      type="password"
      bind:value={password}
      required
    />
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <button type="submit" disabled={submitting}>
      {submitting ? "Logging in…" : "Log in"}
    </button>
  </form>
</div>
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/test/EditorLoginPage.test.ts
```

---

## EditorPage

- [ ] **Step 5: Write failing test**

Create `src/test/EditorPage.test.ts`:

```typescript
import { render, screen } from "@testing-library/svelte";
import { authStore } from "../stores/authStore";
import EditorPage from "../pages/editor/EditorPage.svelte";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    items: [{ id: "democrats_abroad", name: "Democrats Abroad" }],
  }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  authStore.login("editor", "Admin", "", true);
});

test("renders project list for navigation", async () => {
  render(EditorPage);
  expect(await screen.findByText("Democrats Abroad")).toBeInTheDocument();
});
```

- [ ] **Step 6: Run to confirm failure**

```bash
npm run test:run -- src/test/EditorPage.test.ts
```

- [ ] **Step 7: Read `src/pages/editor/EditorPage.tsx`, then create `src/pages/editor/EditorPage.svelte`**

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../../stores/authStore";
  import { titleBarStore } from "../../stores/titleBarStore";
  import { languageStore } from "../../stores/languageStore";
  import { loadText } from "../../utils/loadText";
  import type { ProjectsData } from "../../types/data";

  titleBarStore.set({ title: "Editor", progress: null, backPath: null });

  let projects = $state<ProjectsData | null>(null);

  $effect(() => {
    loadText<ProjectsData>($languageStore.currentLang, "projects/projects").then(
      (data) => {
        projects = data;
      },
    );
  });

  async function handleLogout() {
    await authStore.logout();
  }
</script>

<div class="editor-page">
  <div class="editor-page__header">
    <h1>Editor</h1>
    <button onclick={handleLogout}>Sign out</button>
  </div>

  {#if projects}
    <ul class="editor-page__projects">
      {#each projects.items as project (project.id)}
        <li>
          <strong>{project.name}</strong>
          <button onclick={() => push(`/editor/locations/${project.id}/den_haag`)}>
            Manage locations
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p>Loading…</p>
  {/if}
</div>
```

- [ ] **Step 8: Run to confirm pass**

```bash
npm run test:run -- src/test/EditorPage.test.ts
```

---

## EditorLocationList

- [ ] **Step 9: Write failing test**

Create `src/test/EditorLocationList.test.ts`:

```typescript
import { render, screen } from "@testing-library/svelte";
import EditorLocationList from "../pages/editor/EditorLocationList.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.spyOn(global, "fetch").mockResolvedValue({
  json: async () => ({
    locations: [{ filename: "001_loc_binnenhof.yaml", title: "Binnenhof" }],
  }),
} as Response);

test("renders location list", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(await screen.findByText("Binnenhof")).toBeInTheDocument();
});
```

- [ ] **Step 10: Run to confirm failure**

```bash
npm run test:run -- src/test/EditorLocationList.test.ts
```

- [ ] **Step 11: Read `src/pages/editor/EditorLocationList.tsx`, then create `src/pages/editor/EditorLocationList.svelte`**

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";

  let {
    params,
  }: { params: { project: string; city: string } } = $props();

  interface LocationMeta {
    filename: string;
    title: string;
  }

  let locations = $state<LocationMeta[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    titleBarStore.set({
      title: `${params.city} locations`,
      progress: null,
      backPath: "/editor",
    });
    fetch(`/editor/locations?project=${params.project}&city=${params.city}`)
      .then((res) => res.json() as Promise<{ locations: LocationMeta[] }>)
      .then((data) => {
        locations = data.locations;
        loading = false;
      })
      .catch(() => {
        error = "Failed to load locations.";
        loading = false;
      });
  });
</script>

<div class="editor-location-list">
  {#if loading}
    <p>Loading…</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <button
      onclick={() =>
        push(`/editor/locations/${params.project}/${params.city}/new`)}
    >
      + New location
    </button>
    <ul>
      {#each locations as loc (loc.filename)}
        <li>
          <span>{loc.title}</span>
          <button
            onclick={() =>
              push(
                `/editor/locations/${params.project}/${params.city}/edit/${loc.filename}`,
              )}
          >
            Edit
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

- [ ] **Step 12: Run to confirm pass**

```bash
npm run test:run -- src/test/EditorLocationList.test.ts
```

---

## EditorLocationForm

- [ ] **Step 13: Write failing test**

Create `src/test/EditorLocationForm.test.ts`:

```typescript
import { render, screen } from "@testing-library/svelte";
import EditorLocationForm from "../pages/editor/EditorLocationForm.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.spyOn(global, "fetch").mockResolvedValue({
  json: async () => ({ ok: true }),
} as Response);

test("renders form in new-location mode", () => {
  render(EditorLocationForm, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
});
```

- [ ] **Step 14: Run to confirm failure**

```bash
npm run test:run -- src/test/EditorLocationForm.test.ts
```

- [ ] **Step 15: Read `src/pages/editor/EditorLocationForm.tsx`, then create `src/pages/editor/EditorLocationForm.svelte`**

The editor form is complex (YAML editing, PR creation, status polling). Read the full React source carefully before implementing. The Svelte version keeps identical fetch calls, payload shapes, and field structure — only the React-specific state management changes.

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";
  import { editorStorage } from "./editorStorage";

  let {
    params,
  }: { params: { project: string; city: string; filename?: string } } =
    $props();

  const isEdit = !!params.filename;

  let yaml = $state("");
  let saving = $state(false);
  let error = $state<string | null>(null);
  let prUrl = $state<string | null>(null);

  $effect(() => {
    titleBarStore.set({
      title: isEdit ? "Edit location" : "New location",
      progress: null,
      backPath: `/editor/locations/${params.project}/${params.city}`,
    });

    if (isEdit && params.filename) {
      fetch(
        `/editor/location?project=${params.project}&city=${params.city}&filename=${params.filename}`,
      )
        .then((res) => res.json() as Promise<{ content: string }>)
        .then((data) => {
          yaml = data.content;
        })
        .catch(() => {
          error = "Failed to load location.";
        });
    } else {
      yaml = editorStorage.getTemplate(params.project, params.city);
    }
  });

  async function handleSave() {
    saving = true;
    error = null;
    try {
      const res = await fetch("/editor/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: params.project,
          city: params.city,
          filename: params.filename,
          content: yaml,
        }),
      });
      const data = (await res.json()) as { ok: boolean; prUrl?: string };
      if (data.ok) {
        prUrl = data.prUrl ?? null;
      } else {
        error = "Save failed.";
      }
    } catch {
      error = "Network error.";
    } finally {
      saving = false;
    }
  }
</script>

<div class="editor-location-form">
  {#if prUrl}
    <div class="editor-location-form__success">
      <p>PR created: <a href={prUrl} target="_blank" rel="noopener">{prUrl}</a></p>
      <button
        onclick={() =>
          push(`/editor/locations/${params.project}/${params.city}`)}
      >
        Back to list
      </button>
    </div>
  {:else}
    <textarea
      class="editor-location-form__textarea"
      bind:value={yaml}
      rows={30}
    ></textarea>
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <div class="editor-location-form__actions">
      <button
        onclick={handleSave}
        disabled={saving}
        class="editor-location-form__save-btn"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  {/if}
</div>
```

- [ ] **Step 16: Run to confirm pass**

```bash
npm run test:run -- src/test/EditorLocationForm.test.ts
```

- [ ] **Step 17: Run full test suite**

```bash
npm run test:run
```

Expected: all editor page tests pass, all previous tests pass.

- [ ] **Step 18: Commit**

```bash
git add src/pages/editor/ \
  src/test/EditorLoginPage.test.ts src/test/EditorPage.test.ts \
  src/test/EditorLocationList.test.ts src/test/EditorLocationForm.test.ts
git commit -m "feat: migrate editor pages to Svelte 5"
```
