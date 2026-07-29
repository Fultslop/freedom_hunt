# Form Field Prefill Value Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a challenge form's YAML define a `value` (prefill) and optional `storeDefaultValue` flag on `string`, `textarea`, `number`, `boolean`, `radio`, and `multiple` fields, so a participant sees a pre-filled answer instead of a blank field.

**Architecture:** Two independent layers, matching the existing form-field pattern. (1) Content-authoring layer — `FormFieldType`/`FormField` in `src/types/data.ts`, `form.schema.json`, and `loadLocations.ts`'s existing `withValidatedFields` unknown-key mechanism, extended with the same visible `schema_error` treatment for bad `value`/`storeDefaultValue` combinations. (2) Runtime layer — `AppForm.svelte`'s existing `initialValues`/`baseValues` machinery already supports pre-filled state and a divergent hasChanges baseline; this plan seeds `values` from `field.value` when no stored value exists, and adds a `getBaseline` helper so `storeDefaultValue` controls whether the seeded default already counts as an answer. No changes needed to `ChallengeForm.svelte` or `formStorage.ts` — the "never stored" signal is exactly what an absent key in `initialValues` already looks like.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte`, `ajv`-based YAML schema validation (`npm run validate:yaml`).

## Global Constraints

- **No git commands.** This repo's `.claude/CLAUDE.md` reserves git control for the user — do not run `git add`/`git commit`/etc. Each task ends with "ready for review," not a commit step.
- **TypeScript only** — `.svelte` files use `<script lang="ts">`; no `.js`/`.jsx`/`.tsx` in `src/`.
- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`) — no Svelte 4 `$:` syntax.
- **No Playwright/browser automation** for verification — the user does manual verification themselves.
- **Stored answer always wins.** `field.value` only seeds a field with no entry in `initialValues` at all (checked via key presence, not truthiness — an explicit `""`, `false`, or `[]` counts as stored).
- **Single validation tier, no silent warnings.** Any invalid `value`/`storeDefaultValue` authoring mistake — unsupported type, JS-shape mismatch, or an option not present in `options` — replaces the whole field with a visible `schema_error` field, exactly like an unknown YAML key does today. No console-only warnings, no partial-array filtering.
- **`storeDefaultValue` defaults to `true`** (accepting the default counts as an answer immediately, Submit enables without the participant touching the field).
- Spec: `doc/superpowers/specs/2026-07-29-form-field-prefill-value-design.md`

---

### Task 1: Schema, type, and loader validation for `value` / `storeDefaultValue`

**Files:**
- Modify: `src/types/data.ts:3-26` (`FormFieldType` union stays the same; `FormField` interface gets two new fields)
- Modify: `src/data/schemas/form.schema.json:9-22` (`properties`)
- Modify: `src/utils/loadLocations.ts:15-42` (`KNOWN_FORM_FIELD_KEYS`, `withValidatedFields`)
- Test: `src/test/loadText.test.ts`

**Interfaces:**
- Produces: `FormField.value?: string | number | boolean | string[]` and `FormField.storeDefaultValue?: boolean`, both consumed by Task 2's `AppForm.svelte` seeding logic. By the time a `FormField` reaches `AppForm.svelte`, `value` is guaranteed to already be valid for its field's type (JS shape correct, and for `radio`/`multiple`, every entry present in `options`) — Task 2 does no re-validation.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/loadText.test.ts`, inside the existing `describe("loadLocations", ...)` block, right before its closing `});` (after the `"accepts a random_value field's values property..."` test, i.e. after line 115):

```ts
  it("passes through a valid value/storeDefaultValue on every supported type", async () => {
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
        { id: "note", type: "string", label: "Note", value: "Default text" },
        { id: "story", type: "textarea", label: "Story", value: "Default story" },
        { id: "count", type: "number", label: "Count", value: 3 },
        { id: "agree", type: "boolean", label: "Agree", value: true },
        {
          id: "time",
          type: "radio",
          label: "Time",
          options: ["Morning", "Afternoon"],
          value: "Afternoon",
        },
        {
          id: "interests",
          type: "multiple",
          label: "Interests",
          options: ["History", "Food", "Art"],
          min: 1,
          max: 2,
          value: ["History", "Art"],
          storeDefaultValue: false,
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form).toHaveLength(6);
    expect(loc.challenge.form.every((f) => f.type !== "schema_error")).toBe(true);
    expect(loc.challenge.form[5].storeDefaultValue).toBe(false);
  });

  it("flags value/storeDefaultValue on an unsupported field type as a schema_error", async () => {
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
        { id: "pic", type: "photo", label: "Take a photo", value: "oops" },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("not supported on type 'photo'");
  });

  it("flags a value whose JS shape doesn't match the field type as a schema_error", async () => {
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
        { id: "count", type: "number", label: "Count", value: "three" },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be a number");
  });

  it("flags a radio value not present in options as a schema_error", async () => {
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
          id: "time",
          type: "radio",
          label: "Time",
          options: ["Morning", "Afternoon"],
          value: "Evenign",
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be one of this field's 'options'");
  });

  it("flags a multiple value with one entry not present in options as a schema_error for the whole field", async () => {
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
          id: "interests",
          type: "multiple",
          label: "Interests",
          options: ["History", "Food", "Art"],
          min: 1,
          max: 2,
          value: ["History", "Musci"],
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be an array of this field's 'options'");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- loadText`
Expected: the 5 new tests FAIL. The "passes through a valid value..." test fails because `value`/`storeDefaultValue` aren't yet in `KNOWN_FORM_FIELD_KEYS`, so every field currently comes back as `schema_error` for "unknown properties". The 4 error-case tests currently produce a `schema_error` too, but with the wrong message (`"unknown properties on '...': value"` instead of the new type-specific message), so their `toContain` assertions fail. All pre-existing `loadText.test.ts` tests still PASS.

- [ ] **Step 3: Add the two keys to the type system**

Edit `src/types/data.ts`, in the `FormField` interface (`data.ts:16-26`):

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
}
```

- [ ] **Step 4: Add the two keys to the JSON schema**

Edit `src/data/schemas/form.schema.json`, in `items.properties` (`form.schema.json:9-22`):

```json
      "id":    { "type": "string" },
      "type":  {
        "type": "string",
        "enum": ["boolean", "string", "number", "radio", "multiple", "photo", "textarea", "section", "random_value"]
      },
      "label":   { "type": "string" },
      "subtext": { "type": "string" },
      "options": { "type": "array", "items": { "type": "string" } },
      "values":  { "type": "array", "items": { "type": "string" } },
      "min":     { "type": "number" },
      "max":     { "type": "number" },
      "value":   { "type": ["string", "number", "boolean", "array"], "items": { "type": "string" } },
      "storeDefaultValue": { "type": "boolean" }
```

(Structural typing only, matching how `options`/`min`/`max` are already loosely typed here — cross-field checks like "radio value must be in options" belong in `loadLocations.ts`, not the JSON schema, same as the existing "radio missing options" check living in `AppForm.svelte` rather than the schema.)

- [ ] **Step 5: Implement validation in `loadLocations.ts`**

Edit `src/utils/loadLocations.ts`. Replace lines 15-42 with:

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
]);

const VALUE_SUPPORTED_TYPES = new Set<FormFieldType>([
  "string",
  "textarea",
  "number",
  "boolean",
  "radio",
  "multiple",
]);

function validateFieldValue(field: FormField): string | null {
  const hasValue = Object.prototype.hasOwnProperty.call(field, "value");
  const hasStoreDefaultValue = Object.prototype.hasOwnProperty.call(
    field,
    "storeDefaultValue",
  );
  if (!hasValue && !hasStoreDefaultValue) {
    return null;
  }
  if (!VALUE_SUPPORTED_TYPES.has(field.type)) {
    return `'value'/'storeDefaultValue' not supported on type '${field.type}'`;
  }
  if (hasStoreDefaultValue && typeof field.storeDefaultValue !== "boolean") {
    return `'storeDefaultValue' must be a boolean`;
  }
  if (!hasValue) {
    return null;
  }
  const value = field.value;
  if (field.type === "string" || field.type === "textarea") {
    if (typeof value !== "string") {
      return `'value' must be a string for type '${field.type}'`;
    }
  } else if (field.type === "number") {
    if (typeof value !== "number") {
      return `'value' must be a number for type 'number'`;
    }
  } else if (field.type === "boolean") {
    if (typeof value !== "boolean") {
      return `'value' must be a boolean for type 'boolean'`;
    }
  } else if (field.type === "radio") {
    if (typeof value !== "string" || !(field.options ?? []).includes(value)) {
      return `'value' must be one of this field's 'options'`;
    }
  } else if (field.type === "multiple") {
    if (
      !Array.isArray(value) ||
      !value.every(
        (v) => typeof v === "string" && (field.options ?? []).includes(v),
      )
    ) {
      return `'value' must be an array of this field's 'options'`;
    }
  }
  return null;
}

function withValidatedFields(fields: FormField[]): FormField[] {
  return fields.map((field) => {
    const unknownKeys = Object.keys(field as unknown as Record<string, unknown>).filter(
      (key) => !KNOWN_FORM_FIELD_KEYS.has(key),
    );
    const valueError = validateFieldValue(field);
    if (unknownKeys.length === 0 && !valueError) {
      return field;
    }
    const fieldId = field.id ?? field.label;
    const messages = [
      ...(unknownKeys.length > 0
        ? [`unknown properties on '${fieldId}': ${unknownKeys.join(", ")}`]
        : []),
      ...(valueError ? [valueError] : []),
    ];
    return {
      id: fieldId,
      type: "schema_error" as FormFieldType,
      label: messages.join("; "),
    };
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- loadText`
Expected: all tests in `loadText.test.ts` PASS, including the 5 new ones.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Validate existing YAML content against the updated schema**

Run: `npm run validate:yaml`
Expected: no errors (confirms the additive schema change doesn't break any existing content file).

- [ ] **Step 9: Ready for review**

Do not commit. Summarize the diff (`src/types/data.ts`, `src/data/schemas/form.schema.json`, `src/utils/loadLocations.ts`, `src/test/loadText.test.ts`) for the user to review and commit themselves.

---

### Task 2: `AppForm.svelte` prefill seeding and `storeDefaultValue` baseline behavior

**Files:**
- Modify: `src/components/AppForm.svelte:104` (`values` state init)
- Modify: `src/components/AppForm.svelte:114-135` (`hasChanges` derived)
- Test: `src/test/AppForm.test.ts`

**Interfaces:**
- Consumes: `FormField.value?: string | number | boolean | string[]` and `FormField.storeDefaultValue?: boolean` from Task 1 (must land first — these fields don't exist on the `FormField` type otherwise). By the time fields reach this component, any `value` is already guaranteed valid for its type (Task 1's loader validation) — no re-validation needed here.
- Produces: no new exported interface — this is purely internal render/state behavior of `AppForm.svelte`, observable only through its existing `initialValues`/`baseValues`/rendered-DOM contract that `ChallengeForm.svelte` and `EditorLocationForm.svelte` already consume unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/AppForm.test.ts`, after the last test in the file (after line 1197):

```ts

// ---------------------------------------------------------------------------
// field.value prefill
// ---------------------------------------------------------------------------

test("prefills a string field from field.value when there is no initialValues entry", () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Note", value: "Default text" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText("Note")).toHaveValue("Default text");
});

test("field.value does not override an existing initialValues entry, even an empty string", () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Note", value: "Default text" },
  ];
  render(AppForm, {
    props: { fields, initialValues: { note: "" }, onSubmit: vi.fn() },
  });
  expect(screen.getByLabelText("Note")).toHaveValue("");
});

test("boolean field.value seeds the checkbox as checked", () => {
  const fields: FormField[] = [
    { id: "agree", type: "boolean", label: "I agree", value: true },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByRole("checkbox")).toBeChecked();
});

test("radio field.value preselects the matching option", () => {
  const fields: FormField[] = [
    {
      id: "time",
      type: "radio",
      label: "Time of day",
      options: ["Morning", "Afternoon"],
      value: "Afternoon",
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText("Afternoon")).toBeChecked();
  expect(screen.getByLabelText("Morning")).not.toBeChecked();
});

test("multiple field.value preselects matching checkboxes", () => {
  const fields: FormField[] = [
    {
      id: "interests",
      type: "multiple",
      label: "Interests",
      options: ["History", "Food", "Art"],
      min: 1,
      max: 2,
      value: ["History", "Art"],
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText("History")).toBeChecked();
  expect(screen.getByLabelText("Art")).toBeChecked();
  expect(screen.getByLabelText("Food")).not.toBeChecked();
});

test("storeDefaultValue defaults to true: submit is enabled immediately from field.value alone", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Note", value: "Default text", isRequired: true },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  const btn = await screen.findByRole("button", { name: /submit/i });
  expect(btn).not.toBeDisabled();
  expect(btn).not.toHaveTextContent(/no changes/i);
});

test("storeDefaultValue: false keeps submit disabled until the participant edits the field", async () => {
  const fields: FormField[] = [
    {
      id: "note",
      type: "string",
      label: "Note",
      value: "Default text",
      storeDefaultValue: false,
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  const disabledBtn = await screen.findByRole("button", { name: /no changes/i });
  expect(disabledBtn).toBeDisabled();

  await fireEvent.input(screen.getByLabelText("Note"), {
    target: { value: "Edited text" },
  });
  const enabledBtn = screen.getByRole("button", { name: /submit/i });
  expect(enabledBtn).not.toBeDisabled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- AppForm`
Expected: all 7 new tests FAIL (no seeding logic exists yet, so prefilled fields render empty/unchecked and Submit always reads "No changes"). All pre-existing `AppForm.test.ts` tests still PASS.

- [ ] **Step 3: Seed `values` from `field.value`**

Edit `src/components/AppForm.svelte`. Replace the `values` state init (line 104):

```ts
  let values = $state<FieldValues>(untrack(() => ({ ...(initialValues as FieldValues) })));
```

with:

```ts
  let values = $state<FieldValues>(
    untrack(() => {
      const seeded: FieldValues = { ...(initialValues as FieldValues) };
      for (const field of fields) {
        if (
          field.id &&
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

- [ ] **Step 4: Add a `getBaseline` helper and use it in `hasChanges`**

Edit `src/components/AppForm.svelte`. Add this function right above the `hasChanges` derived (before line 114):

```ts
  function getBaseline(field: FormField, id: string): unknown {
    const source = (baseValues ?? initialValues) as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(source, id)) {
      return source[id];
    }
    if (field.value !== undefined && field.storeDefaultValue === false) {
      return field.value;
    }
    return undefined;
  }
```

Then replace the baseline computation inside `hasChanges` (`AppForm.svelte:125-127`):

```ts
        const curr = values[id];
        const baseline = baseValues
          ? (baseValues as Record<string, unknown>)[id]
          : (initialValues as Record<string, unknown>)[id];
```

with:

```ts
        const curr = values[id];
        const baseline = getBaseline(f, id);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- AppForm`
Expected: all tests in `AppForm.test.ts` PASS, including the 7 new ones.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test:run`
Expected: all tests PASS (confirms `ChallengeForm.svelte` and `EditorLocationForm.svelte`'s existing usage of `AppForm` isn't affected — neither passes fields with `.value` today, so `getBaseline` falls through to its final `return undefined` branch for all of their fields, identical to the prior inline behavior).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Ready for review**

Do not commit. Summarize the diff (`src/components/AppForm.svelte`, `src/test/AppForm.test.ts`) for the user to review and commit themselves. Note for the user: manual verification in the running app (a location whose form YAML sets `value` on a field, confirming it renders prefilled and Submit behaves per `storeDefaultValue`) is manual/UI verification the user does themselves — not run via Playwright.

---

## Self-Review Notes

- **Spec coverage:** §1 (schema & type changes) → Task 1 Steps 3-4; §2 (loader validation, single tier) → Task 1 Step 5; §3 (runtime behavior: seeding, stored-wins, `storeDefaultValue` baseline) → Task 2 Steps 3-4; Out of scope (`EditorLocationForm.svelte`, no changes) → verified by Task 2 Step 6's full-suite run; Testing section → Task 1 Step 1 (loader cases) and Task 2 Step 1 (AppForm cases).
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code with exact file paths and line numbers.
- **Type consistency:** `FormField.value`/`storeDefaultValue` types match exactly between Task 1's `data.ts` edit and Task 2's usage (`field.value as FieldValues[string]`, `field.storeDefaultValue === false`). `validateFieldValue`'s exact message substrings (`"not supported on type"`, `"must be a number"`, `"must be one of this field's 'options'"`, `"must be an array of this field's 'options'"`) match between the implementation step and the test assertions.
- **Scope check:** two tasks, each independently testable and revertible; no real location YAML is authored in this plan (out of scope per the design doc — no specific location was named for this feature).
