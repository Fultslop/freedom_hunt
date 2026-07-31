# Consent Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `000_options_eula.yaml`/`OptionsScreen` pre-hunt screen with a GDPR-correct consent screen (age gate + separable, withdrawable photo-promotion consent), backed by a real D1 record, a human `promoApproved` review gate, and a mid-route re-prompt when the consent text version is bumped.

**Architecture:** Two small generic `AppForm` additions (`note` field type, `radio` `variant: segmented`) land first as reusable primitives. Then a new backend subsystem (`consent_records` D1 table + upsert, three Worker routes, a KV-stored version number) is built and tested in isolation. Then the frontend consumes both: a new `consent` route-entry template-type + `ConsentScreen.svelte`, a `RoutePage` staleness-polling effect, a `TitleBar` withdrawal submenu, and a minimal `PromoReviewPage` editor tool.

**Tech Stack:** Svelte 5 (runes) + TypeScript, Vitest + @testing-library/svelte, Cloudflare Workers + D1 + KV, `js-yaml`/ajv-validated YAML content.

**Spec:** `doc/superpowers/specs/2026-07-31-consent-screen-design.md`

## Global Constraints

- TypeScript only (`.ts`/`.svelte` with `<script lang="ts">`), no `.js`/`.jsx`/`.tsx` in `src/`.
- Styling via co-located `.css` files and `var(--color-*)` tokens only — no inline styles except genuinely dynamic values, no Tailwind/CSS modules.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`) — no `$:`.
- No new runtime dependency for this feature (spec §10 acceptance checklist) — this feature is fully buildable with what's already in the repo.
- `promo_consent` must be impossible to persist as `true` when `all_sixteen_plus` is `false` — enforced server-side in `upsertConsent`, not only client-side (spec §4.2, §10).
- `consent_version` is always server-stamped; `POST /consent` never accepts it from the client (spec §4.3, §13).
- No hardcoded hex colors in any new CSS — use existing `--color-*`/`--font-*`/`--gap-*` tokens.
- Every new Worker route follows the existing pattern: `requireAuth`/`isParticipantToken` (or `requireOrganizerCap` for the editor route), `try/catch` JSON parse, `json()` responses from `src/worker/utils.ts`.
- Age threshold is `project.consent_age_threshold` (per-project config, default `16`), never a hardcoded constant (spec §3, §10).

---

### Task 1: `AppForm` — `note` field type

**Files:**
- Modify: `src/types/data.ts:4-17` (`FormFieldType`)
- Modify: `src/data/schemas/form.schema.json:98` (`type` enum)
- Modify: `src/components/AppForm.svelte`
- Modify: `src/components/AppForm.css`
- Test: `src/test/AppForm.test.ts`

**Interfaces:**
- Produces: `FormFieldType` gains `"note"`. A `note` field has no `id` (produces no value, like `section`), renders `label` as emphasized lead text and `subtext` as body copy — no heading rule, no hairline (unlike `section`). Consumed by Task 7's `ConsentEntry` YAML (the declined-state block) and by the existing `isVisible` resolver (`src/utils/visibility.ts`, unchanged).

- [ ] **Step 1: Write the failing tests**

Add to `src/test/AppForm.test.ts`:

```ts
test("renders a note field's label and subtext as body copy, not a section heading", () => {
  render(AppForm, {
    fields: [
      { type: "note", label: "We won't use your photos for promotion.", subtext: "Your photos still appear in the gallery." },
    ],
    onSubmit: async () => {},
  });
  expect(screen.getByText("We won't use your photos for promotion.")).toHaveClass("af-note");
  expect(screen.getByText("Your photos still appear in the gallery.")).toHaveClass("af-subtext");
});

test("a note field never renders as unknown-type and produces no value on submit", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, {
    fields: [
      { id: "x", type: "string", label: "X", value: "seed" },
      { type: "note", label: "Some note" },
    ],
    onSubmit,
    alwaysSubmittable: true,
  });
  expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalledWith({ x: "seed" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts -t "note field"`
Expected: FAIL — `note` isn't a valid type yet, renders as `af-field--unknown`.

- [ ] **Step 3: Add `"note"` to `FormFieldType`**

In `src/types/data.ts:4-17`:

```ts
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "video"
  | "textarea"
  | "section"
  | "note"
  | "image-picker"
  | "coord-picker"
  | "random_value"
  | "schema_error";
```

- [ ] **Step 4: Add `"note"` to the form schema's type enum**

In `src/data/schemas/form.schema.json:98`, change:

```json
"enum": ["boolean", "string", "number", "radio", "multiple", "photo", "video", "textarea", "section", "random_value"]
```

to:

```json
"enum": ["boolean", "string", "number", "radio", "multiple", "photo", "video", "textarea", "section", "note", "random_value"]
```

- [ ] **Step 5: Render `note` in `AppForm.svelte`**

Add the constant near the other `STR_*` constants (`AppForm.svelte:25`):

```ts
const STR_SECTION = "section";
const STR_NOTE = "note";
```

Add `STR_NOTE` to `VALID_TYPES` (`AppForm.svelte:30-43`).

In `checkDefinition` (`AppForm.svelte:310-311`), change:

```ts
if (field.type === STR_SECTION) {
  return null;
}
```

to:

```ts
if (field.type === STR_SECTION || field.type === STR_NOTE) {
  return null;
}
```

In the template (`AppForm.svelte:524-526`), add a branch immediately after the `section` branch and before the generic `{:else}`:

```svelte
{:else if field.type === "section"}
  <div class="af-section-heading">{field.label}</div>
  {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
{:else if field.type === "note"}
  <div class="af-note">{field.label}</div>
  {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
{:else}
```

Add to `AppForm.css` (after `.af-section-heading`, `AppForm.css:17`):

```css
.af-note {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
  margin-top: var(--gap-block);
  margin-bottom: var(--gap-field);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: PASS, all existing `AppForm.test.ts` cases still green.

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/types/data.ts src/data/schemas/form.schema.json src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: add note field type to AppForm"
```

---

### Task 2: `AppForm` — `radio` `variant: segmented`, plus `aria-live` for conditional fields

**Files:**
- Modify: `src/types/data.ts` (`FormField`)
- Modify: `src/data/schemas/form.schema.json`
- Modify: `src/components/AppForm.svelte`
- Modify: `src/components/AppForm.css`
- Test: `src/test/AppForm.test.ts`

**Interfaces:**
- Produces: `FormField.variant?: "segmented"` (only meaningful when `type: "radio"`). Same value shape as plain `radio` (`values[id]` is the selected option string) — purely a rendering variant. Also produces: any field whose `isVisible.initially === "conditional"` now renders inside an `aria-live="polite"` wrapper, satisfying spec §10's "switching the age answer announces the change" checklist item generically (benefits every existing/future conditional field, not just this screen). Also fixes a pre-existing gap: `AppForm.svelte`'s `boolean` branch (`AppForm.svelte:642-652`) never wired `aria-describedby` to its own `subtext`, unlike the generic string/textarea/number branch — the consent screen's promo-consent checkbox needs this for spec §10's "the consent note is wired via `aria-describedby`" checklist item, so it's fixed here at the source rather than worked around per-screen.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/AppForm.test.ts`:

```ts
test("radio variant segmented renders as buttons, not native radio inputs", () => {
  render(AppForm, {
    fields: [{ id: "age", type: "radio", variant: "segmented", label: "16+?", options: ["Yes", "No"] }],
    onSubmit: async () => {},
  });
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
});

test("clicking a segmented option selects it and submits its value", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, {
    fields: [{ id: "age", type: "radio", variant: "segmented", label: "16+?", options: ["Yes", "No"] }],
    onSubmit,
    alwaysSubmittable: true,
  });
  await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
  expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalledWith({ age: "Yes" });
});

test("a boolean field's subtext is wired via aria-describedby", () => {
  render(AppForm, {
    fields: [{ id: "promo", type: "boolean", label: "Promo consent", subtext: "Optional — change it any time." }],
    onSubmit: async () => {},
  });
  const checkbox = screen.getByRole("checkbox");
  const describedBy = checkbox.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(screen.getByText("Optional — change it any time.")).toHaveAttribute("id", describedBy);
});

test("a conditionally-visible field is wrapped in an aria-live=polite region", () => {
  render(AppForm, {
    fields: [
      { id: "age", type: "radio", label: "16+?", options: ["Yes", "No"] },
      {
        id: "promo", type: "boolean", label: "Promo consent",
        isVisible: { initially: "conditional", condition: { source: "age", operator: "=", value: "Yes" } },
      },
    ],
    onSubmit: async () => {},
  });
  const label = screen.getByText("Promo consent");
  expect(label.closest('[aria-live="polite"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts -t "segmented"`
Expected: FAIL — no `variant` handling exists; radios render as native inputs.

- [ ] **Step 3: Add `variant` to `FormField`**

In `src/types/data.ts`, add to the `FormField` interface (near `options`):

```ts
options?: string[];
variant?: "segmented";
```

- [ ] **Step 4: Add `variant` to the form schema**

In `src/data/schemas/form.schema.json`, add a property alongside `"reroll"`/`"editable"`:

```json
"variant": { "enum": ["segmented"] },
```

- [ ] **Step 5: Render the segmented variant and wrap conditional fields in `AppForm.svelte`**

In the template, replace the existing `{:else if field.type === "radio"}` branch (`AppForm.svelte:714-727`) with:

```svelte
{:else if field.type === "radio" && field.variant === "segmented"}
  <div class="af-segmented" role="radiogroup" aria-label={field.label}>
    {#each field.options ?? [] as opt (opt)}
      <button
        type="button"
        class="af-segmented__option"
        class:af-segmented__option--selected={values[id] === opt}
        aria-pressed={values[id] === opt}
        onclick={() => { values[id] = opt; }}
      >
        {opt}
      </button>
    {/each}
  </div>
{:else if field.type === "radio"}
  <div class="af-radio-group">
    {#each field.options ?? [] as opt (opt)}
      <label class="af-label--radio">
        <input type="radio" name={domId} value={opt} bind:group={values[id] as string} />
        {opt}
      </label>
    {/each}
  </div>
```

Separately, fix the `boolean` branch's missing `aria-describedby` (`AppForm.svelte:642-652`) — replace:

```svelte
{:else if field.type === "boolean"}
  <label class="af-label--checkbox">
    {field.label}
    <input
      id={domId}
      type="checkbox"
      class="af-checkbox"
      bind:checked={values[id] as boolean}
    />
  </label>
  {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
```

with:

```svelte
{:else if field.type === "boolean"}
  <label class="af-label--checkbox">
    {field.label}
    <input
      id={domId}
      type="checkbox"
      class="af-checkbox"
      bind:checked={values[id] as boolean}
      aria-describedby={field.subtext ? `${domId}-help` : undefined}
    />
  </label>
  {#if field.subtext}<p class="af-subtext" id={`${domId}-help`}>{field.subtext}</p>{/if}
```

For the `aria-live` wrapper, change the top of the `{#each fields}` block (`AppForm.svelte:515-519`) from:

```svelte
{#each fields as field (field.id ?? field.label)}
  {@const visibility = visibilityFor(field)}
  {#if visibility.status === "hidden"}
  {:else if visibility.status === "error"}
```

to:

```svelte
{#each fields as field (field.id ?? field.label)}
  {@const visibility = visibilityFor(field)}
  {@const isConditional = field.isVisible?.initially === "conditional"}
  <div aria-live={isConditional ? "polite" : undefined}>
  {#if visibility.status === "hidden"}
  {:else if visibility.status === "error"}
```

and close the new wrapper at the end of that same per-field block — change the final `{/if}` of the per-field chain (`AppForm.svelte:873`, immediately before the `{/each}`) to:

```svelte
  {/if}
  </div>
{/each}
```

- [ ] **Step 6: Add segmented control CSS**

Add to `AppForm.css` (after `.af-radio-group`):

```css
.af-segmented {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.af-segmented__option {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--field-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
}

.af-segmented__option--selected {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: PASS, all cases including pre-existing ones.

- [ ] **Step 8: Typecheck, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: 0 errors, all tests green (the new wrapper `<div>` is presentational-only and must not change any other component's existing assertions — if any unrelated `AppForm` consumer test breaks on the extra wrapper div, fix that test's selector, don't remove the wrapper).

- [ ] **Step 9: Commit**

```bash
git add src/types/data.ts src/data/schemas/form.schema.json src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: add segmented radio variant, aria-live wrapper for conditional fields, and boolean field aria-describedby"
```

---

### Task 3: Backend — `consent_records` table, upsert/query functions, KV-stored consent version

**Files:**
- Create: `migrations/006_consent.sql`
- Modify: `src/worker/db.ts`
- Create: `src/worker/consentVersion.ts`
- Test: `src/test/worker.consentdb.test.ts`

**Interfaces:**
- Produces: `DbConsentRecord`, `upsertConsent()`, `getConsent()`, `setPromoApproved()`, `listPromoReviewPhotos()` from `db.ts`; `getConsentVersion()`/`setConsentVersion()` from `consentVersion.ts`. Consumed by Task 4 (participant routes) and Task 5 (promo-approve route).
- **Correction from the spec's SQL sketch:** `contact` is `TEXT NOT NULL DEFAULT ''`, never SQL `NULL`. SQLite's `UNIQUE` constraint treats every `NULL` as distinct from every other `NULL`, so a nullable `contact` column would silently defeat the whole "update, don't duplicate" requirement for every shared-team-password project (where `contact` is usually absent) — the exact case spec §10's "clearing localStorage updates one row" checklist item is about. Empty string is a normal, unique-constraint-comparable value; `NULL` is not. (This also means `db.ts`'s `DbFormSubmission`/`DbPhoto`'s nullable `contact: string | null` convention does **not** carry over here — a deliberate, documented deviation, not an oversight.)
- **Consent version storage:** the app has no live CMS — YAML content is compiled into the client bundle at build time, and nothing in `src/worker/**` currently imports YAML (`import.meta.glob` in `loadText.ts` is a Vite client-bundle-only construct). Rather than invent new Worker-side YAML-reading machinery, `consentVersion` is stored in the existing `AUTH_STORE` KV namespace (same mechanism `KV_PREFIX_ADMIN`/`KV_PREFIX_PARTICIPANT` already use for passwords), key `` `consent-version:${project}:${city}:${route}` ``, plain string value, organiser-managed via `wrangler kv key put` — no new admin UI, matching the `participant_whitelist` precedent. Missing key defaults to `1`.

- [ ] **Step 1: Write the migration**

Create `migrations/006_consent.sql`:

```sql
CREATE TABLE IF NOT EXISTS consent_records (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  team_name         TEXT NOT NULL,
  contact           TEXT NOT NULL DEFAULT '',
  all_sixteen_plus  INTEGER NOT NULL,
  promo_consent     INTEGER NOT NULL,
  promo_approved    INTEGER NOT NULL DEFAULT 0,
  consent_version   INTEGER NOT NULL,
  acknowledged_at   INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  UNIQUE (project_id, team_name, contact)
);
```

- [ ] **Step 2: Write the failing db tests**

Create `src/test/worker.consentdb.test.ts`, following the fake-D1 pattern from `src/test/worker.formsubmissiondb.test.ts`:

```ts
// @ts-nocheck
import { describe, it, expect } from "vitest";
import { upsertConsent, getConsent, setPromoApproved, listPromoReviewPhotos } from "../worker/db";

function makeDb() {
  const rows: Record<string, unknown>[] = [];
  const photos: Record<string, unknown>[] = [];

  function findConsent(projectId: string, teamName: string, contact: string) {
    return rows.find(
      (r) => r.project_id === projectId && r.team_name === teamName && r.contact === contact,
    );
  }

  const prepare = (sql: string) => {
    const args: unknown[] = [];
    const stmt = {
      bind: (...values: unknown[]) => { args.push(...values); return stmt; },
      run: async () => {
        if (sql.startsWith("INSERT INTO consent_records")) {
          const [id, project_id, team_name, contact, all_sixteen_plus, promo_consent, , consent_version, acknowledged_at, updated_at] = args;
          const existing = findConsent(project_id as string, team_name as string, contact as string);
          if (existing) {
            existing.all_sixteen_plus = all_sixteen_plus;
            existing.promo_consent = promo_consent;
            existing.consent_version = consent_version;
            existing.updated_at = updated_at;
          } else {
            rows.push({ id, project_id, team_name, contact, all_sixteen_plus, promo_consent, promo_approved: 0, consent_version, acknowledged_at, updated_at });
          }
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE consent_records SET promo_approved")) {
          const [updated_at, project_id, team_name, contact] = args;
          const existing = findConsent(project_id as string, team_name as string, contact as string);
          if (existing) { existing.promo_approved = 1; existing.updated_at = updated_at; }
          return { meta: { changes: existing ? 1 : 0 } };
        }
        return { meta: { changes: 0 } };
      },
      first: async () => {
        if (sql.startsWith("SELECT * FROM consent_records")) {
          const [project_id, team_name, contact] = args;
          return findConsent(project_id as string, team_name as string, contact as string) ?? null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes("FROM photos")) {
          const [project_id, city_id] = args;
          const matched = photos.filter((p) => {
            const consent = findConsent(project_id as string, p.team_name as string, (p.contact as string) ?? "");
            return (
              p.project_id === project_id &&
              p.city_id === city_id &&
              consent?.promo_consent === 1 &&
              consent?.promo_approved === 0
            );
          });
          return { results: matched };
        }
        return { results: [] };
      },
    };
    return stmt;
  };

  return { prepare, _photos: photos };
}

describe("upsertConsent", () => {
  it("inserts a new row on first consent", async () => {
    const db = makeDb();
    const record = await upsertConsent(db, { projectId: "den_haag", teamName: "Team A", contact: "" }, {
      allSixteenPlus: true, promoConsent: true, consentVersion: 1,
    });
    expect(record.all_sixteen_plus).toBe(1);
    expect(record.promo_consent).toBe(1);
  });

  it("updates the same row on a second call with the same identity key, never duplicating", async () => {
    const db = makeDb();
    await upsertConsent(db, { projectId: "den_haag", teamName: "Team A", contact: "" }, {
      allSixteenPlus: true, promoConsent: false, consentVersion: 1,
    });
    await upsertConsent(db, { projectId: "den_haag", teamName: "Team A", contact: "" }, {
      allSixteenPlus: true, promoConsent: true, consentVersion: 2,
    });
    const record = await getConsent(db, "den_haag", "Team A", "");
    expect(record?.promo_consent).toBe(1);
    expect(record?.consent_version).toBe(2);
  });

  it("forces promo_consent to 0 when all_sixteen_plus is false, regardless of what was requested", async () => {
    const db = makeDb();
    const record = await upsertConsent(db, { projectId: "den_haag", teamName: "Team B", contact: "" }, {
      allSixteenPlus: false, promoConsent: true, consentVersion: 1,
    });
    expect(record.promo_consent).toBe(0);
  });

  it("distinguishes two individual accounts sharing a team_name by contact", async () => {
    const db = makeDb();
    await upsertConsent(db, { projectId: "demo", teamName: "Squad", contact: "a@x.com" }, {
      allSixteenPlus: true, promoConsent: true, consentVersion: 1,
    });
    await upsertConsent(db, { projectId: "demo", teamName: "Squad", contact: "b@x.com" }, {
      allSixteenPlus: false, promoConsent: false, consentVersion: 1,
    });
    const a = await getConsent(db, "demo", "Squad", "a@x.com");
    const b = await getConsent(db, "demo", "Squad", "b@x.com");
    expect(a?.all_sixteen_plus).toBe(1);
    expect(b?.all_sixteen_plus).toBe(0);
  });
});

describe("setPromoApproved / listPromoReviewPhotos", () => {
  it("lists photos only for teams with promo_consent granted and not yet approved", async () => {
    const db = makeDb();
    await upsertConsent(db, { projectId: "den_haag", teamName: "Team A", contact: "" }, {
      allSixteenPlus: true, promoConsent: true, consentVersion: 1,
    });
    db._photos.push({ id: "p1", project_id: "den_haag", city_id: "den_haag", team_name: "Team A", contact: null });
    const before = await listPromoReviewPhotos(db, "den_haag", "den_haag");
    expect(before.map((p) => p.id)).toEqual(["p1"]);

    const approved = await setPromoApproved(db, "den_haag", "Team A", "");
    expect(approved).toBe(true);
    const after = await listPromoReviewPhotos(db, "den_haag", "den_haag");
    expect(after).toEqual([]);
  });

  it("returns false when no matching consent record exists to approve", async () => {
    const db = makeDb();
    const approved = await setPromoApproved(db, "den_haag", "Nonexistent", "");
    expect(approved).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/test/worker.consentdb.test.ts`
Expected: FAIL — `upsertConsent` etc. don't exist yet.

- [ ] **Step 4: Implement the db functions**

Add to `src/worker/db.ts` (after the form submission section):

```ts
// ---------------------------------------------------------------------------
// Consent record queries
// ---------------------------------------------------------------------------

export interface DbConsentRecord {
  id: string;
  project_id: string;
  team_name: string;
  contact: string; // never NULL — "" sentinel; see migration 006 comment
  all_sixteen_plus: number; // 0/1
  promo_consent: number; // 0/1
  promo_approved: number; // 0/1
  consent_version: number;
  acknowledged_at: number;
  updated_at: number;
}

export async function getConsent(
  database: D1Database,
  projectId: string,
  teamName: string,
  contact: string,
): Promise<DbConsentRecord | null> {
  return database
    .prepare("SELECT * FROM consent_records WHERE project_id = ? AND team_name = ? AND contact = ?")
    .bind(projectId, teamName, contact)
    .first<DbConsentRecord>();
}

export async function upsertConsent(
  database: D1Database,
  key: { projectId: string; teamName: string; contact: string },
  values: { allSixteenPlus: boolean; promoConsent: boolean; consentVersion: number },
): Promise<DbConsentRecord> {
  const now = Math.floor(Date.now() / 1000);
  const allSixteenPlus = values.allSixteenPlus ? 1 : 0;
  const promoConsent = allSixteenPlus === 1 && values.promoConsent ? 1 : 0;
  const existing = await getConsent(database, key.projectId, key.teamName, key.contact);
  const id = existing?.id ?? crypto.randomUUID();
  const acknowledgedAt = existing?.acknowledged_at ?? now;
  await database
    .prepare(
      `INSERT INTO consent_records
       (id, project_id, team_name, contact, all_sixteen_plus, promo_consent, promo_approved, consent_version, acknowledged_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
       ON CONFLICT(project_id, team_name, contact) DO UPDATE SET
         all_sixteen_plus = excluded.all_sixteen_plus,
         promo_consent = excluded.promo_consent,
         consent_version = excluded.consent_version,
         updated_at = excluded.updated_at`,
    )
    .bind(id, key.projectId, key.teamName, key.contact, allSixteenPlus, promoConsent, values.consentVersion, acknowledgedAt, now)
    .run();
  return (await getConsent(database, key.projectId, key.teamName, key.contact))!;
}

export async function setPromoApproved(
  database: D1Database,
  projectId: string,
  teamName: string,
  contact: string,
): Promise<boolean> {
  const result = await database
    .prepare(
      `UPDATE consent_records SET promo_approved = 1, updated_at = ?
       WHERE project_id = ? AND team_name = ? AND contact = ?`,
    )
    .bind(Math.floor(Date.now() / 1000), projectId, teamName, contact)
    .run();
  return result.meta.changes > 0;
}

export async function listPromoReviewPhotos(
  database: D1Database,
  projectId: string,
  cityId: string,
): Promise<DbPhoto[]> {
  const result = await database
    .prepare(
      `SELECT p.* FROM photos p
       JOIN consent_records c
         ON c.project_id = p.project_id
        AND c.team_name = p.team_name
        AND c.contact = COALESCE(p.contact, '')
       WHERE p.project_id = ? AND p.city_id = ?
         AND c.promo_consent = 1 AND c.promo_approved = 0
       ORDER BY p.uploaded_at ASC`,
    )
    .bind(projectId, cityId)
    .all<DbPhoto>();
  return result.results;
}
```

- [ ] **Step 5: Implement the KV-backed consent version helper**

Create `src/worker/consentVersion.ts`:

```ts
import type { Env } from "../types/worker";

export const KV_PREFIX_CONSENT_VERSION = "consent-version:";
const DEFAULT_CONSENT_VERSION = 1;

function consentVersionKey(project: string, city: string, route: string): string {
  return `${KV_PREFIX_CONSENT_VERSION}${project}:${city}:${route}`;
}

/** Reads the organiser-set current consent version, or the default (1) if never set. */
export async function getConsentVersion(
  env: Env,
  project: string,
  city: string,
  route: string,
): Promise<number> {
  const raw = await env.AUTH_STORE.get(consentVersionKey(project, city, route));
  if (raw === null) {
    return DEFAULT_CONSENT_VERSION;
  }
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? DEFAULT_CONSENT_VERSION : parsed;
}
```

(No `setConsentVersion` — organisers bump it via `wrangler kv key put "consent-version:project:city:route" "2" --binding=AUTH_STORE`, matching how `participant_whitelist`/KV admin passwords are already managed with no admin UI.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/test/worker.consentdb.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add migrations/006_consent.sql src/worker/db.ts src/worker/consentVersion.ts src/test/worker.consentdb.test.ts
git commit -m "feat: add consent_records table, upsert/query functions, KV-backed consent version"
```

---

### Task 4: Backend — participant-facing consent routes

**Files:**
- Create: `src/worker/routes/consentRoutes.ts`
- Modify: `src/worker.ts`
- Test: `src/test/worker.consentRoutes.test.ts`

**Interfaces:**
- Consumes: `upsertConsent`, `getConsent` (Task 3, `db.ts`); `getConsentVersion` (Task 3, `consentVersion.ts`); `requireAuth`, `isParticipantToken` (existing `auth.ts`/`types/auth.ts`); `json`, `checkOrigin` (existing `utils.ts`).
- Produces: `handleConsentRoutes(request, url, env)` wired into `src/worker.ts`'s route chain. Three routes: `POST /consent`, `GET /consent`, `GET /consent/version`. Consumed by Task 6 (`api.ts` client functions).
- **`POST /consent` body carries `acknowledge: boolean`, not just the two answers.** Both the consent screen (Task 8) and the "Photo permissions" withdrawal menu (Task 11) call this same route, but the spec requires only the screen's submission to bump `consent_version` — the menu toggle "never touches `consent_version`" (spec §6). `acknowledge: true` (screen) means "stamp whatever `getConsentVersion()` currently returns"; `acknowledge: false` (menu) means "keep whatever `consent_version` the existing record already has." Without this distinction, both call sites would silently re-stamp the version on every save, since they'd otherwise share one code path with no way to tell them apart.

- [ ] **Step 1: Write the failing route tests**

Create `src/test/worker.consentRoutes.test.ts`. Mock `../worker/db` and `../worker/consentVersion` (following the `vi.mock` pattern used by other worker route tests), and `../worker/auth`'s `requireAuth`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleConsentRoutes } from "../worker/routes/consentRoutes";

vi.mock("../worker/auth", () => ({
  requireAuth: vi.fn(),
}));
vi.mock("../worker/db", () => ({
  upsertConsent: vi.fn(),
  getConsent: vi.fn(),
}));
vi.mock("../worker/consentVersion", () => ({
  getConsentVersion: vi.fn(),
}));

import { requireAuth } from "../worker/auth";
import { upsertConsent, getConsent } from "../worker/db";
import { getConsentVersion } from "../worker/consentVersion";

const env = { AUTH_DB: {}, AUTH_STORE: {} } as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /consent", () => {
  it("rejects unauthenticated requests", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null);
    const req = new Request("https://x/consent", { method: "POST", body: "{}" });
    const res = await handleConsentRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(401);
  });

  it("acknowledge:true stamps consentVersion from getConsentVersion, ignoring any client-sent value", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue(null);
    vi.mocked(getConsentVersion).mockResolvedValue(7);
    vi.mocked(upsertConsent).mockResolvedValue({} as any);
    const req = new Request("https://x/consent?city=den_haag&route=short_loop", {
      method: "POST",
      body: JSON.stringify({ allSixteenPlus: true, promoConsent: true, acknowledge: true, consentVersion: 999 }),
    });
    await handleConsentRoutes(req, new URL(req.url), env);
    expect(upsertConsent).toHaveBeenCalledWith(
      env.AUTH_DB,
      { projectId: "den_haag", teamName: "Team A", contact: "" },
      { allSixteenPlus: true, promoConsent: true, consentVersion: 7 },
    );
  });

  it("acknowledge:false (e.g. the withdrawal menu) preserves the existing record's consent_version instead of re-stamping it", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue({ consent_version: 3 } as any);
    vi.mocked(getConsentVersion).mockResolvedValue(7); // current KV value is newer — must NOT be used here
    vi.mocked(upsertConsent).mockResolvedValue({} as any);
    const req = new Request("https://x/consent", {
      method: "POST",
      body: JSON.stringify({ allSixteenPlus: true, promoConsent: false, acknowledge: false }),
    });
    await handleConsentRoutes(req, new URL(req.url), env);
    expect(upsertConsent).toHaveBeenCalledWith(
      env.AUTH_DB,
      { projectId: "den_haag", teamName: "Team A", contact: "" },
      { allSixteenPlus: true, promoConsent: false, consentVersion: 3 },
    );
    expect(getConsentVersion).not.toHaveBeenCalled();
  });

  it("acknowledge:false with no existing record falls back to the current version (defensive — shouldn't normally happen)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue(null);
    vi.mocked(getConsentVersion).mockResolvedValue(7);
    vi.mocked(upsertConsent).mockResolvedValue({} as any);
    const req = new Request("https://x/consent", {
      method: "POST",
      body: JSON.stringify({ allSixteenPlus: true, promoConsent: false, acknowledge: false }),
    });
    await handleConsentRoutes(req, new URL(req.url), env);
    expect(upsertConsent).toHaveBeenCalledWith(
      env.AUTH_DB,
      { projectId: "den_haag", teamName: "Team A", contact: "" },
      { allSixteenPlus: true, promoConsent: false, consentVersion: 7 },
    );
  });
});

describe("GET /consent", () => {
  it("returns the participant's current record", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue({ promo_consent: 1 } as any);
    const req = new Request("https://x/consent", { method: "GET" });
    const res = await handleConsentRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true, record: { promo_consent: 1 } });
  });

  it("returns record: null when nothing exists yet", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue(null);
    const req = new Request("https://x/consent", { method: "GET" });
    const res = await handleConsentRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true, record: null });
  });
});

describe("GET /consent/version", () => {
  it("returns the current version for a project/city/route with no auth required", async () => {
    vi.mocked(getConsentVersion).mockResolvedValue(3);
    const req = new Request("https://x/consent/version?project=den_haag&city=den_haag&route=short_loop", { method: "GET" });
    const res = await handleConsentRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true, consentVersion: 3 });
    expect(requireAuth).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/worker.consentRoutes.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `consentRoutes.ts`**

Create `src/worker/routes/consentRoutes.ts`:

```ts
import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { isParticipantToken } from "../../types/auth";
import { upsertConsent, getConsent } from "../db";
import { getConsentVersion } from "../consentVersion";
import { json } from "../utils";

export async function handleConsentRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method === "GET" && url.pathname === "/consent/version") {
    const project = url.searchParams.get("project") ?? "";
    const city = url.searchParams.get("city") ?? "";
    const route = url.searchParams.get("route") ?? "";
    const consentVersion = await getConsentVersion(env, project, city, route);
    return json({ ok: true, consentVersion });
  }

  if (request.method === "GET" && url.pathname === "/consent") {
    const authPayload = await requireAuth(request, env);
    if (!authPayload || !isParticipantToken(authPayload)) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const record = await getConsent(
      env.AUTH_DB,
      authPayload.project,
      authPayload.teamName,
      authPayload.contact || "",
    );
    return json({ ok: true, record });
  }

  if (request.method === "POST" && url.pathname === "/consent") {
    const authPayload = await requireAuth(request, env);
    if (!authPayload || !isParticipantToken(authPayload)) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    let body: { allSixteenPlus?: boolean; promoConsent?: boolean; acknowledge?: boolean };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    const contact = authPayload.contact || "";
    const existing = await getConsent(env.AUTH_DB, authPayload.project, authPayload.teamName, contact);

    // acknowledge:true (the consent screen itself) always re-stamps the
    // current version. acknowledge:false (the withdrawal menu, Task 11)
    // preserves whatever version the existing record already has — the
    // participant is only flipping a preference, not re-reading the text.
    // The `!existing` fallback only matters defensively; the menu can't
    // normally toggle a record that doesn't exist yet.
    const consentVersion =
      body.acknowledge || !existing
        ? await getConsentVersion(env, authPayload.project, url.searchParams.get("city") ?? "", url.searchParams.get("route") ?? "")
        : existing.consent_version;

    const record = await upsertConsent(
      env.AUTH_DB,
      { projectId: authPayload.project, teamName: authPayload.teamName, contact },
      { allSixteenPlus: !!body.allSixteenPlus, promoConsent: !!body.promoConsent, consentVersion },
    );
    return json({ ok: true, record });
  }

  return null;
}
```

- [ ] **Step 4: Wire into `worker.ts`**

In `src/worker.ts`, add the import (after `handleFormSubmitRoute`):

```ts
import { handleFormSubmitRoute } from "./worker/routes/formSubmitRoute";
import { handleConsentRoutes } from "./worker/routes/consentRoutes";
```

and add it to the `??` chain (after `handleFormSubmitRoute`):

```ts
(await handleFormSubmitRoute(request, url, env)) ??
(await handleConsentRoutes(request, url, env)) ??
(await handleGalleryRoutes(request, url, env)) ??
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/worker.consentRoutes.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/worker/routes/consentRoutes.ts src/worker.ts src/test/worker.consentRoutes.test.ts
git commit -m "feat: add POST/GET /consent and GET /consent/version routes"
```

---

### Task 5: Backend — `promo-approve` route (human review gate)

**Files:**
- Modify: `src/worker/routes/editorRoutes.ts`
- Test: `src/test/worker.editorRoutes.promoApprove.test.ts`

**Interfaces:**
- Consumes: `requireOrganizerCap` (already defined in `editorRoutes.ts:87-103`), `listPromoReviewPhotos`, `setPromoApproved` (Task 3).
- Produces: `GET /promo-review?project=X&city=Y` (list), `POST /promo-approve` (approve). Consumed by Task 12 (`PromoReviewPage.svelte`).
- **Why `requireOrganizerCap` and not `requireEditorCap`:** this gate carries real GDPR/legal weight (spec §5 calls it "the actual safety net"), so it uses the stricter of the two existing capability checks already in this file — the same one `POST /editor/:project/users/:userId/revoke` uses for user-management actions — rather than the more permissive `requireEditorCap` used for ordinary location content edits.

- [ ] **Step 1: Write the failing tests**

Create `src/test/worker.editorRoutes.promoApprove.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleEditorRoutes } from "../worker/routes/editorRoutes";

vi.mock("../worker/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("../worker/db", () => ({
  getUserCaps: vi.fn(),
  listPromoReviewPhotos: vi.fn(),
  setPromoApproved: vi.fn(),
}));

import { requireAuth } from "../worker/auth";
import { getUserCaps, listPromoReviewPhotos, setPromoApproved } from "../worker/db";

const env = { AUTH_DB: {} } as any;

beforeEach(() => vi.clearAllMocks());

describe("GET /promo-review", () => {
  it("requires organizer capability", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user_id: "u1", exp: 0 });
    vi.mocked(getUserCaps).mockResolvedValue([{ project_id: "den_haag", capability: "editor" } as any]);
    const req = new Request("https://x/promo-review?project=den_haag&city=den_haag", { method: "GET" });
    const res = await handleEditorRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(403);
  });

  it("lists photos for an organizer", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user_id: "u1", exp: 0 });
    vi.mocked(getUserCaps).mockResolvedValue([{ project_id: "den_haag", capability: "organizer" } as any]);
    vi.mocked(listPromoReviewPhotos).mockResolvedValue([{ id: "p1" } as any]);
    const req = new Request("https://x/promo-review?project=den_haag&city=den_haag", { method: "GET" });
    const res = await handleEditorRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true, photos: [{ id: "p1" }] });
  });
});

describe("POST /promo-approve", () => {
  it("approves the team's consent record", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user_id: "u1", exp: 0 });
    vi.mocked(getUserCaps).mockResolvedValue([{ project_id: "den_haag", capability: "organizer" } as any]);
    vi.mocked(setPromoApproved).mockResolvedValue(true);
    const req = new Request("https://x/promo-approve", {
      method: "POST",
      body: JSON.stringify({ project: "den_haag", teamName: "Team A", contact: "" }),
    });
    const res = await handleEditorRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true });
    expect(setPromoApproved).toHaveBeenCalledWith(env.AUTH_DB, "den_haag", "Team A", "");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/worker.editorRoutes.promoApprove.test.ts`
Expected: FAIL — routes don't exist.

- [ ] **Step 3: Implement the routes**

In `src/worker/routes/editorRoutes.ts`, add the import:

```ts
import { getUserCaps, getUserById, revokeCap, listProjectUsers, listPromoReviewPhotos, setPromoApproved } from "../db";
```

Add two new route blocks inside `handleEditorRoutes`, near the other `GET`/`POST` blocks (before the final `return null;`):

```ts
// -------------------------------------------------------------------------
// GET /promo-review
// -------------------------------------------------------------------------
if (request.method === "GET" && url.pathname === "/promo-review") {
  const project = url.searchParams.get("project") ?? "";
  const city = url.searchParams.get("city") ?? "";
  const authResult = await requireOrganizerCap(request, env, project);
  if (authResult instanceof Response) {return authResult;}
  const photos = await listPromoReviewPhotos(env.AUTH_DB, project, city);
  return json({ ok: true, photos });
}

// -------------------------------------------------------------------------
// POST /promo-approve
// -------------------------------------------------------------------------
if (request.method === "POST" && url.pathname === "/promo-approve") {
  if (!checkOrigin(request)) {return json({ ok: false, error: "Forbidden" }, 403);}
  const { project, teamName, contact } = (await request.json()) as {
    project?: string; teamName?: string; contact?: string;
  };
  if (!project || !teamName) {
    return json({ ok: false, error: "Missing project or teamName" }, 400);
  }
  const authResult = await requireOrganizerCap(request, env, project);
  if (authResult instanceof Response) {return authResult;}
  const approved = await setPromoApproved(env.AUTH_DB, project, teamName, contact ?? "");
  return json({ ok: approved, error: approved ? undefined : "No matching consent record" });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/worker.editorRoutes.promoApprove.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full existing `editorRoutes` test suite to check for regressions**

Run: `npx vitest run -t "editor"`
Expected: PASS, no regressions from the new import/routes.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/worker/routes/editorRoutes.ts src/test/worker.editorRoutes.promoApprove.test.ts
git commit -m "feat: add organizer-gated promo-review list and approve routes"
```

---

### Task 6: Frontend — `api.ts` client functions for consent + promo review

**Files:**
- Modify: `src/utils/api.ts`
- Test: `src/test/api.test.ts`

**Interfaces:**
- Produces: `postConsentUpdate()`, `fetchConsent()`, `fetchConsentVersion()`, `fetchPromoReviewPhotos()`, `postPromoApprove()`. Consumed by Task 8 (`ConsentScreen`), Task 10 (`RoutePage`), Task 11 (`TitleBar`), Task 12 (`PromoReviewPage`).

- [ ] **Step 1: Write the failing tests**

Add to `src/test/api.test.ts` (following the existing mocked-`fetch` pattern in that file):

```ts
describe("consent", () => {
  it("postConsentUpdate posts to /consent with city/route query params and the acknowledge flag", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true, record: {} }) });
    vi.stubGlobal("fetch", mockFetch);
    await postConsentUpdate("den_haag", "short_loop", { allSixteenPlus: true, promoConsent: false, acknowledge: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "/consent?city=den_haag&route=short_loop",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ allSixteenPlus: true, promoConsent: false, acknowledge: true }),
      }),
    );
  });

  it("fetchConsentVersion GETs /consent/version with project/city/route", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true, consentVersion: 2 }) });
    vi.stubGlobal("fetch", mockFetch);
    const res = await fetchConsentVersion("den_haag", "den_haag", "short_loop");
    expect(mockFetch).toHaveBeenCalledWith("/consent/version?project=den_haag&city=den_haag&route=short_loop");
    expect(res.consentVersion).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/api.test.ts -t "consent"`
Expected: FAIL — functions don't exist.

- [ ] **Step 3: Implement the client functions**

Add to `src/utils/api.ts` (after the Challenge section):

```ts
// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

export interface ConsentRecord {
  all_sixteen_plus: number;
  promo_consent: number;
  promo_approved: number;
  consent_version: number;
}

export interface ConsentResponse {
  ok: boolean;
  record?: ConsentRecord | null;
  error?: string;
}

export async function postConsentUpdate(
  city: string,
  route: string,
  payload: { allSixteenPlus: boolean; promoConsent: boolean; acknowledge: boolean },
): Promise<ConsentResponse> {
  const res = await fetch(`/consent?city=${city}&route=${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<ConsentResponse>;
}

export async function fetchConsent(): Promise<ConsentResponse> {
  const res = await fetch("/consent");
  return res.json() as Promise<ConsentResponse>;
}

export interface ConsentVersionResponse {
  ok: boolean;
  consentVersion?: number;
  error?: string;
}

export async function fetchConsentVersion(
  project: string,
  city: string,
  route: string,
): Promise<ConsentVersionResponse> {
  const res = await fetch(`/consent/version?project=${project}&city=${city}&route=${route}`);
  return res.json() as Promise<ConsentVersionResponse>;
}

// ---------------------------------------------------------------------------
// Promo review (editor)
// ---------------------------------------------------------------------------

export interface PromoReviewPhoto {
  id: string;
  team_name: string;
  contact: string | null;
  task_title: string;
}

export async function fetchPromoReviewPhotos(
  project: string,
  city: string,
): Promise<{ ok: boolean; photos?: PromoReviewPhoto[]; error?: string }> {
  const res = await fetch(`/promo-review?project=${project}&city=${city}`);
  return res.json() as Promise<{ ok: boolean; photos?: PromoReviewPhoto[]; error?: string }>;
}

export async function postPromoApprove(
  project: string,
  teamName: string,
  contact: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/promo-approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, teamName, contact }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}
```

(Note: unlike `postConsentUpdate`/`fetchConsentVersion`, which take `project`/`city`/`route` as call arguments, `fetchConsent`/`GET /consent` intentionally take none — the Worker derives project/team identity entirely from the auth cookie, matching every other participant-scoped endpoint in this file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/api.ts src/test/api.test.ts
git commit -m "feat: add consent and promo-review client API functions"
```

---

### Task 7: Content model — `ConsentEntry` type, `consent.schema.json`, age threshold config

**Files:**
- Modify: `src/types/data.ts` (`RouteEntry` union, `HuntSettings`)
- Create: `src/data/schemas/consent.schema.json`
- Modify: `src/utils/huntSettings.ts`
- Test: `src/test/huntSettings.test.ts`
- Test: `src/test/consentSchema.test.ts` (new, mirrors the existing `completionSchema.test.ts` pattern)

**Interfaces:**
- Produces: `ConsentEntry` (added to the `RouteEntry` union), `HuntSettings.ageThreshold: number`. Consumed by Task 8 (`ConsentScreen.svelte`), Task 9 (YAML content).
- **Authoring shape decision (new, not spelled out in the design spec — resolved here as a plan-time "file structure" decision, matching CLAUDE.md's YAML-first policy):** the mockup's two icon+text bullet sections ("Stay safe" / "About your photos") aren't representable as plain markdown (each row needs a distinct `lucide-svelte` icon per spec §2.1) and aren't `AppForm` fields either (they carry no participant-editable value) — they're static structured content specific to this template-type, analogous to how `SplashEntry`/`OptionsEntry` each already carry their own template-specific shape. `fields` (the interactive `AppForm` part: age question, checkbox, declined note) stays separate from this static content.

- [ ] **Step 1: Add `ConsentEntry` to `src/types/data.ts`**

Add near `OptionsEntry` (after it, before `WideButtonTarget`):

```ts
export interface ConsentBulletSection {
  heading: string;
  items: Array<{ icon: string; text: string }>;
}

export interface ConsentEntry {
  "template-type": "consent";
  heading: string;
  intro: string;
  chips?: string[];
  safety: ConsentBulletSection;
  photos: ConsentBulletSection;
  fields: FormField[];
  primaryButtonText: string;
  privacyLinkUrl?: string;
  footerText?: string;
  "nav-bar"?: NavBarConfig;
}
```

Add `ConsentEntry` to the `RouteEntry` union (`src/types/data.ts:271-277`):

```ts
export type RouteEntry =
  | LocationEntry
  | TextEntry
  | SplashEntry
  | OptionsEntry
  | ConsentEntry
  | CheckpointEntry
  | CompletionEntry;
```

Add `ageThreshold` to `HuntSettings`:

```ts
export interface HuntSettings {
  storeFormsInLocalStorage: boolean;
  formRequired: boolean;
  canFormsSkip: boolean;
  allowResubmit: boolean;
  ageThreshold: number;
}
```

- [ ] **Step 2: Write the failing `huntSettings` test**

Add to `src/test/huntSettings.test.ts`:

```ts
test("ageThreshold defaults to 16 when project.consent_age_threshold is absent", () => {
  const settings = getHuntSettings({});
  expect(settings.ageThreshold).toBe(16);
});

test("ageThreshold reads project.consent_age_threshold when present", () => {
  const settings = getHuntSettings({ "project.consent_age_threshold": 15 });
  expect(settings.ageThreshold).toBe(15);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/test/huntSettings.test.ts`
Expected: FAIL — `ageThreshold` is `undefined`.

- [ ] **Step 4: Implement in `huntSettings.ts`**

```ts
import type { HuntSettings, ProjectMeta } from "../types/data";

const DEFAULT_AGE_THRESHOLD = 16;

export function getHuntSettings(meta: ProjectMeta | null): HuntSettings {
  return {
    storeFormsInLocalStorage: meta?.["project.store_forms_in_local_storage"] !== false,
    formRequired: meta?.["project.form_required"] === true,
    canFormsSkip: meta?.["project.can_forms_skip"] === true,
    allowResubmit: meta?.["project.allow_resubmit"] !== false,
    ageThreshold:
      typeof meta?.["project.consent_age_threshold"] === "number"
        ? (meta["project.consent_age_threshold"] as number)
        : DEFAULT_AGE_THRESHOLD,
  };
}
```

- [ ] **Step 5: Write `consent.schema.json`**

Create `src/data/schemas/consent.schema.json`, following the structure of `options.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Consent Screen",
  "type": "object",
  "additionalProperties": false,
  "required": ["template-type", "heading", "intro", "safety", "photos", "fields", "primaryButtonText"],
  "properties": {
    "template-type": { "const": "consent" },
    "heading": { "type": "string" },
    "intro": { "type": "string" },
    "chips": { "type": "array", "items": { "type": "string" } },
    "nav-bar": {
      "type": "object",
      "additionalProperties": false,
      "properties": { "visible": { "type": "boolean" } }
    },
    "safety": { "$ref": "#/definitions/bulletSection" },
    "photos": { "$ref": "#/definitions/bulletSection" },
    "fields": { "type": "array" },
    "primaryButtonText": { "type": "string" },
    "privacyLinkUrl": { "type": "string" },
    "footerText": { "type": "string" }
  },
  "definitions": {
    "bulletSection": {
      "type": "object",
      "additionalProperties": false,
      "required": ["heading", "items"],
      "properties": {
        "heading": { "type": "string" },
        "items": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["icon", "text"],
            "properties": {
              "icon": { "type": "string" },
              "text": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

`fields` is intentionally left as a loose `array` here (not `$ref`-ing `form.schema.json`'s field definitions) — `scripts/validate-yaml.ts` (Task 9) validates `fields` against `form.schema.json` separately, the same way `challenge.form` references a separately-validated file today; duplicating the full field schema inline here would drift out of sync with `form.schema.json` over time.

- [ ] **Step 6: Write the schema test**

Create `src/test/consentSchema.test.ts`, matching `src/test/completionSchema.test.ts`'s exact `ajv`/import setup:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemaPath = join(__dirname, "..", "data", "schemas", "consent.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const validDoc = {
  "template-type": "consent",
  heading: "Before you begin",
  intro: "A few things to know before you head out.",
  chips: ["2.4 km", "~2 hours"],
  safety: { heading: "Stay safe", items: [{ icon: "Phone", text: "Call 112." }] },
  photos: { heading: "About your photos", items: [{ icon: "Eye", text: "Others can see your photos." }] },
  fields: [],
  primaryButtonText: "I understand — start the hunt",
};

test("accepts a well-formed consent entry", () => {
  expect(validate(validDoc)).toBe(true);
});

test("accepts the optional chips, privacyLinkUrl, footerText, and nav-bar fields", () => {
  expect(
    validate({
      ...validDoc,
      privacyLinkUrl: "https://example.org/privacy",
      footerText: "Questions during the hunt? Contact your organiser.",
      "nav-bar": { visible: false },
    }),
  ).toBe(true);
});

test("accepts a document with no chips (optional)", () => {
  const { chips: _chips, ...withoutChips } = validDoc;
  expect(validate(withoutChips)).toBe(true);
});

test("rejects a consent entry missing heading", () => {
  const { heading: _heading, ...withoutHeading } = validDoc;
  expect(validate(withoutHeading)).toBe(false);
});

test("rejects a safety/photos section missing items", () => {
  expect(validate({ ...validDoc, safety: { heading: "Stay safe" } })).toBe(false);
});

test("rejects a bullet item missing icon", () => {
  expect(
    validate({ ...validDoc, safety: { heading: "Stay safe", items: [{ text: "Call 112." }] } }),
  ).toBe(false);
});

test("rejects an unknown top-level property", () => {
  expect(validate({ ...validDoc, unexpected_field: true })).toBe(false);
});
```

- [ ] **Step 7: Run all new tests**

Run: `npx vitest run src/test/huntSettings.test.ts src/test/consentSchema.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/types/data.ts src/data/schemas/consent.schema.json src/utils/huntSettings.ts src/test/huntSettings.test.ts src/test/consentSchema.test.ts
git commit -m "feat: add ConsentEntry content model, consent.schema.json, and age threshold config"
```

---

### Task 8: `ConsentScreen.svelte` + `RouteScreen.svelte` dispatch wiring

**Files:**
- Create: `src/components/ConsentScreen.svelte`
- Create: `src/components/ConsentScreen.css`
- Modify: `src/components/RouteScreen.svelte`
- Test: `src/test/ConsentScreen.test.ts`
- Test: `src/test/RouteScreen.test.ts`

**Interfaces:**
- Consumes: `AppForm` (`formContext` prop, `onSubmit`/`onSuccess`), `postConsentUpdate` (Task 6), `evaluateVisibility` (unchanged, used internally by `AppForm`), lucide-svelte icons.
- Produces: `ConsentScreen` props `{ entry: ConsentEntry, project, city, route, onContinue }`. Consumed by `RouteScreen.svelte`'s new `consent` branch.
- **Icon mapping:** `ConsentBulletSection.items[].icon` is a small closed vocabulary (not a dynamic string-to-arbitrary-import lookup, to keep this type-safe and tree-shakeable) — `AlertTriangle`, `Footprints`, `Wifi`, `Phone`, `Eye`, `ShieldAlert`, matching the mockup's five safety/photo bullets. Add more only when new content actually needs them.

- [ ] **Step 1: Write the failing `ConsentScreen` tests**

Create `src/test/ConsentScreen.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { vi } from "vitest";
import ConsentScreen from "../components/ConsentScreen.svelte";
import * as api from "../utils/api";

const entry = {
  "template-type": "consent" as const,
  heading: "Before you begin",
  intro: "A few things to know.",
  chips: ["2.4 km", "~2 hours"],
  safety: { heading: "Stay safe", items: [{ icon: "Phone", text: "Call 112." }] },
  photos: { heading: "About your photos", items: [{ icon: "Eye", text: "Others can see your photos." }] },
  fields: [
    { id: "all_sixteen_plus", type: "radio" as const, variant: "segmented" as const, label: "16+?", options: ["Yes", "No"] },
    {
      id: "promo_consent", type: "boolean" as const, label: "Promo consent",
      isVisible: { initially: "conditional" as const, condition: { source: "all_sixteen_plus", operator: "=" as const, value: "Yes" } },
    },
  ],
  primaryButtonText: "I understand — start the hunt",
};

beforeEach(() => vi.clearAllMocks());

test("renders heading, chips, and bullet sections", () => {
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  expect(screen.getByText("Before you begin")).toBeInTheDocument();
  expect(screen.getByText("2.4 km")).toBeInTheDocument();
  expect(screen.getByText("Call 112.")).toBeInTheDocument();
});

test("submitting posts consent and calls onContinue", async () => {
  vi.spyOn(api, "postConsentUpdate").mockResolvedValue({ ok: true, record: {} as any });
  const onContinue = vi.fn();
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue });
  await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
  await fireEvent.click(screen.getByRole("button", { name: entry.primaryButtonText }));
  expect(api.postConsentUpdate).toHaveBeenCalledWith("den_haag", "short_loop", { allSixteenPlus: true, promoConsent: false, acknowledge: true });
  expect(onContinue).toHaveBeenCalled();
});

test("a failed consent post still calls onContinue (never blocks navigation)", async () => {
  vi.spyOn(api, "postConsentUpdate").mockRejectedValue(new Error("network"));
  const onContinue = vi.fn();
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue });
  await fireEvent.click(screen.getByRole("button", { name: entry.primaryButtonText }));
  expect(onContinue).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/ConsentScreen.test.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement `ConsentScreen.svelte`**

```svelte
<script lang="ts">
  import { AlertTriangle, Footprints, Wifi, Phone, Eye, ShieldAlert } from "lucide-svelte";
  import AppForm from "./AppForm.svelte";
  import MarkdownText from "./MarkdownText.svelte";
  import { postConsentUpdate } from "../utils/api";
  import type { ConsentEntry } from "../types/data";
  import "./ConsentScreen.css";

  const ICONS = { AlertTriangle, Footprints, Wifi, Phone, Eye, ShieldAlert } as const;

  let {
    entry,
    project,
    city,
    route,
    onContinue = undefined,
  }: {
    entry: ConsentEntry;
    project: string;
    city: string;
    route: string;
    onContinue?: () => void;
  } = $props();

  async function handleSubmit(values: Record<string, unknown>) {
    try {
      await postConsentUpdate(city, route, {
        allSixteenPlus: values.all_sixteen_plus === "Yes",
        promoConsent: values.promo_consent === true,
        acknowledge: true,
      });
    } catch {
      // Never blocks navigation — see spec §13. The locally-seeded answer is
      // re-sent the next time RoutePage mounts (Task 10).
    }
  }
</script>

<div class="consent-screen">
  <h1 class="consent-screen__heading">{entry.heading}</h1>
  <p class="consent-screen__intro">{entry.intro}</p>

  {#if entry.chips && entry.chips.length > 0}
    <div class="consent-screen__chips">
      {#each entry.chips as chip (chip)}
        <span class="consent-screen__chip">{chip}</span>
      {/each}
    </div>
  {/if}

  {#each [entry.safety, entry.photos] as section (section.heading)}
    <div class="consent-screen__section-heading">{section.heading}</div>
    {#each section.items as item, i (i)}
      {@const Icon = ICONS[item.icon as keyof typeof ICONS]}
      <div class="consent-screen__bullet">
        {#if Icon}<Icon size={18} aria-hidden="true" />{/if}
        <span>{item.text}</span>
      </div>
    {/each}
  {/each}

  <AppForm
    fields={entry.fields}
    formContext={{ project, city, route }}
    onSubmit={handleSubmit}
    onSuccess={onContinue}
    submitLabel={entry.primaryButtonText}
    alwaysSubmittable={true}
  />

  {#if entry.privacyLinkUrl}
    <a class="consent-screen__privacy-link" href={entry.privacyLinkUrl} target="_blank" rel="noopener noreferrer">
      Read the full privacy notice
    </a>
  {/if}
  {#if entry.footerText}
    <MarkdownText text={entry.footerText} />
  {/if}
</div>
```

Note: `AppForm`'s built-in submit button *is* the primary button here (`submitLabel={entry.primaryButtonText}`), and `alwaysSubmittable` is required — per spec §10, the button must stay enabled regardless of the age answer or checkbox state, but `AppForm`'s default dirty-tracking (`Task 1`'s `hasChanges`) would otherwise disable it until something changes from its seeded baseline. This is the same reason `TeamSetupPage` already sets `alwaysSubmittable` for its one-shot form.

- [ ] **Step 4: Write `ConsentScreen.css`**

```css
/* src/components/ConsentScreen.css */

.consent-screen {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--gap-section) var(--gap-block);
}

.consent-screen__heading {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text);
  text-align: left;
  margin: 0 0 var(--gap-field);
}

.consent-screen__intro {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0 0 var(--gap-section);
}

.consent-screen__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: var(--gap-section);
}

.consent-screen__chip {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.consent-screen__section-heading {
  font-family: var(--font-map, var(--font-family));
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 6px;
  margin-top: var(--gap-section);
  margin-bottom: var(--gap-block);
}

.consent-screen__bullet {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: var(--gap-field);
  color: var(--color-text);
  font-size: var(--font-size-base);
}

.consent-screen__privacy-link {
  display: block;
  margin-top: var(--gap-section);
  color: var(--color-accent);
  font-size: var(--font-size-sm);
}
```

- [ ] **Step 5: Wire `RouteScreen.svelte`'s dispatch**

Add the import:

```ts
import ConsentScreen from "./ConsentScreen.svelte";
```

Add a branch after the `options` branch (`RouteScreen.svelte:85-96`):

```svelte
{:else if entry["template-type"] === "consent"}
  <ConsentScreen
    entry={entry}
    project={project}
    city={cityId ?? ""}
    route={routeId ?? ""}
    {onContinue}
  />
```

- [ ] **Step 6: Write the failing `RouteScreen` dispatch test, then make it pass**

Add to `src/test/RouteScreen.test.ts` (following that file's existing per-template-type test pattern):

```ts
test("dispatches a consent entry to ConsentScreen", () => {
  render(RouteScreen, {
    entry: {
      "template-type": "consent",
      heading: "Before you begin", intro: "x",
      safety: { heading: "Stay safe", items: [{ icon: "Phone", text: "Call 112." }] },
      photos: { heading: "About your photos", items: [{ icon: "Eye", text: "x" }] },
      fields: [], primaryButtonText: "Go",
    },
    index: 0, project: "den_haag",
  });
  expect(screen.getByText("Before you begin")).toBeInTheDocument();
});
```

- [ ] **Step 7: Run tests to verify everything passes**

Run: `npx vitest run src/test/ConsentScreen.test.ts src/test/RouteScreen.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/ConsentScreen.svelte src/components/ConsentScreen.css src/components/RouteScreen.svelte src/test/ConsentScreen.test.ts src/test/RouteScreen.test.ts
git commit -m "feat: add ConsentScreen and wire the consent template-type into RouteScreen"
```

---

### Task 9: YAML content — replace `den_haag`'s pre-hunt screen, add age threshold config

**Files:**
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/000_options_eula.yaml` → rename to `000_consent_eula.yaml`
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml` (update the filename reference)
- Modify: `src/data/text/en/projects/democrats_abroad/democrats_abroad.yaml`

**Interfaces:**
- No new code interfaces — this task produces the actual authored content Task 7/8's types and components render.

- [ ] **Step 1: Delete the old file and create the new one**

Delete `000_options_eula.yaml`. Create `000_consent_eula.yaml`:

```yaml
template-type: consent
nav-bar:
  visible: false
heading: "Before you begin"
intro: "A few things to know before you head out. This takes a minute, then you're off."
chips:
  - "2.4 km"
  - "~2 hours"
  - "Steps & cobbles"
safety:
  heading: "Stay safe"
  items:
    - icon: AlertTriangle
      text: "Watch traffic, especially at crossings and on tram tracks."
    - icon: Footprints
      text: "Self-paced. Take breaks, and skip any challenge you'd rather not do."
    - icon: Wifi
      text: "You'll need a data connection for clues and photo uploads."
    - icon: Phone
      text: "In an emergency, call 112."
photos:
  heading: "About your photos"
  items:
    - icon: Eye
      text: "Other teams can see your photos in this hunt's gallery."
    - icon: ShieldAlert
      text: "Don't photograph people who haven't agreed — and never children outside your own group."
fields:
  - type: section
    label: "Photo permission"
  - id: all_sixteen_plus
    type: radio
    variant: segmented
    label: "Is everyone in your team 16 or over?"
    options: ["Yes", "No"]
  - id: promo_consent
    type: boolean
    label: "The organisers may use my photos and videos to promote future hunts."
    subtext: "Optional — the hunt works either way. Change it any time under Photo permissions in the menu."
    isVisible:
      initially: conditional
      condition: { source: all_sixteen_plus, operator: "=", value: "Yes" }
  - type: note
    label: "We won't use your photos for promotion."
    subtext: "Your photos still appear in this hunt's gallery for other teams. A parent or guardian can give promotional permission by contacting the organiser."
    isVisible:
      initially: conditional
      condition: { source: all_sixteen_plus, operator: "=", value: "No" }
primaryButtonText: "I understand — start the hunt"
footerText: "Questions during the hunt? Contact your organiser."
```

(`privacyLinkUrl` is deliberately omitted — no privacy-notice URL currently exists for this organiser; the "Read the full privacy notice" link only renders when it's set. Add it once the organiser has one.)

- [ ] **Step 2: Update `routes.yaml`'s reference**

In `src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml`, change every occurrence of `000_options_eula` to `000_consent_eula`.

- [ ] **Step 3: Add `project.consent_age_threshold`**

In `src/data/text/en/projects/democrats_abroad/democrats_abroad.yaml`, add:

```yaml
# GDPR Article 8 age threshold for the consent screen — varies 13-16 across the EU
project.consent_age_threshold: 16
```

- [ ] **Step 4: Validate**

Run: `npm run validate:yaml`
Expected: 0 violations (this exercises `consent.schema.json` and `form.schema.json` against the real authored file for the first time — if it fails, fix the YAML, not the schema, unless the schema itself has a bug).

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS — check specifically that no existing test hardcodes `000_options_eula`/`OptionsScreen` for this specific file (grep first: `grep -rn "000_options_eula" src/`); update any that do.

- [ ] **Step 6: Commit**

```bash
git add src/data/text/en/projects/democrats_abroad/den_haag/000_consent_eula.yaml src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml src/data/text/en/projects/democrats_abroad/democrats_abroad.yaml
git rm src/data/text/en/projects/democrats_abroad/den_haag/000_options_eula.yaml
git commit -m "content: replace den_haag's EULA screen with the consent screen"
```

---

### Task 10: `RoutePage` — consent cache and mid-route staleness redirect

**Files:**
- Create: `src/utils/consentCache.ts`
- Modify: `src/pages/RoutePage.svelte`
- Test: `src/test/consentCache.test.ts`
- Test: `src/test/RoutePage.test.ts`

**Interfaces:**
- Produces: `readConsentCache()`, `writeConsentCache()` (`consentCache.ts`). Consumed by `ConsentScreen.svelte` (write, after Task 8's `handleSubmit` succeeds — small addendum to that file, included in Step 3 below) and `RoutePage.svelte` (read, in the new staleness effect).
- Consumes: `fetchConsentVersion` (Task 6).

- [ ] **Step 1: Write the failing `consentCache` tests**

Create `src/test/consentCache.test.ts`:

```ts
import { readConsentCache, writeConsentCache } from "../utils/consentCache";

beforeEach(() => localStorage.clear());

test("writeConsentCache then readConsentCache round-trips the version", () => {
  writeConsentCache("den_haag", "den_haag", "short_loop", { consentVersion: 3 });
  expect(readConsentCache("den_haag", "den_haag", "short_loop")).toEqual({ consentVersion: 3 });
});

test("readConsentCache returns null when nothing was cached", () => {
  expect(readConsentCache("den_haag", "den_haag", "short_loop")).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/consentCache.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `consentCache.ts`**

```ts
export interface ConsentCache {
  consentVersion: number;
}

function cacheKey(project: string, city: string, route: string): string {
  return `${project}/${city}/${route}/consent`;
}

export function writeConsentCache(project: string, city: string, route: string, cache: ConsentCache): void {
  localStorage.setItem(cacheKey(project, city, route), JSON.stringify(cache));
}

export function readConsentCache(project: string, city: string, route: string): ConsentCache | null {
  const raw = localStorage.getItem(cacheKey(project, city, route));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ConsentCache;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Wire the cache write into `ConsentScreen.svelte`'s `handleSubmit`**

In `src/components/ConsentScreen.svelte` (from Task 8), update `handleSubmit`:

```ts
import { writeConsentCache } from "../utils/consentCache";

async function handleSubmit(values: Record<string, unknown>) {
  try {
    const res = await postConsentUpdate(city, route, {
      allSixteenPlus: values.all_sixteen_plus === "Yes",
      promoConsent: values.promo_consent === true,
      acknowledge: true,
    });
    if (res.record) {
      writeConsentCache(project, city, route, { consentVersion: res.record.consent_version });
    }
  } catch {
    // Never blocks navigation — see spec §13.
  }
}
```

- [ ] **Step 5: Write the failing `RoutePage` staleness tests**

`RoutePage.test.ts` builds its route-entry fixtures inside a `vi.hoisted(() => ({...}))` block (e.g. `mockEulaEntries`) and mocks `../utils/loadLocations` and `../utils/api` (currently only `postFormSubmit`/`postPhotoUpload`) at module scope. Add a new fixture alongside the existing ones (e.g. right after `mockEulaEntries`), and add its name to the destructured list at the top of the `vi.hoisted` block:

```ts
mockConsentEntries: [
  {
    "template-type": "consent",
    "nav-bar": { visible: false },
    heading: "Before you begin",
    intro: "A few things to know.",
    safety: { heading: "Stay safe", items: [{ icon: "Phone", text: "Call 112." }] },
    photos: { heading: "About your photos", items: [{ icon: "Eye", text: "Others can see your photos." }] },
    fields: [],
    primaryButtonText: "Go",
  },
  {
    title: "Loc 1",
    name: { value: "Location 1" },
    coordinates: { latitude: 52.0, longitude: 4.0 },
    storyline: "Story 1",
    breadcrumb: "Step 1",
    challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
  },
],
```

Add `fetchConsentVersion` to the existing `vi.mock("../utils/api", ...)` block:

```ts
vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true, httpCode: 200 }),
  fetchConsentVersion: vi.fn().mockResolvedValue({ ok: true, consentVersion: 1 }),
}));
```

Then add the tests, following the exact `loadLocations`-mocking + `localStorage.setItem` + `render`/`screen.findByText` pattern this file already uses elsewhere (e.g. its existing resume-position test, which does `localStorage.setItem("democrats_abroad/den_haag/short_loop", "2")` before rendering):

```ts
test("redirects to the consent entry's index when the cached consent version is stale, even mid-route", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { fetchConsentVersion } = await import("../utils/api");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockConsentEntries as RouteEntry[]);
  vi.mocked(fetchConsentVersion).mockResolvedValue({ ok: true, consentVersion: 2 });
  localStorage.setItem("democrats_abroad/den_haag/short_loop", "1"); // already past the consent screen
  localStorage.setItem("democrats_abroad/den_haag/short_loop/consent", JSON.stringify({ consentVersion: 1 }));
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Before you begin")).toBeInTheDocument();
});

test("does not redirect when the cached version matches the current one", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { fetchConsentVersion } = await import("../utils/api");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockConsentEntries as RouteEntry[]);
  vi.mocked(fetchConsentVersion).mockResolvedValue({ ok: true, consentVersion: 1 });
  localStorage.setItem("democrats_abroad/den_haag/short_loop", "1");
  localStorage.setItem("democrats_abroad/den_haag/short_loop/consent", JSON.stringify({ consentVersion: 1 }));
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
  expect(screen.queryByText("Before you begin")).not.toBeInTheDocument();
});

test("fails open (no redirect) when the version fetch rejects", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { fetchConsentVersion } = await import("../utils/api");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockConsentEntries as RouteEntry[]);
  vi.mocked(fetchConsentVersion).mockRejectedValue(new Error("offline"));
  localStorage.setItem("democrats_abroad/den_haag/short_loop", "1");
  localStorage.setItem("democrats_abroad/den_haag/short_loop/consent", JSON.stringify({ consentVersion: 1 }));
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
  expect(screen.queryByText("Before you begin")).not.toBeInTheDocument();
});

test("does not fetch a version at all when there is no cached consent record (first-time participant)", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { fetchConsentVersion } = await import("../utils/api");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockConsentEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Before you begin")).toBeInTheDocument();
  expect(fetchConsentVersion).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/test/RoutePage.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement the staleness effect in `RoutePage.svelte`**

Add the import:

```ts
import { readConsentCache } from "../utils/consentCache";
import { fetchConsentVersion } from "../utils/api";
```

Add a helper to find the consent entry's index (near the other `entries`-derived values, e.g. after `currentEntry` at `RoutePage.svelte:276`):

```ts
let consentEntryIndex = $derived(entries.findIndex((e) => e["template-type"] === "consent"));
```

Add the staleness effect (after the existing `mountNormalizeAttempted` effect, `RoutePage.svelte:121-128`):

```ts
$effect(() => {
  // Re-runs on every currentIndex change — deliberately, not just at mount,
  // so a consentVersion bump interrupts an already-open tab mid-route, not
  // only at route start. See spec §12 for why this needs a network check at
  // all (this app has no live CMS; an open tab can't learn a version bump on
  // its own) and why a failed check must fail open (§13).
  currentIndex; // eslint-disable-line @typescript-eslint/no-unused-expressions
  if (consentEntryIndex === -1) {
    return;
  }
  const cached = readConsentCache(params.project, params.city, params.route);
  if (!cached) {
    return;
  }
  fetchConsentVersion(params.project, params.city, params.route)
    .then((res) => {
      if (res.ok && res.consentVersion !== undefined && res.consentVersion !== cached.consentVersion) {
        currentIndex = consentEntryIndex;
      }
    })
    .catch(() => {
      // Fail open — a network blip must not force a spurious redirect.
    });
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/test/consentCache.test.ts src/test/RoutePage.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the full suite (this touches a heavily-tested file)**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, 0 errors — pay particular attention to any existing `RoutePage.test.ts` case that didn't previously mock `fetchConsentVersion`; the new effect calls it unconditionally whenever a route has a consent entry and a cache exists, so tests using routes with a consent entry need that mock added, not the effect narrowed.

- [ ] **Step 10: Commit**

```bash
git add src/utils/consentCache.ts src/components/ConsentScreen.svelte src/pages/RoutePage.svelte src/test/consentCache.test.ts src/test/RoutePage.test.ts
git commit -m "feat: cache consent version locally and redirect to the consent screen when it goes stale, including mid-route"
```

---

### Task 11: `TitleBar` — "Photo permissions" withdrawal submenu

**Files:**
- Modify: `src/components/TitleBar.svelte`
- Modify: `src/components/TitleBar.css`
- Test: `src/test/TitleBar.test.ts`

**Interfaces:**
- Consumes: `fetchConsent`, `postConsentUpdate` (Task 6), both called with `acknowledge: false` (see Task 4's interfaces note). `TitleBar` is global (rendered once in `App.svelte`, outside any route params), so it has no `city`/`route` to pass — that's fine specifically because `acknowledge: false` means the Worker never calls `getConsentVersion()` at all for this call (Task 4's handler branches on `existing.consent_version` instead), so the missing `city`/`route` context is never actually needed. `postConsentUpdate("", "", ...)` passes empty strings simply because the function signature requires them; the Worker route ignores them on this path. If the menu ever needs to *also* validate against a specific route's version (it doesn't today), passing real values would require threading route context into `TitleBar`, which this task deliberately does not do.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/TitleBar.test.ts`:

```ts
import * as api from "../utils/api";
import { authStore } from "../stores/authStore";

test("Photo permissions menu item fetches and shows the current promo consent state", async () => {
  authStore.setForTest({ activeAuth: { kind: "participant", projectId: "den_haag", teamName: "Team A", contact: null, isAdmin: false }, authLoading: false, isLoggingOut: false });
  vi.spyOn(api, "fetchConsent").mockResolvedValue({ ok: true, record: { all_sixteen_plus: 1, promo_consent: 0, promo_approved: 0, consent_version: 1 } });
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  await fireEvent.click(screen.getByText("Photo permissions"));
  expect(await screen.findByRole("checkbox")).not.toBeChecked();
});

test("declined-state (all_sixteen_plus false) shows explanatory copy instead of a toggle", async () => {
  authStore.setForTest({ activeAuth: { kind: "participant", projectId: "den_haag", teamName: "Team A", contact: null, isAdmin: false }, authLoading: false, isLoggingOut: false });
  vi.spyOn(api, "fetchConsent").mockResolvedValue({ ok: true, record: { all_sixteen_plus: 0, promo_consent: 0, promo_approved: 0, consent_version: 1 } });
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  await fireEvent.click(screen.getByText("Photo permissions"));
  expect(await screen.findByText(/won't use your photos/i)).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

test("toggling the checkbox auto-saves via postConsentUpdate", async () => {
  authStore.setForTest({ activeAuth: { kind: "participant", projectId: "den_haag", teamName: "Team A", contact: null, isAdmin: false }, authLoading: false, isLoggingOut: false });
  vi.spyOn(api, "fetchConsent").mockResolvedValue({ ok: true, record: { all_sixteen_plus: 1, promo_consent: 0, promo_approved: 0, consent_version: 1 } });
  const postSpy = vi.spyOn(api, "postConsentUpdate").mockResolvedValue({ ok: true, record: {} as any });
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  await fireEvent.click(screen.getByText("Photo permissions"));
  await fireEvent.click(await screen.findByRole("checkbox"));
  expect(postSpy).toHaveBeenCalledWith("", "", { allSixteenPlus: true, promoConsent: true, acknowledge: false });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/TitleBar.test.ts -t "Photo permissions"`
Expected: FAIL — no such menu item.

- [ ] **Step 3: Implement the submenu**

Add root-menu button (after the "Text Size" button, `TitleBar.svelte:116-122`):

```svelte
<button
  onclick={() => (menuView = "photo-permissions")}
  class="titlebar__menu-item"
>
  <span class="titlebar__menu-item-label">Photo permissions</span>
  <span class="titlebar__menu-item-arrow">›</span>
</button>
```

Add script-level state and fetch logic (near the other `let menuView` state):

```ts
import { fetchConsent, postConsentUpdate, type ConsentRecord } from "../utils/api";

let consentRecord = $state<ConsentRecord | null>(null);
let consentLoading = $state(false);

$effect(() => {
  if (menuView === "photo-permissions") {
    consentLoading = true;
    fetchConsent().then((res) => {
      consentRecord = res.record ?? null;
      consentLoading = false;
    });
  }
});

async function togglePromoConsent() {
  if (!consentRecord) {
    return;
  }
  const next = consentRecord.promo_consent === 0;
  const res = await postConsentUpdate("", "", { allSixteenPlus: true, promoConsent: next, acknowledge: false });
  if (res.record) {
    consentRecord = res.record;
  }
}
```

Add the submenu body (after the `fontsize` block, `TitleBar.svelte:194-226`):

```svelte
{#if menuView === "photo-permissions"}
  <button onclick={() => (menuView = "root")} aria-label="Back to menu" class="titlebar__submenu-header">
    <span class="titlebar__submenu-back">‹</span>
    <span class="titlebar__submenu-title">Photo permissions</span>
  </button>
  <div class="titlebar__profile-body">
    {#if consentLoading}
      <p>Loading…</p>
    {:else if !consentRecord || consentRecord.all_sixteen_plus === 0}
      <p class="titlebar__consent-declined">
        We won't use your photos for promotion. A parent or guardian can give promotional permission by contacting the organiser.
      </p>
    {:else}
      <label class="titlebar__consent-toggle">
        <input type="checkbox" checked={consentRecord.promo_consent === 1} onchange={togglePromoConsent} />
        The organisers may use my photos and videos to promote future hunts.
      </label>
    {/if}
  </div>
{/if}
```

- [ ] **Step 4: Add CSS**

Add to `TitleBar.css`:

```css
.titlebar__consent-toggle {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  font-size: var(--font-size-base);
  color: var(--color-text);
  cursor: pointer;
}

.titlebar__consent-declined {
  padding: 12px 16px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/TitleBar.test.ts`
Expected: PASS, including pre-existing cases.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/TitleBar.svelte src/components/TitleBar.css src/test/TitleBar.test.ts
git commit -m "feat: add Photo permissions withdrawal submenu to TitleBar"
```

---

### Task 12: `PromoReviewPage` editor tool

**Files:**
- Modify: `src/utils/authGuards.ts` (new `requireOrganizerAccess`)
- Create: `src/pages/editor/PromoReviewPage.svelte`
- Create: `src/pages/editor/PromoReviewPage.css`
- Modify: `src/App.svelte` (route registration)
- Test: `src/test/authGuards.test.ts`
- Test: `src/test/PromoReviewPage.test.ts`

**Interfaces:**
- Consumes: `fetchPromoReviewPhotos`, `postPromoApprove` (Task 6).
- Produces: `requireOrganizerAccess()` frontend guard (mirrors `requireEditorAccess` but checks only `"organizer"`, matching the backend's `requireOrganizerCap` from Task 5 — kept symmetric so a non-organizer editor never reaches a page whose actions will 403).

- [ ] **Step 1: Write the failing `requireOrganizerAccess` test**

Add to `src/test/authGuards.test.ts`:

```ts
test("requireOrganizerAccess redirects an editor-only (non-organizer) user", () => {
  authStore.setForTest({ activeAuth: { kind: "editor", userId: "u1", email: "x", username: "x", capabilities: ["editor"] }, authLoading: false, isLoggingOut: false });
  const result = requireOrganizerAccess();
  expect(result).toBe(false);
});

test("requireOrganizerAccess allows an organizer", () => {
  authStore.setForTest({ activeAuth: { kind: "editor", userId: "u1", email: "x", username: "x", capabilities: ["organizer"] }, authLoading: false, isLoggingOut: false });
  const result = requireOrganizerAccess();
  expect(result).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/authGuards.test.ts -t "requireOrganizerAccess"`
Expected: FAIL — function doesn't exist.

- [ ] **Step 3: Implement `requireOrganizerAccess`**

Add to `src/utils/authGuards.ts`:

```ts
export function requireOrganizerAccess(): boolean {
  const { activeAuth, authLoading, isLoggingOut } = get(authStore);
  if (authLoading || isLoggingOut) {
    return true;
  }
  if (!activeAuth || activeAuth.kind !== "editor") {
    replace("/editor/login");
    return false;
  }
  if (!activeAuth.capabilities.includes("organizer")) {
    replace("/editor/login");
    return false;
  }
  return true;
}
```

- [ ] **Step 4: Write the failing `PromoReviewPage` tests**

Create `src/test/PromoReviewPage.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { vi } from "vitest";
import PromoReviewPage from "../pages/editor/PromoReviewPage.svelte";
import * as api from "../utils/api";

beforeEach(() => vi.clearAllMocks());

test("lists photos pending promo approval", async () => {
  vi.spyOn(api, "fetchPromoReviewPhotos").mockResolvedValue({
    ok: true,
    photos: [{ id: "p1", team_name: "Team A", contact: null, task_title: "Find the plaque" }],
  });
  render(PromoReviewPage, { params: { project: "den_haag", city: "den_haag" } });
  expect(await screen.findByText("Team A")).toBeInTheDocument();
});

test("approving removes the row and calls postPromoApprove with the photo's team identity", async () => {
  vi.spyOn(api, "fetchPromoReviewPhotos").mockResolvedValue({
    ok: true,
    photos: [{ id: "p1", team_name: "Team A", contact: null, task_title: "Find the plaque" }],
  });
  const approveSpy = vi.spyOn(api, "postPromoApprove").mockResolvedValue({ ok: true });
  render(PromoReviewPage, { params: { project: "den_haag", city: "den_haag" } });
  await fireEvent.click(await screen.findByRole("button", { name: /approve/i }));
  expect(approveSpy).toHaveBeenCalledWith("den_haag", "Team A", null);
  expect(screen.queryByText("Team A")).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Run to verify failure**

Run: `npx vitest run src/test/PromoReviewPage.test.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 6: Implement `PromoReviewPage.svelte`**

```svelte
<script lang="ts">
  import { fetchPromoReviewPhotos, postPromoApprove, type PromoReviewPhoto } from "../../utils/api";
  import "./PromoReviewPage.css";

  let { params }: { params: { project: string; city: string } } = $props();

  let photos = $state<PromoReviewPhoto[]>([]);

  $effect(() => {
    fetchPromoReviewPhotos(params.project, params.city).then((res) => {
      photos = res.photos ?? [];
    });
  });

  async function approve(photo: PromoReviewPhoto) {
    const res = await postPromoApprove(params.project, photo.team_name, photo.contact);
    if (res.ok) {
      photos = photos.filter((p) => p.team_name !== photo.team_name || p.contact !== photo.contact);
    }
  }
</script>

<div class="promo-review-page">
  <h1>Photo promotion review</h1>
  {#each photos as photo (photo.id)}
    <div class="promo-review-page__row">
      <img src={`/photos/${photo.id}/thumb`} alt={photo.task_title} class="promo-review-page__thumb" />
      <span class="promo-review-page__team">{photo.team_name}</span>
      <button type="button" onclick={() => approve(photo)}>Approve</button>
    </div>
  {/each}
  {#if photos.length === 0}
    <p>Nothing pending review.</p>
  {/if}
</div>
```

Create `src/pages/editor/PromoReviewPage.css`, matching `EditorLocationList.css`'s token conventions:

```css
/* src/pages/editor/PromoReviewPage.css */

.promo-review-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-background);
  min-height: 100vh;
}

.promo-review-page__row {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 10px;
  background: var(--color-surface);
}

.promo-review-page__thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.promo-review-page__team {
  flex: 1;
  font-weight: 600;
  font-size: var(--font-size-base);
  color: var(--color-text);
}
```

- [ ] **Step 7: Register the route**

In `src/App.svelte`, add the import:

```ts
import PromoReviewPage from "./pages/editor/PromoReviewPage.svelte";
```

and the route (alongside the other `/editor/...` entries):

```ts
"/editor/:project/:city/promo-review": wrap({
  component: asRoute(PromoReviewPage),
  conditions: [requireOrganizerAccess],
}),
```

and export `requireOrganizerAccess` from the `<script module>` block alongside the existing guards:

```ts
export { requireAuth, requireEditorAccess, requireOrganizerAccess } from "./utils/authGuards";
```

and import it in the main script block too:

```ts
import { requireAuth, requireEditorAccess, requireOrganizerAccess } from "./utils/authGuards";
```

- [ ] **Step 8: Run all new/changed tests**

Run: `npx vitest run src/test/authGuards.test.ts src/test/PromoReviewPage.test.ts src/test/App.routing.test.ts src/test/App.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: 0 errors, all tests green.

- [ ] **Step 10: Commit**

```bash
git add src/utils/authGuards.ts src/pages/editor/PromoReviewPage.svelte src/pages/editor/PromoReviewPage.css src/App.svelte src/test/authGuards.test.ts src/test/PromoReviewPage.test.ts
git commit -m "feat: add organizer-only PromoReviewPage for the promo-approval gate"
```

---

## After all tasks

- [ ] Run the full suite one more time end to end: `npx vitest run && npx tsc --noEmit && npm run lint && npm run validate:yaml`
- [ ] Update `doc/superpowers/specs/2026-07-31-consent-screen-design.md`: fix §4.2's schema snippet (`contact TEXT` → `contact TEXT NOT NULL DEFAULT ''`, per Task 3's correction) and §4.3/§15 (the "Worker reads YAML directly" framing → the KV-backed `consentVersion`, per Task 3) so the spec matches what was actually built, not what was guessed at spec time.
- [ ] Apply migration `006_consent.sql` to the real D1 database (remote) — this is a deploy-time step, not a code change; confirm with the user before running it against production data.
- [ ] Manual verification (per this project's rule against Playwright/browser automation): the user should click through the den_haag `short_loop` route's new consent screen themselves in a real browser before considering this done.
