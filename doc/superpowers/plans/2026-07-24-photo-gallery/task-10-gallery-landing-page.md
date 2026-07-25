# Task 10: `GalleryLandingPage` + Route Wiring

**Depends on:** Task 07 (`PhotoHero`), Task 08 (`PhotoGallery`), Task 09 (`PhotoLightbox`).

**Files:**
- Create: `src/pages/GalleryLandingPage.svelte`
- Create: `src/pages/GalleryLandingPage.css`
- Modify: `src/App.svelte`
- Create: `src/test/GalleryLandingPage.test.ts`

**Interfaces:**
- Consumes: `PhotoHero`, `PhotoGallery`, `PhotoLightbox` components; `loadText` from `../utils/loadText` (existing); `titleBarStore` from `../stores/titleBarStore` (existing).
- Produces: route `/:project/:city/gallery`, guarded by the existing `requireAuth` condition (imported from `./utils/authGuards`, already used by every other `:project` route) — this is what makes "same login, skipped if already logged in" work for free, since it's the exact same guard and `authStore` session as the rest of the app.

**Organizer link data source:** the header's external organizer link is read from an **optional** `organizer_url` key in `projects/<project>/<project>.yaml` (the existing free-form project YAML, typed `ProjectMeta = Record<string, unknown>`). If the key is absent, the link is not rendered — no placeholder or invented URL. Organizers who want the link add `organizer_url: "https://..."` to their project YAML themselves (documented in Task 12).

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/GalleryLandingPage.test.ts`:

```ts
import { render, screen, waitFor, fireEvent } from "@testing-library/svelte/svelte5";
import GalleryLandingPage from "../pages/GalleryLandingPage.svelte";
import { loadText } from "../utils/loadText";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({}),
}));

vi.mock("../utils/api", () => ({
  fetchRandomPhotos: vi.fn().mockResolvedValue({ ok: true, photos: [] }),
  fetchGalleryPhotos: vi.fn().mockResolvedValue({ ok: true, photos: [] }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

test("renders the project/city title", () => {
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(screen.getByText("democrats abroad Scavenger Hunt")).toBeInTheDocument();
});

test("does not render an organizer link when the project YAML has no organizer_url", async () => {
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await waitFor(() => expect(loadText).toHaveBeenCalled());
  expect(screen.queryByRole("link", { name: /event organizer/i })).not.toBeInTheDocument();
});

test("renders an organizer link that opens in a new tab when organizer_url is set", async () => {
  (loadText as ReturnType<typeof vi.fn>).mockResolvedValue({ organizer_url: "https://example.org" });
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const link = await screen.findByRole("link", { name: /event organizer/i });
  expect(link).toHaveAttribute("href", "https://example.org");
  expect(link).toHaveAttribute("target", "_blank");
});

test("'Browse All Photos' scrolls the gallery grid into view", async () => {
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const scrollSpy = vi.fn();
  const gallery = document.getElementById("gallery");
  if (gallery) {
    gallery.scrollIntoView = scrollSpy;
  }
  await fireEvent.click(screen.getByRole("button", { name: /browse all photos/i }));
  expect(scrollSpy).toHaveBeenCalled();
});

test("'Find / Download My Photos' scrolls to the gallery and focuses the team filter", async () => {
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await waitFor(() => expect(document.getElementById("gallery-team-filter")).toBeInTheDocument());
  const gallery = document.getElementById("gallery");
  const select = document.getElementById("gallery-team-filter") as HTMLSelectElement;
  if (gallery) {
    gallery.scrollIntoView = vi.fn();
  }
  const focusSpy = vi.spyOn(select, "focus");
  await fireEvent.click(screen.getByRole("button", { name: /find.*download my photos/i }));
  expect(focusSpy).toHaveBeenCalled();
});
```

---

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/GalleryLandingPage.test.ts`
Expected: FAIL — `../pages/GalleryLandingPage.svelte` doesn't exist.

---

- [ ] **Step 3: Implement `GalleryLandingPage.svelte`**

Create `src/pages/GalleryLandingPage.svelte`:

```svelte
<script lang="ts">
  import { languageStore } from "../stores/languageStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { loadText } from "../utils/loadText";
  import PhotoHero from "../components/PhotoHero.svelte";
  import PhotoGallery from "../components/PhotoGallery.svelte";
  import PhotoLightbox from "../components/PhotoLightbox.svelte";
  import type { GalleryPhoto } from "../types/gallery";
  import type { ProjectMeta } from "../types/data";
  import "./GalleryLandingPage.css";

  let { params }: { params: { project: string; city: string } } = $props();

  let selectedPhoto = $state<GalleryPhoto | null>(null);
  let organizerUrl = $state<string | null>(null);

  titleBarStore.set({
    title: `${params.city.replace(/_/g, " ")} Photos`,
    progress: null,
    backPath: `/${params.project}/${params.city}`,
  });

  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<ProjectMeta>(lang, `projects/${params.project}/${params.project}`).then((data) => {
      const url = data?.organizer_url;
      organizerUrl = typeof url === "string" ? url : null;
    });
  });

  function scrollToGallery() {
    document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
  }

  function focusTeamFilter() {
    scrollToGallery();
    (document.getElementById("gallery-team-filter") as HTMLSelectElement | null)?.focus();
  }
</script>

<div class="gallery-landing">
  <header class="gallery-landing__header">
    <h1 class="gallery-landing__title">
      {params.project.replace(/_/g, " ")} Scavenger Hunt
    </h1>
    {#if organizerUrl}
      <a
        href={organizerUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="gallery-landing__organizer-link"
      >
        Event organizer ↗
      </a>
    {/if}
  </header>

  <PhotoHero project={params.project} city={params.city} />

  <div class="gallery-landing__ctas">
    <button class="gallery-landing__cta" onclick={scrollToGallery}>
      Browse All Photos
    </button>
    <button
      class="gallery-landing__cta gallery-landing__cta--secondary"
      onclick={focusTeamFilter}
    >
      Find / Download My Photos
    </button>
  </div>

  <PhotoGallery
    project={params.project}
    city={params.city}
    onSelectPhoto={(photo) => (selectedPhoto = photo)}
  />

  <PhotoLightbox photo={selectedPhoto} onClose={() => (selectedPhoto = null)} />
</div>
```

Create `src/pages/GalleryLandingPage.css`:

```css
/* src/pages/GalleryLandingPage.css */

.gallery-landing__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  flex-wrap: wrap;
}

.gallery-landing__title {
  font-size: var(--font-size-large);
  color: var(--color-text);
  text-transform: capitalize;
  margin: 0;
}

.gallery-landing__organizer-link {
  color: var(--color-accent);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.gallery-landing__ctas {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 0 16px 24px;
  flex-wrap: wrap;
}

.gallery-landing__cta {
  padding: 12px 20px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-accent);
  color: var(--color-background);
  font-weight: 600;
  cursor: pointer;
}

.gallery-landing__cta--secondary {
  background: var(--color-surface);
  color: var(--color-text);
}
```

---

- [ ] **Step 4: Wire the route in `App.svelte`**

In `src/App.svelte`, add the import:

```ts
  import GalleryLandingPage from "./pages/GalleryLandingPage.svelte";
```

Add the route to the `routes` object, after `"/:project/:city/:route"`:

```ts
    "/:project/:city/gallery": wrap({
      component: asRoute(GalleryLandingPage),
      conditions: [requireAuth],
    }),
```

---

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/GalleryLandingPage.test.ts`
Expected: PASS, all 5 tests.

---

- [ ] **Step 6: Run full suite, lint, typecheck**

```bash
npm run test:run
npm run lint
npm run typecheck
```

Expected: all pass, 0 errors.

---

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev
```

Log in as a participant for an existing project (e.g. `democrats_abroad`), then navigate to `/#/democrats_abroad/den_haag/gallery` in the browser. Confirm the page loads without console errors (it will show empty states everywhere, since no photos exist until Task 04's upload path or Task 11's backfill have run against real data — that's expected at this point in the plan).

---

- [ ] **Step 8: Commit**

```bash
git add src/pages/GalleryLandingPage.svelte src/pages/GalleryLandingPage.css src/App.svelte src/test/GalleryLandingPage.test.ts
git commit -m "feat: add gallery landing page and wire /:project/:city/gallery route"
```
