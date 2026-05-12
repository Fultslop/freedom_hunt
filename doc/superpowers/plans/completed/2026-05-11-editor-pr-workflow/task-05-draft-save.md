# Task 05 — EditorLocationForm: draft save + compact success

**Files:**
- Modify: `src/pages/editor/EditorLocationForm.svelte`
- Modify: `src/test/EditorLocationForm.test.ts`

**Prerequisites:** Task 03 (AppForm `onValuesChange`, `baseValues`) and Task 04 (draft helpers in `editorStorage`) must be complete.

**Context:** Three additions to `EditorLocationForm`:
1. **Draft auto-save** — on every keystroke, save form values to localStorage via `onValuesChange`. On mount, restore from draft if one exists.
2. **`baseValues`** — pass the server-loaded values as `baseValues` to `AppForm` so `hasChanges` compares against the committed data, not the draft. Without this, a form pre-populated with a draft (which differs from the server) would show "No changes".
3. **Compact success screen** — the existing success screen is already minimal; the main change here is that the draft is cleared on success via `handleSuccess`.

The draft key format is: `` `editor_draft_${params.project}/${params.city}/locations_${params.filename}` `` for edits, `` `editor_draft_${params.project}/${params.city}/locations_new` `` for new locations. The `DRAFT_PREFIX` constant is not exported from `editorStorage`, so build the key directly with the `"editor_draft_"` literal.

---

- [x] **Step 1: Write failing tests**

Add to `src/test/EditorLocationForm.test.ts`:

1. Add to the top-level imports:

```ts
import { getDraft, saveDraft, clearDraft } from "../pages/editor/editorStorage";
```

2. Add the following tests at the end of the file:

// ---------------------------------------------------------------------------
// Draft save
// ---------------------------------------------------------------------------

test("saves a draft to localStorage as the user types", async () => {
  localStorage.clear();
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Title$/i);
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "New Location Title" },
  });
  await waitFor(() => {
    const draft = getDraft(
      "editor_draft_democrats_abroad/den_haag/locations_new",
    );
    expect(draft).not.toBeNull();
    expect((draft as Record<string, unknown>)["title"]).toBe(
      "New Location Title",
    );
  });
});

test("restores draft values into the form on mount", async () => {
  localStorage.clear();
  saveDraft("editor_draft_democrats_abroad/den_haag/locations_new", {
    title: "Restored Title",
    identity: "restored",
    storyline: "A story.",
  });

  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });

  await screen.findByLabelText(/^Title$/i);
  expect(
    (screen.getByLabelText(/^Title$/i) as HTMLInputElement).value,
  ).toBe("Restored Title");
});

test("clears draft from localStorage after successful submit", async () => {
  localStorage.clear();
  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_new";
  saveDraft(draftKey, { title: "Draft", identity: "draft", storyline: "S." });

  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });

  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "test" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Test" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "Story." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );

  await waitFor(() => {
    expect(getDraft(draftKey)).toBeNull();
  });
});
```

- [x] **Step 2: Run to confirm they fail**

```
npx vitest run src/test/EditorLocationForm.test.ts --reporter=verbose
```

Expected: new tests FAIL (draft helpers not wired up yet).

- [x] **Step 3: Rewrite `EditorLocationForm.svelte`**

Replace the entire `<script lang="ts">` block with:

```ts
import { untrack } from "svelte";
import { push } from "svelte-spa-router";
import { titleBarStore } from "../../stores/titleBarStore";
import {
  addPending,
  getDraft,
  saveDraft,
  clearDraft,
} from "./editorStorage";
import type { FormField } from "../../types/data";
import {
  createLocationFilename,
  locationFilenameToString,
  tryParseLocationName,
} from "./editorUtils";
import { fetchEditorLocation, saveEditorLocation } from "../../utils/api";
import { flattenValues } from "../../utils/formValues";
import { loadText } from "../../utils/loadText";
import AppForm from "../../components/AppForm.svelte";
import "./EditorLocationForm.css";

let {
  params,
}: {
  params: {
    project: string;
    city: string;
    filename?: string;
    newId: number;
  };
} = $props();

const isEdit = $derived(!!params.filename);

function getDraftKey(): string {
  const ns = `${params.project}/${params.city}/locations`;
  return `editor_draft_${ns}_${params.filename ?? "new"}`;
}

let fields = $state<FormField[]>([]);
let serverValues = $state<Record<string, unknown>>({});
let initialValues = $state<Record<string, unknown>>(
  // For new locations: load draft synchronously before AppForm mounts
  !params.filename ? (getDraft(getDraftKey()) ?? {}) : {},
);
let existingSha = $state<string | null>(null);
let locLoading = $state(untrack(() => Boolean(params.filename)));
let submitSuccess = $state(false);
let prUrl = $state<string | null>(null);
let submitError = $state<string | null>(null);

$effect(() => {
  titleBarStore.set({
    title: isEdit ? "Edit location" : "Add location",
    progress: null,
    backPath: `/editor/locations/${params.project}/${params.city}`,
  });
});

$effect(() => {
  loadText<FormField[]>("en", "editor/location_form").then((data) => {
    if (data) { fields = data; }
  });
});

$effect(() => {
  if (isEdit && params.filename) {
    locLoading = true;
    fetchEditorLocation(params.project, params.city, params.filename)
      .then((data) => {
        if (data.ok && data.location) {
          const flat = flattenValues(
            data.location as Record<string, unknown>,
          );
          flat["identity"] =
            tryParseLocationName(params.filename)?.title ?? "";
          serverValues = flat;
          // Draft takes priority: if one exists it represents uncommitted work
          const draft = getDraft(getDraftKey());
          initialValues = draft ?? flat;
        }
      })
      .catch(() => {})
      .finally(() => {
        locLoading = false;
      });
  }
});

async function handleSubmit(nested: Record<string, unknown>) {
  submitError = null;

  const resolvedFilename =
    isEdit && params.filename
      ? params.filename
      : locationFilenameToString(
          createLocationFilename(
            params.newId ?? 0,
            (nested["identity"] as string) ?? "",
          ),
        );

  const coords = (nested["coordinates"] ?? {}) as {
    latitude?: string;
    longitude?: string;
  };
  const location = {
    ...nested,
    coordinates: {
      latitude: parseFloat(coords.latitude ?? "0") || 0,
      longitude: parseFloat(coords.longitude ?? "0") || 0,
    },
  };

  const data = await saveEditorLocation({
    project: params.project,
    city: params.city,
    filename: resolvedFilename,
    existingSha,
    location,
  });

  if (data.ok) {
    addPending(`${params.project}/${params.city}/locations`, {
      filename: resolvedFilename!,
      locationTitle: (nested["title"] as string) ?? "",
      prUrl: data.prUrl,
      prTitle: `${isEdit ? "Edit" : "Add"} location: ${(nested["title"] as string) ?? ""}`,
      submittedAt: new Date().toISOString(),
    });
    prUrl = data.prUrl ?? null;
  } else {
    submitError = data.error ?? "Submission failed";
    throw new Error(submitError);
  }
}

function handleSuccess() {
  clearDraft(getDraftKey());
  submitSuccess = true;
}
```

Keep the template unchanged (except update `onSuccess` in the `<AppForm>` call and add `baseValues`):

```svelte
<AppForm
  {fields}
  {initialValues}
  baseValues={isEdit ? serverValues : undefined}
  onSubmit={handleSubmit}
  onValuesChange={(vals) => saveDraft(getDraftKey(), vals)}
  onSuccess={handleSuccess}
  submitLabel="Submit for review"
/>
```

- [x] **Step 4: Run the tests to confirm they pass**

```
npx vitest run src/test/EditorLocationForm.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [x] **Step 5: Run the full suite**

```
npx vitest run --reporter=verbose
```

Expected: all tests PASS.

- [x] **Step 6: Commit**

```
git add src/pages/editor/EditorLocationForm.svelte src/test/EditorLocationForm.test.ts
git commit -m "feat: draft auto-save and baseValues wiring in EditorLocationForm"
```
