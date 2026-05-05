# Task 05 — Complex Components

**Files:**
- Create: `src/actions/swipe.ts`
- Create: `src/actions/leafletMap.ts`
- Create: `src/components/ChallengeForm.svelte`
- Create: `src/components/ChallengeCard.svelte`
- Create: `src/components/TitleBar.svelte`
- Test: `src/test/swipe.test.ts`
- Test: `src/test/ChallengeForm.test.ts`
- Test: `src/test/ChallengeCard.test.ts`
- Test: `src/test/TitleBar.test.ts`

CSS files are kept unchanged. `leafletMap.ts` has no dedicated test (covered by ChallengeCard integration test).

---

## Swipe action

- [ ] **Step 1: Write failing swipe test**

Create `src/test/swipe.test.ts`:

```typescript
import { swipe } from "../actions/swipe";

function makeNode() {
  return document.createElement("div");
}

function touch(clientX: number): Touch {
  return { clientX } as Touch;
}

test("calls onSwipeLeft when delta exceeds threshold", () => {
  const node = makeNode();
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  swipe(node, { onSwipeLeft, onSwipeRight });

  node.dispatchEvent(
    new TouchEvent("touchstart", { touches: [touch(200)] as unknown as TouchList }),
  );
  node.dispatchEvent(
    new TouchEvent("touchend", {
      changedTouches: [touch(100)] as unknown as TouchList,
    }),
  );

  expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  expect(onSwipeRight).not.toHaveBeenCalled();
});

test("calls onSwipeRight when delta exceeds threshold", () => {
  const node = makeNode();
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  swipe(node, { onSwipeLeft, onSwipeRight });

  node.dispatchEvent(
    new TouchEvent("touchstart", { touches: [touch(100)] as unknown as TouchList }),
  );
  node.dispatchEvent(
    new TouchEvent("touchend", {
      changedTouches: [touch(200)] as unknown as TouchList,
    }),
  );

  expect(onSwipeRight).toHaveBeenCalledTimes(1);
  expect(onSwipeLeft).not.toHaveBeenCalled();
});

test("ignores swipes below threshold", () => {
  const node = makeNode();
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  swipe(node, { onSwipeLeft, onSwipeRight, threshold: 60 });

  node.dispatchEvent(
    new TouchEvent("touchstart", { touches: [touch(100)] as unknown as TouchList }),
  );
  node.dispatchEvent(
    new TouchEvent("touchend", {
      changedTouches: [touch(120)] as unknown as TouchList,
    }),
  );

  expect(onSwipeLeft).not.toHaveBeenCalled();
  expect(onSwipeRight).not.toHaveBeenCalled();
});

test("destroy removes event listeners", () => {
  const node = makeNode();
  const onSwipeLeft = vi.fn();
  const action = swipe(node, { onSwipeLeft, onSwipeRight: vi.fn() });
  action.destroy();

  node.dispatchEvent(
    new TouchEvent("touchstart", { touches: [touch(200)] as unknown as TouchList }),
  );
  node.dispatchEvent(
    new TouchEvent("touchend", {
      changedTouches: [touch(100)] as unknown as TouchList,
    }),
  );

  expect(onSwipeLeft).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test:run -- src/test/swipe.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create `src/actions/swipe.ts`**

```typescript
export interface SwipeParams {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
}

export function swipe(node: HTMLElement, params: SwipeParams) {
  let startX: number | null = null;
  let threshold = params.threshold ?? 60;

  function onTouchStart(evt: TouchEvent) {
    startX = evt.touches[0].clientX;
  }

  function onTouchEnd(evt: TouchEvent) {
    if (startX === null) return;
    const delta = evt.changedTouches[0].clientX - startX;
    startX = null;
    if (delta < -threshold) {
      params.onSwipeLeft();
    } else if (delta > threshold) {
      params.onSwipeRight();
    }
  }

  node.addEventListener("touchstart", onTouchStart);
  node.addEventListener("touchend", onTouchEnd);

  return {
    update(newParams: SwipeParams) {
      params = newParams;
      threshold = newParams.threshold ?? 60;
    },
    destroy() {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchend", onTouchEnd);
    },
  };
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/test/swipe.test.ts
```

Expected: PASS.

---

## Leaflet map action

No dedicated test — covered by ChallengeCard rendering test (map node is created).

- [ ] **Step 5: Create `src/actions/leafletMap.ts`**

```typescript
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface LeafletMapParams {
  center: [number, number];
  zoom: number;
}

const PIN = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;background:#BF0A30;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconAnchor: [7, 7],
});

export function leafletMap(node: HTMLElement, params: LeafletMapParams) {
  const map = L.map(node, { zoomControl: false, scrollWheelZoom: false });
  map.setView(params.center, params.zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const marker = L.marker(params.center, {
    icon: PIN as unknown as L.Icon,
  }).addTo(map);

  return {
    update(newParams: LeafletMapParams) {
      map.setView(newParams.center, newParams.zoom);
      marker.setLatLng(newParams.center);
    },
    destroy() {
      map.remove();
    },
  };
}
```

---

## ChallengeForm

- [ ] **Step 6: Write failing ChallengeForm test**

Create `src/test/ChallengeForm.test.ts`:

```typescript
import { render, screen, fireEvent } from "@testing-library/svelte";
import { authStore } from "../stores/authStore";
import ChallengeForm from "../components/ChallengeForm.svelte";

const form = [
  { id: "found_it", type: "boolean" as const, label: "Did you find it?" },
  { id: "note", type: "string" as const, label: "Your note" },
];

beforeEach(() => {
  vi.spyOn(global, "fetch").mockResolvedValue({
    json: async () => ({ ok: true }),
  } as Response);
  authStore.login("test_project", "Team A", "team@test.com");
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders form fields", () => {
  render(ChallengeForm, { props: { form, locationId: 1, routeId: "short_loop" } });
  expect(screen.getByText("Did you find it?")).toBeInTheDocument();
  expect(screen.getByText("Your note")).toBeInTheDocument();
});

test("shows confirmation dialog on submit", async () => {
  render(ChallengeForm, { props: { form, locationId: 1, routeId: "short_loop" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText(/submit your answers/i)).toBeInTheDocument();
});

test("submits on confirm", async () => {
  render(ChallengeForm, { props: { form, locationId: 1, routeId: "short_loop" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(fetch).toHaveBeenCalledWith("/form-submit", expect.objectContaining({ method: "POST" }));
});

test("renders two ornamental dividers framing the field list", () => {
  const { container } = render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  expect(container.querySelectorAll(".cf-divider")).toHaveLength(2);
});

test("photo field renders nothing", () => {
  const photoForm = [{ id: "pic", type: "photo" as const, label: "Photo" }];
  render(ChallengeForm, { props: { form: photoForm, locationId: 1 } });
  expect(screen.queryByText("Photo")).not.toBeInTheDocument();
});
```

- [ ] **Step 7: Run to confirm failure**

```bash
npm run test:run -- src/test/ChallengeForm.test.ts
```

Expected: FAIL.

- [ ] **Step 8: Create `src/components/ChallengeForm.svelte`**

```svelte
<script lang="ts">
  import { Camera, Flag } from "lucide-svelte";
  import { authStore } from "../stores/authStore";
  import type { FormField, FormFieldType } from "../types/data";
  import "./ChallengeForm.css";

  const VALID_TYPES: FormFieldType[] = [
    "string", "number", "boolean", "radio", "multiple", "photo",
  ];

  type SubmitState = "idle" | "submitting" | "success" | "error";
  type UploadState = "idle" | "uploading" | "success" | "error";
  type FieldValues = Record<string, string | number | boolean | string[]>;

  let {
    form,
    locationId,
    routeId = undefined,
  }: { form: FormField[]; locationId: number; routeId?: string } = $props();

  let values = $state<FieldValues>({});
  let errors = $state<Record<string, string>>({});
  let submitState = $state<SubmitState>("idle");
  let uploadState = $state<UploadState>("idle");
  let showConfirm = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  function checkDefinition(field: FormField): string | null {
    if (!VALID_TYPES.includes(field.type)) return `unknown type "${field.type}"`;
    if (field.type === "radio" && (!field.options || field.options.length === 0)) {
      return "radio field missing options";
    }
    if (field.type === "multiple" && (!field.options || field.options.length === 0)) {
      return "multiple field missing options";
    }
    if (field.type === "multiple" && (field.min == null || field.max == null)) {
      return "multiple field missing min/max";
    }
    if (
      field.type === "multiple" &&
      field.min !== undefined &&
      field.max !== undefined &&
      field.min > field.max
    ) {
      return "multiple field: min > max";
    }
    return null;
  }

  async function handleFileChange(evt: Event) {
    const file = (evt.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadState = "uploading";
    const body = new FormData();
    body.append("photo", file);
    body.append("locationId", String(locationId));
    try {
      const res = await fetch("/upload", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean };
      uploadState = data.ok ? "success" : "error";
    } catch {
      uploadState = "error";
    }
  }

  function handleSubmit() {
    const newErrors: Record<string, string> = {};
    for (const field of form) {
      const def = checkDefinition(field);
      if (def) newErrors[field.id] = def;
    }
    errors = newErrors;
    if (Object.keys(newErrors).length === 0) showConfirm = true;
  }

  async function handleConfirm() {
    showConfirm = false;
    submitState = "submitting";
    try {
      const payload = {
        locationId,
        routeId,
        teamName: $authStore.activeAuth?.teamName ?? "",
        contact: $authStore.activeAuth?.contact ?? "",
        answers: values,
      };
      const res = await fetch("/form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean };
      submitState = data.ok ? "success" : "error";
    } catch {
      submitState = "error";
    }
  }

  function hasPhotoField(): boolean {
    return form.some((fld) => fld.type === "photo");
  }

  function renderField(field: FormField) {
    const err = errors[field.id];
    if (field.type === "photo") return null;
    return { field, err };
  }
</script>

<div class="challenge-form">
  {#if submitState === "success"}
    <p class="cf-success">Submitted! ✓</p>
  {:else}
    {#if hasPhotoField()}
      <div class="cf-photo-wrap">
        <button
          class="cf-photo-btn"
          onclick={() => fileInput?.click()}
          disabled={uploadState === "uploading"}
        >
          <Camera size={16} aria-hidden />
          {uploadState === "success" ? "Photo uploaded ✓" : uploadState === "uploading" ? "Uploading…" : "Add photo"}
        </button>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          class="cf-photo-input"
          bind:this={fileInput}
          onchange={handleFileChange}
        />
        {#if uploadState === "error"}
          <p class="cf-upload-error">Upload failed. Try again.</p>
        {/if}
      </div>
    {/if}

    <div class="cf-divider" aria-hidden>
      <span class="cf-divider__line"></span>
      <Flag size={12} class="cf-divider__icon" />
      <span class="cf-divider__line"></span>
    </div>

    {#each form as field (field.id)}
      {#if field.type !== "photo"}
        {@const err = errors[field.id]}
        <div class="cf-field">
          <label class="cf-label" for={field.id}>{field.label}</label>
          {#if field.type === "string"}
            <input
              id={field.id}
              type="text"
              class="cf-input"
              bind:value={values[field.id] as string}
            />
          {:else if field.type === "number"}
            <input
              id={field.id}
              type="number"
              class="cf-input"
              bind:value={values[field.id] as number}
            />
          {:else if field.type === "boolean"}
            <input
              id={field.id}
              type="checkbox"
              class="cf-checkbox"
              bind:checked={values[field.id] as boolean}
            />
          {:else if field.type === "radio"}
            {#each field.options ?? [] as opt (opt)}
              <label class="cf-radio-label">
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  bind:group={values[field.id] as string}
                />
                {opt}
              </label>
            {/each}
          {:else if field.type === "multiple"}
            {#each field.options ?? [] as opt (opt)}
              <label class="cf-checkbox-label">
                <input
                  type="checkbox"
                  value={opt}
                  checked={(values[field.id] as string[] ?? []).includes(opt)}
                  onchange={(evt) => {
                    const checked = (evt.target as HTMLInputElement).checked;
                    const cur = (values[field.id] as string[]) ?? [];
                    values[field.id] = checked
                      ? [...cur, opt]
                      : cur.filter((val) => val !== opt);
                  }}
                />
                {opt}
              </label>
            {/each}
          {/if}
          {#if err}
            <p class="cf-error">{err}</p>
          {/if}
        </div>
      {/if}
    {/each}

    <div class="cf-divider" aria-hidden>
      <span class="cf-divider__line"></span>
      <Flag size={12} class="cf-divider__icon" />
      <span class="cf-divider__line"></span>
    </div>

    {#if showConfirm}
      <div class="cf-confirm-overlay">
        <p class="cf-confirm-msg">Submit your answers?</p>
        <div class="cf-confirm-btns">
          <button class="cf-cancel-btn" onclick={() => (showConfirm = false)}>
            Cancel
          </button>
          <button class="cf-confirm-btn" onclick={handleConfirm}>Confirm</button>
        </div>
      </div>
    {:else}
      <button
        class="cf-submit-btn"
        onclick={handleSubmit}
        disabled={submitState === "submitting"}
      >
        {submitState === "submitting" ? "Submitting…" : submitState === "error" ? "Try again" : "Submit"}
      </button>
    {/if}
  {/if}
</div>
```

- [ ] **Step 9: Run to confirm pass**

```bash
npm run test:run -- src/test/ChallengeForm.test.ts
```

Expected: PASS.

---

## ChallengeCard

- [ ] **Step 10: Write failing ChallengeCard test**

Create `src/test/ChallengeCard.test.ts`:

```typescript
import { render, screen } from "@testing-library/svelte";
import { authStore } from "../stores/authStore";
import ChallengeCard from "../components/ChallengeCard.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
}));

vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));

const location = {
  locationId: 1,
  title: "The Binnenhof",
  image: "binnenhof.jpg",
  name: { label: "", value: "Binnenhof" },
  address: "Binnenhof 1",
  coordinates: { latitude: 52.0799, longitude: 4.3133 },
  storyline: "A historic place.",
  breadcrumb: "Look for the gate.",
  challenge: {
    name: "",
    description: "Find the plaque.",
    notes: "",
    form: [{ id: "found_it", type: "boolean" as const, label: "Found it?" }],
  },
};

beforeEach(() => {
  authStore.login("test_project", "Team A", "team@test.com");
});

test("renders location title", () => {
  render(ChallengeCard, { props: { location } });
  expect(screen.getByText("The Binnenhof")).toBeInTheDocument();
});

test("renders location badge with index", () => {
  render(ChallengeCard, { props: { location, index: 3 } });
  expect(screen.getByTestId("location-badge")).toHaveTextContent("3");
});

test("renders challenge form when form fields present", () => {
  render(ChallengeCard, { props: { location } });
  expect(screen.getByText("Found it?")).toBeInTheDocument();
});

test("hides breadcrumb when isLast=true", () => {
  render(ChallengeCard, { props: { location, isLast: true } });
  expect(screen.queryByText("Look for the gate.")).not.toBeInTheDocument();
});
```

- [ ] **Step 11: Run to confirm failure**

```bash
npm run test:run -- src/test/ChallengeCard.test.ts
```

Expected: FAIL.

- [ ] **Step 12: Create `src/components/ChallengeCard.svelte`**

```svelte
<script lang="ts">
  import { BookOpen, MapPin, Crosshair, Compass } from "lucide-svelte";
  import { fetchImage } from "../assets/AssetManager";
  import { themeStore } from "../stores/themeStore";
  import { leafletMap } from "../actions/leafletMap";
  import MarkdownText from "./MarkdownText.svelte";
  import ChallengeForm from "./ChallengeForm.svelte";
  import type { Location } from "../types/data";
  import "./ChallengeCard.css";

  let {
    location,
    isLast = false,
    index = undefined,
    routeId = undefined,
  }: {
    location: Location;
    isLast?: boolean;
    index?: number;
    routeId?: string;
  } = $props();

  let heroSrc = $state<string | null>(null);
  let hasHero = $derived(!!heroSrc);
  let pos = $derived<[number, number]>([
    location.coordinates.latitude,
    location.coordinates.longitude,
  ]);

  $effect(() => {
    if (!location.image) return;
    let cancelled = false;
    fetchImage(location.image).then((url) => {
      if (!cancelled) heroSrc = url;
    });
    return () => {
      cancelled = true;
    };
  });
</script>

<div class="cc-root">
  {#if hasHero}
    <div class="cc-hero-wrap">
      <img src={heroSrc!} alt={location.name?.value || location.title} class="cc-hero-img" />
      <div class="cc-hero-title-wrap">
        <div class={`cc-title-card cc-title-card--shadow`}>
          <div
            class="cc-badge"
            style="background: {location.themeColor ?? $themeStore.theme.accent}"
            data-testid="location-badge"
          >
            {index}
          </div>
          <div>
            <div class="cc-location-title">{location.title}</div>
            {#if location.name?.value}
              <div class="cc-location-name">{location.name.value}</div>
            {/if}
            {#if location.address}
              <div class="cc-location-address">{location.address}</div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="cc-no-hero-wrap">
      <div class="cc-title-card">
        <div
          class="cc-badge"
          style="background: {location.themeColor ?? $themeStore.theme.accent}"
          data-testid="location-badge"
        >
          {index}
        </div>
        <div>
          <div class="cc-location-title">{location.title}</div>
          {#if location.name?.value}
            <div class="cc-location-name">{location.name.value}</div>
          {/if}
          {#if location.address}
            <div class="cc-location-address">{location.address}</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <div class="cc-section">
    <div class="cc-section-label">
      <BookOpen size={12} aria-hidden />
      Storyline
    </div>
    <MarkdownText text={location.storyline} />
  </div>

  <div class="cc-section">
    <div class="cc-section-label">
      <MapPin size={12} aria-hidden />
      Location
    </div>
    <div
      use:leafletMap={{ center: pos, zoom: 16 }}
      style="height: 180px; border-radius: 6px; border: 1px solid var(--color-border);"
    ></div>
    <div class="cc-map-coords">
      {location.coordinates.latitude}° N, {location.coordinates.longitude}° E
    </div>

    <div class="cc-challenge-box">
      <div class="cc-section-label">
        <Crosshair size={12} aria-hidden />
        Challenge
      </div>
      <MarkdownText text={location.challenge.description} />
    </div>

    {#if location.challenge.form && location.challenge.form.length > 0}
      <ChallengeForm
        form={location.challenge.form}
        locationId={location.locationId}
        {routeId}
      />
    {/if}
  </div>

  {#if !isLast}
    <div class="cc-section--no-border">
      <div class="cc-section-label">
        <Compass size={12} aria-hidden />
        Your clue to your next destination
      </div>
      <p class="cc-breadcrumb">{location.breadcrumb}</p>
    </div>
  {/if}
</div>
```

- [ ] **Step 13: Run to confirm pass**

```bash
npm run test:run -- src/test/ChallengeCard.test.ts
```

Expected: PASS.

---

## TitleBar

- [ ] **Step 14: Write failing TitleBar test**

Create `src/test/TitleBar.test.ts`:

```typescript
import { render, screen, fireEvent } from "@testing-library/svelte";
import { titleBarStore } from "../stores/titleBarStore";
import { authStore } from "../stores/authStore";
import TitleBar from "../components/TitleBar.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Test Title", progress: null, backPath: null });
  authStore.login("test_project", "Team A", "a@b.com");
});

test("renders title from store", () => {
  render(TitleBar);
  expect(screen.getByText("Test Title")).toBeInTheDocument();
});

test("shows progress bar when progress is set", () => {
  titleBarStore.set({ title: "T", progress: { current: 2, total: 5 }, backPath: null });
  render(TitleBar);
  expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
});

test("hides progress bar when progress is null", () => {
  render(TitleBar);
  expect(screen.queryByTestId("progress-bar")).not.toBeInTheDocument();
});

test("opens menu on hamburger click", async () => {
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  expect(screen.getByText("Themes")).toBeInTheDocument();
});

test("shows back button when backPath set", async () => {
  titleBarStore.set({ title: "T", progress: null, backPath: "/test" });
  render(TitleBar);
  expect(screen.getByLabelText("Back")).toBeInTheDocument();
});
```

- [ ] **Step 15: Run to confirm failure**

```bash
npm run test:run -- src/test/TitleBar.test.ts
```

Expected: FAIL.

- [ ] **Step 16: Create `src/components/TitleBar.svelte`**

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { themeStore } from "../stores/themeStore";
  import { fontSizeStore, FONT_SIZES } from "../stores/fontSizeStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { authStore } from "../stores/authStore";
  import { themes } from "../theme/themes";
  import type { ThemeName } from "../types/theme";
  import type { FontSize } from "../stores/fontSizeStore";
  import "./TitleBar.css";

  let menuView = $state<string | null>(null);

  function closeMenu() {
    menuView = null;
  }
</script>

<div class="titlebar">
  <div class="titlebar__row">
    <div class="titlebar__left">
      {#if $titleBarStore.backPath}
        <button
          onclick={() => push($titleBarStore.backPath!)}
          aria-label="Back"
          class="titlebar__back-btn"
        >
          ←
        </button>
      {/if}
      <span class="titlebar__title">{$titleBarStore.title}</span>
    </div>

    <div class="titlebar__menu-wrap">
      <button
        onclick={() => (menuView = menuView ? null : "root")}
        aria-label="Menu"
        class="titlebar__menu-btn"
      >
        ☰
      </button>

      {#if menuView}
        <div class="titlebar__dropdown">
          {#if menuView === "root"}
            <button onclick={() => (menuView = "profile")} class="titlebar__menu-item">
              <span class="titlebar__menu-item-label">Profile</span>
              <span class="titlebar__menu-item-arrow">›</span>
            </button>
            <button onclick={() => (menuView = "themes")} class="titlebar__menu-item">
              <span class="titlebar__menu-item-label">Themes</span>
              <span class="titlebar__menu-item-arrow">›</span>
            </button>
            <button onclick={() => (menuView = "fontsize")} class="titlebar__menu-item">
              <span class="titlebar__menu-item-label">Text Size</span>
              <span class="titlebar__menu-item-arrow">›</span>
            </button>
          {/if}

          {#if menuView === "profile"}
            <button onclick={() => (menuView = "root")} aria-label="Back to menu" class="titlebar__submenu-header">
              <span class="titlebar__submenu-back">‹</span>
              <span class="titlebar__submenu-title">Profile</span>
            </button>
            <div class="titlebar__profile-body">
              <div class="titlebar__profile-field">
                <div class="titlebar__profile-label">Team</div>
                <div class="titlebar__profile-value">
                  {$authStore.activeAuth?.teamName ?? "—"}
                </div>
              </div>
              <div class="titlebar__profile-field" style="margin-bottom: 16px">
                <div class="titlebar__profile-label">Contact</div>
                <div class="titlebar__profile-value--contact">
                  {$authStore.activeAuth?.contact ?? "—"}
                </div>
              </div>
              <button
                onclick={async () => { await authStore.logout(); closeMenu(); }}
                class="titlebar__signout-btn"
              >
                Sign out
              </button>
            </div>
          {/if}

          {#if menuView === "themes"}
            <button onclick={() => (menuView = "root")} aria-label="Back to menu" class="titlebar__submenu-header">
              <span class="titlebar__submenu-back">‹</span>
              <span class="titlebar__submenu-title">Themes</span>
            </button>
            {#each Object.keys(themes) as name (name)}
              {@const isActive = name === $themeStore.themeName}
              <button
                onclick={() => { themeStore.setThemeName(name as ThemeName); closeMenu(); }}
                class="titlebar__theme-btn"
                style="background: {isActive ? $themeStore.theme.accent : 'transparent'}; color: {isActive ? $themeStore.theme.barText : $themeStore.theme.text}; font-weight: {isActive ? 700 : 400}"
              >
                <span>{name}</span>
                {#if isActive}<span class="titlebar__theme-check">✓</span>{/if}
              </button>
            {/each}
          {/if}

          {#if menuView === "fontsize"}
            <button onclick={() => (menuView = "root")} aria-label="Back to menu" class="titlebar__submenu-header">
              <span class="titlebar__submenu-back">‹</span>
              <span class="titlebar__submenu-title">Text Size</span>
            </button>
            {#each FONT_SIZES as size (size)}
              {@const isActive = size === $fontSizeStore.fontSize}
              <button
                onclick={() => { fontSizeStore.setFontSize(size as FontSize); closeMenu(); }}
                class="titlebar__theme-btn"
                style="background: {isActive ? $themeStore.theme.accent : 'transparent'}; color: {isActive ? $themeStore.theme.barText : $themeStore.theme.text}; font-weight: {isActive ? 700 : 400}"
              >
                <span style="text-transform: capitalize">{size}</span>
                {#if isActive}<span class="titlebar__theme-check">✓</span>{/if}
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if $titleBarStore.progress}
    <div data-testid="progress-bar" class="titlebar__progress-track" style="height: 6px">
      <div
        class="titlebar__progress-fill"
        style="width: {($titleBarStore.progress.current / $titleBarStore.progress.total) * 100}%"
      ></div>
    </div>
  {/if}
</div>
```

- [ ] **Step 17: Import TitleBar in `src/App.svelte`**

Add the import and component to `App.svelte`:

```svelte
<script lang="ts">
  // ... existing imports ...
  import TitleBar from "./components/TitleBar.svelte";
  // ...
</script>

<TitleBar />
<Router {routes} />
```

- [ ] **Step 18: Run to confirm pass**

```bash
npm run test:run -- src/test/TitleBar.test.ts
```

Expected: PASS.

- [ ] **Step 19: Run full test suite**

```bash
npm run test:run
```

Expected: all new component tests pass, worker tests pass.

- [ ] **Step 20: Commit**

```bash
git add src/actions/ src/components/ChallengeForm.svelte src/components/ChallengeCard.svelte \
  src/components/TitleBar.svelte src/App.svelte \
  src/test/swipe.test.ts src/test/ChallengeForm.test.ts \
  src/test/ChallengeCard.test.ts src/test/TitleBar.test.ts
git commit -m "feat: migrate complex components and actions to Svelte 5"
```
