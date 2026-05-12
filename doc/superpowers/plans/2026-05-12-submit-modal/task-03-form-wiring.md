# Task 03 — EditorLocationForm: wire modal, timeout, retry

**Files:**
- Modify: `src/pages/editor/EditorLocationForm.svelte`
- Modify: `src/test/EditorLocationForm.test.ts`

**Context:** Wire the SubmitModal into EditorLocationForm. On submit: write a `"submitting"` entry to localStorage, open the modal. On success: update to `"pending"`, set modal to success. On failure or 30 s timeout: update to `"failed"`, set modal to failed. Replace the old full-page success screen and inline error banner. Add `retrySubmit()` for modal retry. Migrate `checkDraftStaleness` to use `prWasClosed`. **Depends on Tasks 01 and 02.**

---

- [ ] **Step 1: Update the existing success test and add new tests**

Open `src/test/EditorLocationForm.test.ts`. Make the following changes:

**1a. Update the import** — add `updatePendingStatus` to the import from editorStorage, and add `addPending` with a `status` field in calls:

No import change needed yet — just note that `addPending` calls in the test file must supply `status`. Update the existing `addPending` calls in the PR-staleness tests to add `status: "pending"`:

In the test `"clears draft and reloads server values when PR is closed"`, update the `addPending` call:
```ts
addPending("democrats_abroad/den_haag/locations", {
  filename: "001_loc_binnenhof.yaml",
  locationTitle: "Binnenhof",
  prUrl: "https://github.com/org/repo/pull/99",
  prTitle: "Edit location: Binnenhof",
  submittedAt: new Date().toISOString(),
  status: "pending",   // ADD THIS
});
```

In the test `"keeps draft when PR is still open"`, update similarly:
```ts
addPending("democrats_abroad/den_haag/locations", {
  filename: "001_loc_binnenhof.yaml",
  locationTitle: "Binnenhof",
  prUrl: "https://github.com/org/repo/pull/55",
  prTitle: "Edit location: Binnenhof",
  submittedAt: new Date().toISOString(),
  status: "pending",   // ADD THIS
});
```

**1b. Update the success test** — the form no longer shows a full-page "changes submitted for review" text; it now shows the modal heading. Replace the test `"submits form and shows success state"`:

```ts
test("submits form and shows modal in success state", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "A great place." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );
  await waitFor(() => {
    expect(
      screen.getByText(/form submitted for review/i),
    ).toBeInTheDocument();
  });
});
```

**1c. Add a failure modal test** — append after the success test:

```ts
test("shows failure modal when API returns an error", async () => {
  vi.mocked(saveEditorLocation).mockResolvedValueOnce({
    ok: false,
    error: "GitHub 422: branch exists",
  });
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "A great place." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );
  await waitFor(() => {
    expect(screen.getByText(/submission failed/i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub 422: branch exists/)).toBeInTheDocument();
  });
});
```

**1d. Add a retry test** — append after the failure test:

```ts
test("retry re-submits and shows success modal on second attempt", async () => {
  vi.mocked(saveEditorLocation)
    .mockResolvedValueOnce({ ok: false, error: "First attempt failed" })
    .mockResolvedValueOnce({
      ok: true,
      prUrl: "https://github.com/org/repo/pull/42",
    });

  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "A great place." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );
  await waitFor(() => {
    expect(screen.getByText(/submission failed/i)).toBeInTheDocument();
  });
  await fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  await waitFor(() => {
    expect(screen.getByText(/form submitted for review/i)).toBeInTheDocument();
  });
  expect(vi.mocked(saveEditorLocation)).toHaveBeenCalledTimes(2);
});
```

**1e. Add an isNewPr detection test** — append after the retry test:

```ts
test("shows 'Opening PR' when previous failed entry has no prUrl", async () => {
  localStorage.clear();
  addPending("democrats_abroad/den_haag/locations", {
    filename: "000_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Add location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "failed",
    isNew: true,
  });

  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "A great place." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );
  await waitFor(() => {
    expect(screen.getByText(/Opening PR:/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to confirm the new ones fail**

```
npx vitest run src/test/EditorLocationForm.test.ts --reporter=verbose
```

Expected: the new tests FAIL (modal not yet wired); the existing staleness tests may also fail due to the `status` field now being required by TypeScript.

- [ ] **Step 3: Rewrite `src/pages/editor/EditorLocationForm.svelte`**

Replace the entire file with:

```svelte
<script lang="ts">
  import { untrack } from "svelte";
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";
  import {
    addPending,
    getDraft,
    saveDraft,
    updatePendingStatus,
    prWasClosed,
    findPendingByFilename,
  } from "./editorStorage";
  import type { FormField } from "../../types/data";
  import {
    createLocationFilename,
    locationFilenameToString,
    tryParseLocationName,
  } from "./editorUtils";
  import {
    fetchEditorLocation,
    saveEditorLocation,
    fetchPrStatuses,
  } from "../../utils/api";
  import { flattenValues } from "../../utils/formValues";
  import { loadText } from "../../utils/loadText";
  import AppForm from "../../components/AppForm.svelte";
  import SubmitModal from "./SubmitModal.svelte";
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
  const namespace = $derived(`${params.project}/${params.city}/locations`);

  function getDraftKey(): string {
    return `editor_draft_${namespace}_${params.filename ?? "new"}`;
  }

  const draftKey = $derived(getDraftKey());

  let fields = $state<FormField[]>([]);
  let serverValues = $state<Record<string, unknown>>({});
  let initialValues = $state<Record<string, unknown>>(
    untrack(() => (!params.filename ? (getDraft(draftKey) ?? {}) : {})),
  );
  let existingSha = $state<string | null>(null);
  let locLoading = $state(untrack(() => Boolean(params.filename)));
  let checkingDraft = $state(false);

  // Modal state
  let showModal = $state(false);
  let modalState = $state<"submitting" | "success" | "failed">("submitting");
  let modalPrTitle = $state("");
  let modalIsNewPr = $state(true);
  let modalExistingPrUrl = $state<string | undefined>(undefined);
  let modalNewPrUrl = $state<string | undefined>(undefined);
  let modalError = $state<string | undefined>(undefined);
  let lastSubmittedNested = $state<Record<string, unknown>>({});

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

  async function checkDraftStaleness(): Promise<boolean> {
    const filename = params.filename ?? "new";
    const pending = findPendingByFilename(namespace, filename);
    if (!pending?.prUrl) return false;

    const match = (pending.prUrl as string).match(/\/pull\/(\d+)/);
    if (!match) return false;

    try {
      const data = await fetchPrStatuses([match[1]]);
      if (data.ok && data.statuses && data.statuses[match[1]] === "closed") {
        prWasClosed(namespace, filename);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  async function reloadData(): Promise<void> {
    checkingDraft = true;
    const wasStale = await checkDraftStaleness();
    if (isEdit && params.filename) {
      locLoading = true;
      try {
        const data = await fetchEditorLocation(params.project, params.city, params.filename);
        if (data.ok && data.location) {
          const flat = flattenValues(data.location as Record<string, unknown>);
          flat["identity"] = tryParseLocationName(params.filename)?.title ?? "";
          serverValues = flat;
          existingSha = data.sha ?? null;
          if (wasStale) {
            initialValues = flat;
          } else {
            const draft = getDraft(draftKey);
            initialValues = draft ?? flat;
          }
        }
      } catch { /* ignore */ }
      locLoading = false;
    } else if (wasStale) {
      initialValues = {};
    }
    checkingDraft = false;
  }

  $effect(() => {
    if (isEdit && params.filename) {
      reloadData();
    } else {
      checkDraftStaleness();
    }
  });

  async function handleSubmit(nested: Record<string, unknown>) {
    lastSubmittedNested = nested;

    const resolvedFilename =
      isEdit && params.filename
        ? params.filename
        : locationFilenameToString(
            createLocationFilename(
              params.newId ?? 0,
              (nested["identity"] as string) ?? "",
            ),
          );

    const existingEntry = findPendingByFilename(namespace, resolvedFilename);
    const isNewPr =
      !existingEntry ||
      (existingEntry.status === "failed" &&
        !(existingEntry.prUrl as string | undefined));
    const existingPrUrl = isNewPr
      ? undefined
      : (existingEntry?.prUrl as string | undefined);
    const locationTitle = (nested["title"] as string) ?? "";
    const prTitle = `${isEdit ? "Edit" : "Add"} location: ${locationTitle}`;

    addPending(namespace, {
      filename: resolvedFilename,
      locationTitle,
      prUrl: existingPrUrl,
      prTitle,
      submittedAt: new Date().toISOString(),
      status: "submitting",
      isNew: !isEdit,
    });

    modalPrTitle = prTitle;
    modalIsNewPr = isNewPr;
    modalExistingPrUrl = existingPrUrl;
    modalNewPrUrl = undefined;
    modalError = undefined;
    modalState = "submitting";
    showModal = true;

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

    const TIMEOUT_MS = 30_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Request timed out after 30s")),
        TIMEOUT_MS,
      ),
    );

    let data: { ok: boolean; prUrl?: string; error?: string };
    try {
      data = await Promise.race([
        saveEditorLocation({
          project: params.project,
          city: params.city,
          filename: resolvedFilename,
          existingSha,
          location,
        }),
        timeoutPromise,
      ]);
    } catch (err) {
      updatePendingStatus(namespace, resolvedFilename, "failed");
      modalError = err instanceof Error ? err.message : "Request failed";
      modalState = "failed";
      throw err;
    }

    if (data.ok) {
      addPending(namespace, {
        filename: resolvedFilename,
        locationTitle,
        prUrl: data.prUrl,
        prTitle,
        submittedAt: new Date().toISOString(),
        status: "pending",
        isNew: !isEdit,
      });
      modalNewPrUrl = data.prUrl ?? undefined;
    } else {
      updatePendingStatus(namespace, resolvedFilename, "failed");
      modalError = data.error ?? "Submission failed";
      modalState = "failed";
      throw new Error(modalError);
    }
  }

  function handleSuccess() {
    modalState = "success";
  }

  async function retrySubmit() {
    modalState = "submitting";
    try {
      await handleSubmit(lastSubmittedNested);
      handleSuccess();
    } catch {
      // modalState already set to "failed" inside handleSubmit
    }
  }
</script>

{#if locLoading || fields.length === 0}
  <div class="loc-form__loading">Loading…</div>
{:else}
  <div class="loc-form">
    <AppForm
      {fields}
      {initialValues}
      baseValues={isEdit ? serverValues : undefined}
      onSubmit={handleSubmit}
      onValuesChange={(vals) => saveDraft(draftKey, vals)}
      onSuccess={handleSuccess}
      submitLabel="Submit for review"
    />

    <div class="loc-form__actions">
      <button
        class="loc-form__cancel"
        onclick={() =>
          push(`/editor/locations/${params.project}/${params.city}`)}
      >
        Cancel
      </button>
      <button
        class="loc-form__refresh"
        onclick={reloadData}
        disabled={checkingDraft}
      >
        {checkingDraft ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  </div>

  {#if showModal}
    <SubmitModal
      state={modalState}
      prTitle={modalPrTitle}
      isNewPr={modalIsNewPr}
      existingPrUrl={modalExistingPrUrl}
      newPrUrl={modalNewPrUrl}
      error={modalError}
      onBack={() => push(`/editor/locations/${params.project}/${params.city}`)}
      onRetry={retrySubmit}
    />
  {/if}
{/if}
```

Also remove the now-unused CSS rules from `src/pages/editor/EditorLocationForm.css` — delete `.loc-form__success`, `.loc-form__pr-link`, and `.loc-form__error` since these elements no longer exist in the template. The rest of the CSS stays unchanged.

- [ ] **Step 4: Run the EditorLocationForm tests**

```
npx vitest run src/test/EditorLocationForm.test.ts --reporter=verbose
```

Expected: all tests PASS including the new failure, retry, and isNewPr tests.

- [ ] **Step 5: Run the full suite**

```
npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/pages/editor/EditorLocationForm.svelte src/pages/editor/EditorLocationForm.css src/test/EditorLocationForm.test.ts
git commit -m "feat: wire SubmitModal into EditorLocationForm — modal replaces inline success/error, adds timeout and retry"
```
