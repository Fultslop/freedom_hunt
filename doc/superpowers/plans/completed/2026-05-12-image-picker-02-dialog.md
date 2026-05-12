# Task 02 — ImagePickerDialog component

**Files:**
- Create: `src/components/ImagePickerDialog.svelte`
- Create: `src/components/ImagePickerDialog.css`
- Create: `src/test/ImagePickerDialog.test.ts`

**Context:**
`ImagePickerDialog` is a modal overlay that renders a grid of image thumbnails. It receives the available images list and the currently selected filename. Clicking a tile calls `onSelect(filename)` and the parent closes the dialog. Clicking Cancel or pressing Escape calls `onCancel`. On mount, focus moves to the Cancel button. Accessible: `role="dialog"`, `aria-label="Pick an image"`. Uses `<svelte:window>` for Escape key.

The "None" tile (always first) sets the value to `""`. A tile whose filename matches `currentValue` gets a selected highlight. If `currentValue` is `""` or not in the images list, the None tile is highlighted.

---

- [ ] **Step 1: Write failing tests**

Create `src/test/ImagePickerDialog.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ImagePickerDialog from "../components/ImagePickerDialog.svelte";
import type { ImageEntry } from "../utils/images";

const mockImages: ImageEntry[] = [
  { filename: "logo.jpg", url: "/assets/logo.jpg" },
  { filename: "photo.png", url: "/assets/photo.png" },
];

test("renders None tile first, then all image tiles", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  const buttons = screen.getAllByRole("button");
  // None tile + 2 image tiles + Cancel button = 4
  expect(buttons.length).toBeGreaterThanOrEqual(3);
  expect(screen.getByRole("button", { name: /none/i })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "logo.jpg" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "photo.png" })).toBeInTheDocument();
});

test("calls onSelect with empty string when None tile is clicked", async () => {
  const onSelect = vi.fn();
  render(ImagePickerDialog, {
    props: {
      currentValue: "logo.jpg",
      images: mockImages,
      onSelect,
      onCancel: vi.fn(),
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /none/i }));
  expect(onSelect).toHaveBeenCalledWith("");
});

test("calls onSelect with filename when image tile is clicked", async () => {
  const onSelect = vi.fn();
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect,
      onCancel: vi.fn(),
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: "logo.jpg" }));
  expect(onSelect).toHaveBeenCalledWith("logo.jpg");
});

test("calls onCancel when Cancel button is clicked", async () => {
  const onCancel = vi.fn();
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel,
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(onCancel).toHaveBeenCalledOnce();
});

test("calls onCancel when Escape key is pressed", async () => {
  const onCancel = vi.fn();
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel,
    },
  });
  await fireEvent.keyDown(window, { key: "Escape" });
  expect(onCancel).toHaveBeenCalledOnce();
});

test("selected tile has ipd-tile--selected class when currentValue matches", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "logo.jpg",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  const logoBtn = screen.getByRole("button", { name: "logo.jpg" });
  expect(logoBtn).toHaveClass("ipd-tile--selected");
});

test("None tile has ipd-tile--selected class when currentValue is empty string", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  expect(screen.getByRole("button", { name: /none/i })).toHaveClass(
    "ipd-tile--selected",
  );
});

test("None tile has ipd-tile--selected class when currentValue is unknown", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "nonexistent.jpg",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  expect(screen.getByRole("button", { name: /none/i })).toHaveClass(
    "ipd-tile--selected",
  );
});

test("dialog container has role=dialog and aria-label", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "Pick an image",
  );
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- src/test/ImagePickerDialog.test.ts
```

Expected: all tests fail with `Cannot find module '../components/ImagePickerDialog.svelte'`.

- [ ] **Step 3: Create `src/components/ImagePickerDialog.css`**

```css
/* src/components/ImagePickerDialog.css */

.ipd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.ipd-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 20px;
  width: min(480px, 92vw);
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ipd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
}

.ipd-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
}

.ipd-tile:hover {
  border-color: var(--color-accent);
}

.ipd-tile--selected {
  border-color: var(--color-accent);
}

.ipd-tile__img {
  width: 80px;
  height: 60px;
  object-fit: cover;
  border-radius: 3px;
  display: block;
}

.ipd-tile__none {
  width: 80px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: 3px;
}

.ipd-tile__name {
  font-size: 11px;
  line-height: 1.3;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.ipd-tile__check {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--color-accent);
  color: #fff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.ipd-actions {
  display: flex;
  justify-content: flex-end;
}

.ipd-cancel {
  padding: 8px 18px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
}
```

- [ ] **Step 4: Create `src/components/ImagePickerDialog.svelte`**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import type { ImageEntry } from "../utils/images";
  import "./ImagePickerDialog.css";

  let {
    currentValue,
    images,
    onSelect,
    onCancel,
  }: {
    currentValue: string;
    images: ImageEntry[];
    onSelect: (filename: string) => void;
    onCancel: () => void;
  } = $props();

  let cancelBtn: HTMLButtonElement | undefined;

  const isNoneSelected = $derived(
    currentValue === "" || !images.find((img) => img.filename === currentValue),
  );

  onMount(() => {
    cancelBtn?.focus();
  });
</script>

<svelte:window onkeydown={(e) => { if (e.key === "Escape") { onCancel(); } }} />

<div class="ipd-overlay" role="dialog" aria-label="Pick an image">
  <div class="ipd-dialog">
    <div class="ipd-grid">
      <button
        type="button"
        class="ipd-tile"
        class:ipd-tile--selected={isNoneSelected}
        onclick={() => onSelect("")}
      >
        {#if isNoneSelected}
          <span class="ipd-tile__check" aria-hidden="true">✓</span>
        {/if}
        <div class="ipd-tile__none" aria-hidden="true">✕</div>
        <span class="ipd-tile__name">None</span>
      </button>

      {#each images as img (img.filename)}
        {@const isSelected = currentValue === img.filename}
        <button
          type="button"
          class="ipd-tile"
          class:ipd-tile--selected={isSelected}
          onclick={() => onSelect(img.filename)}
        >
          {#if isSelected}
            <span class="ipd-tile__check" aria-hidden="true">✓</span>
          {/if}
          <img src={img.url} alt={img.filename} class="ipd-tile__img" />
          <!-- aria-hidden: img alt already provides the accessible name; span would duplicate it -->
          <span class="ipd-tile__name" aria-hidden="true">{img.filename}</span>
        </button>
      {/each}
    </div>

    <div class="ipd-actions">
      <button
        type="button"
        class="ipd-cancel"
        onclick={onCancel}
        bind:this={cancelBtn}
      >
        Cancel
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Run tests to confirm they pass**

```
npm test -- src/test/ImagePickerDialog.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 6: Run the full test suite and linter**

```
npm test
npm run lint
```

Expected: all existing tests still pass, no lint errors.

- [ ] **Step 7: Commit**

```
git add src/components/ImagePickerDialog.svelte src/components/ImagePickerDialog.css src/test/ImagePickerDialog.test.ts
git commit -m "feat: add ImagePickerDialog component"
```
