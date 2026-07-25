# Task 07: `PhotoHero` Component

**Depends on:** Task 06 (`fetchRandomPhotos` exists in `src/utils/api.ts`).

**Files:**
- Create: `src/components/PhotoHero.svelte`
- Create: `src/components/PhotoHero.css`
- Create: `src/test/PhotoHero.test.ts`

**Interfaces:**
- Consumes: `fetchRandomPhotos(project, city)` from `../utils/api`; `GalleryPhoto` type from `../types/gallery`.
- Produces: `PhotoHero` component with props `{ project: string; city: string }`, consumed by Task 10 (`GalleryLandingPage`).

Auto-rotates every 3.5s through a random sample of photos in a stacked-Polaroid presentation. Hides itself entirely if fewer than 3 photos are available (avoids an awkward rotation of one or two, per the design spec).

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/PhotoHero.test.ts`:

```ts
import { render, screen, waitFor } from "@testing-library/svelte/svelte5";
import PhotoHero from "../components/PhotoHero.svelte";
import { fetchRandomPhotos } from "../utils/api";
import type { GalleryPhoto } from "../types/gallery";

vi.mock("../utils/api", () => ({
  fetchRandomPhotos: vi.fn(),
}));

function makePhoto(id: string, team: string): GalleryPhoto {
  return {
    id,
    locationId: "1",
    taskTitle: `Task ${id}`,
    teamName: team,
    uploadedAt: 1,
    thumbUrl: `/photos/${id}/thumb`,
    mediumUrl: `/photos/${id}/medium`,
    fullUrl: `/photos/${id}/full`,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

test("renders nothing while loading", () => {
  (fetchRandomPhotos as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  render(PhotoHero, { props: { project: "democrats_abroad", city: "den_haag" } });
  expect(screen.queryByTestId("photo-hero-card")).not.toBeInTheDocument();
});

test("hides itself when fewer than 3 photos are returned", async () => {
  (fetchRandomPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    photos: [makePhoto("p1", "Team A"), makePhoto("p2", "Team B")],
  });
  render(PhotoHero, { props: { project: "democrats_abroad", city: "den_haag" } });
  await waitFor(() => expect(fetchRandomPhotos).toHaveBeenCalled());
  expect(screen.queryByTestId("photo-hero-card")).not.toBeInTheDocument();
});

test("shows the first photo's team and task caption once loaded", async () => {
  (fetchRandomPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    photos: [makePhoto("p1", "Team A"), makePhoto("p2", "Team B"), makePhoto("p3", "Team C")],
  });
  render(PhotoHero, { props: { project: "democrats_abroad", city: "den_haag" } });
  await waitFor(() => expect(screen.getByTestId("photo-hero-card")).toBeInTheDocument());
  expect(screen.getByText("Team A")).toBeInTheDocument();
  expect(screen.getByText("Task p1")).toBeInTheDocument();
});

test("rotates to the next photo after the interval elapses", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  (fetchRandomPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    photos: [makePhoto("p1", "Team A"), makePhoto("p2", "Team B"), makePhoto("p3", "Team C")],
  });
  render(PhotoHero, { props: { project: "democrats_abroad", city: "den_haag" } });
  await waitFor(() => expect(screen.getByTestId("photo-hero-card")).toBeInTheDocument());
  expect(screen.getByText("Team A")).toBeInTheDocument();
  await vi.advanceTimersByTimeAsync(3500);
  expect(screen.getByText("Team B")).toBeInTheDocument();
});
```

---

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/PhotoHero.test.ts`
Expected: FAIL — `../components/PhotoHero.svelte` doesn't exist.

---

- [ ] **Step 3: Implement `PhotoHero.svelte`**

Create `src/components/PhotoHero.svelte`:

```svelte
<script lang="ts">
  import { fetchRandomPhotos } from "../utils/api";
  import type { GalleryPhoto } from "../types/gallery";
  import "./PhotoHero.css";

  let { project, city }: { project: string; city: string } = $props();

  const ROTATE_INTERVAL_MS = 3500;
  const MIN_PHOTOS_TO_SHOW = 3;

  let photos = $state<GalleryPhoto[]>([]);
  let currentIndex = $state(0);

  $effect(() => {
    let cancelled = false;
    fetchRandomPhotos(project, city).then((data) => {
      if (!cancelled && data.ok && data.photos) {
        photos = data.photos;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (photos.length < MIN_PHOTOS_TO_SHOW) {
      return undefined;
    }
    const timer = setInterval(() => {
      currentIndex = (currentIndex + 1) % photos.length;
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  });

  /** Deterministic per-photo tilt (-5deg to +5deg) so it doesn't jitter on rotation. */
  function tiltForPhoto(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) % 1000;
    }
    return (hash / 1000) * 10 - 5;
  }

  let currentPhoto = $derived(photos[currentIndex]);
  let shouldShow = $derived(photos.length >= MIN_PHOTOS_TO_SHOW && !!currentPhoto);
</script>

{#if shouldShow}
  <div class="photo-hero">
    <div
      class="photo-hero__polaroid"
      style="transform: rotate({tiltForPhoto(currentPhoto.id)}deg)"
      data-testid="photo-hero-card"
    >
      <img
        src={currentPhoto.mediumUrl}
        alt={currentPhoto.taskTitle}
        class="photo-hero__img"
      />
      <div class="photo-hero__caption">
        <div class="photo-hero__team">{currentPhoto.teamName}</div>
        <div class="photo-hero__task">{currentPhoto.taskTitle}</div>
      </div>
    </div>
  </div>
{/if}
```

Create `src/components/PhotoHero.css`:

```css
/* src/components/PhotoHero.css */

.photo-hero {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 32px 16px;
}

.photo-hero__polaroid {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 12px 12px 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  max-width: 320px;
  width: 100%;
  transition: transform 400ms ease;
}

.photo-hero__img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 2px;
}

.photo-hero__caption {
  margin-top: 10px;
  text-align: center;
}

.photo-hero__team {
  font-weight: 700;
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.photo-hero__task {
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  margin-top: 2px;
}
```

---

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/PhotoHero.test.ts`
Expected: PASS, all 4 tests.

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
git add src/components/PhotoHero.svelte src/components/PhotoHero.css src/test/PhotoHero.test.ts
git commit -m "feat: add PhotoHero auto-rotating stacked-Polaroid component"
```
