# `random_value` Form Field Implementation Plan


**Goal:** Add a new `random_value` form field type that lets a location's challenge form assign each team a single, locked-in random pick from an author-supplied list — used first by `003_loc_jewish_children_museum.yaml` to assign a name from the monument.

**Architecture:** Extends the existing three-touch-point pattern already used for `image-picker`/`coord-picker`: (1) `FormFieldType`/`FormField` in `src/types/data.ts`, (2) `form.schema.json`'s type enum + a new `values` property, (3) a new render branch in `AppForm.svelte`. No new components, stores, or route/type changes — the picked value is stored as a plain string in the field's existing `values[id]` slot, so it rides the existing localStorage/`initialValues` persistence for free.

**Tech Stack:** Svelte 5 (runes), TypeScript, `lucide-svelte` (`Dice5` icon, already used by `JoinTeamPage.svelte`), Vitest + `@testing-library/svelte`, `ajv`-based YAML schema validation (`npm run validate:yaml`).

## Global Constraints

- **No git commands.** This repo's `.claude/CLAUDE.md` reserves git control for the user — do not run `git add`/`git commit`/etc. Each task ends with "ready for review," not a commit step.
- **TypeScript only** — `.svelte` files use `<script lang="ts">`; no `.js`/`.jsx`/`.tsx` in `src/`.
- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`) — no Svelte 4 `$:` syntax.
- **CSS via co-located `.css` files** using `var(--color-*)` tokens; class names follow the existing `af-` BEM-ish prefix already used throughout `AppForm.css`.
- **Follow the established field-type pattern exactly**: every new type touches `src/types/data.ts`, `src/data/schemas/form.schema.json`, and `AppForm.svelte`'s `VALID_TYPES`/`checkDefinition`/template — do not invent a parallel mechanism.
- **No Playwright/browser automation** for verification — the user does manual verification themselves.
- One-time roll only: once a `random_value` field has a value, render it as static text — never render a reroll control.

---

### Task 1: Data model, schema, and `AppForm.svelte` rendering for `random_value`

**Files:**
- Modify: `src/types/data.ts:3-24` (`FormFieldType` union, `FormField` interface)
- Modify: `src/data/schemas/form.schema.json:9-21` (`type` enum, `properties`)
- Modify: `src/components/AppForm.svelte`
- Modify: `src/components/AppForm.css`
- Test: `src/test/AppForm.test.ts`

**Interfaces:**
- Produces: `FormFieldType` including `"random_value"`; `FormField.values?: string[]`. Both are consumed by Task 2's YAML data (validated against `form.schema.json`, loaded at runtime into `FormField[]`, which `AppForm.svelte` renders).

- [ ] **Step 1: Add `random_value` to the type system**

Edit `src/types/data.ts`:

```ts
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "textarea"
  | "section"
  | "image-picker"
  | "coord-picker"
  | "random_value";

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
}
```

- [ ] **Step 2: Add `random_value` to the JSON schema**

Edit `src/data/schemas/form.schema.json` so `properties.type.enum` and `properties` read:

```json
      "type":  {
        "type": "string",
        "enum": ["boolean", "string", "number", "radio", "multiple", "photo", "textarea", "section", "random_value"]
      },
      "label":   { "type": "string" },
      "subtext": { "type": "string" },
      "options": { "type": "array", "items": { "type": "string" } },
      "values":  { "type": "array", "items": { "type": "string" } },
      "min":     { "type": "number" },
      "max":     { "type": "number" }
```

(`image-picker`/`coord-picker` are editor-only types not in this enum today — leave that as-is; only add `random_value`.)

- [ ] **Step 3: Write the failing tests**

Add to `src/test/AppForm.test.ts`, in a new section at the end of the file:

```ts
// ---------------------------------------------------------------------------
// random_value field
// ---------------------------------------------------------------------------

test("random_value: renders a reveal button when no value is set", () => {
  const fields: FormField[] = [
    {
      id: "assigned_child",
      type: "random_value" as FormFieldType,
      label: "Tap to reveal the name you'll look for",
      values: ["Alpha", "Beta", "Gamma"],
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(
    screen.getByText("Tap to reveal the name you'll look for"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /reveal a name/i }),
  ).toBeInTheDocument();
});

test("random_value: clicking reveal sets one of the listed values and removes the button", async () => {
  const values = ["Alpha", "Beta", "Gamma"];
  const fields: FormField[] = [
    { id: "assigned_child", type: "random_value" as FormFieldType, label: "Reveal", values },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  await fireEvent.click(screen.getByRole("button", { name: /reveal a name/i }));
  expect(
    screen.queryByRole("button", { name: /reveal a name/i }),
  ).not.toBeInTheDocument();
  const revealed = values.find((v) => screen.queryByText(v));
  expect(revealed).toBeDefined();
});

test("random_value: pre-populated value from initialValues renders locked, no reveal button", () => {
  const fields: FormField[] = [
    {
      id: "assigned_child",
      type: "random_value" as FormFieldType,
      label: "Reveal",
      values: ["Alpha", "Beta"],
    },
  ];
  render(AppForm, {
    props: { fields, initialValues: { assigned_child: "Alpha" }, onSubmit: vi.fn() },
  });
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /reveal a name/i }),
  ).not.toBeInTheDocument();
});

test("random_value: rolled value is passed to onSubmit", async () => {
  const fields: FormField[] = [
    {
      id: "assigned_child",
      type: "random_value" as FormFieldType,
      label: "Reveal",
      values: ["Alpha"],
    },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, { props: { fields, onSubmit } });
  await fireEvent.click(screen.getByRole("button", { name: /reveal a name/i }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({ assigned_child: "Alpha" }),
  );
});

test("random_value: missing values array blocks submit with a definition error", async () => {
  const fields: FormField[] = [
    { id: "assigned_child", type: "random_value" as FormFieldType, label: "Reveal" },
    { id: "note", type: "string", label: "Note" },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, { props: { fields, onSubmit } });
  await fireEvent.input(screen.getByLabelText("Note"), { target: { value: "hi" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText("random_value field missing values")).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm run test:run -- AppForm`
Expected: the 5 new `random_value` tests FAIL (button/text not found — the type isn't rendered yet). All pre-existing `AppForm.test.ts` tests still PASS.

- [ ] **Step 5: Implement the `random_value` branch in `AppForm.svelte`**

Add `Dice5` to the existing lucide-svelte import:

```ts
import { Image, Check, Dice5 } from "lucide-svelte";
```

Add the type constant next to the others, and add it to `VALID_TYPES`:

```ts
const STR_RANDOM_VALUE = "random_value";
```

```ts
const VALID_TYPES: FormFieldType[] = [
  STR_STRING,
  STR_NUMBER,
  STR_BOOLEAN,
  STR_RADIO,
  STR_MULTIPLE,
  STR_PHOTO,
  STR_TEXTAREA,
  STR_SECTION,
  STR_IMAGE_PICKER,
  STR_COORD_PICKER,
  STR_RANDOM_VALUE,
];
```

Add the message constant next to `MSG_MIN_GT_MAX`:

```ts
const MSG_RANDOM_VALUE_MISSING = "random_value field missing values";
```

In `checkDefinition`, add a check alongside the existing radio/multiple block:

```ts
if (field.type === STR_RANDOM_VALUE) {
  if (!field.values || field.values.length === 0) {
    return MSG_RANDOM_VALUE_MISSING;
  }
}
```

In `validateValues`, fold `random_value` into the existing string/textarea required-check branch:

```ts
} else if (field.type === STR_STRING || field.type === STR_TEXTAREA || field.type === STR_RANDOM_VALUE) {
  const v = values[field.id] as string | undefined;
  if (!v || v.trim() === "") {
    errs[field.id] = MSG_REQUIRED;
  }
}
```

In the template, add a new branch after the `coord-picker` branch (still inside the `{#if field.type === "photo"} ... {:else if ...} ... {/if}` chain that follows the shared label/subtext/err block):

```svelte
{:else if field.type === "random_value"}
  {@const picked = values[id] as string | undefined}
  {#if picked}
    <p class="af-random-value-result">{picked}</p>
  {:else}
    <button
      type="button"
      class="af-random-value-btn"
      disabled={!field.values || field.values.length === 0}
      onclick={() => {
        const options = field.values ?? [];
        if (options.length > 0) {
          values[id] = options[Math.floor(Math.random() * options.length)];
        }
      }}
    >
      <Dice5 size={18} aria-hidden="true" />
      Reveal a name
    </button>
  {/if}
{/if}
```

Add the matching styles to `src/components/AppForm.css`:

```css
.af-random-value-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  margin-top: 4px;
}

.af-random-value-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.af-random-value-result {
  margin: 4px 0 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- AppForm`
Expected: all tests in `AppForm.test.ts` PASS, including the 5 new ones.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Ready for review**

Do not commit. Summarize the diff (`src/types/data.ts`, `src/data/schemas/form.schema.json`, `src/components/AppForm.svelte`, `src/components/AppForm.css`, `src/test/AppForm.test.ts`) for the user to review and commit themselves.

---

### Task 2: Wire up `003_loc_jewish_children_museum.yaml`'s challenge form

**Files:**
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/003_form_jewish_children_museum.yaml`
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/003_loc_jewish_children_museum.yaml`

**Interfaces:**
- Consumes: the `random_value` field type from Task 1 (must be merged/implemented first — `npm run validate:yaml` will reject this file against the old schema otherwise).

- [ ] **Step 1: Create the form YAML file**

Create `src/data/text/en/projects/democrats_abroad/den_haag/003_form_jewish_children_museum.yaml`:

```yaml
- id: assigned_child
  type: random_value
  label: "Tap to reveal the name you'll look for"
  values:
    - "Erna Aalsvel (15 years old)"
    - "David Abrahams (13 years old)"
    - "Elfrieda Abrahams (4 years old)"
    - "Helene Abrahams (10 years old)"
    - "Helene Minna Abrahams (17 years old)"
    - "Henri Abrahams (10 years old)"
    - "Isidor Abrahams (2 years old)"
    - "Jacob Abrahams (10 years old)"
    - "Judith Abrahams (5 years old)"
    - "Machiel Abrahams (7 years old)"
    - "Menno Samuël Abrahams (8 years old)"
    - "Michel Abrahams (18 years old)"
    - "Mirjam Minne Abrahams (9 years old)"
    - "Raphaël Abrahams (2 years old)"
    - "Abram Abram (13 years old)"
    - "Meyer Abram (16 years old)"
    - "Mietje Abram (11 years old)"
    - "Mozes Abram (8 years old)"
    - "Regina Abram (4 years old)"
    - "Willy Abram (4 years old)"
    - "Abraham Abramowicz (17 years old)"
    - "Heinrich Adler (10 years old)"
    - "Hanna Agsterribbe (3 years old)"
    - "Jozef Agsterribbe (4 years old)"
    - "Rachel Agsterribbe (18 months old)"
    - "Rachel Hanna Agsterribbe (5 years old)"

- id: found_and_read_name
  type: boolean
  label: "Did you find the name on the monument, read it and their age aloud, and pause together for 30 seconds?"
```

- [ ] **Step 2: Validate the new form file**

Run: `npm run validate:yaml`
Expected: no errors for `003_form_jewish_children_museum.yaml`. (If Task 1's schema change isn't in place yet, this will fail with `must be equal to one of the allowed values` for `type` — that means Task 1 needs to land first.)

- [ ] **Step 3: Wire the form into the location and reword the "click HERE" instruction**

Edit `src/data/text/en/projects/democrats_abroad/den_haag/003_loc_jewish_children_museum.yaml`. Change the `challenge` block from:

```yaml
challenge:
  name: "SAY THE NAME"
  description: |
    This was once a living Jewish neighborhood: homes, schools, shops, synagogues, families, and children. The state tried to turn those children into numbers. This monument returns them to their names.
    When your team arrives at the monument, click HERE. Find the name on the monument. When you find it, read the name and age aloud. Stand together in silence for 30 seconds. During the silence, imagine the child as alive: walking to school, playing nearby, sitting in class, being called by name.
    Confirm task is done when the team has found the name, read it aloud, said the age, and paused together.
```

to:

```yaml
challenge:
  name: "SAY THE NAME"
  description: |
    This was once a living Jewish neighborhood: homes, schools, shops, synagogues, families, and children. The state tried to turn those children into numbers. This monument returns them to their names.
    When your team arrives at the monument, tap **Reveal a name** below. Find that name on the monument. When you find it, read the name and age aloud. Stand together in silence for 30 seconds. During the silence, imagine the child as alive: walking to school, playing nearby, sitting in class, being called by name.
    Confirm task is done when the team has found the name, read it aloud, said the age, and paused together.
  form: "003_form_jewish_children_museum"
```

- [ ] **Step 4: Validate the location file**

Run: `npm run validate:yaml`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test:run`
Expected: all tests PASS (this location file isn't covered by a dedicated unit test — the run confirms nothing else regressed, e.g. `loadLocations.ts`'s form-resolution path).

- [ ] **Step 6: Ready for review**

Do not commit. Note for the user: manual verification of this screen (visiting `003_loc_jewish_children_museum` in the running app, tapping "Reveal a name", confirming the name locks in and survives a reload) is manual/UI verification the user does themselves — not run via Playwright.

---

## Self-Review Notes

- **Spec coverage:** Problem/Approach → Task 1 (field type + interaction); Data Model Changes → Task 1 Steps 1–2; Component Changes → Task 1 Steps 5; Data Files → Task 2; Validation → Task 2 Steps 2/4 (existing schema layers, no new code); Testing → Task 1 Steps 3–4/6; Out of Scope items are not implemented anywhere in this plan, as intended.
- **Placeholder scan:** no TBD/TODO; all code blocks are complete, runnable snippets with exact file paths.
- **Type consistency:** `assigned_child` is the field id used consistently across Task 2's form YAML, the reworded description, and matches the `FormField.values`/`random_value` type added in Task 1. `MSG_RANDOM_VALUE_MISSING`'s exact string (`"random_value field missing values"`) matches between the implementation step and the test assertion.
