# Task 04 — Leaf Components

**Files:**
- Create: `src/components/MarkdownText.svelte`
- Create: `src/components/CitySelector.svelte`
- Create: `src/components/RouteSelector.svelte`
- Test: `src/test/MarkdownText.test.ts`
- Test: `src/test/CitySelector.test.ts`
- Test: `src/test/RouteSelector.test.ts`

CSS files (`MarkdownText.css`, `CitySelector.css`, `RouteSelector.css`) are kept unchanged.

Replaces: `src/components/MarkdownText.tsx`, `src/components/CitySelector.tsx`, `src/components/RouteSelector.tsx`.

---

## MarkdownText

- [ ] **Step 1: Write failing test**

Create `src/test/MarkdownText.test.ts`:

```typescript
import { render } from "@testing-library/svelte";
import MarkdownText from "../components/MarkdownText.svelte";

test("renders markdown as HTML", () => {
  const { container } = render(MarkdownText, { props: { text: "**bold**" } });
  expect(container.querySelector("strong")).not.toBeNull();
});

test("renders nothing for null text", () => {
  const { container } = render(MarkdownText, { props: { text: null } });
  expect(container.querySelector(".md-text")).toBeNull();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test:run -- src/test/MarkdownText.test.ts
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create `src/components/MarkdownText.svelte`**

```svelte
<script lang="ts">
  import { marked } from "marked";
  import "./MarkdownText.css";

  let { text }: { text: string | null } = $props();
</script>

{#if text}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  <div class="md-text">{@html marked(text)}</div>
{/if}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npm run test:run -- src/test/MarkdownText.test.ts
```

Expected: PASS.

---

## CitySelector

First, check the current `src/components/CitySelector.tsx` to understand the props and rendered output before writing the test.

- [ ] **Step 5: Write failing CitySelector test**

Create `src/test/CitySelector.test.ts`:

```typescript
import { render, screen, fireEvent } from "@testing-library/svelte";
import CitySelector from "../components/CitySelector.svelte";

const city = {
  id: "den_haag",
  name: "Den Haag",
  country: "Netherlands",
  description: "A great city",
  image: null,
};

test("renders city name", () => {
  render(CitySelector, { props: { city, onClick: vi.fn() } });
  expect(screen.getByText("Den Haag")).toBeInTheDocument();
});

test("calls onClick when clicked", async () => {
  const onClick = vi.fn();
  render(CitySelector, { props: { city, onClick } });
  await fireEvent.click(screen.getByRole("button"));
  expect(onClick).toHaveBeenCalledWith("den_haag");
});
```

- [ ] **Step 6: Run to confirm failure**

```bash
npm run test:run -- src/test/CitySelector.test.ts
```

Expected: FAIL.

- [ ] **Step 7: Read `src/components/CitySelector.tsx` to understand props/markup, then create `src/components/CitySelector.svelte`**

Read the current file first, then create the Svelte version matching the same CSS class names and rendered structure. Key translation points:
- Props interface → `$props()`
- `useTheme()` context → `$themeStore`
- `useState` for image load → `$state(null)` + `$effect(() => { fetchImage(...).then(...) })`
- `onClick` prop callback stays as a prop

```svelte
<script lang="ts">
  import { fetchImage } from "../assets/AssetManager";
  import { themeStore } from "../stores/themeStore";
  import "./CitySelector.css";

  let {
    city,
    onClick,
  }: {
    city: { id: string; name: string; country: string; description: string; image: string | null };
    onClick: (id: string) => void;
  } = $props();

  let imgSrc = $state<string | null>(null);

  $effect(() => {
    if (!city.image) return;
    fetchImage(city.image).then((url) => {
      imgSrc = url;
    });
  });
</script>

<button
  class="city-selector"
  onclick={() => onClick(city.id)}
  style="border-color: {$themeStore.theme.border}"
>
  {#if imgSrc}
    <img src={imgSrc} alt={city.name} class="city-selector__img" />
  {/if}
  <div class="city-selector__body">
    <div class="city-selector__name">{city.name}</div>
    <div class="city-selector__country">{city.country}</div>
    <p class="city-selector__desc">{city.description}</p>
  </div>
</button>
```

- [ ] **Step 8: Run to confirm pass**

```bash
npm run test:run -- src/test/CitySelector.test.ts
```

Expected: PASS.

---

## RouteSelector

- [ ] **Step 9: Write failing RouteSelector test**

Create `src/test/RouteSelector.test.ts`:

```typescript
import { render, screen, fireEvent } from "@testing-library/svelte";
import RouteSelector from "../components/RouteSelector.svelte";

const routeData = {
  id: "short_loop",
  description: "A 2.5–3 hour route",
  locations: ["001_loc_binnenhof", "002_loc_vredespaleis"],
};

test("renders route description", () => {
  render(RouteSelector, { props: { routeId: "short_loop", routeData, onClick: vi.fn() } });
  expect(screen.getByText("A 2.5–3 hour route")).toBeInTheDocument();
});

test("shows stop count", () => {
  render(RouteSelector, { props: { routeId: "short_loop", routeData, onClick: vi.fn() } });
  expect(screen.getByText(/2 stops/i)).toBeInTheDocument();
});

test("calls onClick with routeId when clicked", async () => {
  const onClick = vi.fn();
  render(RouteSelector, { props: { routeId: "short_loop", routeData, onClick } });
  await fireEvent.click(screen.getByRole("button"));
  expect(onClick).toHaveBeenCalledWith("short_loop");
});
```

- [ ] **Step 10: Run to confirm failure**

```bash
npm run test:run -- src/test/RouteSelector.test.ts
```

Expected: FAIL.

- [ ] **Step 11: Read `src/components/RouteSelector.tsx`, then create `src/components/RouteSelector.svelte`**

Read the current file to confirm prop names and CSS class names, then implement:

```svelte
<script lang="ts">
  import "./RouteSelector.css";
  import type { RouteDefinition } from "../types/data";

  let {
    routeId,
    routeData,
    onClick,
  }: {
    routeId: string;
    routeData: RouteDefinition;
    onClick: (id: string) => void;
  } = $props();

  let label = $derived(routeId.replace(/_/g, " "));
  let stopCount = $derived(routeData.locations.length);
</script>

<button class="route-selector" onclick={() => onClick(routeId)}>
  <div class="route-selector__label">{label}</div>
  <div class="route-selector__desc">{routeData.description}</div>
  <div class="route-selector__stops">{stopCount} stops</div>
</button>
```

- [ ] **Step 12: Run to confirm pass**

```bash
npm run test:run -- src/test/RouteSelector.test.ts
```

Expected: PASS.

- [ ] **Step 13: Run full test suite**

```bash
npm run test:run
```

Expected: new component tests pass, worker tests pass, store tests pass.

- [ ] **Step 14: Commit**

```bash
git add src/components/MarkdownText.svelte src/components/CitySelector.svelte \
  src/components/RouteSelector.svelte \
  src/test/MarkdownText.test.ts src/test/CitySelector.test.ts \
  src/test/RouteSelector.test.ts
git commit -m "feat: migrate MarkdownText, CitySelector, RouteSelector to Svelte 5"
```
