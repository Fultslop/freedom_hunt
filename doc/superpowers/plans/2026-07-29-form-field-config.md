# Form Field `config` Property Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a challenge form's YAML set a `config` object on a `textarea` field, with a single sub-key today — `lineCount` (the number of visible textarea rows, defaulting to 5).

**Architecture:** Same two-layer pattern as the recent `value`/`storeDefaultValue` work. (1) Content-authoring layer — `FormField.config` in `src/types/data.ts`, `form.schema.json`, and a new `validateFieldConfig` check in `loadLocations.ts`'s existing `withValidatedFields` mechanism, giving bad `config` the same visible `schema_error` treatment as every other authoring mistake. (2) Runtime layer — `AppForm.svelte`'s `textarea` branch renders a native `rows={field.config?.lineCount ?? 5}` attribute (it currently sets no `rows` at all), and `AppForm.css`'s `.af-textarea` rule swaps its hardcoded `min-height: 80px` for the same `var(--field-min-height)` floor `.af-input` already uses, so `rows` — not a CSS floor — drives actual height.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte`, `ajv`-based YAML schema validation (`npm run validate:yaml`).

## Global Constraints

- **No git commands.** This repo's `.claude/CLAUDE.md` reserves git control for the user — do not run `git add`/`git commit`/etc. Each task ends with "ready for review," not a commit step.
- **TypeScript only** — `.svelte` files use `<script lang="ts">`; no `.js`/`.jsx`/`.tsx` in `src/`.
- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`) — no Svelte 4 `$:` syntax.
- **No Playwright/browser automation** for verification — the user does manual verification themselves.
- **Single validation tier, no silent warnings.** `config` on an unsupported type, an unknown key inside `config`, or an invalid `lineCount` all replace the whole field with a visible `schema_error` field — same treatment as an unknown top-level YAML key gets today. No console warnings, no partial acceptance.
- **Keep `loadLocations.ts`'s validation functions small.** This project's ESLint `complexity` rule caps at 10 (`eslint.config.js:103`) — the previous `value`/`storeDefaultValue` plan blew through this (complexity 21) by cramming a 5-way type dispatch into one function and needed a follow-up fix. Task 1 below extracts message-building into its own small helper from the start to avoid repeating that mistake.
- Spec: `doc/superpowers/specs/2026-07-29-form-field-config-design.md`

---

### Task 1: Schema, type, and loader validation for `config`

**Files:**
- Modify: `src/types/data.ts:17-29` (`FormField` interface)
- Modify: `src/data/schemas/form.schema.json:9-23` (`properties`)
- Modify: `src/utils/loadLocations.ts` (`KNOWN_FORM_FIELD_KEYS`, `withValidatedFields`, plus new `validateFieldConfig`/`buildFieldErrorMessages`)
- Test: `src/test/loadText.test.ts`

**Interfaces:**
- Produces: `FormField.config?: { lineCount?: number }`, consumed by Task 2's `AppForm.svelte`. By the time a `FormField` reaches `AppForm.svelte`, `config` is guaranteed valid for its field's type (only `textarea`, only the `lineCount` key, a positive integer) — Task 2 does no re-validation.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/loadText.test.ts`, inside the existing `describe("loadLocations", ...)` block, right before its closing `});` (currently line 291 — after the `"flags a multiple value with one entry not present in options..."` test):

```ts
  it("passes through a valid config.lineCount on a textarea field", async () => {
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
        { id: "story", type: "textarea", label: "Story", config: { lineCount: 8 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("textarea");
    expect(loc.challenge.form[0].config).toEqual({ lineCount: 8 });
  });

  it("flags config present on a non-textarea type as a schema_error", async () => {
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
        { id: "note", type: "string", label: "Note", config: { lineCount: 3 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("not supported on type 'string'");
  });

  it("flags an unknown config key as a schema_error", async () => {
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
        { id: "story", type: "textarea", label: "Story", config: { fontSize: 12 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("unknown config properties: fontSize");
  });

  it("flags a non-integer config.lineCount as a schema_error", async () => {
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
        { id: "story", type: "textarea", label: "Story", config: { lineCount: 2.5 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be a positive integer");
  });

  it("flags a non-positive config.lineCount as a schema_error", async () => {
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
        { id: "story", type: "textarea", label: "Story", config: { lineCount: 0 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be a positive integer");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- loadText`
Expected: the 5 new tests FAIL. `config` isn't in `KNOWN_FORM_FIELD_KEYS` yet, so every field in these fixtures currently comes back as `schema_error` for "unknown properties" — the "passes through" test fails because the field isn't passed through, and the 4 error-case tests fail because the message text doesn't yet contain the new type-specific wording. All pre-existing `loadText.test.ts` tests still PASS.

- [ ] **Step 3: Add `config` to the type system**

Edit `src/types/data.ts`, in the `FormField` interface (`data.ts:17-29`):

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
}
```

- [ ] **Step 4: Add `config` to the JSON schema**

Edit `src/data/schemas/form.schema.json`, in `items.properties` (`form.schema.json:9-23`):

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
      "storeDefaultValue": { "type": "boolean" },
      "config":  {
        "type": "object",
        "properties": { "lineCount": { "type": "number" } },
        "additionalProperties": false
      }
```

- [ ] **Step 5: Implement validation in `loadLocations.ts`**

Edit `src/utils/loadLocations.ts`. Add `"config"` to `KNOWN_FORM_FIELD_KEYS`:

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
]);
```

Add these two functions after `getValueShapeError` and before `validateFieldValue`:

```ts
const CONFIG_SUPPORTED_TYPES = new Set<FormFieldType>(["textarea"]);
const KNOWN_CONFIG_KEYS = new Set(["lineCount"]);

function validateFieldConfig(field: FormField): string | null {
  if (field.config === undefined) {
    return null;
  }
  if (!CONFIG_SUPPORTED_TYPES.has(field.type)) {
    return `'config' not supported on type '${field.type}'`;
  }
  const unknownConfigKeys = Object.keys(field.config).filter(
    (key) => !KNOWN_CONFIG_KEYS.has(key),
  );
  if (unknownConfigKeys.length > 0) {
    return `unknown config properties: ${unknownConfigKeys.join(", ")}`;
  }
  const { lineCount } = field.config;
  if (lineCount !== undefined && !(Number.isInteger(lineCount) && lineCount > 0)) {
    return `'config.lineCount' must be a positive integer`;
  }
  return null;
}
```

Replace `withValidatedFields` with a version that also runs `validateFieldConfig`, delegating message assembly to a small dedicated helper (kept separate to stay well under this project's `complexity: 10` ESLint cap):

```ts
function buildFieldErrorMessages(
  fieldId: string,
  unknownKeys: string[],
  valueError: string | null,
  configError: string | null,
): string[] {
  return [
    ...(unknownKeys.length > 0
      ? [`unknown properties on '${fieldId}': ${unknownKeys.join(", ")}`]
      : []),
    ...(valueError ? [valueError] : []),
    ...(configError ? [configError] : []),
  ];
}

function withValidatedFields(fields: FormField[]): FormField[] {
  return fields.map((field) => {
    const unknownKeys = Object.keys(field as unknown as Record<string, unknown>).filter(
      (key) => !KNOWN_FORM_FIELD_KEYS.has(key),
    );
    const valueError = validateFieldValue(field);
    const configError = validateFieldConfig(field);
    if (unknownKeys.length === 0 && !valueError && !configError) {
      return field;
    }
    const fieldId = field.id ?? field.label;
    return {
      id: fieldId,
      type: "schema_error" as FormFieldType,
      label: buildFieldErrorMessages(fieldId, unknownKeys, valueError, configError).join("; "),
    };
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- loadText`
Expected: all tests in `loadText.test.ts` PASS, including the 5 new ones.

- [ ] **Step 7: Lint, typecheck, and validate existing content**

Run, in order:
1. `npm run lint` — expected: no errors (this is the check that caught the complexity problem last time; confirm `validateFieldConfig`/`buildFieldErrorMessages`/`withValidatedFields` all pass).
2. `npm run typecheck` — expected: no errors.
3. `npm run validate:yaml` — expected: no errors (confirms the additive schema change doesn't break any existing content file).

- [ ] **Step 8: Ready for review**

Do not commit. Summarize the diff (`src/types/data.ts`, `src/data/schemas/form.schema.json`, `src/utils/loadLocations.ts`, `src/test/loadText.test.ts`) for the user to review and commit themselves.

---

### Task 2: `AppForm.svelte` `rows` rendering and `.af-textarea` height CSS

**Files:**
- Modify: `src/components/AppForm.svelte:515-522` (`textarea` branch)
- Modify: `src/components/AppForm.css:106-109` (`.af-textarea`)
- Test: `src/test/AppForm.test.ts`

**Interfaces:**
- Consumes: `FormField.config?: { lineCount?: number }` from Task 1 (must land first — this field doesn't exist on `FormField` otherwise). By the time fields reach this component, `config` is already guaranteed valid (Task 1's loader validation) — no re-validation needed here.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/AppForm.test.ts`, after the last test in the file (after line 1291):

```ts

// ---------------------------------------------------------------------------
// textarea config.lineCount
// ---------------------------------------------------------------------------

test("textarea renders with rows=5 by default when no config is set", () => {
  const fields: FormField[] = [
    { id: "story", type: "textarea", label: "Your story" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText("Your story")).toHaveAttribute("rows", "5");
});

test("textarea renders with rows from config.lineCount when set", () => {
  const fields: FormField[] = [
    { id: "story", type: "textarea", label: "Your story", config: { lineCount: 8 } },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText("Your story")).toHaveAttribute("rows", "8");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- AppForm`
Expected: both new tests FAIL (no `rows` attribute is rendered today). All pre-existing `AppForm.test.ts` tests still PASS.

- [ ] **Step 3: Render `rows` on the textarea**

Edit `src/components/AppForm.svelte`. Replace the `textarea` branch (`AppForm.svelte:515-522`):

```svelte
          {:else if field.type === "textarea"}
            <textarea
              id={domId}
              class="af-textarea"
              class:af-textarea--error={err}
              aria-describedby={describedBy}
              bind:value={values[id] as string}
            ></textarea>
```

with:

```svelte
          {:else if field.type === "textarea"}
            <textarea
              id={domId}
              class="af-textarea"
              class:af-textarea--error={err}
              aria-describedby={describedBy}
              rows={field.config?.lineCount ?? 5}
              bind:value={values[id] as string}
            ></textarea>
```

- [ ] **Step 4: Let `rows` drive height instead of a fixed CSS floor**

Edit `src/components/AppForm.css`. Replace (`AppForm.css:106-109`):

```css
.af-textarea {
  resize: vertical;
  min-height: 80px;
}
```

with:

```css
.af-textarea {
  resize: vertical;
  min-height: var(--field-min-height);
}
```

(`--field-min-height` is already defined in `src/styles/tokens.css:37` as `2.75rem` — the same 44px touch-target floor `.af-input` uses at `AppForm.css:111-113`. This is now just an accessible minimum, not the primary height control; `rows` drives the actual textarea height.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- AppForm`
Expected: all tests in `AppForm.test.ts` PASS, including the 2 new ones. In particular, confirm the pre-existing `"renders textarea field"` test (asserts `tagName === "TEXTAREA"`) and the `"input/textarea/photo-tile borders use the dedicated field-border token"` CSS-regex test still pass unaffected — neither inspects `rows` or the `min-height` value that changed.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test:run`
Expected: all tests PASS (confirms `ChallengeForm.svelte` and `EditorLocationForm.svelte`'s existing usage of `AppForm` isn't affected — neither passes fields with `.config` today, so every existing textarea simply falls back to the `?? 5` default).

- [ ] **Step 7: Lint and typecheck**

Run: `npm run lint` and `npm run typecheck`.
Expected: no errors in either.

- [ ] **Step 8: Ready for review**

Do not commit. Summarize the diff (`src/components/AppForm.svelte`, `src/components/AppForm.css`, `src/test/AppForm.test.ts`) for the user to review and commit themselves. Note for the user: manual verification in the running app (a location whose form YAML sets `config.lineCount` on a `textarea` field, confirming the rendered box is visibly shorter/taller than the current default, and that a plain `textarea` field with no `config` still looks reasonable at the new 5-row default) is manual/UI verification the user does themselves — not run via Playwright.

---

## Self-Review Notes

- **Spec coverage:** §1 (schema & type changes) → Task 1 Steps 3-4; §2 (loader validation, single tier) → Task 1 Step 5; §3 (runtime rendering + CSS floor change, with the explicitly-accepted default-height side effect) → Task 2 Steps 3-4; Out of scope (no other type gets `config`, no discriminated union) → not implemented anywhere in this plan, as intended; Testing section → Task 1 Step 1 (loader cases) and Task 2 Step 1 (`AppForm` cases).
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code with exact file paths and line numbers.
- **Type consistency:** `FormField.config?: { lineCount?: number }` matches exactly between Task 1's `data.ts` edit and Task 2's `field.config?.lineCount` usage. `validateFieldConfig`'s exact message substrings (`"not supported on type"`, `"unknown config properties:"`, `"must be a positive integer"`) match between the implementation step and the test assertions.
- **Complexity guard:** unlike the previous plan, `buildFieldErrorMessages` is extracted as its own function from the start specifically to keep `withValidatedFields` and `validateFieldConfig` each well under the project's `complexity: 10` ESLint rule — Task 1 Step 7 runs `npm run lint` as an explicit checkpoint to catch it immediately if this estimate is wrong, rather than discovering it in a later review pass.
- **Scope check:** two tasks, each independently testable and revertible; no real location YAML is authored in this plan (out of scope — no specific location was named for this feature).
