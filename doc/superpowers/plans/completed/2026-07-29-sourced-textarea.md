# Sourced Textarea Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `type: textarea` form field declare `source: <location_id>.form.<field_id>`, seeding its value from another location's already-saved answer. While untouched, it stays live-synced to the source (re-resolved on every fresh mount); once the participant edits it, it freezes, with an "Update available" button to pull in the latest source value on demand, behind a confirm prompt.

**Architecture:** A new pure-logic module (`locationFormLookup.ts`) resolves a `source` reference into a stored value, built directly on the location-identity migration's `buildFormStorageKey`/`loadFormState`. `ChallengeForm.svelte` resolves all of a form's sourced fields once per mount and tracks which fields have been touched, passing both down to `AppForm.svelte` as plain props/callbacks — mirroring the existing `baseValues`/`onValuesChange` pattern exactly. A new `SourcedTextareaField.svelte` component, used only when `field.source` is set, owns the untouched/touched rendering split and the update-confirm interaction; ordinary textareas are completely untouched.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte`.

## Global Constraints

- **No git commands.** This repo's `.claude/CLAUDE.md` reserves git control for the user — do not run `git add`/`git commit`/etc. Each task ends with "ready for review," not a commit step.
- **TypeScript only** — `.svelte` files use `<script lang="ts">`; no `.js`/`.jsx`/`.tsx` in `src/`.
- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`) — no Svelte 4 `$:` syntax.
- **No Playwright/browser automation** for verification — the user does manual verification themselves.
- **New components get a co-located CSS file**, imported at the top of the `.svelte` file, with BEM-ish class names following this codebase's existing short-prefix convention (e.g. `af-textarea`, `af-confirm-msg` — not full double-underscore BEM).
- **`STORAGE_VERSION` bump required.** Per this repo's CLAUDE.md and the comment in `src/utils/formStorage.ts`, adding `touchedFields` to `FormState` is an additive, backward-compatible change — bump only the **minor** segment (`"1.0"` → `"1.1"`), not the major one.
- **Typecheck gate timing.** Task 3 (`FormState.touchedFields`) makes that field required, which breaks `ChallengeForm.svelte`'s local `stored` fallback literal (`{ values: {}, uploads: {}, submitted: false, skipped: false }`, missing the new field) until Task 6 fixes it. **Tasks 3, 4, and 5 gate on their own scoped `npm run test:run -- <pattern>` only** — a full `npm run typecheck` between Task 3 and Task 6 will show one real, expected error in `ChallengeForm.svelte`. Task 6 is the first point a full `npm run typecheck` should be clean again.
- Spec: `doc/superpowers/specs/2026-07-29-sourced-textarea-design.md`
- Depends on the already-implemented `doc/superpowers/specs/2026-07-29-location-identity-migration-design.md` — locations are addressable by their `routes.yaml` id string.

---

### Task 1: `locationFormLookup.ts` — parse and resolve `source` references

**Files:**
- Create: `src/utils/locationFormLookup.ts`
- Test: `src/test/locationFormLookup.test.ts` (new)

**Interfaces:**
- Produces: `parseSourceRef(source: string): { locationId: string; fieldId: string } | null`, `getLocationFormValue(project: string, city: string, route: string | undefined, locationId: string, fieldId: string): string | undefined`. Both are consumed by Task 2 (`loadLocations.ts`'s shape validation reuses `parseSourceRef`) and Task 6 (`ChallengeForm.svelte`'s resolution loop uses both).
- Consumes: `buildFormStorageKey`/`loadFormState` from `src/utils/formStorage.ts` (already `string`-keyed, from the location-identity migration).

- [ ] **Step 1: Write the failing tests**

Create `src/test/locationFormLookup.test.ts`:

```ts
import { parseSourceRef, getLocationFormValue } from "../utils/locationFormLookup";
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";

beforeEach(() => {
  localStorage.clear();
});

describe("parseSourceRef", () => {
  it("parses a well-formed reference into locationId and fieldId", () => {
    expect(parseSourceRef("004_loc_lange_voorhout.form.manifesto")).toEqual({
      locationId: "004_loc_lange_voorhout",
      fieldId: "manifesto",
    });
  });

  it("returns null when the '.form.' separator is missing", () => {
    expect(parseSourceRef("004_loc_lange_voorhout.manifesto")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseSourceRef("")).toBeNull();
  });
});

describe("getLocationFormValue", () => {
  it("returns the stored string value for the given location and field", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, {
      values: { manifesto: "We pledge to keep fighting." },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto"),
    ).toBe("We pledge to keep fighting.");
  });

  it("returns undefined when the location was never visited", () => {
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "999_loc_never_visited", "manifesto"),
    ).toBeUndefined();
  });

  it("returns undefined when the field was never answered", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, { values: {}, uploads: {}, submitted: false, skipped: false, touchedFields: [] });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto"),
    ).toBeUndefined();
  });

  it("returns undefined when the stored value isn't a string", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, {
      values: { manifesto: 42 as unknown as string },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto"),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- locationFormLookup`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement `locationFormLookup.ts`**

Create `src/utils/locationFormLookup.ts`:

```ts
import { buildFormStorageKey, loadFormState } from "./formStorage";

export function parseSourceRef(source: string): { locationId: string; fieldId: string } | null {
  const match = /^(.+)\.form\.(.+)$/.exec(source);
  return match ? { locationId: match[1], fieldId: match[2] } : null;
}

export function getLocationFormValue(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
  fieldId: string,
): string | undefined {
  const key = buildFormStorageKey(project, city, route, locationId);
  const value = loadFormState(key).values[fieldId];
  return typeof value === "string" ? value : undefined;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- locationFormLookup`
Expected: all PASS.

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint` and `npm run typecheck`.
Expected: no errors — this module has no other consumers yet.

- [ ] **Step 6: Ready for review**

Do not commit. Summarize the diff (`src/utils/locationFormLookup.ts`, `src/test/locationFormLookup.test.ts`) for the user to review and commit themselves.

---

### Task 2: Schema and loader validation for `source`

**Files:**
- Modify: `src/types/data.ts` (`FormField`)
- Modify: `src/data/schemas/form.schema.json`
- Modify: `src/utils/loadLocations.ts` (`KNOWN_FORM_FIELD_KEYS`, new `validateFieldSource`, `buildFieldErrorMessages`, `withValidatedFields`)
- Test: `src/test/loadText.test.ts`

**Interfaces:**
- Consumes: `parseSourceRef` from Task 1.
- Produces: `FormField.source?: string`. By the time a `FormField` reaches any renderer, `source` is guaranteed either absent, or present-and-valid-shape on a `textarea` field — `AppForm.svelte` (Task 4) does no re-validation.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/loadText.test.ts`, inside the existing `describe("loadLocations", ...)` block, after the existing `config` validation tests (before the block's closing `});`):

```ts

  it("passes through a valid source on a textarea field", async () => {
    vi.mocked(loadText)
      .mockResolvedValueOnce({
        title: "Test",
        name: { value: "Test Location" },
        coordinates: { latitude: 0, longitude: 0 },
        storyline: "Test storyline",
        breadcrumb: "Test breadcrumb",
        challenge: {
          name: "",
          description: "Do the thing",
          notes: "",
          form: "001_form_test.yaml",
        },
      } as unknown as RouteEntry)
      .mockResolvedValueOnce([
        {
          id: "final",
          type: "textarea",
          label: "Final manifesto",
          source: "004_loc_lange_voorhout.form.manifesto",
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", ["projects/test/city/001_loc_test"]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("textarea");
    expect(loc.challenge.form[0].source).toBe("004_loc_lange_voorhout.form.manifesto");
  });

  it("flags source present on a non-textarea type as a schema_error", async () => {
    vi.mocked(loadText)
      .mockResolvedValueOnce({
        title: "Test",
        name: { value: "Test Location" },
        coordinates: { latitude: 0, longitude: 0 },
        storyline: "Test storyline",
        breadcrumb: "Test breadcrumb",
        challenge: {
          name: "",
          description: "Do the thing",
          notes: "",
          form: "001_form_test.yaml",
        },
      } as unknown as RouteEntry)
      .mockResolvedValueOnce([
        {
          id: "note",
          type: "string",
          label: "Note",
          source: "004_loc_lange_voorhout.form.manifesto",
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", ["projects/test/city/001_loc_test"]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("not supported on type 'string'");
  });

  it("flags a malformed source shape as a schema_error", async () => {
    vi.mocked(loadText)
      .mockResolvedValueOnce({
        title: "Test",
        name: { value: "Test Location" },
        coordinates: { latitude: 0, longitude: 0 },
        storyline: "Test storyline",
        breadcrumb: "Test breadcrumb",
        challenge: {
          name: "",
          description: "Do the thing",
          notes: "",
          form: "001_form_test.yaml",
        },
      } as unknown as RouteEntry)
      .mockResolvedValueOnce([
        {
          id: "final",
          type: "textarea",
          label: "Final manifesto",
          source: "004_loc_lange_voorhout.manifesto",
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", ["projects/test/city/001_loc_test"]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must match");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- loadText`
Expected: the 3 new tests FAIL — `source` isn't in `KNOWN_FORM_FIELD_KEYS` yet, so every field in these fixtures currently comes back `schema_error` for "unknown properties" regardless of the new tests' intent.

- [ ] **Step 3: Add `source` to the type system**

Edit `src/types/data.ts`, in the `FormField` interface:

```ts
export interface FormField {
  id?: string;
  type: FormFieldType;
  label: string;
  subtext?: string;
  options?: string[];
  values?: string[];
  min?: number;
  max?: number;
  isRequired?: boolean;
  value?: string | number | boolean | string[];
  storeDefaultValue?: boolean;
  config?: { lineCount?: number };
  source?: string;
}
```

- [ ] **Step 4: Add `source` to the JSON schema**

Edit `src/data/schemas/form.schema.json`, in `items.properties`, after `"config"`:

```json
      "config":  {
        "type": "object",
        "properties": { "lineCount": { "type": "number" } },
        "additionalProperties": false
      },
      "source":  { "type": "string" }
```

(Matching the existing precedent in this file: the JSON schema only does coarse type-level checks; the fine-grained shape/business-rule validation — the `<location_id>.form.<field_id>` pattern, the textarea-only restriction — lives solely in `loadLocations.ts`, same as `config.lineCount`'s "must be a positive integer" rule isn't mirrored here either.)

- [ ] **Step 5: Implement validation in `loadLocations.ts`**

Edit `src/utils/loadLocations.ts`. Add the import:

```ts
import { parseSourceRef } from "./locationFormLookup";
```

Add `"source"` to `KNOWN_FORM_FIELD_KEYS`:

```ts
const KNOWN_FORM_FIELD_KEYS = new Set([
  "id",
  "type",
  "label",
  "subtext",
  "options",
  "values",
  "min",
  "max",
  "isRequired",
  "value",
  "storeDefaultValue",
  "config",
  "source",
]);
```

Add this function after `validateFieldConfig` and before `validateFieldValue`:

```ts
const SOURCE_SUPPORTED_TYPES = new Set<FormFieldType>(["textarea"]);

function validateFieldSource(field: FormField): string | null {
  if (field.source === undefined) {
    return null;
  }
  if (!SOURCE_SUPPORTED_TYPES.has(field.type)) {
    return `'source' not supported on type '${field.type}'`;
  }
  if (!parseSourceRef(field.source)) {
    return `'source' must match '<location_id>.form.<field_id>'`;
  }
  return null;
}
```

Replace `buildFieldErrorMessages` and `withValidatedFields` to also run `validateFieldSource`:

```ts
function buildFieldErrorMessages(
  fieldId: string,
  unknownKeys: string[],
  valueError: string | null,
  configError: string | null,
  sourceError: string | null,
): string[] {
  return [
    ...(unknownKeys.length > 0
      ? [`unknown properties on '${fieldId}': ${unknownKeys.join(", ")}`]
      : []),
    ...(valueError ? [valueError] : []),
    ...(configError ? [configError] : []),
    ...(sourceError ? [sourceError] : []),
  ];
}

function withValidatedFields(fields: FormField[]): FormField[] {
  return fields.map((field) => {
    const unknownKeys = Object.keys(field as unknown as Record<string, unknown>).filter(
      (key) => !KNOWN_FORM_FIELD_KEYS.has(key),
    );
    const valueError = validateFieldValue(field);
    const configError = validateFieldConfig(field);
    const sourceError = validateFieldSource(field);
    if (unknownKeys.length === 0 && !valueError && !configError && !sourceError) {
      return field;
    }
    const fieldId = field.id ?? field.label;
    return {
      id: fieldId,
      type: "schema_error" as FormFieldType,
      label: buildFieldErrorMessages(fieldId, unknownKeys, valueError, configError, sourceError).join("; "),
    };
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- loadText`
Expected: all tests in `loadText.test.ts` PASS, including the 3 new ones.

- [ ] **Step 7: Lint, typecheck, and validate existing content**

Run, in order:
1. `npm run lint` — expected: no errors (confirms `validateFieldSource`/`buildFieldErrorMessages`/`withValidatedFields` all stay well under this project's `complexity: 10` ESLint rule — each added branch is a flat array-spread or an early return, not nested conditionals).
2. `npm run typecheck` — expected: no errors.
3. `npm run validate:yaml` — expected: **still one error**, on `007_form_binnenhof.yaml`'s `source:` value (`004_form_lange_voorhout.manifesto`) — it's now a *known, type-appropriate* property, but its value doesn't match `<location_id>.form.<field_id>` shape yet. This is expected and gets fixed in Task 7; `form.schema.json`'s coarse `"type": "string"` check alone doesn't catch shape (see Step 4's note).

- [ ] **Step 8: Ready for review**

Do not commit. Summarize the diff (`src/types/data.ts`, `src/data/schemas/form.schema.json`, `src/utils/loadLocations.ts`, `src/test/loadText.test.ts`) for the user to review and commit themselves.

---

### Task 3: `SourcedTextareaField.svelte` — new component

**Files:**
- Create: `src/components/SourcedTextareaField.svelte`
- Create: `src/components/SourcedTextareaField.css`
- Test: `src/test/SourcedTextareaField.test.ts` (new)

**Interfaces:**
- Produces: a component with props `domId: string`, `value: string`, `hasError?: boolean`, `describedBy?: string`, `rows?: number`, `sourceValue: string | undefined`, `touched: boolean`, `onChange: (value: string) => void`, `onUpdateFromSource: () => void`. Consumed by Task 4 (`AppForm.svelte`).
- Consumes: nothing from other tasks — testable fully standalone.

- [ ] **Step 1: Write the failing tests**

Create `src/test/SourcedTextareaField.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import SourcedTextareaField from "../components/SourcedTextareaField.svelte";

test("renders the current value in the textarea", () => {
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "hello",
      sourceValue: "hello",
      touched: false,
      onChange: vi.fn(),
      onUpdateFromSource: vi.fn(),
    },
  });
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("hello");
});

test("calls onChange with the new value on input", async () => {
  const onChange = vi.fn();
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "hello",
      sourceValue: "hello",
      touched: false,
      onChange,
      onUpdateFromSource: vi.fn(),
    },
  });
  await fireEvent.input(screen.getByRole("textbox"), { target: { value: "hello world" } });
  expect(onChange).toHaveBeenCalledWith("hello world");
});

test("shows no Update button while untouched", () => {
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "hello",
      sourceValue: "newer text",
      touched: false,
      onChange: vi.fn(),
      onUpdateFromSource: vi.fn(),
    },
  });
  expect(screen.queryByRole("button", { name: /update available/i })).not.toBeInTheDocument();
});

test("shows the Update button once touched, when a source value has resolved", () => {
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: "newer text",
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource: vi.fn(),
    },
  });
  expect(screen.getByRole("button", { name: /update available/i })).toBeInTheDocument();
});

test("hides the Update button when touched but the source has never resolved", () => {
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: undefined,
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource: vi.fn(),
    },
  });
  expect(screen.queryByRole("button", { name: /update available/i })).not.toBeInTheDocument();
});

test("clicking Update shows a confirm prompt instead of applying immediately", async () => {
  const onUpdateFromSource = vi.fn();
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: "newer text",
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource,
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /update available/i }));
  expect(screen.getByText(/replace your edits/i)).toBeInTheDocument();
  expect(onUpdateFromSource).not.toHaveBeenCalled();
});

test("confirming the update calls onUpdateFromSource and hides the confirm prompt", async () => {
  const onUpdateFromSource = vi.fn();
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: "newer text",
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource,
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /update available/i }));
  await fireEvent.click(screen.getByRole("button", { name: /replace/i }));
  expect(onUpdateFromSource).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/replace your edits/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /update available/i })).toBeInTheDocument();
});

test("cancelling the confirm prompt leaves the value unchanged and re-shows the Update button", async () => {
  const onUpdateFromSource = vi.fn();
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: "newer text",
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource,
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /update available/i }));
  await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(onUpdateFromSource).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /update available/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- SourcedTextareaField`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Create the component**

Create `src/components/SourcedTextareaField.svelte`:

```svelte
<script lang="ts">
  import "./SourcedTextareaField.css";

  let {
    domId,
    value,
    hasError = false,
    describedBy = undefined,
    rows = 5,
    sourceValue,
    touched,
    onChange,
    onUpdateFromSource,
  }: {
    domId: string;
    value: string;
    hasError?: boolean;
    describedBy?: string;
    rows?: number;
    sourceValue: string | undefined;
    touched: boolean;
    onChange: (value: string) => void;
    onUpdateFromSource: () => void;
  } = $props();

  let showConfirm = $state(false);
</script>

<textarea
  id={domId}
  class="stf-textarea"
  class:stf-textarea--error={hasError}
  aria-describedby={describedBy}
  {rows}
  {value}
  oninput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
></textarea>

{#if touched && sourceValue !== undefined}
  {#if showConfirm}
    <div class="stf-confirm">
      <p class="stf-confirm-msg">Replace your edits with the latest source text? This can't be undone.</p>
      <div class="stf-confirm-actions">
        <button type="button" class="stf-confirm-cancel" onclick={() => (showConfirm = false)}>
          Cancel
        </button>
        <button
          type="button"
          class="stf-confirm-ok"
          onclick={() => {
            onUpdateFromSource();
            showConfirm = false;
          }}
        >
          Replace
        </button>
      </div>
    </div>
  {:else}
    <button type="button" class="stf-update-btn" onclick={() => (showConfirm = true)}>
      Update available
    </button>
  {/if}
{/if}
```

- [ ] **Step 4: Create the CSS**

Create `src/components/SourcedTextareaField.css`:

```css
.stf-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  font-size: var(--font-size-base);
  margin-top: var(--gap-field);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  resize: vertical;
  min-height: var(--field-min-height);
}

.stf-textarea:focus {
  outline: none;
  border-color: var(--field-border-focus);
  box-shadow: 0 0 0 2px var(--field-border-focus);
}

.stf-textarea--error {
  border-color: var(--color-error);
}

.stf-update-btn {
  margin-top: 6px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.stf-confirm {
  margin-top: 6px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
}

.stf-confirm-msg {
  margin: 0 0 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.stf-confirm-actions {
  display: flex;
  gap: 8px;
}

.stf-confirm-cancel,
.stf-confirm-ok {
  flex: 1;
  padding: 6px 0;
  border-radius: 6px;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.stf-confirm-cancel {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.stf-confirm-ok {
  background: var(--color-accent);
  color: #fff;
  border: none;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- SourcedTextareaField`
Expected: all PASS.

- [ ] **Step 6: Lint and typecheck**

Run: `npm run lint` and `npm run typecheck`.
Expected: no errors — this component has no other consumers yet.

- [ ] **Step 7: Ready for review**

Do not commit. Summarize the diff (`src/components/SourcedTextareaField.svelte`, `src/components/SourcedTextareaField.css`, `src/test/SourcedTextareaField.test.ts`) for the user to review and commit themselves.

---

### Task 4: `AppForm.svelte` — wire in sourced textareas

**Files:**
- Modify: `src/components/AppForm.svelte`
- Test: `src/test/AppForm.test.ts`

**Interfaces:**
- Consumes: `SourcedTextareaField` from Task 3.
- Produces: `AppForm` gains props `touchedFields?: string[]` (default `[]`), `sourceValues?: Record<string, string>` (default `{}`), `onTouchedFieldsChange?: (fields: string[]) => void`. Consumed by Task 6 (`ChallengeForm.svelte`).
- `EditorLocationForm.svelte` (the content-authoring editor, also an `AppForm` consumer) needs **no changes** — all three new props default gracefully, so a sourced-textarea field rendered there just shows with no live source resolution and no Update button, which is the correct behavior for an authoring tool that has no concept of a live hunt session.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/AppForm.test.ts`, after the last test in the file:

```ts

// ---------------------------------------------------------------------------
// Sourced textarea (field.source)
// ---------------------------------------------------------------------------

test("sourced textarea seeds its value from sourceValues when untouched", () => {
  const fields: FormField[] = [
    { id: "final", type: "textarea", label: "Final", source: "004_loc_lange_voorhout.form.manifesto" },
  ];
  render(AppForm, {
    props: { fields, sourceValues: { final: "resolved draft text" }, onSubmit: vi.fn() },
  });
  expect((screen.getByLabelText("Final") as HTMLTextAreaElement).value).toBe("resolved draft text");
});

test("sourced textarea falls back to its own value default when the source hasn't resolved", () => {
  const fields: FormField[] = [
    {
      id: "final",
      type: "textarea",
      label: "Final",
      source: "004_loc_lange_voorhout.form.manifesto",
      value: "placeholder text",
    },
  ];
  render(AppForm, { props: { fields, sourceValues: {}, onSubmit: vi.fn() } });
  expect((screen.getByLabelText("Final") as HTMLTextAreaElement).value).toBe("placeholder text");
});

test("a touched sourced field keeps the persisted value instead of the live source value", () => {
  const fields: FormField[] = [
    { id: "final", type: "textarea", label: "Final", source: "004_loc_lange_voorhout.form.manifesto" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { final: "my own edit" },
      touchedFields: ["final"],
      sourceValues: { final: "newer source text" },
      onSubmit: vi.fn(),
    },
  });
  expect((screen.getByLabelText("Final") as HTMLTextAreaElement).value).toBe("my own edit");
});

test("editing a sourced textarea reports it as touched via onTouchedFieldsChange", async () => {
  const onTouchedFieldsChange = vi.fn();
  const fields: FormField[] = [
    { id: "final", type: "textarea", label: "Final", source: "004_loc_lange_voorhout.form.manifesto" },
  ];
  render(AppForm, {
    props: {
      fields,
      sourceValues: { final: "resolved draft text" },
      onTouchedFieldsChange,
      onSubmit: vi.fn(),
    },
  });
  await fireEvent.input(screen.getByLabelText("Final"), { target: { value: "my edit" } });
  await waitFor(() => {
    expect(onTouchedFieldsChange).toHaveBeenLastCalledWith(["final"]);
  });
});

test("a plain textarea without source is unaffected by sourceValues/touchedFields props", () => {
  const fields: FormField[] = [
    { id: "story", type: "textarea", label: "Your story", value: "default" },
  ];
  render(AppForm, {
    props: { fields, sourceValues: { story: "should not apply" }, onSubmit: vi.fn() },
  });
  expect((screen.getByLabelText("Your story") as HTMLTextAreaElement).value).toBe("default");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- AppForm`
Expected: the 5 new tests FAIL — `AppForm` doesn't accept `sourceValues`/`touchedFields`/`onTouchedFieldsChange` yet, and every `textarea` renders the plain branch regardless of `field.source`. All pre-existing `AppForm.test.ts` tests still PASS.

- [ ] **Step 3: Add the new props**

Edit `src/components/AppForm.svelte`. Add the import:

```ts
import SourcedTextareaField from "./SourcedTextareaField.svelte";
```

In the props block, add `touchedFields`, `sourceValues`, and `onTouchedFieldsChange`:

```ts
  let {
    fields,
    initialValues = {},
    baseValues = undefined,
    initialUploads = {},
    baseUploads = undefined,
    touchedFields = [],
    sourceValues = {},
    onSubmit,
    onPhotoUpload = undefined,
    onVideoUpload = undefined,
    onSuccess = undefined,
    onValuesChange = undefined,
    onHasChangesChange = undefined,
    onStatusChange = undefined,
    onUploadsChange = undefined,
    onTouchedFieldsChange = undefined,
    submitLabel = "Submit",
    confirmMessage = undefined,
  }: {
    fields: FormField[];
    initialValues?: Record<string, unknown>;
    baseValues?: Record<string, unknown>;
    initialUploads?: Record<string, PhotoUploadStatus>;
    baseUploads?: Record<string, PhotoUploadStatus>;
    touchedFields?: string[];
    sourceValues?: Record<string, string>;
    onSubmit: (values: Record<string, unknown>) => Promise<void>;
    onPhotoUpload?: (file: File) => Promise<{ ok: boolean; httpCode?: number }>;
    onVideoUpload?: (video: File, poster: File) => Promise<{ ok: boolean; httpCode?: number }>;
    onSuccess?: () => void;
    onValuesChange?: (values: FieldValues) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onStatusChange?: (status: FormValidationStatus) => void;
    onUploadsChange?: (uploads: Record<string, PhotoUploadStatus>) => void;
    onTouchedFieldsChange?: (fields: string[]) => void;
    submitLabel?: string;
    confirmMessage?: string;
  } = $props();
```

- [ ] **Step 4: Seed `values` from `sourceValues` for untouched sourced fields**

Replace the `values` seeding block:

```ts
  let values = $state<FieldValues>(
    untrack(() => {
      const seeded: FieldValues = { ...(initialValues as FieldValues) };
      for (const field of fields) {
        if (!field.id) {/* no-op */} else if (
          field.type === STR_TEXTAREA &&
          field.source &&
          !touchedFields.includes(field.id) &&
          sourceValues[field.id] !== undefined
        ) {
          seeded[field.id] = sourceValues[field.id];
        } else if (
          field.value !== undefined &&
          !Object.prototype.hasOwnProperty.call(seeded, field.id)
        ) {
          seeded[field.id] = field.value as FieldValues[string];
        }
      }
      return seeded;
    }),
  );
```

(Written as an `if`/`else-if` chain rather than `continue`-based early exits — this repo's ESLint config sets `"no-continue": "error"`, so the more natural `continue` version fails lint.)

(An untouched sourced field with a resolved value always takes the fresh source content, overriding any stale persisted value from a previous mount — this is what makes it "live-synced while untouched." A touched field, or one whose source hasn't resolved yet, falls through unchanged to the existing default-seeding logic.)

- [ ] **Step 5: Add local touched-field tracking**

Add after the `hasChanges` derived and its two effects (near the other `$effect(() => { on...Change?.(...) })` blocks):

```ts
  let touchedFieldSet = $state<Set<string>>(new Set(untrack(() => touchedFields)));

  function markTouched(fieldId: string) {
    if (!touchedFieldSet.has(fieldId)) {
      touchedFieldSet = new Set(touchedFieldSet).add(fieldId);
    }
  }

  $effect(() => {
    onTouchedFieldsChange?.([...touchedFieldSet]);
  });
```

- [ ] **Step 6: Split the textarea branch**

Replace the `textarea` branch in the template:

```svelte
          {:else if field.type === "textarea"}
            {#if field.source}
              <SourcedTextareaField
                domId={domId}
                value={(values[id] as string) ?? ""}
                hasError={!!err}
                describedBy={describedBy}
                rows={field.config?.lineCount ?? 5}
                sourceValue={sourceValues[id]}
                touched={touchedFieldSet.has(id)}
                onChange={(v) => {
                  values[id] = v;
                  markTouched(id);
                }}
                onUpdateFromSource={() => {
                  const resolved = sourceValues[id];
                  if (resolved !== undefined) {
                    values[id] = resolved;
                  }
                }}
              />
            {:else}
              <textarea
                id={domId}
                class="af-textarea"
                class:af-textarea--error={err}
                aria-describedby={describedBy}
                rows={field.config?.lineCount ?? 5}
                bind:value={values[id] as string}
              ></textarea>
            {/if}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test:run -- AppForm`
Expected: all tests in `AppForm.test.ts` PASS, including the 5 new ones.

- [ ] **Step 8: Run this cluster's lint check**

Run: `npm run lint`.
Expected: no errors. **Do not run `npm run typecheck` yet** — `ChallengeForm.svelte` doesn't pass these new props yet (harmless — they're all optional with defaults) but `FormState.touchedFields` (Task 5) isn't required yet either, so typecheck is actually still clean at this point; it only breaks starting Task 5, per the Global Constraints note.

- [ ] **Step 9: Ready for review**

Do not commit. Summarize the diff (`src/components/AppForm.svelte`, `src/test/AppForm.test.ts`) for the user to review and commit themselves.

---

### Task 5: `FormState.touchedFields` and the storage version bump

**Files:**
- Modify: `src/types/data.ts` (`FormState`)
- Modify: `src/utils/formStorage.ts` (`STORAGE_VERSION`, `EMPTY_STATE`, `loadFormState`)
- Test: `src/test/formStorage.test.ts`

**Interfaces:**
- Produces: `FormState.touchedFields: string[]` (required). Consumed by Task 6 (`ChallengeForm.svelte`).
- This is the task the Global Constraints' typecheck-gate note is about: after this task, `ChallengeForm.svelte`'s `stored` fallback literal is missing the new required field, and stays broken until Task 6.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/test/formStorage.test.ts`:

```ts
import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";

beforeEach(() => {
  localStorage.clear();
});

test("buildFormStorageKey composes project/city/route/locationId", () => {
  expect(buildFormStorageKey("demo", "den_haag", "short_loop", "3")).toBe(
    "demo/den_haag/short_loop/3/form",
  );
});

test("buildFormStorageKey handles an undefined route", () => {
  expect(buildFormStorageKey("demo", "den_haag", undefined, "3")).toBe(
    "demo/den_haag//3/form",
  );
});

test("loadFormState returns empty defaults when nothing is stored", () => {
  expect(loadFormState("missing-key")).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
  });
});

test("saveFormState then loadFormState round-trips the exact state", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  const state = {
    values: { note: "hello" },
    uploads: { pic: { status: "success" as const, httpCode: 200 } },
    submitted: true,
    skipped: false,
    touchedFields: ["note"],
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
    touchedFields: [],
  });
});

test("saveFormState writes a version envelope that loadFormState reads back transparently", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  saveFormState(key, {
    values: { note: "hi" },
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
  });
  const raw = JSON.parse(localStorage.getItem(key)!);
  expect(raw.version).toBe("1.1");
  expect(loadFormState(key)).toEqual({
    values: { note: "hi" },
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
  });
});

test("loadFormState treats a pre-versioning payload (no version field) as empty", () => {
  const key = "legacy-key";
  localStorage.setItem(
    key,
    JSON.stringify({ values: { note: "old" }, uploads: {}, submitted: true, skipped: false }),
  );
  expect(loadFormState(key)).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
  });
});

test("loadFormState treats a major-version mismatch as empty", () => {
  const key = "future-key";
  localStorage.setItem(
    key,
    JSON.stringify({
      version: "2.0",
      values: { note: "future" },
      uploads: {},
      submitted: true,
      skipped: false,
    }),
  );
  expect(loadFormState(key)).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
  });
});

test("loadFormState reads a minor-version-only payload (pre-touchedFields shape) with touchedFields defaulting to empty", () => {
  const key = "spec1-key";
  localStorage.setItem(
    key,
    JSON.stringify({
      version: "1.0",
      values: { note: "kept" },
      uploads: {},
      submitted: true,
      skipped: false,
    }),
  );
  expect(loadFormState(key)).toEqual({
    values: { note: "kept" },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- formStorage`
Expected: FAIL — `touchedFields` isn't part of `FormState` yet, so it's absent from every `loadFormState` return value, and the version stays `"1.0"` instead of `"1.1"`.

- [ ] **Step 3: Add `touchedFields` to `FormState`**

Edit `src/types/data.ts`:

```ts
export interface FormState {
  values: Record<string, unknown>;
  uploads: Record<string, PhotoUploadStatus>;
  submitted: boolean;
  skipped: boolean;
  touchedFields: string[];
}
```

- [ ] **Step 4: Bump the version and update the envelope**

Edit `src/utils/formStorage.ts`. Change the version constant (keep the explanatory comment above it, only the literal changes):

```ts
const STORAGE_VERSION = "1.1";
```

Update `EMPTY_STATE`:

```ts
const EMPTY_STATE: FormState = {
  values: {},
  uploads: {},
  submitted: false,
  skipped: false,
  touchedFields: [],
};
```

Update `loadFormState`'s return object:

```ts
    return {
      values: parsed.values ?? {},
      uploads: parsed.uploads ?? {},
      submitted: parsed.submitted ?? false,
      skipped: parsed.skipped ?? false,
      touchedFields: parsed.touchedFields ?? [],
    };
```

(The two `{ ...EMPTY_STATE, values: {}, uploads: {} }` fallback returns elsewhere in this function need no edit — they already spread `EMPTY_STATE`, which now includes `touchedFields: []` automatically.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- formStorage`
Expected: all PASS.

- [ ] **Step 6: Run this cluster's lint check**

Run: `npm run lint`.
Expected: no errors. **Do not run `npm run typecheck` yet** — `ChallengeForm.svelte`'s `stored` fallback literal is now missing the required `touchedFields` field; this is the one expected error until Task 6 lands.

- [ ] **Step 7: Ready for review**

Do not commit. Summarize the diff (`src/types/data.ts`, `src/utils/formStorage.ts`, `src/test/formStorage.test.ts`) for the user to review and commit themselves. Note for the user: `npm run typecheck` will show one error in `ChallengeForm.svelte` until Task 6 lands — expected.

---

### Task 6: `ChallengeForm.svelte` — resolve sources and track touched fields

**Files:**
- Modify: `src/components/ChallengeForm.svelte`
- Test: `src/test/ChallengeForm.test.ts`

**Interfaces:**
- Consumes: `parseSourceRef`/`getLocationFormValue` (Task 1), `AppForm`'s `touchedFields`/`sourceValues`/`onTouchedFieldsChange` props (Task 4), `FormState.touchedFields` (Task 5).
- This is the last task in the chain — after this task, a full `npm run typecheck` should be clean.

- [ ] **Step 1: Write the failing tests**

Edit `src/test/ChallengeForm.test.ts`. Update the one existing `saveFormState` call missing `touchedFields` (in `"restores previously-entered values and submitted state from local storage on mount"`):

```ts
  saveFormState(key, {
    values: { note: "restored text" },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
```

Add these tests at the end of the file:

```ts

// ---------------------------------------------------------------------------
// Sourced textarea (cross-location prefill)
// ---------------------------------------------------------------------------

test("a sourced textarea seeds its value from another location's already-saved answer", () => {
  const sourceKey = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
  saveFormState(sourceKey, {
    values: { manifesto: "We pledge to keep fighting." },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  const sourcedForm = [
    {
      id: "final_manifesto",
      type: "textarea" as const,
      label: "Final manifesto",
      source: "004_loc_lange_voorhout.form.manifesto",
    },
  ];
  render(ChallengeForm, {
    props: {
      form: sourcedForm,
      locationId: "007_loc_binnenhof",
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
    },
  });
  expect((screen.getByLabelText("Final manifesto") as HTMLTextAreaElement).value).toBe(
    "We pledge to keep fighting.",
  );
});

test("a sourced textarea is empty when the source location was never visited", () => {
  const sourcedForm = [
    {
      id: "final_manifesto",
      type: "textarea" as const,
      label: "Final manifesto",
      source: "999_loc_never_visited.form.manifesto",
    },
  ];
  render(ChallengeForm, {
    props: {
      form: sourcedForm,
      locationId: "007_loc_binnenhof",
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
    },
  });
  expect((screen.getByLabelText("Final manifesto") as HTMLTextAreaElement).value).toBe("");
});

test("editing a sourced textarea and remounting keeps the edit instead of re-syncing from a changed source", async () => {
  const sourceKey = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
  const targetKey = buildFormStorageKey("demo", "den_haag", "short_loop", "007_loc_binnenhof");
  saveFormState(sourceKey, {
    values: { manifesto: "Original draft." },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  const sourcedForm = [
    {
      id: "final_manifesto",
      type: "textarea" as const,
      label: "Final manifesto",
      source: "004_loc_lange_voorhout.form.manifesto",
    },
  ];
  const { unmount } = render(ChallengeForm, {
    props: {
      form: sourcedForm,
      locationId: "007_loc_binnenhof",
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
    },
  });
  await fireEvent.input(screen.getByLabelText("Final manifesto"), {
    target: { value: "My own final words." },
  });
  await waitFor(() => {
    expect(JSON.parse(localStorage.getItem(targetKey)!).touchedFields).toEqual(["final_manifesto"]);
  });
  unmount();

  // Simulating the participant going back and revising the draft after
  // already having edited the target field.
  saveFormState(sourceKey, {
    values: { manifesto: "Revised draft." },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });

  render(ChallengeForm, {
    props: {
      form: sourcedForm,
      locationId: "007_loc_binnenhof",
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
    },
  });
  expect((screen.getByLabelText("Final manifesto") as HTMLTextAreaElement).value).toBe(
    "My own final words.",
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- ChallengeForm`
Expected: the 3 new tests FAIL — `ChallengeForm` doesn't resolve `source` or track touched fields yet. The updated `saveFormState` call in the pre-existing restore test should already pass (it's just a literal fix for the new required field).

- [ ] **Step 3: Rewrite `ChallengeForm.svelte`**

Replace the full contents of `src/components/ChallengeForm.svelte`:

```svelte
<script lang="ts">
  import { untrack } from "svelte";
  import { authStore } from "../stores/authStore";
  import type { FormField, PhotoUploadStatus } from "../types/data";
  import { postFormSubmit, postPhotoUpload, postVideoUpload } from "../utils/api";
  import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";
  import { parseSourceRef, getLocationFormValue } from "../utils/locationFormLookup";
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
    locationId: string;
    routeId?: string;
    project?: string;
    cityId?: string;
    taskTitle?: string;
    storeInLocalStorage?: boolean;
    allowResubmit?: boolean;
    onFormStatusChange?: (status: { submitted: boolean; missingLabels: string[] }) => void;
  } = $props();

  const storageKey = untrack(() => buildFormStorageKey(project, cityId, routeId, locationId));
  const stored = untrack(() =>
    storeInLocalStorage
      ? loadFormState(storageKey)
      : { values: {}, uploads: {}, submitted: false, skipped: false, touchedFields: [] },
  );

  let baseValues = $state<Record<string, unknown>>(stored.values);
  let baseUploads = $state<Record<string, PhotoUploadStatus>>(stored.uploads);
  let latestValues = $state<Record<string, unknown>>(stored.values);
  let latestUploads = $state<Record<string, PhotoUploadStatus>>(stored.uploads);
  let hasSubmittedOnce = $state(stored.submitted);
  let skipped = $state(stored.skipped);
  let touchedFields = $state<string[]>(stored.touchedFields);

  const sourceValues = untrack(() => {
    const result: Record<string, string> = {};
    for (const field of form) {
      if (field.type === "textarea" && field.source && field.id) {
        const ref = parseSourceRef(field.source);
        if (ref) {
          const value = getLocationFormValue(project, cityId, routeId, ref.locationId, ref.fieldId);
          if (value !== undefined) {
            result[field.id] = value;
          }
        }
      }
    }
    return result;
  });

  function persist(
    vals: Record<string, unknown>,
    ups: Record<string, PhotoUploadStatus>,
    submitted: boolean,
    skp: boolean,
    touched: string[],
  ) {
    if (storeInLocalStorage) {
      saveFormState(storageKey, { values: vals, uploads: ups, submitted, skipped: skp, touchedFields: touched });
    }
  }

  function handleValuesChange(values: Record<string, unknown>) {
    latestValues = values;
    persist(
      values,
      untrack(() => latestUploads),
      untrack(() => hasSubmittedOnce),
      untrack(() => skipped),
      untrack(() => touchedFields),
    );
  }

  function handleUploadsChange(uploads: Record<string, PhotoUploadStatus>) {
    latestUploads = uploads;
    persist(
      untrack(() => latestValues),
      uploads,
      untrack(() => hasSubmittedOnce),
      untrack(() => skipped),
      untrack(() => touchedFields),
    );
  }

  function handleTouchedFieldsChange(fields: string[]) {
    touchedFields = fields;
    persist(
      untrack(() => latestValues),
      untrack(() => latestUploads),
      untrack(() => hasSubmittedOnce),
      untrack(() => skipped),
      fields,
    );
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
    persist(latestValues, latestUploads, true, skipped, untrack(() => touchedFields));
    onFormStatusChange?.({ submitted: true, missingLabels: [] });
  }

  async function handlePhotoUpload(file: File): Promise<{ ok: boolean; httpCode?: number }> {
    return postPhotoUpload({ locationId, cityId, routeId, taskTitle, file });
  }

  async function handleVideoUpload(
    video: File,
    poster: File,
  ): Promise<{ ok: boolean; httpCode?: number }> {
    return postVideoUpload({ locationId, cityId, routeId, taskTitle, video, poster });
  }
</script>

<div class="challenge-form">
  {#if hasSubmittedOnce && !allowResubmit}
    <p class="cf-success">Submitted! ✓</p>
  {:else}
    <div class="cf-form-wrap">
      <AppForm
        fields={form}
        initialValues={baseValues}
        {baseValues}
        initialUploads={baseUploads}
        {baseUploads}
        {touchedFields}
        {sourceValues}
        onSubmit={handleSubmit}
        onPhotoUpload={handlePhotoUpload}
        onVideoUpload={handleVideoUpload}
        onSuccess={handleSuccess}
        onValuesChange={handleValuesChange}
        onUploadsChange={handleUploadsChange}
        onTouchedFieldsChange={handleTouchedFieldsChange}
        onStatusChange={handleStatusChange}
        confirmMessage="Submit your answers?"
        submitLabel={hasSubmittedOnce ? "Re-submit" : "Submit"}
      />
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- ChallengeForm`
Expected: all PASS, including the 3 new ones.

- [ ] **Step 5: Run the full test suite, lint, and typecheck**

Run, in order:
1. `npm run test:run` — expected: all tests PASS across the whole repo.
2. `npm run lint` — expected: no errors.
3. `npm run typecheck` — expected: no errors. This is the first point in this plan where a full, repo-wide typecheck should be clean again.

- [ ] **Step 6: Ready for review**

Do not commit. Summarize the diff (`src/components/ChallengeForm.svelte`, `src/test/ChallengeForm.test.ts`) for the user to review and commit themselves.

---

### Task 7: Content fix — `007_form_binnenhof.yaml`'s `source:` value

**Files:**
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/007_form_binnenhof.yaml`

**Interfaces:** none — content only.

- [ ] **Step 1: Update the stale reference**

Edit `src/data/text/en/projects/democrats_abroad/den_haag/007_form_binnenhof.yaml`. Change:

```yaml
  source: 004_form_lange_voorhout.manifesto
```

to:

```yaml
  source: 004_loc_lange_voorhout.form.manifesto
```

(`004_loc_lange_voorhout` is the location id used in `routes.yaml` for the "Huddle" location whose form file, `004_form_lange_voorhout.yaml`, has a field with `id: manifesto` — this is the draft-manifesto field this final-manifesto textarea should prefill from.)

- [ ] **Step 2: Validate the content**

Run: `npm run validate:yaml`
Expected: no errors — `007_form_binnenhof.yaml`'s `source` is now both a known property (Task 2) and correctly shaped.

- [ ] **Step 3: Ready for review**

Do not commit. Summarize the diff (the one YAML file) for the user to review and commit themselves. Note for the user: manual verification in the running app — walking to `004_loc_lange_voorhout`, writing a draft manifesto, then reaching `007_loc_binnenhof` and confirming the final-manifesto field is pre-filled with it — is manual/UI verification the user does themselves, not run via Playwright.

---

### Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: all tests PASS.

- [ ] **Step 2: Lint and typecheck**

Run: `npm run lint` and `npm run typecheck`.
Expected: no errors in either.

- [ ] **Step 3: Validate content**

Run: `npm run validate:yaml`
Expected: no errors.

- [ ] **Step 4: Ready for review**

Do not commit. Report to the user that the sourced-textarea feature (Tasks 1-7) is complete and passing.

---

## Self-Review Notes

- **Spec coverage:** Reference format & Section 1 (schema) → Task 2. Section 2 (resolution) → Task 1. Section 3 (persisted state + `ChallengeForm` wiring) → Tasks 5-6. Section 4 (`SourcedTextareaField.svelte`) → Tasks 3-4. Section 5 (testing) → covered per-task; the `007_form_binnenhof.yaml` content fix → Task 7. Non-goals (textarea-only, mount-time-only resolution, full-overwrite update, no route-existence validation) → not implemented anywhere in this plan, as intended.
- **Placeholder scan:** no TBD/TODO; every step has complete, exact code with file paths.
- **Type consistency:** `parseSourceRef`/`getLocationFormValue` signatures (Task 1) match their usage in `loadLocations.ts` (Task 2, `parseSourceRef` only) and `ChallengeForm.svelte` (Task 6, both). `SourcedTextareaField`'s prop names (`domId`, `value`, `hasError`, `describedBy`, `rows`, `sourceValue`, `touched`, `onChange`, `onUpdateFromSource`) match exactly between Task 3's component and Task 4's `AppForm.svelte` usage. `FormState.touchedFields: string[]` (Task 5) matches every literal constructing a `FormState`-shaped value touched in this plan (`ChallengeForm.svelte`'s `stored` fallback, and every `formStorage.test.ts`/`ChallengeForm.test.ts`/`locationFormLookup.test.ts` fixture).
- **Dependency ordering:** Task 1 is a clean leaf. Task 2 consumes Task 1. Task 3 is an independent leaf (no consumers yet). Task 4 consumes Task 3, and is clean on landing (its new props are all optional). Task 5 is independent of Tasks 1-4 but introduces the one expected transient typecheck break, deliberately placed immediately before Task 6 to minimize how long it's outstanding. Task 6 consumes Tasks 1, 4, and 5, and closes the chain. Task 7 depends on Task 2 (so `source` is a known, accepted field) but not on Tasks 3-6 (the schema/validation and the runtime behavior are independent concerns). The Global Constraints section calls out the one place `npm run typecheck` is not a valid gate, so the executing engineer doesn't mistake it for a mistake in Task 4 or 5's own work.
- **Scope check:** eight tasks, each independently testable via its own scoped Vitest run (`locationFormLookup`, `loadText`, `SourcedTextareaField`, `AppForm`, `formStorage`, `ChallengeForm`) plus one content-only task and one final full-suite verification.
