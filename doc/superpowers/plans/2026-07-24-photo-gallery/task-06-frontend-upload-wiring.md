# Task 06: Frontend API Client + Upload Metadata Wiring

**Depends on:** Task 05 (gallery routes exist and return `GalleryPhoto[]`), Task 04 (upload route accepts `cityId`/`taskTitle`).

**Files:**
- Modify: `src/utils/api.ts`
- Modify: `src/test/api.test.ts`
- Modify: `src/components/ChallengeForm.svelte`
- Modify: `src/components/ChallengeCard.svelte`
- Modify: `src/pages/RoutePage.svelte`
- Modify: `src/test/ChallengeForm.test.ts`

**Interfaces:**
- Produces: `postPhotoUpload(payload: PhotoUploadPayload)` (breaking signature change from `postPhotoUpload(locationId, file)`), `fetchGalleryPhotos(project, city, filters?)`, `fetchRandomPhotos(project, city)` from `src/utils/api.ts` — consumed by Task 07-10 (gallery components).
- Consumes: `GalleryPhoto` type from `src/types/gallery.ts` (Task 05).

`cityId` is added as an **optional** prop (default `""`) on `ChallengeCard` and `ChallengeForm`, not required — this means `ChallengeCard.test.ts` needs no changes (existing calls that don't pass `cityId` keep working, matching the existing `routeId?` pattern). `taskTitle` is derived internally by `ChallengeCard` from `location.challenge.name` and is not a new prop callers of `ChallengeCard` need to supply.

---

- [ ] **Step 1: Write the failing `api.ts` tests**

In `src/test/api.test.ts`, replace the existing `postPhotoUpload` test:

```ts
test("postPhotoUpload POSTs to /upload with FormData", async () => {
  mockFetch({ ok: true, id: "photo-1", key: "1_123" });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const result = await postPhotoUpload({
    locationId: 1,
    cityId: "den_haag",
    routeId: "short_loop",
    taskTitle: "The Final Civic Act",
    file,
  });
  expect(fetch).toHaveBeenCalledWith(
    "/upload",
    expect.objectContaining({ method: "POST" }),
  );
  expect(result).toEqual({ ok: true, id: "photo-1", key: "1_123" });
});
```

Add new tests for the gallery fetch functions (near the bottom of the file, after the existing tests):

```ts
test("fetchGalleryPhotos GETs /gallery/:project/:city/photos", async () => {
  mockFetch({ ok: true, photos: [] });
  await fetchGalleryPhotos("democrats_abroad", "den_haag");
  expect(fetch).toHaveBeenCalledWith("/gallery/democrats_abroad/den_haag/photos");
});

test("fetchGalleryPhotos appends team/task filters as query params", async () => {
  mockFetch({ ok: true, photos: [] });
  await fetchGalleryPhotos("democrats_abroad", "den_haag", { team: "Team A", task: "Plaque" });
  expect(fetch).toHaveBeenCalledWith(
    "/gallery/democrats_abroad/den_haag/photos?team=Team+A&task=Plaque",
  );
});

test("fetchRandomPhotos GETs /gallery/:project/:city/photos/random", async () => {
  mockFetch({ ok: true, photos: [] });
  await fetchRandomPhotos("democrats_abroad", "den_haag");
  expect(fetch).toHaveBeenCalledWith("/gallery/democrats_abroad/den_haag/photos/random");
});
```

Add `fetchGalleryPhotos, fetchRandomPhotos` to the existing `import { ... } from "../utils/api";` block at the top of the file.

---

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/api.test.ts`
Expected: FAIL — `postPhotoUpload` still takes `(locationId, file)`; `fetchGalleryPhotos`/`fetchRandomPhotos` don't exist.

---

- [ ] **Step 3: Update `api.ts`**

Replace the existing `postPhotoUpload` function in `src/utils/api.ts` with:

```ts
export interface PhotoUploadPayload {
  locationId: number;
  cityId: string;
  routeId?: string;
  taskTitle: string;
  file: File;
}

export async function postPhotoUpload(
  payload: PhotoUploadPayload,
): Promise<{ ok: boolean; id?: string; key?: string }> {
  const body = new FormData();
  body.append("photo", payload.file);
  body.append("locationId", String(payload.locationId));
  body.append("cityId", payload.cityId);
  if (payload.routeId) {
    body.append("routeId", payload.routeId);
  }
  body.append("taskTitle", payload.taskTitle);
  const res = await fetch("/upload", { method: "POST", body });
  return res.json() as Promise<{ ok: boolean; id?: string; key?: string }>;
}
```

Add a new "Gallery" section at the end of `src/utils/api.ts`:

```ts
// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

import type { GalleryPhoto } from "../types/gallery";

export interface GalleryPhotosResponse {
  ok: boolean;
  photos?: GalleryPhoto[];
  error?: string;
}

export async function fetchGalleryPhotos(
  project: string,
  city: string,
  filters?: { team?: string; task?: string },
): Promise<GalleryPhotosResponse> {
  const params = new URLSearchParams();
  if (filters?.team) {
    params.set("team", filters.team);
  }
  if (filters?.task) {
    params.set("task", filters.task);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/gallery/${project}/${city}/photos${query}`);
  return res.json() as Promise<GalleryPhotosResponse>;
}

export async function fetchRandomPhotos(
  project: string,
  city: string,
): Promise<GalleryPhotosResponse> {
  const res = await fetch(`/gallery/${project}/${city}/photos/random`);
  return res.json() as Promise<GalleryPhotosResponse>;
}
```

Move the `import type { GalleryPhoto } from "../types/gallery";` line up to the top of the file alongside the existing `import type { Location } from "../types/data";` — ESLint's import ordering rules require all imports at the top; do not leave it inline mid-file.

---

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/api.test.ts`
Expected: PASS, all tests.

---

- [ ] **Step 5: Wire `cityId`/`taskTitle` through the component chain**

In `src/components/ChallengeForm.svelte`, change the props and `handlePhotoUpload`:

```ts
  let {
    form,
    locationId,
    routeId = undefined,
    cityId = "",
    taskTitle = "",
  }: {
    form: FormField[];
    locationId: number;
    routeId?: string;
    cityId?: string;
    taskTitle?: string;
  } = $props();
```

```ts
  async function handlePhotoUpload(file: File): Promise<{ ok: boolean }> {
    return postPhotoUpload({ locationId, cityId, routeId, taskTitle, file });
  }
```

In `src/components/ChallengeCard.svelte`, add `cityId` to props and pass both `cityId` and `taskTitle` to `ChallengeForm`:

```ts
  let {
    location,
    isLast = false,
    index = undefined,
    routeId = undefined,
    cityId = undefined,
  }: {
    location: Location;
    isLast?: boolean;
    index?: number;
    routeId?: string;
    cityId?: string;
  } = $props();
```

```svelte
    {#if location.challenge.form && location.challenge.form.length > 0}
      <ChallengeForm
        form={location.challenge.form}
        locationId={index ?? -1}
        {routeId}
        {cityId}
        taskTitle={location.challenge.name}
      />
    {/if}
```

In `src/pages/RoutePage.svelte`, pass `cityId={params.city}` on both `<ChallengeCard>` usages (the `swipeMode === "snap"` branch and the strip-mode `{#each}` branch):

```svelte
        <ChallengeCard
          location={currentLocation}
          isLast={currentIndex === locations.length - 1}
          index={currentIndex + 1}
          routeId={params.route}
          cityId={params.city}
        />
```

```svelte
              <ChallengeCard
                location={slotLocation}
                isLast={locIdx === locations.length - 1}
                index={locIdx + 1}
                routeId={params.route}
                cityId={params.city}
              />
```

---

- [ ] **Step 6: Add a test verifying the upload payload includes `cityId`/`taskTitle`**

In `src/test/ChallengeForm.test.ts`, add a new test (this exercises the actual file-input change event, mirroring how `AppForm.svelte` triggers `onPhotoUpload`):

```ts
test("photo upload sends cityId and taskTitle from props", async () => {
  const { postPhotoUpload } = await import("../utils/api");
  const photoForm = [
    { id: "pic", type: "photo" as const, label: "Take a photo" },
  ];
  const { container } = render(ChallengeForm, {
    props: {
      form: photoForm,
      locationId: 1,
      routeId: "short_loop",
      cityId: "den_haag",
      taskTitle: "The Final Civic Act",
    },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  expect(postPhotoUpload).toHaveBeenCalledWith(
    expect.objectContaining({
      locationId: 1,
      cityId: "den_haag",
      routeId: "short_loop",
      taskTitle: "The Final Civic Act",
    }),
  );
});
```

---

- [ ] **Step 7: Run full suite, lint, typecheck**

```bash
npm run test:run
npm run lint
npm run typecheck
```

Expected: all pass, 0 errors. `ChallengeCard.test.ts` and the rest of `ChallengeForm.test.ts` should pass unmodified — `cityId`/`taskTitle` are optional props with defaults.

---

- [ ] **Step 8: Commit**

```bash
git add src/utils/api.ts src/test/api.test.ts src/components/ChallengeForm.svelte src/components/ChallengeCard.svelte src/pages/RoutePage.svelte src/test/ChallengeForm.test.ts
git commit -m "feat: thread cityId/taskTitle through upload flow, add gallery API client functions"
```
