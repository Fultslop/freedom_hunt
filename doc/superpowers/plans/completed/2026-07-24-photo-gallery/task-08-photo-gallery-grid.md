# Task 08: `PhotoGallery` Grid + `PhotoThumb` + `GalleryFilters`

**Depends on:** Task 06 (`fetchGalleryPhotos` exists).

**Files:**
- Create: `src/components/PhotoGallery.svelte`
- Create: `src/components/PhotoGallery.css`
- Create: `src/components/PhotoThumb.svelte`
- Create: `src/components/PhotoThumb.css`
- Create: `src/components/GalleryFilters.svelte`
- Create: `src/components/GalleryFilters.css`
- Create: `src/test/PhotoGallery.test.ts`

**Interfaces:**
- Consumes: `fetchGalleryPhotos(project, city)` from `../utils/api`; `GalleryPhoto` from `../types/gallery`.
- Produces: `PhotoGallery` component with props `{ project: string; city: string; onSelectPhoto: (photo: GalleryPhoto) => void }` — the click-to-open-lightbox decision is bubbled up via `onSelectPhoto`, not handled inside `PhotoGallery`, so Task 09/10 own the lightbox state. Renders a `<select id="gallery-team-filter">` — Task 10 focuses this element for the "Find / Download My Photos" CTA.

`PhotoGallery` owns fetching the full photo list and all filter state; `GalleryFilters` and `PhotoThumb` are presentational children.

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/PhotoGallery.test.ts`:

```ts
import { render, screen, waitFor, fireEvent } from "@testing-library/svelte/svelte5";
import PhotoGallery from "../components/PhotoGallery.svelte";
import { fetchGalleryPhotos } from "../utils/api";
import type { GalleryPhoto } from "../types/gallery";

vi.mock("../utils/api", () => ({
  fetchGalleryPhotos: vi.fn(),
}));

function makePhoto(id: string, team: string, task: string): GalleryPhoto {
  return {
    id,
    locationId: "1",
    taskTitle: task,
    teamName: team,
    uploadedAt: 1,
    thumbUrl: `/photos/${id}/thumb`,
    mediumUrl: `/photos/${id}/medium`,
    fullUrl: `/photos/${id}/full`,
  };
}

const PHOTOS = [
  makePhoto("p1", "Team A", "Plaque"),
  makePhoto("p2", "Team B", "Plaque"),
  makePhoto("p3", "Team A", "Statue"),
];

beforeEach(() => {
  (fetchGalleryPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, photos: PHOTOS });
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders all photos once loaded", async () => {
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
});

test("filtering by team shows only that team's photos", async () => {
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
  await fireEvent.change(screen.getByLabelText("Team"), { target: { value: "Team A" } });
  expect(screen.getAllByTestId("photo-thumb")).toHaveLength(2);
});

test("filtering by task shows only matching photos", async () => {
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
  await fireEvent.change(screen.getByLabelText("Task"), { target: { value: "Statue" } });
  expect(screen.getAllByTestId("photo-thumb")).toHaveLength(1);
});

test("shows empty state when there are no photos at all", async () => {
  (fetchGalleryPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, photos: [] });
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getByText("No photos yet.")).toBeInTheDocument());
});

test("shows a filtered-empty message when filters match no photos", async () => {
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
  await fireEvent.change(screen.getByLabelText("Team"), { target: { value: "Team B" } });
  await fireEvent.change(screen.getByLabelText("Task"), { target: { value: "Statue" } });
  expect(screen.getByText("No photos match your filters.")).toBeInTheDocument();
});

test("clicking a thumbnail calls onSelectPhoto with that photo", async () => {
  const onSelectPhoto = vi.fn();
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
  await fireEvent.click(screen.getAllByTestId("photo-thumb")[0]);
  expect(onSelectPhoto).toHaveBeenCalledWith(PHOTOS[0]);
});
```

---

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/PhotoGallery.test.ts`
Expected: FAIL — none of the three components exist yet.

---

- [ ] **Step 3: Implement `PhotoThumb.svelte`**

Create `src/components/PhotoThumb.svelte`:

```svelte
<script lang="ts">
  import type { GalleryPhoto } from "../types/gallery";
  import "./PhotoThumb.css";

  let { photo, onClick }: { photo: GalleryPhoto; onClick: () => void } = $props();

  let src = $state(photo.thumbUrl);

  function handleError() {
    if (src !== photo.fullUrl) {
      src = photo.fullUrl;
    }
  }
</script>

<button class="photo-thumb" onclick={onClick} data-testid="photo-thumb">
  <img
    src={src}
    alt={photo.taskTitle}
    class="photo-thumb__img"
    onerror={handleError}
  />
  <div class="photo-thumb__caption">
    <span class="photo-thumb__team">{photo.teamName}</span>
    <span class="photo-thumb__task">{photo.taskTitle}</span>
  </div>
</button>
```

Create `src/components/PhotoThumb.css`:

```css
/* src/components/PhotoThumb.css */

.photo-thumb {
  display: block;
  width: 100%;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  cursor: pointer;
  overflow: hidden;
  text-align: left;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.photo-thumb:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.14);
}

.photo-thumb__img {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}

.photo-thumb__caption {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
}

.photo-thumb__team {
  font-weight: 600;
  font-size: var(--font-size-small);
  color: var(--color-text);
}

.photo-thumb__task {
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
}
```

---

- [ ] **Step 4: Implement `GalleryFilters.svelte`**

Create `src/components/GalleryFilters.svelte`:

```svelte
<script lang="ts">
  import "./GalleryFilters.css";

  let {
    teams,
    tasks,
    selectedTeam,
    selectedTask,
    onTeamChange,
    onTaskChange,
  }: {
    teams: string[];
    tasks: string[];
    selectedTeam: string;
    selectedTask: string;
    onTeamChange: (value: string) => void;
    onTaskChange: (value: string) => void;
  } = $props();
</script>

<div class="gallery-filters">
  <label class="gallery-filters__field">
    <span class="gallery-filters__label">Team</span>
    <select
      id="gallery-team-filter"
      class="gallery-filters__select"
      value={selectedTeam}
      onchange={(e) => onTeamChange((e.target as HTMLSelectElement).value)}
    >
      <option value="">All teams</option>
      {#each teams as team (team)}
        <option value={team}>{team}</option>
      {/each}
    </select>
  </label>

  <label class="gallery-filters__field">
    <span class="gallery-filters__label">Task</span>
    <select
      class="gallery-filters__select"
      value={selectedTask}
      onchange={(e) => onTaskChange((e.target as HTMLSelectElement).value)}
    >
      <option value="">All tasks</option>
      {#each tasks as task (task)}
        <option value={task}>{task}</option>
      {/each}
    </select>
  </label>
</div>
```

Create `src/components/GalleryFilters.css`:

```css
/* src/components/GalleryFilters.css */

.gallery-filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px;
}

.gallery-filters__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
}

.gallery-filters__label {
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  font-weight: 600;
}

.gallery-filters__select {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-base);
}
```

---

- [ ] **Step 5: Implement `PhotoGallery.svelte`**

Create `src/components/PhotoGallery.svelte`:

```svelte
<script lang="ts">
  import { fetchGalleryPhotos } from "../utils/api";
  import type { GalleryPhoto } from "../types/gallery";
  import GalleryFilters from "./GalleryFilters.svelte";
  import PhotoThumb from "./PhotoThumb.svelte";
  import "./PhotoGallery.css";

  let {
    project,
    city,
    onSelectPhoto,
  }: {
    project: string;
    city: string;
    onSelectPhoto: (photo: GalleryPhoto) => void;
  } = $props();

  let photos = $state<GalleryPhoto[]>([]);
  let loaded = $state(false);
  let selectedTeam = $state("");
  let selectedTask = $state("");

  $effect(() => {
    let cancelled = false;
    fetchGalleryPhotos(project, city).then((data) => {
      if (!cancelled) {
        photos = data.ok && data.photos ? data.photos : [];
        loaded = true;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  let teams = $derived([...new Set(photos.map((photo) => photo.teamName))].sort());
  let tasks = $derived([...new Set(photos.map((photo) => photo.taskTitle))].sort());

  let filteredPhotos = $derived(
    photos.filter(
      (photo) =>
        (selectedTeam === "" || photo.teamName === selectedTeam) &&
        (selectedTask === "" || photo.taskTitle === selectedTask),
    ),
  );
</script>

<div class="photo-gallery" id="gallery">
  <GalleryFilters
    {teams}
    {tasks}
    {selectedTeam}
    {selectedTask}
    onTeamChange={(value) => (selectedTeam = value)}
    onTaskChange={(value) => (selectedTask = value)}
  />

  {#if loaded && photos.length === 0}
    <p class="photo-gallery__empty">No photos yet.</p>
  {:else if loaded && filteredPhotos.length === 0}
    <p class="photo-gallery__empty">No photos match your filters.</p>
  {:else}
    <div class="photo-gallery__grid">
      {#each filteredPhotos as photo (photo.id)}
        <PhotoThumb {photo} onClick={() => onSelectPhoto(photo)} />
      {/each}
    </div>
  {/if}
</div>
```

Create `src/components/PhotoGallery.css`:

```css
/* src/components/PhotoGallery.css */

.photo-gallery {
  padding: 8px 16px 32px;
}

.photo-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.photo-gallery__empty {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 40px 0;
}
```

---

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/test/PhotoGallery.test.ts`
Expected: PASS, all 6 tests.

---

- [ ] **Step 7: Run full suite, lint, typecheck**

```bash
npm run test:run
npm run lint
npm run typecheck
```

Expected: all pass, 0 errors.

---

- [ ] **Step 8: Commit**

```bash
git add src/components/PhotoGallery.svelte src/components/PhotoGallery.css src/components/PhotoThumb.svelte src/components/PhotoThumb.css src/components/GalleryFilters.svelte src/components/GalleryFilters.css src/test/PhotoGallery.test.ts
git commit -m "feat: add PhotoGallery grid with team/task filtering"
```
