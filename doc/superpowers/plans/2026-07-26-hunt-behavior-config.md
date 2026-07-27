# Hunt Behavior Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four project-level config flags (`store_forms_in_local_storage`, `form_required`, `can_forms_skip`, `allow_resubmit`) that drive form persistence, Next-button gating, a skip toast, and resubmission behavior during a hunt, plus a per-location completion badge.

**Architecture:** A new `huntSettings.ts` util reads the four flags (with defaults) from the existing free-form `<projectId>.yaml`. A new `formStorage.ts` util persists per-location form state (values, photo upload outcomes, submitted/skipped flags) to `localStorage`. `AppForm` gains per-field photo upload tracking (fixing an existing shared-state bug), required-photo validation, and two new reporting callbacks. `ChallengeForm` wires those into local storage and resubmit behavior. `ChallengeCard` renders a completion/skipped badge and wraps `ChallengeForm` in a `{#key}` block so recycled carousel slots reset correctly per location. `RoutePage` loads the settings, gates the Next button/swipe with a "soft-disabled" style (never a hard `disabled` attribute, so a Skip action stays reachable), and shows a toast on a blocked attempt.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + @testing-library/svelte, lucide-svelte icons, localStorage.

## Global Constraints

- TypeScript only; no `.js`/`.jsx`/`.tsx` files added.
- All new component styling goes in co-located `.css` files using `var(--color-*)` tokens — no inline styles for static colors, no Tailwind, no CSS modules.
- New components use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) — no `$:` reactive statements.
- Follow BEM-like class names (`component-name__element--modifier`) for new CSS.
- Backend (`form_submissions` table / Google Sheet forwarding) is explicitly out of scope — resubmission appending duplicate rows is an accepted limitation, not fixed here.
- Never give the Next button a hard `disabled` attribute when blocked — it must stay clickable so the toast (and Skip option) are reachable.
- Reference spec: `doc/superpowers/specs/2026-07-26-hunt-behavior-config-design.md`.

---

## Task 1: `HuntSettings` type and `getHuntSettings()`

**Files:**
- Modify: `src/types/data.ts`
- Create: `src/utils/huntSettings.ts`
- Test: `src/test/huntSettings.test.ts`

**Interfaces:**
- Produces: `HuntSettings` type (`src/types/data.ts`), `getHuntSettings(meta: ProjectMeta | null): HuntSettings` (`src/utils/huntSettings.ts`) — consumed by Task 8 (`RoutePage`).

- [x] **Step 1: Write the failing test**

Create `src/test/huntSettings.test.ts`:

```ts
import { getHuntSettings } from "../utils/huntSettings";

test("defaults to store_forms_in_local_storage and allow_resubmit true, others false, when meta is null", () => {
  expect(getHuntSettings(null)).toEqual({
    storeFormsInLocalStorage: true,
    formRequired: false,
    canFormsSkip: false,
    allowResubmit: true,
  });
});

test("defaults to the same values when meta is an empty object", () => {
  expect(getHuntSettings({})).toEqual({
    storeFormsInLocalStorage: true,
    formRequired: false,
    canFormsSkip: false,
    allowResubmit: true,
  });
});

test("honors explicit true/false overrides", () => {
  expect(
    getHuntSettings({
      "project.store_forms_in_local_storage": false,
      "project.form_required": true,
      "project.can_forms_skip": true,
      "project.allow_resubmit": false,
    }),
  ).toEqual({
    storeFormsInLocalStorage: false,
    formRequired: true,
    canFormsSkip: true,
    allowResubmit: false,
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/huntSettings.test.ts`
Expected: FAIL — `Failed to resolve import "../utils/huntSettings"`.

- [x] **Step 3: Add the `HuntSettings` type**

In `src/types/data.ts`, add after the `ProjectMeta` type (end of file):

```ts
export interface HuntSettings {
  storeFormsInLocalStorage: boolean;
  formRequired: boolean;
  canFormsSkip: boolean;
  allowResubmit: boolean;
}
```

- [x] **Step 4: Implement `getHuntSettings`**

Create `src/utils/huntSettings.ts`:

```ts
import type { HuntSettings, ProjectMeta } from "../types/data";

export function getHuntSettings(meta: ProjectMeta | null): HuntSettings {
  return {
    storeFormsInLocalStorage: meta?.["project.store_forms_in_local_storage"] !== false,
    formRequired: meta?.["project.form_required"] === true,
    canFormsSkip: meta?.["project.can_forms_skip"] === true,
    allowResubmit: meta?.["project.allow_resubmit"] !== false,
  };
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/huntSettings.test.ts`
Expected: PASS (3 tests)

- [x] **Step 6: Commit**

```bash
git add src/types/data.ts src/utils/huntSettings.ts src/test/huntSettings.test.ts
git commit -m "feat: add HuntSettings type and getHuntSettings() defaults"
```

---

## Task 2: `FormState`/`PhotoUploadStatus` types and `formStorage.ts`

**Files:**
- Modify: `src/types/data.ts`
- Create: `src/utils/formStorage.ts`
- Test: `src/test/formStorage.test.ts`

**Interfaces:**
- Produces: `PhotoUploadStatus`, `FormState` types (`src/types/data.ts`); `buildFormStorageKey(project: string, city: string, route: string | undefined, locationId: number): string`, `loadFormState(key: string): FormState`, `saveFormState(key: string, state: FormState): void` (`src/utils/formStorage.ts`) — consumed by Task 3 (AppForm's upload types), Task 6 (`ChallengeForm`), Task 8 (`RoutePage`).

- [x] **Step 1: Write the failing test**

Create `src/test/formStorage.test.ts`:

```ts
import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";

beforeEach(() => {
  localStorage.clear();
});

test("buildFormStorageKey composes project/city/route/locationId", () => {
  expect(buildFormStorageKey("demo", "den_haag", "short_loop", 3)).toBe(
    "demo/den_haag/short_loop/3/form",
  );
});

test("buildFormStorageKey handles an undefined route", () => {
  expect(buildFormStorageKey("demo", "den_haag", undefined, 3)).toBe(
    "demo/den_haag//3/form",
  );
});

test("loadFormState returns empty defaults when nothing is stored", () => {
  expect(loadFormState("missing-key")).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});

test("saveFormState then loadFormState round-trips the exact state", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", 1);
  const state = {
    values: { note: "hello" },
    uploads: { pic: { status: "success" as const, httpCode: 200 } },
    submitted: true,
    skipped: false,
  };
  saveFormState(key, state);
  expect(loadFormState(key)).toEqual(state);
});

test("loadFormState falls back to defaults on malformed JSON", () => {
  const key = "corrupt-key";
  localStorage.setItem(key, "{not json");
  expect(loadFormState(key)).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/formStorage.test.ts`
Expected: FAIL — `Failed to resolve import "../utils/formStorage"`.

- [x] **Step 3: Add `PhotoUploadStatus` and `FormState` types**

In `src/types/data.ts`, add after `HuntSettings` (from Task 1):

```ts
export interface PhotoUploadStatus {
  status: "success" | "error";
  httpCode: number;
}

export interface FormState {
  values: Record<string, unknown>;
  uploads: Record<string, PhotoUploadStatus>;
  submitted: boolean;
  skipped: boolean;
}
```

- [x] **Step 4: Implement `formStorage.ts`**

Create `src/utils/formStorage.ts`:

```ts
import type { FormState } from "../types/data";

export function buildFormStorageKey(
  project: string,
  city: string,
  route: string | undefined,
  locationId: number,
): string {
  return `${project}/${city}/${route ?? ""}/${locationId}/form`;
}

const EMPTY_STATE: FormState = {
  values: {},
  uploads: {},
  submitted: false,
  skipped: false,
};

export function loadFormState(key: string): FormState {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return { ...EMPTY_STATE, values: {}, uploads: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FormState>;
    return {
      values: parsed.values ?? {},
      uploads: parsed.uploads ?? {},
      submitted: parsed.submitted ?? false,
      skipped: parsed.skipped ?? false,
    };
  } catch {
    return { ...EMPTY_STATE, values: {}, uploads: {} };
  }
}

export function saveFormState(key: string, state: FormState): void {
  localStorage.setItem(key, JSON.stringify(state));
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/formStorage.test.ts`
Expected: PASS (5 tests)

- [x] **Step 6: Commit**

```bash
git add src/types/data.ts src/utils/formStorage.ts src/test/formStorage.test.ts
git commit -m "feat: add FormState/PhotoUploadStatus types and formStorage persistence utils"
```

---

## Task 3: AppForm — per-field photo upload state, required-photo validation

This fixes an existing bug: `AppForm` currently tracks photo upload state (`uploadState`, `fileInput`) as a *single shared pair for the whole form*, so a form with two photo fields has one upload indicator shared between them. It also currently exempts `photo` fields from required-field validation entirely (`canSkipValidation` includes `STR_PHOTO`), so a required photo can be left empty with no error — this task fixes both, which `form_required` gating (Task 8) depends on.

**Files:**
- Modify: `src/utils/api.ts:36-49` (`postPhotoUpload`)
- Modify: `src/test/api.test.ts`
- Modify: `src/components/AppForm.svelte`
- Modify: `src/test/AppForm.test.ts`

**Interfaces:**
- Consumes: `PhotoUploadStatus` type (Task 2).
- Produces: `postPhotoUpload()` now resolves `{ ok, id?, key?, httpCode }`; `AppForm` gains `initialUploads?: Record<string, PhotoUploadStatus>` and `baseUploads?: Record<string, PhotoUploadStatus>` props, and its `onPhotoUpload` prop type widens to `(file: File) => Promise<{ ok: boolean; httpCode?: number }>`. Consumed by Task 6 (`ChallengeForm`).

- [x] **Step 1: Write the failing tests**

In `src/test/api.test.ts`, update the shared `mockFetch` helper to accept a status code, and update the existing `postPhotoUpload` test:

```ts
function mockFetch(response: unknown, status = 200) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    json: async () => response,
    status,
  } as Response);
}
```

Replace the existing `"postPhotoUpload POSTs to /upload with FormData"` test body with:

```ts
test("postPhotoUpload POSTs to /upload with FormData", async () => {
  mockFetch({ ok: true, id: "photo-1", key: "1_123" }, 200);
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
  expect(result).toEqual({ ok: true, id: "photo-1", key: "1_123", httpCode: 200 });
});
```

In `src/test/AppForm.test.ts`, add:

```ts
test("required photo field blocks submit until a successful upload", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo", isRequired: true },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit, onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
  });
  expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
});

test("required photo field: failed upload keeps Required validation blocking submit", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: false, httpCode: 500 });
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo", isRequired: true },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit, onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Upload failed. Try again.")).toBeInTheDocument();
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(onSubmit).not.toHaveBeenCalled();
});

test("two photo fields track upload state independently", async () => {
  const onPhotoUpload = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, httpCode: 200 })
    .mockResolvedValueOnce({ ok: false, httpCode: 500 });
  const fields: FormField[] = [
    { id: "pic1", type: "photo", label: "Photo one" },
    { id: "pic2", type: "photo", label: "Photo two" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const inputs = container.querySelectorAll(".af-photo-input");
  await fireEvent.change(inputs[0], { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
  });
  await fireEvent.change(inputs[1], { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Upload failed. Try again.")).toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/api.test.ts src/test/AppForm.test.ts`
Expected: FAIL — `api.test.ts` expects `httpCode` which isn't returned yet; `AppForm.test.ts` new tests fail because required photo fields aren't validated and there's no per-field upload state.

- [x] **Step 3: Add `httpCode` to `postPhotoUpload`**

In `src/utils/api.ts`, replace:

```ts
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

with:

```ts
export async function postPhotoUpload(
  payload: PhotoUploadPayload,
): Promise<{ ok: boolean; id?: string; key?: string; httpCode: number }> {
  const body = new FormData();
  body.append("photo", payload.file);
  body.append("locationId", String(payload.locationId));
  body.append("cityId", payload.cityId);
  if (payload.routeId) {
    body.append("routeId", payload.routeId);
  }
  body.append("taskTitle", payload.taskTitle);
  const res = await fetch("/upload", { method: "POST", body });
  const data = (await res.json()) as { ok: boolean; id?: string; key?: string };
  return { ...data, httpCode: res.status };
}
```

- [x] **Step 4: Update `AppForm.svelte` imports and types**

Change the type import line:

```ts
import type { FormField, FormFieldType } from "../types/data";
```

to:

```ts
import type { FormField, FormFieldType, PhotoUploadStatus } from "../types/data";
```

Add a `PhotoFieldState` type next to the existing type aliases (`SubmitState`, `UploadState`, `FieldValues`):

```ts
type SubmitState = "idle" | "submitting" | "error";
type UploadState = "idle" | "uploading" | "success" | "error";
type FieldValues = Record<string, string | number | boolean | string[] | { latitude: number; longitude: number }>;
interface PhotoFieldState {
  status: UploadState;
  httpCode?: number;
}
```

- [x] **Step 5: Add `initialUploads`/`baseUploads` props**

Update the props destructure and type block to add `initialUploads`/`baseUploads`, and widen `onPhotoUpload`:

```ts
  let {
    fields,
    initialValues = {},
    baseValues = undefined,
    initialUploads = {},
    baseUploads = undefined,
    onSubmit,
    onPhotoUpload = undefined,
    onSuccess = undefined,
    onValuesChange = undefined,
    onHasChangesChange = undefined,
    submitLabel = "Submit",
    confirmMessage = undefined,
  }: {
    fields: FormField[];
    initialValues?: Record<string, unknown>;
    baseValues?: Record<string, unknown>;
    initialUploads?: Record<string, PhotoUploadStatus>;
    baseUploads?: Record<string, PhotoUploadStatus>;
    onSubmit: (values: Record<string, unknown>) => Promise<void>;
    onPhotoUpload?: (file: File) => Promise<{ ok: boolean; httpCode?: number }>;
    onSuccess?: () => void;
    onValuesChange?: (values: FieldValues) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    submitLabel?: string;
    confirmMessage?: string;
  } = $props();
```

- [x] **Step 6: Replace the state block with per-field `uploadStates`**

Replace this block:

```ts
  let values = $state<FieldValues>(untrack(() => ({ ...(initialValues as FieldValues) })));
  const hasChanges = $derived(
    fields
      .filter((f) => f.id && f.type !== STR_SECTION)
      .some((f) => {
        const id = f.id!;
        const curr = values[id];
        const baseline = baseValues
          ? (baseValues as Record<string, unknown>)[id]
          : (initialValues as Record<string, unknown>)[id];
        if (Array.isArray(curr) || Array.isArray(baseline)) {
          return JSON.stringify(curr ?? []) !== JSON.stringify(baseline ?? []);
        } else if (typeof curr === "object" || typeof baseline === "object") {
          return JSON.stringify(curr ?? {}) !== JSON.stringify(baseline ?? {});
        }
        return curr !== baseline;
      }),
  );

  $effect(() => {
    onValuesChange?.({ ...values });
  });
  $effect(() => {
    onHasChangesChange?.(hasChanges);
  });
  let errors = $state<Record<string, string>>({});
  let submitState = $state<SubmitState>("idle");
  let uploadState = $state<UploadState>("idle");
  let showConfirm = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();
  let maxWarningKeys = $state<Record<string, number>>({});
  const availableImages: ImageEntry[] = getAvailableImages();
  let imagePickerOpenId = $state<string | null>(null);
  let imagePickerTrigger: HTMLButtonElement | undefined;
```

with:

```ts
  let values = $state<FieldValues>(untrack(() => ({ ...(initialValues as FieldValues) })));
  let uploadStates = $state<Record<string, PhotoFieldState>>(
    untrack(() => {
      const result: Record<string, PhotoFieldState> = {};
      for (const [id, upload] of Object.entries(initialUploads)) {
        result[id] = { status: upload.status, httpCode: upload.httpCode };
      }
      return result;
    }),
  );
  const hasChanges = $derived(
    fields
      .filter((f) => f.id && f.type !== STR_SECTION)
      .some((f) => {
        const id = f.id!;
        if (f.type === STR_PHOTO) {
          const currentStatus = uploadStates[id]?.status;
          const baselineStatus = (baseUploads ?? initialUploads)[id]?.status;
          return currentStatus !== undefined && currentStatus !== baselineStatus;
        }
        const curr = values[id];
        const baseline = baseValues
          ? (baseValues as Record<string, unknown>)[id]
          : (initialValues as Record<string, unknown>)[id];
        if (Array.isArray(curr) || Array.isArray(baseline)) {
          return JSON.stringify(curr ?? []) !== JSON.stringify(baseline ?? []);
        } else if (typeof curr === "object" || typeof baseline === "object") {
          return JSON.stringify(curr ?? {}) !== JSON.stringify(baseline ?? {});
        }
        return curr !== baseline;
      }),
  );

  $effect(() => {
    onValuesChange?.({ ...values });
  });
  $effect(() => {
    onHasChangesChange?.(hasChanges);
  });
  let errors = $state<Record<string, string>>({});
  let submitState = $state<SubmitState>("idle");
  let showConfirm = $state(false);
  let maxWarningKeys = $state<Record<string, number>>({});
  const availableImages: ImageEntry[] = getAvailableImages();
  let imagePickerOpenId = $state<string | null>(null);
  let imagePickerTrigger: HTMLButtonElement | undefined;
```

Note the shared `uploadState`/`fileInput` variables are gone — `fileInput` is replaced by `document.getElementById(id)` in Step 8, since each photo `<input>` already renders with its own `{id}` attribute.

Why `hasChanges` needs a photo branch: photo fields never write into `values` at all (they only ever wrote to the old shared `uploadState`), so without this, a form containing only a photo field could never leave the "No changes" disabled state — this was a latent gap that required-photo validation would otherwise make unreachable to submit.

- [x] **Step 7: Fix `canSkipValidation` and add photo validation**

Replace:

```ts
  function canSkipValidation(field: FormField): boolean {
    return (
      
      field.type === STR_SECTION ||
      field.type === STR_BOOLEAN ||
      field.type === STR_PHOTO
    );
  }
```

with:

```ts
  function canSkipValidation(field: FormField): boolean {
    return field.type === STR_SECTION || field.type === STR_BOOLEAN;
  }
```

In `validateValues`, add a branch for `STR_PHOTO` (insert after the `STR_MULTIPLE` branch, before `STR_IMAGE_PICKER`):

```ts
      } else if (field.type === STR_MULTIPLE) {
        const selected = (values[field.id] as string[]) ?? [];
        const min = field.min ?? 1;
        if (selected.length < min) {
          errs[field.id] = MSG_SELECT_MIN(min);
        }
      } else if (field.type === STR_PHOTO) {
        if (uploadStates[field.id]?.status !== "success") {
          errs[field.id] = MSG_REQUIRED;
        }
      } else if (field.type === STR_IMAGE_PICKER) {
```

- [x] **Step 8: Rewrite `handleFileChange` and the photo field template block**

Replace:

```ts
  async function handleFileChange(evt: Event) {
    if (onPhotoUpload) {
      const file = (evt.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadState = "uploading";
        try {
          const data = await onPhotoUpload(file);
          uploadState = data.ok ? "success" : "error";
        } catch {
          uploadState = "error";
        }
      }
    }
  }
```

with:

```ts
  async function handleFileChange(evt: Event, fieldId: string) {
    if (onPhotoUpload) {
      const file = (evt.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadStates = { ...uploadStates, [fieldId]: { status: "uploading" } };
        try {
          const data = await onPhotoUpload(file);
          uploadStates = {
            ...uploadStates,
            [fieldId]: { status: data.ok ? "success" : "error", httpCode: data.httpCode },
          };
        } catch {
          uploadStates = { ...uploadStates, [fieldId]: { status: "error", httpCode: 0 } };
        }
      }
    }
  }
```

In the template, replace the `{#if field.type === "photo"}` block:

```svelte
        {#if field.type === "photo"}
          <div class="af-photo-wrap">
            <button
              class="af-photo-btn"
              onclick={() => fileInput?.click()}
              disabled={uploadState === "uploading"}
            >
              <Camera size={16} aria-hidden="true" />
              {uploadState === "success"
                ? "Photo uploaded ✓"
                : uploadState === "uploading"
                  ? "Uploading…"
                  : field.label}
            </button>
            <input
              {id}
              type="file"
              accept="image/*"
              capture="environment"
              class="af-photo-input"
              bind:this={fileInput}
              onchange={handleFileChange}
            />
            {#if uploadState === "error"}
              <p class="af-photo-error">Upload failed. Try again.</p>
            {/if}
          </div>
```

with:

```svelte
        {#if field.type === "photo"}
          {@const upload = uploadStates[id]}
          <div class="af-photo-wrap">
            <button
              class="af-photo-btn"
              onclick={() => (document.getElementById(id) as HTMLInputElement | null)?.click()}
              disabled={upload?.status === "uploading"}
            >
              <Camera size={16} aria-hidden="true" />
              {upload?.status === "success"
                ? "Photo uploaded ✓"
                : upload?.status === "uploading"
                  ? "Uploading…"
                  : field.label}
            </button>
            <input
              {id}
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
```

- [x] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/test/api.test.ts src/test/AppForm.test.ts`
Expected: PASS (all existing AppForm tests still pass, plus the 3 new tests; api.test.ts passes with `httpCode`)

- [x] **Step 10: Commit**

```bash
git add src/utils/api.ts src/test/api.test.ts src/components/AppForm.svelte src/test/AppForm.test.ts
git commit -m "fix: per-field photo upload state in AppForm and required-photo validation"
```

---

## Task 4: AppForm — `onStatusChange` and `onUploadsChange` callbacks

**Files:**
- Modify: `src/components/AppForm.svelte`
- Modify: `src/test/AppForm.test.ts`

**Interfaces:**
- Consumes: `PhotoUploadStatus` (Task 2).
- Produces: `FormValidationStatus` type (`src/types/data.ts`); `AppForm` props `onStatusChange?: (status: FormValidationStatus) => void` and `onUploadsChange?: (uploads: Record<string, PhotoUploadStatus>) => void`. Consumed by Task 6 (`ChallengeForm`).

- [x] **Step 1: Write the failing tests**

Add to `src/test/AppForm.test.ts`:

```ts
test("onStatusChange reports missing required field labels", async () => {
  const onStatusChange = vi.fn();
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", isRequired: true },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onStatusChange } });
  await waitFor(() => {
    expect(onStatusChange).toHaveBeenCalledWith({ missingLabels: ["Your note"] });
  });
});

test("onStatusChange reports empty missingLabels once the required field is filled", async () => {
  const onStatusChange = vi.fn();
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", isRequired: true },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onStatusChange } });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "hello" },
  });
  await waitFor(() => {
    expect(onStatusChange).toHaveBeenLastCalledWith({ missingLabels: [] });
  });
});

test("onUploadsChange reports only settled upload statuses, keyed by field id", async () => {
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
      pic: { status: "success", httpCode: 200 },
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: FAIL — `onStatusChange`/`onUploadsChange` props don't exist yet.

- [x] **Step 3: Add `FormValidationStatus` type**

In `src/types/data.ts`, add after `FormState` (from Task 2):

```ts
export interface FormValidationStatus {
  missingLabels: string[];
}
```

- [x] **Step 4: Add the props and effects to `AppForm.svelte`**

Update the import line:

```ts
import type { FormField, FormFieldType, PhotoUploadStatus } from "../types/data";
```

to:

```ts
import type { FormField, FormFieldType, PhotoUploadStatus, FormValidationStatus } from "../types/data";
```

Add `onStatusChange`/`onUploadsChange` to the props destructure and type block (from Task 3):

```ts
  let {
    fields,
    initialValues = {},
    baseValues = undefined,
    initialUploads = {},
    baseUploads = undefined,
    onSubmit,
    onPhotoUpload = undefined,
    onSuccess = undefined,
    onValuesChange = undefined,
    onHasChangesChange = undefined,
    onStatusChange = undefined,
    onUploadsChange = undefined,
    submitLabel = "Submit",
    confirmMessage = undefined,
  }: {
    fields: FormField[];
    initialValues?: Record<string, unknown>;
    baseValues?: Record<string, unknown>;
    initialUploads?: Record<string, PhotoUploadStatus>;
    baseUploads?: Record<string, PhotoUploadStatus>;
    onSubmit: (values: Record<string, unknown>) => Promise<void>;
    onPhotoUpload?: (file: File) => Promise<{ ok: boolean; httpCode?: number }>;
    onSuccess?: () => void;
    onValuesChange?: (values: FieldValues) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onStatusChange?: (status: FormValidationStatus) => void;
    onUploadsChange?: (uploads: Record<string, PhotoUploadStatus>) => void;
    submitLabel?: string;
    confirmMessage?: string;
  } = $props();
```

Add two effects right after the existing `onValuesChange`/`onHasChangesChange` effects:

```ts
  $effect(() => {
    onValuesChange?.({ ...values });
  });
  $effect(() => {
    onHasChangesChange?.(hasChanges);
  });
  const liveErrors = $derived(validateValues());
  const missingLabels = $derived(
    fields.filter((f) => f.id && liveErrors[f.id]).map((f) => f.label),
  );
  $effect(() => {
    onStatusChange?.({ missingLabels });
  });
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

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: PASS (all AppForm tests, including the 3 new ones)

- [x] **Step 6: Commit**

```bash
git add src/types/data.ts src/components/AppForm.svelte src/test/AppForm.test.ts
git commit -m "feat: add AppForm onStatusChange and onUploadsChange callbacks"
```

---

## Task 5: `Toast` component

**Files:**
- Create: `src/components/Toast.svelte`
- Create: `src/components/Toast.css`
- Test: `src/test/Toast.test.ts`

**Interfaces:**
- Produces: `Toast` component with props `{ message: string; onDismiss: () => void; skipLabel?: string; onSkip?: () => void; autoDismissMs?: number }`. Consumed by Task 8 (`RoutePage`).

- [x] **Step 1: Write the failing tests**

Create `src/test/Toast.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import Toast from "../components/Toast.svelte";

test("renders the message", () => {
  render(Toast, { props: { message: "Please complete: Your note", onDismiss: vi.fn() } });
  expect(screen.getByText("Please complete: Your note")).toBeInTheDocument();
});

test("does not render a skip button when skipLabel/onSkip are absent", () => {
  render(Toast, { props: { message: "msg", onDismiss: vi.fn() } });
  expect(screen.queryByRole("button", { name: /skip/i })).not.toBeInTheDocument();
});

test("renders and triggers the skip action when provided", async () => {
  const onSkip = vi.fn();
  render(Toast, {
    props: { message: "msg", onDismiss: vi.fn(), skipLabel: "Skip", onSkip },
  });
  await fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(onSkip).toHaveBeenCalledOnce();
});

test("calls onDismiss when the close button is clicked", async () => {
  const onDismiss = vi.fn();
  render(Toast, { props: { message: "msg", onDismiss } });
  await fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
  expect(onDismiss).toHaveBeenCalledOnce();
});

test("auto-dismisses after autoDismissMs", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  render(Toast, { props: { message: "msg", onDismiss, autoDismissMs: 1000 } });
  vi.advanceTimersByTime(1000);
  expect(onDismiss).toHaveBeenCalledOnce();
  vi.useRealTimers();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/Toast.test.ts`
Expected: FAIL — `Failed to resolve import "../components/Toast.svelte"`.

- [x] **Step 3: Implement `Toast.svelte`**

Create `src/components/Toast.svelte`:

```svelte
<script lang="ts">
  import "./Toast.css";

  let {
    message,
    onDismiss,
    skipLabel = undefined,
    onSkip = undefined,
    autoDismissMs = 4000,
  }: {
    message: string;
    onDismiss: () => void;
    skipLabel?: string;
    onSkip?: () => void;
    autoDismissMs?: number;
  } = $props();

  $effect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  });
</script>

<div class="toast" role="status">
  <p class="toast__message">{message}</p>
  <div class="toast__actions">
    {#if skipLabel && onSkip}
      <button class="toast__skip" onclick={onSkip}>{skipLabel}</button>
    {/if}
    <button class="toast__close" aria-label="Dismiss" onclick={onDismiss}>✕</button>
  </div>
</div>
```

- [x] **Step 4: Implement `Toast.css`**

Create `src/components/Toast.css`:

```css
/* src/components/Toast.css */

.toast {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 76px;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.toast__message {
  flex: 1;
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.toast__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.toast__skip {
  padding: 6px 12px;
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  background: transparent;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}

.toast__close {
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/Toast.test.ts`
Expected: PASS (5 tests)

- [x] **Step 6: Commit**

```bash
git add src/components/Toast.svelte src/components/Toast.css src/test/Toast.test.ts
git commit -m "feat: add Toast component for blocked-navigation and skip messaging"
```

---

## Task 6: `ChallengeForm` — local storage persistence and resubmit behavior

**Files:**
- Modify: `src/components/ChallengeForm.svelte`
- Modify: `src/test/ChallengeForm.test.ts`

**Interfaces:**
- Consumes: `buildFormStorageKey`, `loadFormState`, `saveFormState` (Task 2); `AppForm`'s `initialUploads`/`baseUploads`/`onStatusChange`/`onUploadsChange` (Tasks 3–4).
- Produces: `ChallengeForm` props `project?: string`, `storeInLocalStorage?: boolean` (default `true`), `allowResubmit?: boolean` (default `true`), `onFormStatusChange?: (status: { submitted: boolean; missingLabels: string[] }) => void`. Consumed by Task 7 (`ChallengeCard`).

- [x] **Step 1: Write the failing tests**

In `src/test/ChallengeForm.test.ts`, update the imports to add `waitFor` and clear `localStorage` between tests:

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import ChallengeForm from "../components/ChallengeForm.svelte";
import { postFormSubmit } from "../utils/api";
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";
```

Update the existing `beforeEach`:

```ts
beforeEach(() => {
  localStorage.clear();
  authStore.loginParticipant("test_project", "Team A", "team@test.com");
});
```

Add these new tests:

```ts
test("form stays visible with a disabled Re-submit button after a successful submit (allowResubmit default true)", async () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  const resubmitBtn = await screen.findByRole("button", { name: /no changes/i });
  expect(resubmitBtn).toBeDisabled();
  expect(screen.getByLabelText("Your note")).toBeInTheDocument();
});

test("Re-submit button enables after editing a previously-submitted form", async () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /no changes/i });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "updated text" },
  });
  expect(screen.getByRole("button", { name: "Re-submit" })).not.toBeDisabled();
});

test("form is replaced by a static success message when allowResubmit is false", async () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop", allowResubmit: false },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(await screen.findByText("Submitted! ✓")).toBeInTheDocument();
  expect(screen.queryByLabelText("Your note")).not.toBeInTheDocument();
});

test("restores previously-entered values and submitted state from local storage on mount", async () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", 1);
  saveFormState(key, {
    values: { note: "restored text" },
    uploads: {},
    submitted: true,
    skipped: false,
  });
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop", cityId: "den_haag", project: "demo" },
  });
  expect((screen.getByLabelText("Your note") as HTMLInputElement).value).toBe(
    "restored text",
  );
  expect(await screen.findByRole("button", { name: /no changes/i })).toBeInTheDocument();
});

test("does not read or write local storage when storeInLocalStorage is false", async () => {
  render(ChallengeForm, {
    props: {
      form,
      locationId: 1,
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
      storeInLocalStorage: false,
    },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  expect(localStorage.getItem("demo/den_haag/short_loop/1/form")).toBeNull();
});

test("reports submitted status and missing labels via onFormStatusChange", async () => {
  const onFormStatusChange = vi.fn();
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop", onFormStatusChange },
  });
  await waitFor(() => {
    expect(onFormStatusChange).toHaveBeenCalledWith({
      submitted: false,
      missingLabels: ["Your note"],
    });
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await waitFor(() => {
    expect(onFormStatusChange).toHaveBeenLastCalledWith({
      submitted: true,
      missingLabels: [],
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/ChallengeForm.test.ts`
Expected: FAIL — new props/behavior don't exist yet.

- [x] **Step 3: Rewrite `ChallengeForm.svelte`**

Replace the entire file with:

```svelte
<script lang="ts">
  import { Flag } from "lucide-svelte";
  import { authStore } from "../stores/authStore";
  import type { FormField, PhotoUploadStatus } from "../types/data";
  import { postFormSubmit, postPhotoUpload } from "../utils/api";
  import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";
  import AppForm from "./AppForm.svelte";
  import "./ChallengeForm.css";

  let {
    form,
    locationId,
    routeId = undefined,
    project = "",
    cityId = "",
    taskTitle = "",
    storeInLocalStorage = true,
    allowResubmit = true,
    onFormStatusChange = undefined,
  }: {
    form: FormField[];
    locationId: number;
    routeId?: string;
    project?: string;
    cityId?: string;
    taskTitle?: string;
    storeInLocalStorage?: boolean;
    allowResubmit?: boolean;
    onFormStatusChange?: (status: { submitted: boolean; missingLabels: string[] }) => void;
  } = $props();

  const storageKey = buildFormStorageKey(project, cityId, routeId, locationId);
  const stored = storeInLocalStorage
    ? loadFormState(storageKey)
    : { values: {}, uploads: {}, submitted: false, skipped: false };

  let baseValues = $state<Record<string, unknown>>(stored.values);
  let baseUploads = $state<Record<string, PhotoUploadStatus>>(stored.uploads);
  let latestValues = $state<Record<string, unknown>>(stored.values);
  let latestUploads = $state<Record<string, PhotoUploadStatus>>(stored.uploads);
  let hasSubmittedOnce = $state(stored.submitted);
  let skipped = $state(stored.skipped);

  function persist() {
    if (storeInLocalStorage) {
      saveFormState(storageKey, {
        values: latestValues,
        uploads: latestUploads,
        submitted: hasSubmittedOnce,
        skipped,
      });
    }
  }

  function handleValuesChange(values: Record<string, unknown>) {
    latestValues = values;
    persist();
  }

  function handleUploadsChange(uploads: Record<string, PhotoUploadStatus>) {
    latestUploads = uploads;
    persist();
  }

  function handleStatusChange(status: { missingLabels: string[] }) {
    onFormStatusChange?.({ submitted: hasSubmittedOnce, missingLabels: status.missingLabels });
  }

  async function handleSubmit(values: Record<string, unknown>) {
    const auth = $authStore.activeAuth;
    const data = await postFormSubmit({
      locationId,
      routeId,
      cityId,
      teamName: auth?.kind === "participant" ? auth.teamName : "",
      contact: auth?.kind === "participant" ? (auth.contact ?? "") : "",
      answers: values,
    });
    if (!data.ok) { throw new Error("Submission failed"); }
  }

  function handleSuccess() {
    hasSubmittedOnce = true;
    baseValues = latestValues;
    baseUploads = latestUploads;
    persist();
    onFormStatusChange?.({ submitted: true, missingLabels: [] });
  }

  async function handlePhotoUpload(file: File): Promise<{ ok: boolean; httpCode?: number }> {
    return postPhotoUpload({ locationId, cityId, routeId, taskTitle, file });
  }
</script>

<div class="challenge-form">
  {#if hasSubmittedOnce && !allowResubmit}
    <p class="cf-success">Submitted! ✓</p>
  {:else}
    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>

    <AppForm
      fields={form}
      initialValues={baseValues}
      {baseValues}
      initialUploads={baseUploads}
      {baseUploads}
      onSubmit={handleSubmit}
      onPhotoUpload={handlePhotoUpload}
      onSuccess={handleSuccess}
      onValuesChange={handleValuesChange}
      onUploadsChange={handleUploadsChange}
      onStatusChange={handleStatusChange}
      confirmMessage="Submit your answers?"
      submitLabel={hasSubmittedOnce ? "Re-submit" : "Submit"}
    />

    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>
  {/if}
</div>
```

Note: `storageKey`/`stored` are computed once at component creation (top-level `const`), not reactively — Task 7 wraps `<ChallengeForm>` in a `{#key}` block so a fresh instance (and fresh `stored` read) is created whenever the location actually changes, rather than trying to make this component react to prop changes after mount.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/ChallengeForm.test.ts`
Expected: PASS (all existing tests plus the 6 new ones)

- [x] **Step 5: Commit**

```bash
git add src/components/ChallengeForm.svelte src/test/ChallengeForm.test.ts
git commit -m "feat: persist ChallengeForm state to local storage and support resubmission"
```

---

## Task 7: `ChallengeCard` — completion badge, `{#key}` remount fix, prop threading

This also fixes a latent bug: in the carousel/peek swipe modes, `RoutePage` recycles the same `ChallengeCard`/`ChallengeForm` component instances across different locations (three fixed DOM slots, only the `location` prop changes) — so `ChallengeForm`'s `submitted`-style state could previously leak from one location to the next if both had a form. Wrapping `<ChallengeForm>` in a `{#key}` keyed on the location forces a fresh instance per location, fixing this and making Task 6's local-storage restore logic actually run per location.

**Files:**
- Modify: `src/components/ChallengeCard.svelte`
- Modify: `src/components/ChallengeCard.css`
- Modify: `src/test/ChallengeCard.test.ts`

**Interfaces:**
- Consumes: `ChallengeForm`'s `project`/`storeInLocalStorage`/`allowResubmit`/`onFormStatusChange` props (Task 6).
- Produces: `ChallengeCard` props `project?: string`, `storeFormsInLocalStorage?: boolean` (default `true`), `allowResubmit?: boolean` (default `true`), `badgeStatus?: "submitted" | "skipped"`, `onFormStatusChange?: (locationId: number, status: { submitted: boolean; missingLabels: string[] }) => void`. Consumed by Task 8 (`RoutePage`).

- [x] **Step 1: Write the failing tests**

In `src/test/ChallengeCard.test.ts`, add the api mock, `waitFor` import, and `localStorage.clear()`:

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import ChallengeCard from "../components/ChallengeCard.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));

vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true, httpCode: 200 }),
}));
```

Update the existing `beforeEach`:

```ts
beforeEach(() => {
  localStorage.clear();
  authStore.loginParticipant("test_project", "Team A", "team@test.com");
});
```

Add these new tests:

```ts
test("renders a submitted checkmark overlay on the badge", () => {
  render(ChallengeCard, { props: { location, index: 1, badgeStatus: "submitted" } });
  expect(screen.getByTestId("badge-status-submitted")).toBeInTheDocument();
});

test("renders a skipped dash overlay on the badge", () => {
  render(ChallengeCard, { props: { location, index: 1, badgeStatus: "skipped" } });
  expect(screen.getByTestId("badge-status-skipped")).toBeInTheDocument();
});

test("renders no status overlay when badgeStatus is unset", () => {
  render(ChallengeCard, { props: { location, index: 1 } });
  expect(screen.queryByTestId("badge-status-submitted")).not.toBeInTheDocument();
  expect(screen.queryByTestId("badge-status-skipped")).not.toBeInTheDocument();
});

test("forwards form status changes tagged with the location's index", async () => {
  const onFormStatusChange = vi.fn();
  render(ChallengeCard, {
    props: { location, index: 3, onFormStatusChange },
  });
  await waitFor(() => {
    expect(onFormStatusChange).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ submitted: false }),
    );
  });
});

test("remounts the challenge form and resets submitted state when the location index changes", async () => {
  const { rerender } = render(ChallengeCard, {
    props: { location, index: 1, allowResubmit: false },
  });
  await fireEvent.click(screen.getByLabelText("Found it?"));
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(await screen.findByText("Submitted! ✓")).toBeInTheDocument();
  await rerender({ index: 2 });
  expect(screen.queryByText("Submitted! ✓")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Found it?")).toBeInTheDocument();
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/ChallengeCard.test.ts`
Expected: FAIL — `badgeStatus`/`onFormStatusChange` props and the badge overlay don't exist yet; the last test would previously fail because `submitted` state isn't reset across a prop change.

- [x] **Step 3: Rewrite `ChallengeCard.svelte`**

Replace the entire file with:

```svelte
<script lang="ts">
  import { BookOpen, MapPin, Crosshair, Compass, Check, Minus } from "lucide-svelte";
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
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
    cityId = undefined,
    project = "",
    storeFormsInLocalStorage = true,
    allowResubmit = true,
    badgeStatus = undefined,
    onFormStatusChange = undefined,
  }: {
    location: Location;
    isLast?: boolean;
    index?: number;
    routeId?: string;
    cityId?: string;
    project?: string;
    storeFormsInLocalStorage?: boolean;
    allowResubmit?: boolean;
    badgeStatus?: "submitted" | "skipped";
    onFormStatusChange?: (
      locationId: number,
      status: { submitted: boolean; missingLabels: string[] },
    ) => void;
  } = $props();

  let heroSrc = $state<string | null>(null);
  let hasHero = $derived(!!heroSrc);
  let pos = $derived<[number, number]>([
    location.coordinates.latitude,
    location.coordinates.longitude,
  ]);

  $effect.pre(() => {
    heroSrc = location.image ? (getCachedImageUrl(location.image) ?? null) : null;
  });

  $effect(() => {
    if (!location.image || getCachedImageUrl(location.image)) {
      return undefined;
    }
    let cancelled = false;
    fetchImage(location.image).then((url) => {
      if (!cancelled) {
        heroSrc = url;
      }
    });
    return () => { cancelled = true; };
  });
</script>

{#snippet badge()}
  <div
    class="cc-badge"
    style="background: {location.themeColor ?? $themeStore.theme.accent}"
    data-testid="location-badge"
  >
    {index}
    {#if badgeStatus === "submitted"}
      <span class="cc-badge-status cc-badge-status--submitted" data-testid="badge-status-submitted">
        <Check size={12} aria-hidden="true" />
      </span>
    {:else if badgeStatus === "skipped"}
      <span class="cc-badge-status cc-badge-status--skipped" data-testid="badge-status-skipped">
        <Minus size={12} aria-hidden="true" />
      </span>
    {/if}
  </div>
{/snippet}

<div class="cc-root">
  {#if hasHero}
    <div class="cc-hero-wrap">
      <img
        src={heroSrc!}
        alt={location.name?.value || location.title}
        class="cc-hero-img"
      />
      <div class="cc-hero-title-wrap">
        <div class="cc-title-card cc-title-card--shadow">
          {@render badge()}
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
        {@render badge()}
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
      <BookOpen size={12} aria-hidden="true" />
      Storyline
    </div>
    <MarkdownText text={location.storyline} />
  </div>

  <div class="cc-section">
    <div class="cc-section-label">
      <MapPin size={12} aria-hidden="true" />
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
        <Crosshair size={12} aria-hidden="true" />
        Challenge
      </div>
      <MarkdownText text={location.challenge.description} />
    </div>

    {#if location.challenge.form && location.challenge.form.length > 0}
      {#key `${project}/${cityId}/${routeId}/${index}`}
        <ChallengeForm
          form={location.challenge.form}
          locationId={index ?? -1}
          {routeId}
          {cityId}
          {project}
          storeInLocalStorage={storeFormsInLocalStorage}
          {allowResubmit}
          taskTitle={location.challenge.name}
          onFormStatusChange={(status) => onFormStatusChange?.(index ?? -1, status)}
        />
      {/key}
    {/if}
  </div>

  {#if !isLast}
    <div class="cc-section--no-border">
      <div class="cc-section-label">
        <Compass size={12} aria-hidden="true" />
        Your clue to your next destination
      </div>
      <p class="cc-breadcrumb">{location.breadcrumb}</p>
    </div>
  {/if}
</div>
```

- [x] **Step 4: Add badge overlay styles to `ChallengeCard.css`**

Update `.cc-badge` to add `position: relative`:

```css
.cc-badge {
  min-width: 44px;
  height: 44px;
  color: #fff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xl);
  font-weight: 800;
  flex-shrink: 0;
  position: relative;
}
```

Add after the `.cc-badge` rule:

```css
.cc-badge-status {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border: 2px solid var(--color-background);
}

.cc-badge-status--submitted {
  background: var(--color-success);
}

.cc-badge-status--skipped {
  background: var(--color-text-muted);
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/ChallengeCard.test.ts`
Expected: PASS (all existing tests plus the 5 new ones)

- [x] **Step 6: Commit**

```bash
git add src/components/ChallengeCard.svelte src/components/ChallengeCard.css src/test/ChallengeCard.test.ts
git commit -m "feat: completion/skipped badge on ChallengeCard, remount form per location"
```

---

## Task 8: `RoutePage` — settings loading, Next-button gating, toast, skip, badge wiring

**Files:**
- Modify: `src/pages/RoutePage.svelte`
- Modify: `src/pages/RoutePage.css`
- Modify: `src/test/RoutePage.test.ts`

**Interfaces:**
- Consumes: `getHuntSettings` (Task 1); `buildFormStorageKey`/`loadFormState`/`saveFormState` (Task 2); `Toast` (Task 5); `ChallengeCard`'s `project`/`storeFormsInLocalStorage`/`allowResubmit`/`badgeStatus`/`onFormStatusChange` props (Task 7).

- [x] **Step 1: Write the failing tests**

Replace `src/test/RoutePage.test.ts` with:

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { titleBarStore } from "../stores/titleBarStore";
import { themeStore } from "../stores/themeStore";
import RoutePage from "../pages/RoutePage.svelte";

const { mockLocations, huntSettingsFixture } = vi.hoisted(() => ({
  mockLocations: [
    {
      locationId: 1,
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: {
        name: "Challenge 1",
        description: "Desc 1",
        form: [{ id: "note", type: "string" as const, label: "Your note", isRequired: true }],
      },
    },
    {
      locationId: 2,
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
    },
  ],
  huntSettingsFixture: {} as Record<string, unknown>,
}));

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockImplementation(async (_lang: string, path: string) => {
    if (path.endsWith("routes")) {
      return {
        short_loop: { description: "2.5h route", locations: ["001", "002"] },
        long_loop: {
          description: "4h route",
          locations: ["001", "002", "003"],
        },
      };
    }
    if (path === "projects/democrats_abroad/democrats_abroad") {
      return huntSettingsFixture;
    }
    if (path.includes("/001")) {
      return mockLocations[0];
    }
    if (path.includes("/002")) {
      return mockLocations[1];
    }
    return null;
  }),
}));

vi.mock("../utils/loadLocations", () => ({
  loadLocations: vi.fn().mockResolvedValue(mockLocations),
}));

vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true, httpCode: 200 }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
  themeStore.setThemeName("wireframe");
});

afterEach(() => {
  delete huntSettingsFixture["project.form_required"];
  delete huntSettingsFixture["project.can_forms_skip"];
  themeStore.setThemeName("app");
});

test("renders challenge card", async () => {
  render(RoutePage, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        route: "short_loop",
      },
    },
  });
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
});

test("Next stays enabled and un-styled when form_required is not set", async () => {
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => {
    expect(nextBtn).not.toHaveClass("route-page__next-btn--pending");
  });
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("blocks Next and shows a toast listing missing fields when form_required and the form is incomplete", async () => {
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => {
    expect(nextBtn).toHaveClass("route-page__next-btn--pending");
  });
  await fireEvent.click(nextBtn);
  expect(await screen.findByText(/please complete: your note/i)).toBeInTheDocument();
  expect(screen.getByText("Location 1")).toBeInTheDocument();
});

test("allows Next once the required form has been submitted", async () => {
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).not.toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("shows a Skip button in the toast when can_forms_skip is true, and skipping advances", async () => {
  huntSettingsFixture["project.form_required"] = true;
  huntSettingsFixture["project.can_forms_skip"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  await fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("does not show a Skip button in the toast when can_forms_skip is false", async () => {
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  await screen.findByText(/please complete/i);
  expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
});

test("renders a submitted badge on a location after its form is submitted", async () => {
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(await screen.findByTestId("badge-status-submitted")).toBeInTheDocument();
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/RoutePage.test.ts`
Expected: FAIL — gating/toast/badge behavior doesn't exist yet.

- [x] **Step 3: Add imports and settings/status state to `RoutePage.svelte`**

Update the imports at the top of the script:

```ts
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { themeStore } from "../stores/themeStore";
  import { loadText } from "../utils/loadText";
  import { loadLocations } from "../utils/loadLocations";
  import {
    clampedNext,
    clampedPrev,
    shouldCommitSwipe,
    elasticOffset,
  } from "../utils/routeNav";
  import { getHuntSettings } from "../utils/huntSettings";
  import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";
  import { swipe } from "../actions/swipe";
  import { preloadImages } from "../assets/AssetManager";
  import ChallengeCard from "../components/ChallengeCard.svelte";
  import Toast from "../components/Toast.svelte";
  import type { RoutesData, Location } from "../types/data";
  import { untrack } from "svelte";
  import "./RoutePage.css";
```

Add a settings-loading effect right after the existing `routesText`-loading effect:

```ts
  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<RoutesData>(
      lang,
      `projects/${params.project}/${params.city}/routes`,
    ).then((data) => {
      routesText = data;
    });
  });

  let huntSettings = $state(getHuntSettings(null));
  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<Record<string, unknown>>(
      lang,
      `projects/${params.project}/${params.project}`,
    ).then((data) => {
      huntSettings = getHuntSettings(data);
    });
  });
```

- [x] **Step 4: Add form-status/skip tracking, eager restore, and derived gating state**

Insert this block right after `let currentLocation = $derived(locations[currentIndex]);`:

```ts
  let currentLocation = $derived(locations[currentIndex]);

  let formStatusByIndex = $state<Record<number, { submitted: boolean; missingLabels: string[] }>>({});
  let skippedIndices = $state<Set<number>>(new Set());
  let showToast = $state(false);
  let toastMissingLabels = $state<string[]>([]);

  $effect(() => {
    if (locations.length > 0 && huntSettings.storeFormsInLocalStorage) {
      const restoredStatus: Record<number, { submitted: boolean; missingLabels: string[] }> = {};
      const restoredSkipped = new Set<number>();
      locations.forEach((_, i) => {
        const locId = i + 1;
        const state = loadFormState(
          buildFormStorageKey(params.project, params.city, params.route, locId),
        );
        if (state.submitted) {
          restoredStatus[locId] = { submitted: true, missingLabels: [] };
        }
        if (state.skipped) {
          restoredSkipped.add(locId);
        }
      });
      untrack(() => {
        formStatusByIndex = { ...restoredStatus, ...formStatusByIndex };
        skippedIndices = new Set([...restoredSkipped, ...skippedIndices]);
      });
    }
  });

  function handleFormStatusChange(
    locationId: number,
    status: { submitted: boolean; missingLabels: string[] },
  ) {
    const current = untrack(() => formStatusByIndex);
    formStatusByIndex = { ...current, [locationId]: status };
  }
```

> **Implementation note (found during execution, not anticipated above):** both of these self-referential `{...existing, [key]: value}` merge patterns triggered Svelte's `effect_update_depth_exceeded` guard at runtime. In `handleFormStatusChange`'s case specifically, it's invoked synchronously from deep inside `AppForm`'s own `onStatusChange` `$effect` (via `ChallengeForm` → `ChallengeCard` → here) — Svelte's dependency tracking is based on the *currently running* reactive computation, not lexical/component scope, so the read of `formStatusByIndex` here was attributed to that distant `$effect`, and the write right after read as "the same effect writing its own dependency," tripping the loop guard after ~1000 iterations. Wrapping the read side in `untrack()` (already used elsewhere in this codebase for exactly this kind of one-time/non-reactive read) fixes both without changing behavior — downstream consumers of `formStatusByIndex` (the `currentFormStatus`/`canAdvance` deriveds, the template) still update normally, since `untrack` only suppresses *this* read from being tracked as a dependency, it doesn't affect the write's ability to notify other subscribers. The code block above already reflects this fix.

```ts

  function computeBadgeStatus(locationId: number, hasForm: boolean): "submitted" | "skipped" | undefined {
    if (!hasForm) return undefined;
    if (formStatusByIndex[locationId]?.submitted) return "submitted";
    if (skippedIndices.has(locationId)) return "skipped";
    return undefined;
  }

  let currentLocationId = $derived(currentIndex + 1);
  let currentHasForm = $derived((currentLocation?.challenge.form?.length ?? 0) > 0);
  let currentFormStatus = $derived(
    formStatusByIndex[currentLocationId] ?? { submitted: false, missingLabels: [] },
  );
  let currentSkipped = $derived(skippedIndices.has(currentLocationId));
  let canAdvance = $derived(
    !huntSettings.formRequired ||
      !currentHasForm ||
      currentFormStatus.submitted ||
      currentSkipped,
  );

  function triggerBlockedToast() {
    toastMissingLabels = currentFormStatus.missingLabels;
    showToast = true;
  }

  function handleSkip() {
    const locId = currentLocationId;
    skippedIndices = new Set(skippedIndices).add(locId);
    if (huntSettings.storeFormsInLocalStorage) {
      const key = buildFormStorageKey(params.project, params.city, params.route, locId);
      saveFormState(key, { ...loadFormState(key), skipped: true });
    }
    showToast = false;
    if (swipeMode === "snap") {
      direction = "next";
      currentIndex = clampedNext(currentIndex, locations.length);
    } else {
      pendingCommit = "next";
      isAnimating = true;
      dragOffset = -cardWidth;
    }
  }
```

- [x] **Step 5: Gate `handleDragEnd`**

Replace the existing `handleDragEnd` function:

```ts
  function handleDragEnd(delta: number) {
    if (!isAnimating) {
      if (swipeMode === "snap") {
        // snap mode: instant index change, no drag animation
        if (delta < -60) {
          direction = "next";
          currentIndex = clampedNext(currentIndex, locations.length);
        } else if (delta > 60) {
          direction = "prev";
          currentIndex = clampedPrev(currentIndex);
        }
        dragOffset = 0;
      } else {
        const atStart = currentIndex === 0;
        const atEnd = currentIndex === locations.length - 1;
        const goingNext = delta < 0;
        const goingPrev = delta > 0;

        if (goingNext && !atEnd && shouldCommitSwipe(delta, cardWidth)) {
          pendingCommit = "next";
          isAnimating = true;
          dragOffset = -cardWidth;
        } else if (goingPrev && !atStart && shouldCommitSwipe(delta, cardWidth)) {
          pendingCommit = "prev";
          isAnimating = true;
          dragOffset = cardWidth;
        } else {
          // spring back
          isAnimating = true;
          dragOffset = 0;
        }
      }
    }
  }
```

with:

```ts
  function handleDragEnd(delta: number) {
    if (!isAnimating) {
      if (swipeMode === "snap") {
        // snap mode: instant index change, no drag animation
        if (delta < -60) {
          if (canAdvance) {
            direction = "next";
            currentIndex = clampedNext(currentIndex, locations.length);
          } else {
            triggerBlockedToast();
          }
        } else if (delta > 60) {
          direction = "prev";
          currentIndex = clampedPrev(currentIndex);
        }
        dragOffset = 0;
      } else {
        const atStart = currentIndex === 0;
        const atEnd = currentIndex === locations.length - 1;
        const goingNext = delta < 0;
        const goingPrev = delta > 0;

        if (goingNext && !atEnd && shouldCommitSwipe(delta, cardWidth)) {
          if (canAdvance) {
            pendingCommit = "next";
            isAnimating = true;
            dragOffset = -cardWidth;
          } else {
            triggerBlockedToast();
            isAnimating = true;
            dragOffset = 0;
          }
        } else if (goingPrev && !atStart && shouldCommitSwipe(delta, cardWidth)) {
          pendingCommit = "prev";
          isAnimating = true;
          dragOffset = cardWidth;
        } else {
          // spring back
          isAnimating = true;
          dragOffset = 0;
        }
      }
    }
  }
```

- [x] **Step 6: Pass new props to `ChallengeCard` and render the `Toast`**

In the snap-mode template branch, replace:

```svelte
        <ChallengeCard
          location={currentLocation}
          isLast={currentIndex === locations.length - 1}
          index={currentIndex + 1}
          routeId={params.route}
          cityId={params.city}
        />
```

with:

```svelte
        <ChallengeCard
          location={currentLocation}
          isLast={currentIndex === locations.length - 1}
          index={currentIndex + 1}
          routeId={params.route}
          cityId={params.city}
          project={params.project}
          storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
          allowResubmit={huntSettings.allowResubmit}
          onFormStatusChange={handleFormStatusChange}
          badgeStatus={computeBadgeStatus(currentIndex + 1, currentHasForm)}
        />
```

In the strip-mode `{#each}` branch, replace:

```svelte
              <ChallengeCard
                location={slotLocation}
                isLast={locIdx === locations.length - 1}
                index={locIdx + 1}
                routeId={params.route}
                cityId={params.city}
              />
```

with:

```svelte
              <ChallengeCard
                location={slotLocation}
                isLast={locIdx === locations.length - 1}
                index={locIdx + 1}
                routeId={params.route}
                cityId={params.city}
                project={params.project}
                storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
                allowResubmit={huntSettings.allowResubmit}
                onFormStatusChange={handleFormStatusChange}
                badgeStatus={computeBadgeStatus(locIdx + 1, (slotLocation.challenge.form?.length ?? 0) > 0)}
              />
```

Update the Next button to add the pending class:

```svelte
        <button
          aria-label="Next stop"
          onclick={() => handleDragEnd(-cardWidth)}
          class="route-page__next-btn"
          class:route-page__next-btn--pending={!canAdvance}
        >
```

Add the `Toast` render just before the closing `</div>` of `.route-page`:

```svelte
  {#if showToast}
    <Toast
      message={`Please complete: ${toastMissingLabels.join(", ")}`}
      onDismiss={() => (showToast = false)}
      skipLabel={huntSettings.canFormsSkip ? "Skip" : undefined}
      onSkip={huntSettings.canFormsSkip ? handleSkip : undefined}
    />
  {/if}
</div>
```

- [x] **Step 7: Add the pending-button style to `RoutePage.css`**

Add after `.route-page__next-btn`:

```css
.route-page__next-btn--pending {
  background: transparent;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  position: relative;
}

.route-page__next-btn--pending::after {
  content: "";
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-error);
}
```

- [x] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/test/RoutePage.test.ts`
Expected: PASS (all 8 tests)

- [x] **Step 9: Run the full test suite**

Run: `npm run test:run`
Expected: PASS — full suite green, no regressions in other files.

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [x] **Step 10: Commit**

```bash
git add src/pages/RoutePage.svelte src/pages/RoutePage.css src/test/RoutePage.test.ts
git commit -m "feat: gate Next button on form_required, add skip toast and badge wiring"
```

---

## Task 9: Documentation

**Files:**
- Modify: `doc/architecture.md`

- [x] **Step 1: Document the new project config fields**

In `doc/architecture.md`, in the `projects/<projectId>/<projectId>.yaml` section, replace:

```markdown
### `projects/<projectId>/<projectId>.yaml` — Project metadata

Free-form project-level YAML. The only field consumed by the app is the optional `organizer_url`:

```yaml
organizer_url: "https://your-organization.example.org"
```

If present, the gallery landing page (`/:project/:city/gallery`) renders a header link pointing to this URL (opens in a new tab). If absent, no link is shown.
```

with:

```markdown
### `projects/<projectId>/<projectId>.yaml` — Project metadata

Free-form project-level YAML. Fields consumed by the app:

```yaml
organizer_url: "https://your-organization.example.org"
project.store_forms_in_local_storage: true   # default true
project.form_required: false                  # default false
project.can_forms_skip: false                 # default false
project.allow_resubmit: true                  # default true
```

- `organizer_url` — if present, the gallery landing page (`/:project/:city/gallery`) renders a header link pointing to this URL (opens in a new tab). If absent, no link is shown.
- `project.store_forms_in_local_storage` — when true (default), each location's form values, photo upload outcomes, and submitted/skipped flags persist to `localStorage` (see `src/utils/formStorage.ts`), keyed `${project}/${city}/${route}/${locationId}/form`, so in-progress or completed forms survive a reload or crash. When false, all form state is in-memory only for the session.
- `project.form_required` — when true, the Next button/swipe-forward is blocked (soft-disabled: styled but still clickable) until the current location's form is submitted, showing a toast listing missing required fields on a blocked attempt. Required `photo` fields must have a successful upload to count as filled.
- `project.can_forms_skip` — when true, the blocked-navigation toast includes a Skip button that bypasses the requirement for that location (persisted if local storage is enabled).
- `project.allow_resubmit` — when true (default), a location's form stays visible and editable after a successful submit, with the button relabeled "Re-submit" (disabled until a value changes). When false, the form is replaced by a static "Submitted! ✓" message, matching the original behavior.

`getHuntSettings()` (`src/utils/huntSettings.ts`) centralizes reading these four flags with their defaults; `RoutePage` loads this file once per route via `loadText`.
```

- [x] **Step 2: Document the completion badge**

Add a new subsection right after the `ChallengeCard` row description isn't a natural fit — instead add to the end of the "Unified Form System" section a short paragraph:

```markdown
**Completion badge.** `ChallengeCard`'s numbered badge shows a small status overlay when `form_required` gating is in effect: a green checkmark once that location's form has been submitted, or a grey dash if the user skipped it via the toast's Skip button (see `project.can_forms_skip` above). The badge's own background color remains the per-location `themeColor`/theme accent — the overlay is a separate small circle, not a recoloring of the badge itself.
```

- [x] **Step 3: Commit**

```bash
git add doc/architecture.md
git commit -m "docs: document hunt behavior config fields and completion badge"
```
