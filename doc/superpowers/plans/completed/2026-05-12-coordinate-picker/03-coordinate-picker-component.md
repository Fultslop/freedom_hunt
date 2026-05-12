# Task 03 — `CoordinatePicker` component

**Depends on:** [02 — leafletMap action](./02-leaflet-map-action.md)  
**Next:** [04 — AppForm changes](./04-appform-changes.md)

**Files:**
- Create: `src/components/CoordinatePicker.svelte`
- Create: `src/components/CoordinatePicker.css`
- Create: `src/test/CoordinatePicker.test.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/CoordinatePicker.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { leafletMap } from "../actions/leafletMap";
import type { LeafletMapParams } from "../actions/leafletMap";
import CoordinatePicker from "../components/CoordinatePicker.svelte";

vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));

test("renders latitude and longitude inputs with initial values", () => {
  render(CoordinatePicker, {
    props: {
      value: { latitude: 52.0799, longitude: 4.3133 },
      onchange: vi.fn(),
    },
  });
  expect((screen.getByLabelText(/latitude/i) as HTMLInputElement).value).toBe("52.0799");
  expect((screen.getByLabelText(/longitude/i) as HTMLInputElement).value).toBe("4.3133");
});

test("manual latitude change fires onchange with updated coords", async () => {
  const onchange = vi.fn();
  render(CoordinatePicker, {
    props: { value: { latitude: 52.0799, longitude: 4.3133 }, onchange },
  });
  await fireEvent.input(screen.getByLabelText(/latitude/i), {
    target: { value: "51.5" },
  });
  expect(onchange).toHaveBeenCalledWith({ latitude: 51.5, longitude: 4.3133 });
});

test("manual longitude change fires onchange with updated coords", async () => {
  const onchange = vi.fn();
  render(CoordinatePicker, {
    props: { value: { latitude: 52.0799, longitude: 4.3133 }, onchange },
  });
  await fireEvent.input(screen.getByLabelText(/longitude/i), {
    target: { value: "5.0" },
  });
  expect(onchange).toHaveBeenCalledWith({ latitude: 52.0799, longitude: 5 });
});

test("map click fires onchange with clicked coordinates", () => {
  const onchange = vi.fn();
  render(CoordinatePicker, {
    props: { value: { latitude: 52.0799, longitude: 4.3133 }, onchange },
  });
  const actionParams = vi.mocked(leafletMap).mock.calls[0][1] as LeafletMapParams;
  actionParams.onClick!(53.0, 5.0);
  expect(onchange).toHaveBeenCalledWith({ latitude: 53.0, longitude: 5.0 });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx vitest run src/test/CoordinatePicker.test.ts
```
Expected: all 4 tests fail with "Cannot find module" or similar (file doesn't exist yet).

- [ ] **Step 3: Create the CSS file**

Create `src/components/CoordinatePicker.css`:

```css
.coord-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.coord-picker__inputs {
  display: flex;
  gap: 8px;
}

.coord-picker__field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.coord-picker__label {
  font-size: 0.875rem;
  color: var(--color-text);
}

.coord-picker__input {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
  width: 100%;
  box-sizing: border-box;
}

.coord-picker__map {
  height: 220px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}
```

- [ ] **Step 4: Create the component**

Create `src/components/CoordinatePicker.svelte`:

```svelte
<script lang="ts">
  import { leafletMap } from "../actions/leafletMap";
  import "./CoordinatePicker.css";

  let {
    value = { latitude: 0, longitude: 0 },
    onchange,
  }: {
    value?: { latitude: number; longitude: number };
    onchange: (coords: { latitude: number; longitude: number }) => void;
  } = $props();

  const center = $derived<[number, number]>([value.latitude, value.longitude]);
</script>

<div class="coord-picker">
  <div class="coord-picker__inputs">
    <div class="coord-picker__field">
      <label class="coord-picker__label" for="cp-latitude">Latitude</label>
      <input
        id="cp-latitude"
        type="number"
        step="any"
        class="coord-picker__input"
        value={value.latitude}
        oninput={(e) => {
          const lat = parseFloat((e.target as HTMLInputElement).value);
          onchange({ latitude: isNaN(lat) ? value.latitude : lat, longitude: value.longitude });
        }}
      />
    </div>
    <div class="coord-picker__field">
      <label class="coord-picker__label" for="cp-longitude">Longitude</label>
      <input
        id="cp-longitude"
        type="number"
        step="any"
        class="coord-picker__input"
        value={value.longitude}
        oninput={(e) => {
          const lng = parseFloat((e.target as HTMLInputElement).value);
          onchange({ latitude: value.latitude, longitude: isNaN(lng) ? value.longitude : lng });
        }}
      />
    </div>
  </div>
  <div
    class="coord-picker__map"
    use:leafletMap={{
      center,
      zoom: 15,
      scrollWheelZoom: true,
      onClick: (lat, lng) => onchange({ latitude: lat, longitude: lng }),
    }}
  ></div>
</div>
```

- [ ] **Step 5: Run tests — verify all 4 pass**

```
npx vitest run src/test/CoordinatePicker.test.ts
```
Expected: 4/4 pass.

- [ ] **Step 6: Run full test suite and lint**

```
npm run test:run
npm run lint
```
Expected: all tests pass, 0 lint errors.

- [ ] **Step 7: Commit**

```
git add src/components/CoordinatePicker.svelte src/components/CoordinatePicker.css src/test/CoordinatePicker.test.ts
git commit -m "feat: add CoordinatePicker component with clickable Leaflet map"
```
