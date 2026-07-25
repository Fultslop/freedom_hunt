# Task 09: `PhotoLightbox` Component

**Depends on:** Task 05 (`GalleryPhoto.fullUrl`/`mediumUrl` shape exists).

**Files:**
- Create: `src/components/PhotoLightbox.svelte`
- Create: `src/components/PhotoLightbox.css`
- Create: `src/test/PhotoLightbox.test.ts`

**Interfaces:**
- Produces: `PhotoLightbox` component with props `{ photo: GalleryPhoto | null; onClose: () => void }`, consumed by Task 10 (`GalleryLandingPage`, which owns the "currently selected photo" state and passes it down).

Renders nothing when `photo` is `null`. `Escape`, a close button, and clicking the backdrop all call `onClose`. The backdrop is a `<button>` (not a `<div onclick>`) so it's keyboard-accessible without extra ARIA wiring, satisfying `eslint-plugin-svelte`'s a11y rules in `svelte.configs.recommended`.

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/PhotoLightbox.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import PhotoLightbox from "../components/PhotoLightbox.svelte";
import type { GalleryPhoto } from "../types/gallery";

const PHOTO: GalleryPhoto = {
  id: "p1",
  locationId: "1",
  taskTitle: "The Final Civic Act",
  teamName: "Team A",
  uploadedAt: 1,
  thumbUrl: "/photos/p1/thumb",
  mediumUrl: "/photos/p1/medium",
  fullUrl: "/photos/p1/full",
};

test("renders nothing when photo is null", () => {
  render(PhotoLightbox, { props: { photo: null, onClose: vi.fn() } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("shows team, task, and a download link pointing at the full-resolution variant", () => {
  render(PhotoLightbox, { props: { photo: PHOTO, onClose: vi.fn() } });
  expect(screen.getByText("Team A")).toBeInTheDocument();
  expect(screen.getByText("The Final Civic Act")).toBeInTheDocument();
  const downloadLink = screen.getByRole("link", { name: /download photo/i });
  expect(downloadLink).toHaveAttribute("href", "/photos/p1/full");
  expect(downloadLink).toHaveAttribute("download");
});

test("calls onClose when the close button is clicked", async () => {
  const onClose = vi.fn();
  render(PhotoLightbox, { props: { photo: PHOTO, onClose } });
  await fireEvent.click(screen.getByRole("button", { name: /close/i }));
  expect(onClose).toHaveBeenCalledOnce();
});

test("calls onClose when the backdrop is clicked", async () => {
  const onClose = vi.fn();
  render(PhotoLightbox, { props: { photo: PHOTO, onClose } });
  await fireEvent.click(screen.getByLabelText("Close photo preview"));
  expect(onClose).toHaveBeenCalledOnce();
});

test("calls onClose when Escape is pressed", async () => {
  const onClose = vi.fn();
  render(PhotoLightbox, { props: { photo: PHOTO, onClose } });
  await fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
});
```

---

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/PhotoLightbox.test.ts`
Expected: FAIL — `../components/PhotoLightbox.svelte` doesn't exist.

---

- [ ] **Step 3: Implement `PhotoLightbox.svelte`**

Create `src/components/PhotoLightbox.svelte`:

```svelte
<script lang="ts">
  import type { GalleryPhoto } from "../types/gallery";
  import "./PhotoLightbox.css";

  let { photo, onClose }: { photo: GalleryPhoto | null; onClose: () => void } = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if photo}
  <div class="photo-lightbox" role="dialog" aria-modal="true" aria-label={photo.taskTitle}>
    <button
      class="photo-lightbox__backdrop"
      aria-label="Close photo preview"
      onclick={onClose}
    ></button>
    <div class="photo-lightbox__content">
      <button class="photo-lightbox__close" onclick={onClose} aria-label="Close">✕</button>
      <img src={photo.mediumUrl} alt={photo.taskTitle} class="photo-lightbox__img" />
      <div class="photo-lightbox__meta">
        <div class="photo-lightbox__team">{photo.teamName}</div>
        <div class="photo-lightbox__task">{photo.taskTitle}</div>
      </div>
      <a href={photo.fullUrl} download class="photo-lightbox__download">Download Photo</a>
    </div>
  </div>
{/if}
```

Create `src/components/PhotoLightbox.css`:

```css
/* src/components/PhotoLightbox.css */

.photo-lightbox {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-lightbox__backdrop {
  position: absolute;
  inset: 0;
  border: none;
  background: rgba(0, 0, 0, 0.72);
  cursor: pointer;
  padding: 0;
}

.photo-lightbox__content {
  position: relative;
  z-index: 1;
  background: var(--color-surface);
  border-radius: 8px;
  padding: 16px;
  max-width: min(90vw, 640px);
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.photo-lightbox__close {
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 16px;
}

.photo-lightbox__img {
  display: block;
  width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 4px;
}

.photo-lightbox__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.photo-lightbox__team {
  font-weight: 700;
  color: var(--color-text);
}

.photo-lightbox__task {
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
}

.photo-lightbox__download {
  display: block;
  text-align: center;
  padding: 10px 16px;
  border-radius: 6px;
  background: var(--color-accent);
  color: var(--color-background);
  font-weight: 600;
  text-decoration: none;
}
```

---

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/PhotoLightbox.test.ts`
Expected: PASS, all 5 tests.

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
git add src/components/PhotoLightbox.svelte src/components/PhotoLightbox.css src/test/PhotoLightbox.test.ts
git commit -m "feat: add PhotoLightbox modal with download action"
```
