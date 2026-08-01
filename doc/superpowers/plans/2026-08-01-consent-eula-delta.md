# Consent EULA Delta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Den Haag consent screen's photo/video-promotion copy per the organiser's revised EULA, and close the real content-authoring gaps that copy change exposed (a "why we're asking" fold, per-route minimum age, platform-default safety/photos content, and crash-resilient rendering) — without rebuilding the parts (per-route consent version, per-route checkbox label, privacy link rendering) that already work.

**Architecture:** All changes are additive to the existing `template-type: consent` pipeline (`ConsentEntry` type → `consent.schema.json` → `ConsentScreen.svelte`). The one new mechanism (the fold) reuses the existing storyline `[+]` convention (`parseStoryline`/`Storyline.svelte`/`StoryFold.svelte`) verbatim rather than inventing a new UI pattern. No backend/worker changes — consent version stays KV-based (see design spec §3, a deliberate correction of the original request).

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + @testing-library/svelte, `ajv`-driven YAML schema validation (`scripts/validate-yaml.ts`, run via `npm run validate:yaml`).

**Design spec:** `doc/superpowers/specs/2026-08-01-consent-eula-delta-design.md` — read it for the "why," this plan is the "what/how."

## Global Constraints

- TypeScript only (`.ts` / `.svelte` with `<script lang="ts">`); no `.js`/`.jsx`/`.tsx` in `src/`.
- No new CSS custom properties — reuse existing `--gap-*`/`--color-*` tokens already used by `ConsentScreen.css`.
- No git commands — the user controls git for this repo. Do not run `git add`/`git commit` even though the generic plan-step template below shows a commit step; leave changes unstaged and tell the user what's ready to review after each task instead.
- Every schema change must keep `npm run validate:yaml` green against real, currently-committed content (Den Haag, Oslo, demo/new_york, demo/paris) — don't introduce a new hard-fail rule that breaks existing routes (this is exactly why the cross-file "photo challenge needs a consent block" check from the original request was dropped: Oslo and the demo projects aren't public-facing, so they don't need to be covered — see design spec §8).
- Real privacy-notice URL is not yet known — Task 5 uses the literal placeholder `https://example.org/TODO-privacy-notice` and must be flagged to the user as needing a real value before ship.

---

### Task 1: "Why we're asking" fold — `whyWereAsking` field + rendering

**Files:**
- Modify: `src/types/data.ts` (`ConsentEntry` interface, ~line 216)
- Modify: `src/data/schemas/consent.schema.json`
- Modify: `src/components/ConsentScreen.svelte`
- Modify: `src/components/ConsentScreen.css`
- Test: `src/test/ConsentScreen.test.ts`

**Interfaces:**
- Consumes: `Storyline.svelte` (existing, `{ text?: string; elements?: Record<string, StatsDoc> }` props) — no changes to it.
- Produces: `ConsentEntry.whyWereAsking?: string` — later tasks (Task 2's validator, Task 5's content) both read this exact field name.

- [ ] **Step 1: Write the failing test**

Add to `src/test/ConsentScreen.test.ts` (after the existing "renders the privacy link..." test):

```ts
test("renders the 'why we're asking' fold collapsed by default, expandable on click", async () => {
  const entryWithFold = {
    ...entry,
    whyWereAsking: "[+] Why we're asking\n\nWe run this hunt to register voters.",
  };
  render(ConsentScreen, { entry: entryWithFold, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  expect(screen.getByText("Why we're asking")).toBeInTheDocument();
  expect(screen.queryByText("We run this hunt to register voters.")).not.toBeInTheDocument();
  await fireEvent.click(screen.getByRole("button", { name: "Why we're asking" }));
  expect(screen.getByText("We run this hunt to register voters.")).toBeInTheDocument();
});

test("does not render a fold at all when whyWereAsking is absent", () => {
  const { container } = render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  expect(container.querySelector(".consent-screen__why")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/ConsentScreen.test.ts`
Expected: FAIL — `screen.getByText("Why we're asking")` finds nothing, because `ConsentScreen` doesn't render `entry.whyWereAsking` yet.

- [ ] **Step 3: Add the field to the type**

In `src/types/data.ts`, in the `ConsentEntry` interface:

```ts
export interface ConsentEntry {
  "template-type": "consent";
  heading: string;
  intro: string;
  chips?: ConsentIconItem[];
  whyWereAsking?: string;
  safety: ConsentBulletSection;
  photos: ConsentBulletSection;
  fields: FormField[];
  primaryButtonText: string;
  privacyLinkUrl?: string;
  footerText?: string;
  "nav-bar"?: NavBarConfig;
}
```

- [ ] **Step 4: Add the property to the schema**

In `src/data/schemas/consent.schema.json`, add to `properties` (order doesn't matter, `additionalProperties: false` just needs the key present):

```json
    "whyWereAsking": { "type": "string" },
```

- [ ] **Step 5: Render it in ConsentScreen.svelte**

Add the import, alongside the existing `MarkdownText` import:

```svelte
  import Storyline from "./Storyline.svelte";
```

Insert this block immediately before `<div class="consent-screen__form">` (currently the line right after the `{#each [entry.safety, entry.photos] ...}{/each}` block closes):

```svelte
  {#if entry.whyWereAsking}
    <div class="consent-screen__why">
      <Storyline text={entry.whyWereAsking} />
    </div>
  {/if}
```

- [ ] **Step 6: Add the CSS rule**

In `src/components/ConsentScreen.css`, add right before the existing `.consent-screen__form` rule:

```css
.consent-screen__why {
  margin: 0 0 var(--gap-block);
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:run -- src/test/ConsentScreen.test.ts`
Expected: PASS, all tests including the two new ones.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 9: Leave changes unstaged for review** (no git commands — see Global Constraints)

---

### Task 2: Validate `whyWereAsking` content in CI

Generalizes the existing `checkStoryline` (currently hardcoded to the `storyline` field on location files) into a reusable `checkStorylineField(filePath, fieldName)`, and applies it to consent files' `whyWereAsking` too, plus a new check that a present `whyWereAsking` has a real (non-blank) fold label rather than silently falling back to `parseStoryline`'s generic `"Read the full story"` default.

**Files:**
- Modify: `scripts/validate-yaml.ts`

**Interfaces:**
- Consumes: `ConsentEntry.whyWereAsking` (Task 1).
- Produces: nothing consumed by later tasks — this is a leaf, CI-only check.

**No unit-test harness exists for this script** (it's a Node CLI validated by running it against real content — see the precedent in `doc/devlog/_devlog.md`'s 01/08/2026 entry: "verified by intentionally corrupting a field type and confirming CI now catches it"). Verify by deliberately breaking a copy of the real content, running the script, then reverting.

- [ ] **Step 1: Generalize `checkStoryline` → `checkStorylineField`**

Replace the existing `checkStoryline` function in `scripts/validate-yaml.ts`:

```ts
function checkStorylineField(filePath: string, fieldName: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content) as Record<string, unknown>;
  const text = data[fieldName];
  if (typeof text !== "string" || !text) {
    return [];
  }
  if (text.includes(":::")) {
    return [`/${fieldName}: found ":::" — the v0.1/v0.2 fence syntax has been retired, use v0.3 markdown-native syntax`];
  }
  const refs = findStatsRefs(text);
  const dir = dirname(filePath);
  const elements = Object.fromEntries(
    refs.flatMap((ref) => {
      try {
        const refContent = readFileSync(join(dir, ref), "utf8");
        return [[ref, loadYaml(refContent)]] as const;
      } catch {
        return [];
      }
    }),
  );
  const { blocks, warnings } = parseStoryline(text, elements);
  return [...warnings, ...validateStoryline(blocks)].map((msg) => `/${fieldName}: ${msg}`);
}
```

(Note: the old `checkStoryline`'s `:::` early-return didn't have the `/storyline: ` prefix that the `parseStoryline` path added via its own `.map`, an inconsistency in the original — this version fixes that by prefixing both paths with `/${fieldName}: `.)

- [ ] **Step 2: Update the location-file call site**

Find (in the `violations` array):

```ts
  ...findFiles(DATA_DIR, LOC_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateLoc).map((msg) => ({ filePath, msg })),
    ...checkStoryline(filePath).map((msg) => ({ filePath, msg })),
  ]),
```

Replace with:

```ts
  ...findFiles(DATA_DIR, LOC_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateLoc).map((msg) => ({ filePath, msg })),
    ...checkStorylineField(filePath, "storyline").map((msg) => ({ filePath, msg })),
  ]),
```

- [ ] **Step 3: Add the fold-label check**

Add this function near `checkConsentFields`:

```ts
const FOLD_MARKER_LINE = /^\s*\[\+\]\s*(.*)$/;

function checkConsentFoldLabel(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content) as { whyWereAsking?: string };
  if (!data.whyWereAsking) {
    return [];
  }
  const lines = data.whyWereAsking.split("\n");
  const foldLine = lines.find((line) => FOLD_MARKER_LINE.test(line));
  if (!foldLine) {
    return ['/whyWereAsking: no "[+]" fold marker found — the whole field is meant to be a collapsed disclosure'];
  }
  const match = FOLD_MARKER_LINE.exec(foldLine) as RegExpExecArray;
  if (!match[1].trim()) {
    return ['/whyWereAsking: "[+]" marker has no label — would silently fall back to "Read the full story"'];
  }
  return [];
}
```

- [ ] **Step 4: Wire it into the consent-file call site**

Find:

```ts
  ...findFiles(DATA_DIR, CONSENT_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateConsent).map((msg) => ({ filePath, msg })),
    ...checkConsentFields(filePath).map((msg) => ({ filePath, msg })),
  ]),
```

Replace with:

```ts
  ...findFiles(DATA_DIR, CONSENT_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateConsent).map((msg) => ({ filePath, msg })),
    ...checkConsentFields(filePath).map((msg) => ({ filePath, msg })),
    ...checkStorylineField(filePath, "whyWereAsking").map((msg) => ({ filePath, msg })),
    ...checkConsentFoldLabel(filePath).map((msg) => ({ filePath, msg })),
  ]),
```

- [ ] **Step 5: Verify current content still passes**

Run: `npm run validate:yaml`
Expected: 0 violations (no `*_consent_*.yaml` file has `whyWereAsking` yet, so both new checks are no-ops today).

- [ ] **Step 6: Verify the checks actually catch bad data**

Temporarily edit `src/data/text/en/projects/democrats_abroad/den_haag/000_consent_eula.yaml`, adding this line anywhere at the top level:

```yaml
whyWereAsking: "no marker here"
```

Run: `npm run validate:yaml`
Expected: FAIL, reporting `/whyWereAsking: no "[+]" fold marker found...`

Change the line to:

```yaml
whyWereAsking: "[+] \n\nbody text"
```

Run: `npm run validate:yaml`
Expected: FAIL, reporting `/whyWereAsking: "[+]" marker has no label...`

Then **revert** `000_consent_eula.yaml` back to its state before this step (remove the temporary `whyWereAsking` line entirely — Task 5 adds the real one later).

Run: `npm run validate:yaml`
Expected: 0 violations again.

- [ ] **Step 7: Note — `npm run typecheck` does not cover this file**

`scripts/` is outside both `tsconfig.json` (`include: ["src/**/*.ts", "src/**/*.svelte"]`) and
`tsconfig.node.json` (`include: ["vite.config.ts"]`), and `validate:yaml` runs it via `tsx`, which
strips types without checking them. Step 5/6's actual `npm run validate:yaml` runs are this task's
real verification — don't rely on `npm run typecheck` to catch mistakes in this file. (No action
here beyond awareness; this note exists so nobody adds a false "0 errors" typecheck claim for a
file that was never checked.)

- [ ] **Step 8: Leave changes unstaged for review**

---

### Task 3: Minimum age moves from project-level to per-route

Replaces `project.consent_age_threshold` / `HuntSettings.ageThreshold` (threaded `RoutePage` → `RouteScreen` → `ConsentScreen` as a prop) with `ConsentEntry.minimumAge` (authored directly in each consent file, required).

**Files:**
- Modify: `src/types/data.ts` (`ConsentEntry`, `HuntSettings`)
- Modify: `src/data/schemas/consent.schema.json`
- Modify: `src/components/ConsentScreen.svelte`
- Modify: `src/components/RouteScreen.svelte`
- Modify: `src/pages/RoutePage.svelte`
- Modify: `src/utils/huntSettings.ts`
- Modify: `src/data/text/en/projects/democrats_abroad/democrats_abroad.yaml`
- Test: `src/test/ConsentScreen.test.ts`
- Test: `src/test/huntSettings.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ConsentEntry.minimumAge: number` (required) — Task 5's content depends on this.

- [ ] **Step 1: Write the failing test**

In `src/test/ConsentScreen.test.ts`, add `minimumAge: 16` to the shared `entry` fixture at the top of the file:

```ts
const entry = {
  "template-type": "consent" as const,
  heading: "Before you begin",
  intro: "A few things to know.",
  minimumAge: 16,
  chips: [
```

Replace the existing `{{age_threshold}}` interpolation test:

```ts
test("interpolates {{age_threshold}} in a field's label using the ageThreshold prop", () => {
  const entryWithAgeField = {
    ...entry,
    fields: [
      { id: "all_sixteen_plus", type: "radio" as const, variant: "segmented" as const, label: "Is everyone in your team {{age_threshold}} or over?", options: ["Yes", "No"] },
    ],
  };
  render(ConsentScreen, { entry: entryWithAgeField, project: "den_haag", city: "den_haag", route: "short_loop", ageThreshold: 15, onContinue: () => {} });
  expect(screen.getByText("Is everyone in your team 15 or over?")).toBeInTheDocument();
});
```

with:

```ts
test("interpolates {{age_threshold}} in a field's label using the entry's minimumAge", () => {
  const entryWithAgeField = {
    ...entry,
    minimumAge: 15,
    fields: [
      { id: "all_sixteen_plus", type: "radio" as const, variant: "segmented" as const, label: "Is everyone in your team {{age_threshold}} or over?", options: ["Yes", "No"] },
    ],
  };
  render(ConsentScreen, { entry: entryWithAgeField, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  expect(screen.getByText("Is everyone in your team 15 or over?")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `npm run test:run -- src/test/ConsentScreen.test.ts`
Expected: FAIL on the renamed test — `ConsentScreen` still reads the (now-unset) `ageThreshold` prop, defaulting to 16, so the label renders "...16 or over?" not "...15 or over?".

- [ ] **Step 3: Add `minimumAge` to the type and schema**

In `src/types/data.ts`, `ConsentEntry`:

```ts
export interface ConsentEntry {
  "template-type": "consent";
  heading: string;
  intro: string;
  chips?: ConsentIconItem[];
  whyWereAsking?: string;
  minimumAge: number;
  safety: ConsentBulletSection;
  photos: ConsentBulletSection;
  fields: FormField[];
  primaryButtonText: string;
  privacyLinkUrl?: string;
  footerText?: string;
  "nav-bar"?: NavBarConfig;
}
```

In `src/data/schemas/consent.schema.json`, add `"minimumAge"` to `required` and add the property:

```json
  "required": ["template-type", "heading", "intro", "safety", "photos", "fields", "primaryButtonText", "minimumAge"],
```

```json
    "minimumAge": { "type": "integer", "minimum": 1 },
```

- [ ] **Step 4: Switch ConsentScreen to read `entry.minimumAge`**

In `src/components/ConsentScreen.svelte`, remove the `ageThreshold` prop entirely:

```svelte
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

  // The minimum age is authored per-route (ConsentEntry.minimumAge) so a
  // route's consent screen is self-contained content, not dependent on a
  // project-level setting threaded through three components — content
  // authors write `{{age_threshold}}` in a field's label/subtext and it's
  // resolved here at render time from this entry's own minimumAge.
  const resolvedFields = $derived(
    entry.fields.map((field) => ({
      ...field,
      label: field.label.replaceAll("{{age_threshold}}", String(entry.minimumAge)),
      subtext: field.subtext?.replaceAll("{{age_threshold}}", String(entry.minimumAge)),
    })),
  );
```

- [ ] **Step 5: Remove `ageThreshold` from RouteScreen.svelte**

In `src/components/RouteScreen.svelte`, remove `ageThreshold = 16,` from the destructure and `ageThreshold?: number;` from its type, and remove `{ageThreshold}` from the `<ConsentScreen>` call (the block becomes):

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

- [ ] **Step 6: Remove `ageThreshold` from RoutePage.svelte's two RouteScreen call sites**

In `src/pages/RoutePage.svelte`, delete both occurrences of the line `ageThreshold={huntSettings.ageThreshold}` (one in the `swipeMode === "snap"` branch, one in the carousel-strip branch).

- [ ] **Step 7: Remove `ageThreshold` from HuntSettings and huntSettings.ts**

In `src/types/data.ts`:

```ts
export interface HuntSettings {
  storeFormsInLocalStorage: boolean;
  formRequired: boolean;
  canFormsSkip: boolean;
  allowResubmit: boolean;
}
```

In `src/utils/huntSettings.ts`:

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

- [ ] **Step 8: Remove the now-dead project setting**

In `src/data/text/en/projects/democrats_abroad/democrats_abroad.yaml`, delete the last two lines:

```yaml
# GDPR Article 8 age threshold for the consent screen — varies 13-16 across the EU
project.consent_age_threshold: 16
```

- [ ] **Step 9: Update huntSettings.test.ts**

In `src/test/huntSettings.test.ts`, remove `ageThreshold: 16` from all three `toEqual({...})` blocks, and delete the last two tests entirely (`"ageThreshold defaults to 16..."` and `"ageThreshold reads project.consent_age_threshold..."`). Final file:

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

- [ ] **Step 10: Run tests to verify everything passes**

Run: `npm run test:run -- src/test/ConsentScreen.test.ts src/test/huntSettings.test.ts src/test/RouteScreen.test.ts src/test/RoutePage.test.ts`
Expected: PASS. (RouteScreen/RoutePage suites don't assert `ageThreshold` today, per repo search — they should be unaffected by its removal, but run them to confirm nothing else was relying on the prop being present.)

- [ ] **Step 11: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors. (This is the step most likely to surface a missed call site — TypeScript will error on any remaining `ageThreshold={...}` prop pass against a component that no longer declares it, or any remaining `.ageThreshold` property access on `HuntSettings`.)

Note: `src/data/text/en/projects/democrats_abroad/den_haag/000_consent_eula.yaml` does **not** yet have `minimumAge` — the schema now requires it there, so `npm run validate:yaml` will fail until Task 5 adds it. That's expected and resolved in Task 5; don't add it early here, so each task's diff matches its own description.

- [ ] **Step 12: Leave changes unstaged for review**

---

### Task 4: Safety/photos platform defaults + crash-resilient rendering

Only Den Haag has a consent screen today, but Oslo's location content already exists with none yet — so a shared-defaults mechanism isn't purely hypothetical. `safety`/`photos` become optional per-route; when omitted, a new platform-wide `consent_defaults.yaml` supplies them whole (no item-level merge — see design spec §6 for why). Also hardens `ConsentScreen` against a malformed entry (missing `safety`/`photos`/`fields`) so it degrades instead of throwing.

**Files:**
- Create: `src/data/text/en/consent_defaults.yaml`
- Create: `src/data/schemas/consent-defaults.schema.json`
- Modify: `src/data/schemas/consent.schema.json`
- Modify: `src/types/data.ts`
- Modify: `src/components/ConsentScreen.svelte`
- Modify: `src/components/RouteScreen.svelte`
- Modify: `src/pages/RoutePage.svelte`
- Modify: `scripts/validate-yaml.ts`
- Test: `src/test/ConsentScreen.test.ts`

**Interfaces:**
- Consumes: `ConsentBulletSection` (existing type, `src/types/data.ts`).
- Produces: `ConsentScreen` props `safetyDefault?: ConsentBulletSection`, `photosDefault?: ConsentBulletSection` — consumed by `RouteScreen`'s same-named pass-through props, which `RoutePage` supplies.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/ConsentScreen.test.ts`:

```ts
test("falls back to the platform default when the entry omits safety/photos", () => {
  const { safety: _safety, photos: _photos, ...entryWithoutSections } = entry;
  render(ConsentScreen, {
    entry: entryWithoutSections as typeof entry,
    project: "den_haag", city: "den_haag", route: "short_loop",
    safetyDefault: { heading: "Stay safe", items: [{ icon: "Phone", text: "Default emergency line." }] },
    photosDefault: { heading: "About your photos", items: [{ icon: "Eye", text: "Default photo notice." }] },
    onContinue: () => {},
  });
  expect(screen.getByText("Default emergency line.")).toBeInTheDocument();
  expect(screen.getByText("Default photo notice.")).toBeInTheDocument();
});

test("renders without crashing when safety/photos and their defaults are both absent", () => {
  const { safety: _safety, photos: _photos, ...entryWithoutSections } = entry;
  render(ConsentScreen, {
    entry: entryWithoutSections as typeof entry,
    project: "den_haag", city: "den_haag", route: "short_loop",
    onContinue: () => {},
  });
  expect(screen.getByText(entry.heading)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/ConsentScreen.test.ts`
Expected: FAIL — `ConsentScreen` doesn't accept `safetyDefault`/`photosDefault` props yet and still reads `entry.safety`/`entry.photos` directly, which are now `undefined` in these two tests (the second one likely throws a `TypeError` rather than failing an assertion, since `entry.safety.heading` on `undefined` crashes).

- [ ] **Step 3: Make `safety`/`photos` optional in the type and schema**

In `src/types/data.ts`:

```ts
export interface ConsentEntry {
  "template-type": "consent";
  heading: string;
  intro: string;
  chips?: ConsentIconItem[];
  whyWereAsking?: string;
  minimumAge: number;
  safety?: ConsentBulletSection;
  photos?: ConsentBulletSection;
  fields: FormField[];
  primaryButtonText: string;
  privacyLinkUrl?: string;
  footerText?: string;
  "nav-bar"?: NavBarConfig;
}
```

In `src/data/schemas/consent.schema.json`, remove `"safety"` and `"photos"` from `required` (properties themselves stay, just no longer required):

```json
  "required": ["template-type", "heading", "intro", "fields", "primaryButtonText", "minimumAge"],
```

- [ ] **Step 4: Update ConsentScreen.svelte — props, fallback, and resilience**

```svelte
  import type { ConsentEntry, ConsentBulletSection } from "../types/data";
```

```svelte
  let {
    entry,
    project,
    city,
    route,
    safetyDefault = undefined,
    photosDefault = undefined,
    onContinue = undefined,
  }: {
    entry: ConsentEntry;
    project: string;
    city: string;
    route: string;
    safetyDefault?: ConsentBulletSection;
    photosDefault?: ConsentBulletSection;
    onContinue?: () => void;
  } = $props();

  const sections = $derived(
    [entry.safety ?? safetyDefault, entry.photos ?? photosDefault].filter(
      (section): section is ConsentBulletSection => section !== undefined,
    ),
  );

  // The minimum age is authored per-route (ConsentEntry.minimumAge) so a
  // route's consent screen is self-contained content, not dependent on a
  // project-level setting threaded through three components — content
  // authors write `{{age_threshold}}` in a field's label/subtext and it's
  // resolved here at render time from this entry's own minimumAge.
  const resolvedFields = $derived(
    (entry.fields ?? []).map((field) => ({
      ...field,
      label: field.label.replaceAll("{{age_threshold}}", String(entry.minimumAge)),
      subtext: field.subtext?.replaceAll("{{age_threshold}}", String(entry.minimumAge)),
    })),
  );
```

Replace the `{#each [entry.safety, entry.photos] as section, i (i)}` loop's source with the new derived value:

```svelte
  {#each sections as section, i (i)}
```

(leave the rest of that block's body untouched — it already reads `section.heading`/`section.items`).

- [ ] **Step 5: Thread the defaults through RouteScreen.svelte**

```svelte
  import type { RouteEntry, LocationEntry, CompletionStats, ConsentBulletSection } from "../types/data";
```

Add `safetyDefault`/`photosDefault` to the props destructure and type (alongside the other consent-related props removed/kept in Task 3):

```svelte
  let {
    entry,
    index,
    locationKey = undefined,
    isLast = false,
    isFirst = false,
    routeId = undefined,
    cityId = undefined,
    project = "",
    storeFormsInLocalStorage = true,
    allowResubmit = true,
    safetyDefault = undefined,
    photosDefault = undefined,
    badgeStatus = undefined,
    onFormStatusChange = undefined,
    onContinue = undefined,
    onPrev = undefined,
    isCurrent = true,
    stats = undefined,
  }: {
    entry: RouteEntry;
    index: number;
    locationKey?: string;
    isLast?: boolean;
    isFirst?: boolean;
    routeId?: string;
    cityId?: string;
    project?: string;
    storeFormsInLocalStorage?: boolean;
    allowResubmit?: boolean;
    safetyDefault?: ConsentBulletSection;
    photosDefault?: ConsentBulletSection;
    badgeStatus?: "submitted" | "skipped";
    onFormStatusChange?: (
      locationId: string,
      status: { submitted: boolean; missingLabels: string[] },
    ) => void;
    onContinue?: () => void;
    onPrev?: () => void;
    isCurrent?: boolean;
    stats?: CompletionStats;
  } = $props();
```

Pass them through in the `<ConsentScreen>` call:

```svelte
{:else if entry["template-type"] === "consent"}
  <ConsentScreen
    entry={entry}
    project={project}
    city={cityId ?? ""}
    route={routeId ?? ""}
    {safetyDefault}
    {photosDefault}
    {onContinue}
  />
```

- [ ] **Step 6: Load and thread the defaults from RoutePage.svelte**

```svelte
  import type { RoutesData, RouteEntry, ConsentBulletSection } from "../types/data";
```

Add state and a load effect, near the existing `huntSettings` load effect:

```ts
  let consentDefaults = $state<{ safety?: ConsentBulletSection; photos?: ConsentBulletSection } | null>(null);
  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<{ safety?: ConsentBulletSection; photos?: ConsentBulletSection }>(lang, "consent_defaults").then((data) => {
      consentDefaults = data;
    });
  });
```

Add `safetyDefault={consentDefaults?.safety}` and `photosDefault={consentDefaults?.photos}` to **both** `<RouteScreen>` call sites (the `swipeMode === "snap"` one and the carousel-strip one) — same two spots Task 3 removed `ageThreshold={huntSettings.ageThreshold}` from.

- [ ] **Step 7: Create the defaults content file**

`src/data/text/en/consent_defaults.yaml`:

```yaml
safety:
  heading: "Stay safe"
  items:
    - icon: AlertTriangle
      text: "Watch traffic, especially at crossings."
    - icon: Footprints
      text: "Self-paced. Take breaks, and skip any challenge you'd rather not do."
    - icon: Wifi
      text: "You'll need a data connection for clues and photo uploads."
    - icon: Phone
      text: "In an emergency, call **112**."
photos:
  heading: "About your photos"
  items:
    - icon: Eye
      text: "Other teams can see your photos in this hunt's gallery."
    - icon: ShieldAlert
      text: "**Don't photograph** people who haven't agreed — and never children outside your own group."
```

- [ ] **Step 8: Create the defaults schema**

`src/data/schemas/consent-defaults.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Consent Defaults",
  "type": "object",
  "additionalProperties": false,
  "required": ["safety", "photos"],
  "properties": {
    "safety": { "$ref": "#/definitions/bulletSection" },
    "photos": { "$ref": "#/definitions/bulletSection" }
  },
  "definitions": {
    "iconItem": {
      "type": "object",
      "additionalProperties": false,
      "required": ["icon", "text"],
      "properties": {
        "icon": { "type": "string" },
        "text": { "type": "string" }
      }
    },
    "bulletSection": {
      "type": "object",
      "additionalProperties": false,
      "required": ["heading", "items"],
      "properties": {
        "heading": { "type": "string" },
        "items": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/definitions/iconItem" }
        }
      }
    }
  }
}
```

- [ ] **Step 9: Validate the defaults file in CI**

(This edit is in `scripts/validate-yaml.ts`, which — per Task 2 Step 7 — isn't covered by `npm run
typecheck`; Step 12 below's actual `npm run validate:yaml` run is the real verification for it.)

In `scripts/validate-yaml.ts`, add near the other `ajv.compile` calls:

```ts
const validateConsentDefaults = ajv.compile(loadSchema("consent-defaults.schema.json"));
```

Add a `TEXT_EN_DIR` constant near `DATA_DIR`:

```ts
const TEXT_EN_DIR = join(ROOT, "src", "data", "text", "en");
```

Add a fixed-path check to the `violations` array (this file has one canonical location, not a glob pattern like the `NNN_*` files):

```ts
  ...checkFile(join(TEXT_EN_DIR, "consent_defaults.yaml"), validateConsentDefaults).map((msg) => ({
    filePath: join(TEXT_EN_DIR, "consent_defaults.yaml"),
    msg,
  })),
```

- [ ] **Step 10: Add a regression test proving two routes' cached consent versions don't collide**

This is existing behavior (the design spec's §0.3 correction — per-route staleness re-prompting
already works via `consentCache.ts`'s per-`project/city/route` localStorage key), not new
production code. No test currently proves two *different* routes stay independent — add one so
the acceptance criterion ("two routes with different consent versions re-prompt independently")
has explicit coverage. Add to `src/test/consentCache.test.ts`:

```ts
test("two different routes' cached versions do not collide", () => {
  writeConsentCache("democrats_abroad", "den_haag", "short_loop", { consentVersion: 3 });
  writeConsentCache("democrats_abroad", "oslo", "inner_circuit", { consentVersion: 7 });
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop")).toEqual({ consentVersion: 3 });
  expect(readConsentCache("democrats_abroad", "oslo", "inner_circuit")).toEqual({ consentVersion: 7 });
});
```

Run: `npm run test:run -- src/test/consentCache.test.ts`
Expected: PASS (this test should pass immediately — it's confirming existing behavior, not driving new code).

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm run test:run -- src/test/ConsentScreen.test.ts src/test/RouteScreen.test.ts src/test/RoutePage.test.ts`
Expected: PASS.

- [ ] **Step 12: Validate content**

Run: `npm run validate:yaml`
Expected: PASS for `consent_defaults.yaml` itself. `000_consent_eula.yaml` still fails on the missing `minimumAge` from Task 3, unresolved until Task 5 — that's expected at this point in the plan.

- [ ] **Step 13: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 14: Leave changes unstaged for review**

---

### Task 5: Den Haag content — new copy, minimumAge, fold body, privacy link

Wires everything from Tasks 1–4 together for the one route that actually ships this. Pure content change plus the placeholder privacy URL noted in Global Constraints.

**Files:**
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/000_consent_eula.yaml`

**Interfaces:**
- Consumes: `whyWereAsking` (Task 1), `minimumAge` (Task 3), optional `safety`/`photos` (Task 4) — this task exercises all three against real content for the first time.
- Produces: nothing — this is the leaf content task.

- [ ] **Step 1: Update the file**

Replace `src/data/text/en/projects/democrats_abroad/den_haag/000_consent_eula.yaml` in full:

```yaml
template-type: consent
nav-bar:
  visible: false
heading: "Before you begin"
intro: "A few things to know before you head out. This takes a minute, then you're off."
minimumAge: 16
chips:
  - icon: Route
    text: "2.4 km"
  - icon: Clock
    text: "~2 hours"
  - icon: TrendingUp
    text: "Steps & cobbles"
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
      text: "In an emergency, call **112**."
photos:
  heading: "About your photos"
  items:
    - icon: Eye
      text: "Other teams can see your photos in this hunt's gallery."
    - icon: ShieldAlert
      text: "**Don't photograph** people who haven't agreed — and never children outside your own group."
whyWereAsking: |
  [+] Why we're asking

  Democrats Abroad Global Women's Caucus is running this event to get US citizens abroad
  registered and voting in the upcoming elections.

  We'd like you to celebrate the cultural and historic heritage of the city you live in —
  and to make photos or video we can share, so other Americans register to vote and request
  their 2026 ballot.

  We won't publish photos or video of minors. If a child appears in something we use, we
  block the image out.
fields:
  - type: section
    label: "Photo permission"
  - id: all_sixteen_plus
    type: radio
    variant: segmented
    label: "Is everyone in your team {{age_threshold}} or over?"
    options: ["Yes", "No"]
  - id: promo_consent
    type: boolean
    label: "The organisers may use my photos and videos on Democrats Abroad social media and in marketing — including posts that specifically promote Democratic candidates and the Democratic Party."
    subtext: "Optional — the hunt works either way. Change it any time under Photo permissions in the menu."
    isVisible:
      initially: conditional
      condition: { source: all_sixteen_plus, operator: "=", value: "Yes" }
  - id: declined_note
    type: note
    label: "We won't use your photos for promotion."
    subtext: "Your photos still appear in this hunt's gallery for other teams. A parent or guardian can give promotional permission by contacting the organiser."
    isVisible:
      initially: conditional
      condition: { source: all_sixteen_plus, operator: "=", value: "No" }
primaryButtonText: "I understand — start the hunt"
privacyLinkUrl: "https://example.org/TODO-privacy-notice"
footerText: "Questions during the hunt? Contact your organiser."
```

- [ ] **Step 2: Validate**

Run: `npm run validate:yaml`
Expected: 0 violations.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test:run`
Expected: PASS (this content file isn't loaded by any test directly — `ConsentScreen.test.ts` uses its own inline fixture — but confirm nothing else regressed).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 6: Manual check (per this project's rules — no Playwright)**

Run `npm run dev`, navigate to the Den Haag `short_loop` route's consent screen, and confirm by eye:
- The checkbox label reads the new candidate/party-promotion copy in full, unexpanded.
- "Why we're asking" appears as a closed fold beside/above the checkbox; clicking it reveals the three paragraphs and re-collapses on a second click.
- "Read the full privacy notice" link is present (pointing at the placeholder URL).

- [ ] **Step 7: Flag the placeholder URL to the user**

Tell the user explicitly that `privacyLinkUrl` in `000_consent_eula.yaml` is a placeholder (`https://example.org/TODO-privacy-notice`) and needs the real privacy-notice URL before this ships.

- [ ] **Step 8: Leave changes unstaged for review**

---

### Task 6: Authoring guidance documentation

Resolves an existing dead cross-reference in `doc/architecture.md` (the template-types table already says "See 'Consent & photo-promotion review' below" — no such section exists) and uses that as the home for the new authoring guidance.

**Files:**
- Modify: `doc/architecture.md`

**Interfaces:** None — documentation only, nothing else in this plan depends on it.

- [ ] **Step 1: Add the section**

In `doc/architecture.md`, insert a new `## Consent & Photo-Promotion Review` section directly after the `consent_records` table subsection (right before `## Theme System`):

```markdown
## Consent & Photo-Promotion Review

Authoring guidance for a route's `NNN_consent_*.yaml` file (referenced from the template-types
table above):

- **Name the specific uses in the checkbox label.** The label is the permission scope a
  participant is actually agreeing to — avoid open-ended phrasing like "and other purposes"; it
  weakens consent specificity and adds nothing beyond the uses already named.
- **The fold (`whyWereAsking`) is for context, the checkbox label is for scope.** Don't move a
  scope fact (what the photos/videos will be used for) into the fold to shorten the label — a
  participant must be able to read the full scope without expanding anything.
- **Bump the consent version via KV, not YAML**, on any material change to the permission scope:
  `wrangler kv key put consent-version:<project>:<city>:<route> <n>`. This is deliberate — see the
  `consent_records` section above for why version bumps stay out of the YAML/build pipeline.
  Participants who agreed to the old scope have not agreed to the new one and must be re-prompted,
  never silently migrated.
- **Minimum age (`minimumAge`) and photo/video permission content are both required per-route
  fields** — the schema (`consent.schema.json`) enforces their presence, but pick a real value
  deliberately; don't copy a number from another city's jurisdiction without checking it.
- **Omit `safety`/`photos` to inherit the platform defaults** in
  `src/data/text/en/consent_defaults.yaml`. To add one route-specific line (a canal towpath, a
  long stair climb) on top of the defaults, copy the default items into the route's own file and
  append the extra one — there's no partial-merge mechanism, a route that sets `safety`/`photos`
  at all replaces the section wholesale.

Photo-promotion consent itself (`promo_consent`, `all_sixteen_plus`) is participant-facing; a
separate **organizer-only** human review gate (`promo_approved`, set only via `POST
/promo-approve`, `src/pages/editor/PromoReviewPage.svelte` at
`/editor/:project/:city/promo-review`) must also be satisfied before any photo is used
promotionally, regardless of what a participant ticked.
```

- [ ] **Step 2: Verify formatting**

Read the file back and confirm the new section renders as valid Markdown between its neighbors (heading level `##` matches sibling sections like `## Theme System`, no broken list/code-fence nesting).

- [ ] **Step 3: Leave changes unstaged for review**

---

## After all tasks

- Run the full verification sweep once more end-to-end: `npm run test:run`, `npm run lint`, `npm run typecheck`, `npm run validate:yaml` — all must be clean.
- Update `doc/devlog/_devlog.md` per this project's Session End convention (`**DD/MM/YYYY, Claude**: [TYPE] summary...` at the top of the file), summarizing: the fold reuse, the minimumAge migration, the consent-defaults mechanism, the dropped cross-file validation (and why), and the outstanding placeholder privacy URL.
- Remind the user: consent version stays KV-based (no code change), and the real privacy URL is still needed in `000_consent_eula.yaml`.
