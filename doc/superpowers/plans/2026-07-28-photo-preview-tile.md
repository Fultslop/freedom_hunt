# Photo Field Preview Tile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the photo form field's small pill-shaped upload button with a square preview tile — a gray photo-icon placeholder before upload, the actual (locally compressed) photo after — persisted in `localStorage` so it survives navigating away and back.

**Architecture:** A new isolated, mockable utility (`createPhotoPreview`) does client-side canvas resize/compression, independent of the network upload. `AppForm.svelte` runs both concurrently on file select and only keeps the generated preview if the server upload actually succeeds. The preview rides the *existing* `PhotoUploadStatus` → `onUploadsChange` → `ChallengeForm.persist()` → `saveFormState()` → `localStorage` pipeline unchanged — no new persistence plumbing.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte`, `lucide-svelte` icons, native Canvas 2D API (`createImageBitmap`, `HTMLCanvasElement`).

## Global Constraints

- TypeScript only; no `.js`/`.jsx`/`.tsx` under `src/`.
- Co-located `.css` files per component; only CSS custom properties (`var(--color-*)`) for colour — no hard-coded hex except where an existing file already does.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`) — no `$:`.
- Inline `style=` attributes only for truly dynamic values that can't be a static CSS rule (per `CLAUDE.md`) — state-dependent visuals here use `class:` bindings instead.
- Full spec: `doc/superpowers/specs/2026-07-28-photo-preview-tile-design.md`. Every task below implements a specific section of it — re-read the relevant section if a step is unclear.
- Do not invoke git commands (per `CLAUDE.md` — "the user will control Git"); each task's steps stop at "stage these files," the user commits.
- Never use Playwright/browser automation to verify changes (standing project preference) — the plan's final manual-check step is for the user, not something to automate.

---

### Task 1: `createPhotoPreview` compression utility

**Files:**
- Create: `src/utils/photoPreview.ts`
- Test: `src/test/photoPreview.test.ts`

**Interfaces:**
- Produces: `createPhotoPreview(file: File): Promise<string>` — resolves a `data:image/jpeg;base64,...` URL, a center-cropped square (200×200) JPEG at quality 0.6. Rejects if the browser can't decode the file or a 2D canvas context is unavailable. This is the only export later tasks depend on.

Real canvas pixel rendering isn't available in this project's test environment (`happy-dom`, no `canvas` npm package installed — verified: `canvas` only appears as jsdom's *optional* peer dependency, not an actual devDependency). So these tests mock the canvas 2D context and `createImageBitmap` directly and assert on the *calls made* (crop math, quality param) rather than real pixel output — this still catches the most likely real bug (wrong-axis or off-by-one crop math) without needing real rendering.

- [ ] **Step 1: Write the failing tests**

Create `src/test/photoPreview.test.ts`:

```ts
import { createPhotoPreview } from "../utils/photoPreview";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubCanvas() {
  const drawImage = vi.fn();
  const toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,FAKE");
  const fakeContext = { drawImage };
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(fakeContext),
    toDataURL,
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );
  return { drawImage, toDataURL };
}

test("center-crops a wider-than-tall image to a square using the shorter side", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 400, height: 300, close: vi.fn() }),
  );
  const { drawImage, toDataURL } = stubCanvas();

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const result = await createPhotoPreview(file);

  // 400x300 source: crop side = min(400,300) = 300, centered horizontally
  // (sx = (400-300)/2 = 50), no vertical offset (sy = 0), drawn to fill the
  // full 200x200 destination.
  expect(drawImage).toHaveBeenCalledWith(
    expect.objectContaining({ width: 400, height: 300 }),
    50, 0, 300, 300,
    0, 0, 200, 200,
  );
  expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.6);
  expect(result).toBe("data:image/jpeg;base64,FAKE");
});

test("center-crops a taller-than-wide image using the shorter side", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 300, height: 500, close: vi.fn() }),
  );
  const { drawImage } = stubCanvas();

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await createPhotoPreview(file);

  // 300x500 source: crop side = min(300,500) = 300, no horizontal offset
  // (sx = 0), centered vertically (sy = (500-300)/2 = 100).
  expect(drawImage).toHaveBeenCalledWith(
    expect.objectContaining({ width: 300, height: 500 }),
    0, 100, 300, 300,
    0, 0, 200, 200,
  );
});

test("rejects when a 2D canvas context is unavailable", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 100, height: 100, close: vi.fn() }),
  );
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(null),
    toDataURL: vi.fn(),
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await expect(createPhotoPreview(file)).rejects.toThrow(
    "2D canvas context unavailable",
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/photoPreview.test.ts`
Expected: FAIL — `Cannot find module '../utils/photoPreview'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/utils/photoPreview.ts`:

```ts
const PREVIEW_SIZE = 200;
const PREVIEW_QUALITY = 0.6;

export async function createPhotoPreview(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const cropX = (bitmap.width - side) / 2;
  const cropY = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }
  ctx.drawImage(bitmap, cropX, cropY, side, side, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", PREVIEW_QUALITY);
}
```

Note: `id-length` in this repo's ESLint config (`eslint.config.js:107,135`) enforces `min: 3` with a short exceptions list that does not include 2-letter names like `sx`/`sy` — hence `cropX`/`cropY` here instead of the more conventional canvas-API shorthand.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/photoPreview.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings from both.

- [ ] **Step 6: Stage for commit**

```bash
git add src/utils/photoPreview.ts src/test/photoPreview.test.ts
```

Do not commit yet — the user commits (per `CLAUDE.md`). Report the staged files and move to Task 2.

---

### Task 2: Thread `previewDataUrl` through upload state and persistence

**Files:**
- Modify: `src/types/data.ts:112-115` (`PhotoUploadStatus`)
- Modify: `src/components/AppForm.svelte:144-152` (`onUploadsChange` settled-object effect), `:190-206` (`handleFileChange`)
- Modify: `src/test/AppForm.test.ts` (top-of-file mocks block, plus new tests)

**Interfaces:**
- Consumes: `createPhotoPreview(file: File): Promise<string>` from Task 1.
- Produces: `PhotoUploadStatus` now has an optional `previewDataUrl?: string`. `handleFileChange` includes it in `uploadStates[fieldId]` on success (discarded on failure). This flows unchanged through the existing `onUploadsChange` effect ([AppForm.svelte:131-139](../../../src/components/AppForm.svelte#L131-L139)) that later tasks and `ChallengeForm.svelte` already consume — no signature changes needed there.

This task deliberately does **not** touch the template/CSS yet — `previewDataUrl` is verified via the `onUploadsChange` callback (the same pattern the existing "onUploadsChange reports only settled upload statuses" test already uses), not by inspecting rendered `<img>` tags. The visual tile is Task 3.

- [ ] **Step 1: Write the failing tests**

In `src/test/AppForm.test.ts`, add this mock near the existing `vi.mock("../actions/leafletMap", ...)` block (top of file, alongside the other module mocks) — importing the mocked function itself (not just the type), matching the existing `leafletMap` import pattern right above it, so later tests can override its resolved value per-test via `vi.mocked(createPhotoPreview)`:

```ts
import { createPhotoPreview } from "../utils/photoPreview";

vi.mock("../utils/photoPreview", () => ({
  createPhotoPreview: vi.fn().mockResolvedValue("data:image/jpeg;base64,MOCKPREVIEW"),
}));
```

Then add these two tests in the "onStatusChange and onUploadsChange" section (near the existing `"onUploadsChange reports only settled upload statuses..."` test):

```ts
test("onUploadsChange includes previewDataUrl after a successful upload", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const onUploadsChange = vi.fn();
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload, onUploadsChange },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(onUploadsChange).toHaveBeenLastCalledWith({
      pic: {
        status: "success",
        httpCode: 200,
        previewDataUrl: "data:image/jpeg;base64,MOCKPREVIEW",
      },
    });
  });
});

test("onUploadsChange omits previewDataUrl when the upload fails, even though preview generation succeeded", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: false, httpCode: 500 });
  const onUploadsChange = vi.fn();
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload, onUploadsChange },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(onUploadsChange).toHaveBeenLastCalledWith({
      pic: { status: "error", httpCode: 500 },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts -t "previewDataUrl"`
Expected: FAIL — `onUploadsChange` payload has no `previewDataUrl` key yet (type doesn't have the field, `handleFileChange` doesn't set it).

- [ ] **Step 3: Add the field to the type**

In `src/types/data.ts`, change:

```ts
export interface PhotoUploadStatus {
  status: "success" | "error";
  httpCode: number;
}
```

to:

```ts
export interface PhotoUploadStatus {
  status: "success" | "error";
  httpCode: number;
  previewDataUrl?: string;
}
```

- [ ] **Step 4: Forward `previewDataUrl` through the settled-object effect**

The `onUploadsChange` effect ([AppForm.svelte:144-152](../../../src/components/AppForm.svelte#L144-L152)) currently rebuilds each entry as exactly `{ status, httpCode }`, which would silently drop `previewDataUrl` even after the next step adds it to `uploadStates`. Change:

```ts
  $effect(() => {
    const settled: Record<string, PhotoUploadStatus> = {};
    for (const [id, state] of Object.entries(uploadStates)) {
      if (state.status === "success" || state.status === "error") {
        settled[id] = { status: state.status, httpCode: state.httpCode ?? 0 };
      }
    }
    onUploadsChange?.(settled);
  });
```

to:

```ts
  $effect(() => {
    const settled: Record<string, PhotoUploadStatus> = {};
    for (const [id, state] of Object.entries(uploadStates)) {
      if (state.status === "success") {
        settled[id] = {
          status: "success",
          httpCode: state.httpCode ?? 0,
          previewDataUrl: state.previewDataUrl,
        };
      } else if (state.status === "error") {
        settled[id] = { status: "error", httpCode: state.httpCode ?? 0 };
      }
    }
    onUploadsChange?.(settled);
  });
```

(Split into two branches, rather than one shared object spread, so the `error` case never carries a stray `previewDataUrl: undefined` key — matching the exact-match test assertions in Step 1, which check the settled object has no `previewDataUrl` key at all on failure, not just an undefined one.)

- [ ] **Step 5: Wire preview generation into `handleFileChange`**

In `src/components/AppForm.svelte`, add the import (near the other utils imports):

```ts
import { createPhotoPreview } from "../utils/photoPreview";
```

Replace `handleFileChange` ([AppForm.svelte:190-206](../../../src/components/AppForm.svelte#L190-L206)):

```ts
async function handleFileChange(evt: Event, fieldId: string) {
  if (onPhotoUpload) {
    const file = (evt.target as HTMLInputElement).files?.[0];
    if (file) {
      uploadStates = { ...uploadStates, [fieldId]: { status: "uploading" } };
      const [uploadResult, previewResult] = await Promise.allSettled([
        onPhotoUpload(file),
        createPhotoPreview(file),
      ]);
      const upload =
        uploadResult.status === "fulfilled" ? uploadResult.value : { ok: false, httpCode: 0 };
      const previewDataUrl =
        previewResult.status === "fulfilled" ? previewResult.value : undefined;
      uploadStates = {
        ...uploadStates,
        [fieldId]: upload.ok
          ? { status: "success", httpCode: upload.httpCode, previewDataUrl }
          : { status: "error", httpCode: upload.httpCode ?? 0 },
      };
    }
  }
}
```

This changes the failure path slightly from the original (`catch { ... httpCode: 0 }`): `Promise.allSettled` never throws, so a rejected `onPhotoUpload` now falls into the `upload = { ok: false, httpCode: 0 }` fallback — same observable behavior as the old try/catch, just expressed through `allSettled` instead of `try`/`catch`, which is necessary so a `createPhotoPreview` rejection can't accidentally fail the whole thing and skip recording the upload's own result.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: all tests in the file pass (this includes the two new ones plus every pre-existing photo test — none of them assert on `previewDataUrl`, so they're unaffected by this step; Task 3 is what touches the tests that assert on the button's visible/accessible name).

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 8: Stage for commit**

```bash
git add src/types/data.ts src/components/AppForm.svelte src/test/AppForm.test.ts
```

---

### Task 3: Replace the button with the preview tile (visual states + accessibility)

**Files:**
- Modify: `src/components/AppForm.svelte:1-9` (imports), `:358-384` (template photo branch)
- Modify: `src/components/AppForm.css:121-154` (photo styles)
- Modify: `src/test/AppForm.test.ts` (4 assertions that check the old `/photo uploaded/i` accessible name, plus new tile-state tests)

**Interfaces:**
- Consumes: `upload?.status` (`"uploading" | "success" | "error" | undefined`) and `upload?.previewDataUrl` from Task 2's `uploadStates`.
- Produces: no new exports — this is the leaf UI task. `getByRole("button", { name: ... })` queries continue to work against the button's `aria-label`, which is now: `` `Take a photo — ${field.label}` `` (idle/error), `` `Uploading photo — ${field.label}` `` (uploading), `` `Retake photo — ${field.label}` `` (success).

- [ ] **Step 1: Write the failing tests**

In `src/test/AppForm.test.ts`, update the 4 existing assertions that check for the old `/photo uploaded/i` accessible name to match the new `/retake photo/i` label:

At line 602 (`"required photo field blocks submit until a successful upload"`), change:
```ts
  expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
```
to:
```ts
  expect(screen.getByRole("button", { name: /retake photo/i })).toBeInTheDocument();
```

At lines 667 and 673 (`"two photo fields track upload state independently"`), change both:
```ts
  expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
```
to:
```ts
  expect(screen.getByRole("button", { name: /retake photo/i })).toBeInTheDocument();
```

At line 736 (`"does not auto-submit when the form has a required field besides the photo"`), change:
```ts
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
  });
```
to:
```ts
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /retake photo/i })).toBeInTheDocument();
  });
```

Then add these new tests in the "Photo field — required validation and per-field state" section:

```ts
test("idle photo field shows the placeholder tile, not an image", () => {
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onPhotoUpload: vi.fn() } });
  expect(screen.getByRole("button", { name: /take a photo/i })).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("shows the compressed preview image after a successful upload", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  const img = await screen.findByRole("img", { name: "Take a photo" });
  expect(img).toHaveAttribute("src", "data:image/jpeg;base64,MOCKPREVIEW");
});

test("reverts to the placeholder tile (no image) after a failed upload", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: false, httpCode: 500 });
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Upload failed. Try again.")).toBeInTheDocument();
  });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /take a photo/i })).toBeInTheDocument();
});

test("shows a checkmark fallback when the upload succeeds but preview generation failed", async () => {
  vi.mocked(createPhotoPreview).mockRejectedValueOnce(new Error("decode failed"));
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /retake photo/i })).toBeInTheDocument();
  });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: FAIL — the button still renders the old visible-text states (`aria-label` doesn't exist yet, no `<img>` in the success case).

- [ ] **Step 3: Update the imports**

In `src/components/AppForm.svelte`, replace line 3:
```ts
  import { Camera } from "lucide-svelte";
```
with:
```ts
  import { Image, Check } from "lucide-svelte";
```

(`Camera` was only used by the button markup this task replaces — confirmed via grep, no other usage in the file.)

- [ ] **Step 4: Replace the template's photo branch**

Replace the `{#if field.type === "photo"}` block ([AppForm.svelte:358-384](../../../src/components/AppForm.svelte#L358-L384)):

```svelte
        {#if field.type === "photo"}
          {@const upload = uploadStates[id]}
          <div class="af-photo-wrap">
            <button
              class="af-photo-tile"
              class:af-photo-tile--uploading={upload?.status === "uploading"}
              aria-label={upload?.status === "success"
                ? `Retake photo — ${field.label}`
                : upload?.status === "uploading"
                  ? `Uploading photo — ${field.label}`
                  : `Take a photo — ${field.label}`}
              onclick={() => (document.getElementById(domId) as HTMLInputElement | null)?.click()}
              disabled={upload?.status === "uploading"}
            >
              {#if upload?.status === "success" && upload.previewDataUrl}
                <img src={upload.previewDataUrl} alt={field.label} class="af-photo-tile__img" />
              {:else if upload?.status === "success"}
                <Check size={32} aria-hidden="true" />
              {:else}
                <Image size={32} aria-hidden="true" />
              {/if}
              {#if upload?.status === "uploading"}
                <span class="af-photo-tile__spinner" aria-hidden="true"></span>
              {/if}
            </button>
            {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
            <input
              id={domId}
              type="file"
              accept="image/*"
              capture="environment"
              class="af-photo-input"
              onchange={(evt) => handleFileChange(evt, id)}
            />
            {#if upload?.status === "error"}
              <p class="af-photo-error">Upload failed. Try again.</p>
            {/if}
          </div>
        {:else if field.type === "boolean"}
```

(Only the opening `{#if field.type === "photo"}` through the closing `</div>` changes — the `{:else if field.type === "boolean"}` line right after it is unchanged and shown here only to mark where the replacement ends.)

- [ ] **Step 5: Replace the CSS**

In `src/components/AppForm.css`, replace the photo-related rules ([AppForm.css:121-154](../../../src/components/AppForm.css#L121-L154), i.e. from `.af-photo-wrap` through `.af-photo-error`):

```css
.af-photo-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.af-photo-tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112px;
  height: 112px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  overflow: hidden;
}

.af-photo-tile--uploading {
  opacity: 0.6;
}

.af-photo-tile:disabled {
  cursor: not-allowed;
}

.af-photo-tile__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.af-photo-tile__spinner {
  position: absolute;
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-text-muted);
  border-radius: 50%;
  animation: af-spin 0.8s linear infinite;
}

@keyframes af-spin {
  to {
    transform: rotate(360deg);
  }
}

.af-photo-input {
  display: none;
}

.af-photo-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: all tests pass.

- [ ] **Step 7: Run the full suite, typecheck, and lint**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass, 0 errors, 0 warnings. (This also re-checks `ChallengeForm.test.ts`'s `"photo field uses label as button text"` test, which queries `getByRole("button", { name: /take a photo/i })` — that continues to pass unchanged, since it's checking the accessible name, not visible text, and the idle-state `aria-label` still starts with "Take a photo".)

- [ ] **Step 8: Stage for commit**

```bash
git add src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
```

---

### Task 4: Manual verification and devlog

**Files:**
- Modify: `doc/devlog/_devlog.md`

No new automated steps here — this closes out the feature per `CLAUDE.md`'s "Session End" rule ("Always update the devlog as the last step of every session") and flags the one thing the automated suite can't verify (per the spec's Testing section: real canvas resize/compression output).

- [ ] **Step 1: Prompt the user for a manual check**

Tell the user to run `npm run dev`, open a location with a photo field (e.g. Nieuwe Kerk), upload a real photo, and confirm:
- The tile shows the gray placeholder icon before upload, a dimmed placeholder + spinner while uploading, and the actual photo after.
- Swiping to an adjacent card and back still shows the photo (no re-fetch).
- Opening browser devtools → Application → Local Storage and inspecting the `.../form` key for that location shows a `previewDataUrl` value roughly 5-15KB long (a rough proxy for base64 length — exact byte count isn't critical, just confirming it's a small thumbnail, not a full-resolution photo).

Do not attempt this verification yourself via Playwright or any browser automation — per standing project preference, this is the user's manual check.

- [ ] **Step 2: Add the devlog entry**

Prepend to `doc/devlog/_devlog.md`:

```markdown
**DD/MM/YYYY, Claude**: [FEATURE] Photo field preview tile.
- Replaced the small pill-shaped photo upload button with a 112px square tile: gray placeholder icon when empty, dimmed placeholder + spinner while uploading, the actual compressed photo once uploaded.
- Added `src/utils/photoPreview.ts` (`createPhotoPreview`) — client-side canvas resize/compress to a 200x200 center-cropped JPEG (quality 0.6), independent of the server-side upload/variant pipeline.
- The preview rides the existing `PhotoUploadStatus` → `onUploadsChange` → `ChallengeForm.persist()` → `localStorage` pipeline unchanged, which is what makes it survive swiping to an adjacent card and back (RoutePage's carousel keeps 3 cards mounted, each an independent `ChallengeForm`).
- A failed upload discards the generated preview and reverts to the placeholder, even if preview generation itself succeeded.
- Spec: `doc/superpowers/specs/2026-07-28-photo-preview-tile-design.md`.
```

(Use today's actual date in place of `DD/MM/YYYY`.)

- [ ] **Step 3: Stage for commit**

```bash
git add doc/devlog/_devlog.md
```

Report to the user that all four tasks' changes are staged (not committed, per `CLAUDE.md`) and ready for their review.
