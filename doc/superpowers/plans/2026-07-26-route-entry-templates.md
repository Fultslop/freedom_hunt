# Route Entry Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a route's `locations` list include non-location screens — `text`, `splash`, and `options` templates — alongside the existing location entries, dispatched by a new `template-type` YAML field.

**Architecture:** A discriminated union `RouteEntry` (`LocationEntry | TextEntry | SplashEntry | OptionsEntry`) replaces the bare `Location` type flowing through `loadLocations`/`RoutePage`. A new `RouteScreen.svelte` dispatcher picks the right renderer per entry; `ChallengeCard` (location) is untouched. Only `location`-type entries count toward the route's progress indicator and badge numbering — this needs a small pure-function util (`routeEntries.ts`) to compute that separately from raw array position. Splash screen entrance effects (confetti/shooting-stars/fireworks) are hand-rolled CSS components with cooldown/replay state lifted into `RoutePage` (mirrors the existing `formStatusByIndex` pattern), since remounting isn't used to detect "re-entered this screen."

**Tech Stack:** Svelte 5 runes, TypeScript, co-located CSS with `var(--color-*)` tokens, `ajv` JSON Schema validation, `marked` (via existing `MarkdownText`), `svelte-spa-router`. No new dependencies.

Full design rationale: `doc/superpowers/specs/2026-07-26-route-entry-templates-design.md`.

## Global Constraints

- TypeScript only (`.ts` + `.svelte`), no `.js`/`.jsx`/`.tsx` under `src/`.
- Co-located `.css` per component, `var(--color-*)` tokens only for themeable colors — no hex literals for anything the theme should control.
- All `@keyframes` go in `src/styles/global.css`, referenced by name from component CSS (existing convention; a few older files violate it — don't follow those, follow the documented rule).
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`) — no `$:` reactive statements.
- New multi-word YAML keys stay kebab-case (`template-type`, `repeat-effect`), matching the spec's chosen convention — no camelCase transform layer in the YAML itself.
- No new npm dependencies (no animation library, no WebGL/shader library, no `ajv-formats`).
- Existing `NNN_loc_*.yaml` files and `location.schema.json`'s existing required fields are never modified beyond adding the new optional `template-type` property.
- Admin editor (`EditorLocationForm`/`EditorLocationList`) is explicitly out of scope — do not touch it.
- User controls git — do not run git commands; stage/commit steps below are for a human or a later step to run, not to be executed automatically. (Per this repo's `.claude/CLAUDE.md`.)

---

### Task 1: `RouteEntry` types and location/template discrimination util

**Files:**
- Modify: `src/types/data.ts`
- Create: `src/utils/routeEntries.ts`
- Test: `src/test/routeEntries.test.ts`

**Interfaces:**
- Produces: `LocationEntry`, `TextEntry`, `SplashEntry`, `OptionsEntry`, `RouteEntry` (types), `isLocationEntry(entry): entry is LocationEntry`, `locationTotal(entries): number`, `locationOrdinalAt(entries, index): number` — all consumed by every later task.

- [ ] **Step 1: Add the discriminated union types to `src/types/data.ts`**

Append after the existing `Location` interface (`src/types/data.ts:45-55`):

```ts
export interface LocationEntry extends Location {
  "template-type"?: "location";
}

export interface TextEntry {
  "template-type": "text";
  image?: string;
  title: string;
  text: string;
  margin?: string;
}

export type SplashShader = "none" | "grayscale" | "duotone" | "vignette" | "darken";
export type SplashEffectName = "confetti" | "shooting-stars" | "fireworks";

export interface SplashAnchor {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "center" | "bottom";
}

export interface SplashEntry {
  "template-type": "splash";
  image: string;
  shader?: SplashShader;
  effect?: SplashEffectName;
  "repeat-effect"?: { cooldown: number; max: number };
  title: string;
  anchor?: SplashAnchor;
}

export type OptionTarget =
  | { type: "link"; value: string }
  | { type: "page"; value: "title" | "project" | "start_route" | "gallery" };

export interface OptionsEntry {
  "template-type": "options";
  image?: string;
  title: string;
  options: Array<{ text: string; target: OptionTarget }>;
}

export type RouteEntry = LocationEntry | TextEntry | SplashEntry | OptionsEntry;
```

- [ ] **Step 2: Write the failing test for the discrimination util**

Create `src/test/routeEntries.test.ts`:

```ts
import { isLocationEntry, locationTotal, locationOrdinalAt } from "../utils/routeEntries";
import type { RouteEntry } from "../types/data";

const location = {
  title: "Loc",
  name: { value: "Loc" },
  coordinates: { latitude: 0, longitude: 0 },
  storyline: "s",
  breadcrumb: "b",
  challenge: { name: "", description: "d", form: [] },
} as const;

const mixed: RouteEntry[] = [
  { ...location },
  { "template-type": "text", title: "T", text: "..." },
  { ...location },
  { "template-type": "splash", image: "x.jpg", title: "S" },
  { "template-type": "options", title: "O", options: [] },
  { ...location },
];

test("isLocationEntry is true for entries with no template-type", () => {
  expect(isLocationEntry(mixed[0])).toBe(true);
});

test("isLocationEntry is true for entries with template-type: location", () => {
  expect(isLocationEntry({ ...location, "template-type": "location" })).toBe(true);
});

test("isLocationEntry is false for text/splash/options entries", () => {
  expect(isLocationEntry(mixed[1])).toBe(false);
  expect(isLocationEntry(mixed[3])).toBe(false);
  expect(isLocationEntry(mixed[4])).toBe(false);
});

test("locationTotal counts only location entries", () => {
  expect(locationTotal(mixed)).toBe(3);
});

test("locationOrdinalAt returns the 1-based count of locations up to and including index", () => {
  expect(locationOrdinalAt(mixed, 0)).toBe(1); // loc
  expect(locationOrdinalAt(mixed, 1)).toBe(1); // text — holds at last location's ordinal
  expect(locationOrdinalAt(mixed, 2)).toBe(2); // loc
  expect(locationOrdinalAt(mixed, 3)).toBe(2); // splash — still holds
  expect(locationOrdinalAt(mixed, 5)).toBe(3); // loc
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/test/routeEntries.test.ts`
Expected: FAIL — `Cannot find module '../utils/routeEntries'`

- [ ] **Step 4: Implement `src/utils/routeEntries.ts`**

```ts
import type { RouteEntry, LocationEntry } from "../types/data";

export function isLocationEntry(entry: RouteEntry): entry is LocationEntry {
  return (entry["template-type"] ?? "location") === "location";
}

export function locationTotal(entries: RouteEntry[]): number {
  return entries.filter(isLocationEntry).length;
}

export function locationOrdinalAt(entries: RouteEntry[], index: number): number {
  return entries.slice(0, index + 1).filter(isLocationEntry).length;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/routeEntries.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/types/data.ts src/utils/routeEntries.ts src/test/routeEntries.test.ts
git commit -m "feat: add RouteEntry union types and location/template discrimination util"
```

---

### Task 2: `loadLocations` template-type pass-through

**Files:**
- Modify: `src/utils/loadLocations.ts`
- Test: `src/test/loadLocations.test.ts` (new)

**Interfaces:**
- Consumes: `RouteEntry`, `LocationEntry`, `TextEntry`, `SplashEntry`, `OptionsEntry` (Task 1)
- Produces: `loadLocations(lang, paths): Promise<RouteEntry[]>` (signature change from `Promise<Location[]>`) — consumed by `RoutePage.svelte` in Task 11.

- [ ] **Step 1: Write the failing tests**

Create `src/test/loadLocations.test.ts`:

```ts
import { loadLocations } from "../utils/loadLocations";

const { mockLoadText } = vi.hoisted(() => ({ mockLoadText: vi.fn() }));

vi.mock("../utils/loadText", () => ({ loadText: mockLoadText }));

const rawLocation = {
  title: "Binnenhof",
  name: { value: "Binnenhof" },
  coordinates: { latitude: 52.08, longitude: 4.31 },
  storyline: "s",
  breadcrumb: "b",
  challenge: { name: "", description: "d", form: [] },
};

beforeEach(() => {
  mockLoadText.mockReset();
});

test("resolves a location entry with no template-type unchanged", async () => {
  mockLoadText.mockResolvedValueOnce(rawLocation);
  const [entry] = await loadLocations("en", ["path/001"]);
  expect(entry).toMatchObject({ title: "Binnenhof" });
  expect((entry as any)["template-type"]).toBeUndefined();
});

test("passes through a text entry unchanged", async () => {
  const raw = { "template-type": "text", title: "Intro", text: "hello" };
  mockLoadText.mockResolvedValueOnce(raw);
  const [entry] = await loadLocations("en", ["path/002"]);
  expect(entry).toEqual(raw);
});

test("passes through a splash entry unchanged", async () => {
  const raw = { "template-type": "splash", image: "x.jpg", title: "Yay" };
  mockLoadText.mockResolvedValueOnce(raw);
  const [entry] = await loadLocations("en", ["path/003"]);
  expect(entry).toEqual(raw);
});

test("passes through an options entry unchanged", async () => {
  const raw = { "template-type": "options", title: "Next?", options: [] };
  mockLoadText.mockResolvedValueOnce(raw);
  const [entry] = await loadLocations("en", ["path/004"]);
  expect(entry).toEqual(raw);
});

test("still resolves challenge.form filename references for location entries", async () => {
  mockLoadText
    .mockResolvedValueOnce({ ...rawLocation, challenge: { ...rawLocation.challenge, form: "001_form_binnenhof" } })
    .mockResolvedValueOnce([{ id: "found_it", type: "boolean", label: "Found it?" }]);
  const [entry] = await loadLocations("en", ["projects/x/y/001_loc_binnenhof"]);
  expect((entry as any).challenge.form).toEqual([{ id: "found_it", type: "boolean", label: "Found it?" }]);
});

test("filters out entries that fail to load", async () => {
  mockLoadText.mockResolvedValueOnce(null);
  const result = await loadLocations("en", ["path/missing"]);
  expect(result).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail or pass unexpectedly**

Run: `npx vitest run src/test/loadLocations.test.ts`
Expected: the text/splash/options tests FAIL — the current `loadAndResolveLocation` always treats `raw.challenge` as present and returns the raw object at `src/utils/loadLocations.ts:60` without checking `template-type`, so for a `TextEntry`/`SplashEntry`/`OptionsEntry` (no `challenge` key) the location-only tests would actually already pass by accident (no challenge → falls through both `if`s → returns raw as-is), but this is not yet correctly *typed* or intentional. Confirm current behavior, then proceed to make the intent explicit and typed.

- [ ] **Step 3: Update `src/utils/loadLocations.ts`**

Replace the full file:

```ts
import { loadText } from "./loadText";
import type {
  RouteEntry,
  LocationEntry,
  FormField,
  RawChallenge,
  FormFieldType,
} from "../types/data";

type RawLocationEntry = Omit<LocationEntry, "challenge"> & { challenge: RawChallenge };
type RawRouteEntry = RawLocationEntry | Exclude<RouteEntry, LocationEntry>;

const KNOWN_FORM_FIELD_KEYS = new Set(["id", "type", "label", "options", "min", "max"]);

function withValidatedFields(fields: FormField[]): FormField[] {
  return fields.map((field) => {
    const unknownKeys = Object.keys(field as unknown as Record<string, unknown>).filter(
      (key) => !KNOWN_FORM_FIELD_KEYS.has(key),
    );
    if (unknownKeys.length === 0) {
      return field;
    }
    const fieldId = field.id ?? field.label;
    return {
      id: fieldId,
      type: "schema_error" as FormFieldType,
      label: `unknown properties on '${fieldId}': ${unknownKeys.join(", ")}`,
    };
  });
}

async function loadAndResolveLocation(
  lang: string,
  path: string,
): Promise<RouteEntry | null> {
  const raw = await loadText<RawRouteEntry>(lang, path);
  if (!raw) {
    return null;
  }

  const templateType = raw["template-type"] ?? "location";
  if (templateType !== "location") {
    return raw as RouteEntry;
  }

  const rawLocation = raw as RawLocationEntry;
  let resolvedForm: FormField[] | undefined;

  if (rawLocation.challenge && typeof rawLocation.challenge.form === "string") {
    const formFileName = rawLocation.challenge.form;
    const dir = path.substring(0, path.lastIndexOf("/") + 1);
    const formPath = dir + formFileName.replace(/\.yaml$/, "");
    resolvedForm = withValidatedFields(
      (await loadText<FormField[]>(lang, formPath)) ?? [],
    );
  } else if (rawLocation.challenge && Array.isArray(rawLocation.challenge.form)) {
    resolvedForm = [
      {
        id: "form",
        type: "inline_form" as FormFieldType,
        label: "challenge.form inline array — migrate to a *_form_*.yaml file",
      },
    ];
  }

  if (resolvedForm !== undefined) {
    return {
      ...rawLocation,
      challenge: { ...rawLocation.challenge, form: resolvedForm },
    } as RouteEntry;
  }

  return rawLocation as RouteEntry;
}

export async function loadLocations(
  lang: string,
  paths: string[],
): Promise<RouteEntry[]> {
  if (paths.length === 0) {
    return [];
  }
  const results = await Promise.all(
    paths.map((path) => loadAndResolveLocation(lang, path)),
  );
  return results.filter((entry): entry is RouteEntry => entry !== null);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/loadLocations.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm run test:run`
Expected: all existing tests still pass (`RoutePage.test.ts` mocks `loadLocations` directly, so its behavior is unaffected by this change).

- [ ] **Step 6: Commit**

```bash
git add src/utils/loadLocations.ts src/test/loadLocations.test.ts
git commit -m "feat: pass template-type entries through loadLocations unchanged"
```

---

### Task 3: JSON Schemas for `text`, `splash`, `options` + validation wiring

**Files:**
- Modify: `src/data/schemas/location.schema.json`
- Create: `src/data/schemas/text.schema.json`
- Create: `src/data/schemas/splash.schema.json`
- Create: `src/data/schemas/options.schema.json`
- Modify: `scripts/validate-yaml.js`
- Modify: `.vscode/settings.json`

**Interfaces:**
- Produces: file-naming convention `NNN_text_*.yaml` / `NNN_splash_*.yaml` / `NNN_options_*.yaml`, each validated against its own schema — consumed by Task 12's demo content.

- [ ] **Step 1: Add optional `template-type` to `location.schema.json`**

In `src/data/schemas/location.schema.json`, add this property (anywhere in `properties`, e.g. right after `"identity"`):

```json
    "template-type": { "type": "string", "enum": ["location"] },
```

- [ ] **Step 2: Create `src/data/schemas/text.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Text Screen",
  "type": "object",
  "additionalProperties": false,
  "required": ["template-type", "title", "text"],
  "properties": {
    "template-type": { "const": "text" },
    "image": { "type": "string" },
    "title": { "type": "string" },
    "text": { "type": "string" },
    "margin": { "type": "string" }
  }
}
```

- [ ] **Step 3: Create `src/data/schemas/splash.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Splash Screen",
  "type": "object",
  "additionalProperties": false,
  "required": ["template-type", "image", "title"],
  "properties": {
    "template-type": { "const": "splash" },
    "image": { "type": "string" },
    "shader": { "enum": ["none", "grayscale", "duotone", "vignette", "darken"] },
    "effect": { "enum": ["confetti", "shooting-stars", "fireworks"] },
    "repeat-effect": {
      "type": "object",
      "additionalProperties": false,
      "required": ["cooldown", "max"],
      "properties": {
        "cooldown": { "type": "number" },
        "max": { "type": "number" }
      }
    },
    "title": { "type": "string" },
    "anchor": {
      "type": "object",
      "additionalProperties": false,
      "required": ["horizontal", "vertical"],
      "properties": {
        "horizontal": { "enum": ["left", "center", "right"] },
        "vertical": { "enum": ["top", "center", "bottom"] }
      }
    }
  }
}
```

- [ ] **Step 4: Create `src/data/schemas/options.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Options Screen",
  "type": "object",
  "additionalProperties": false,
  "required": ["template-type", "title", "options"],
  "properties": {
    "template-type": { "const": "options" },
    "image": { "type": "string" },
    "title": { "type": "string" },
    "options": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["text", "target"],
        "properties": {
          "text": { "type": "string" },
          "target": {
            "type": "object",
            "additionalProperties": false,
            "required": ["type", "value"],
            "properties": {
              "type": { "enum": ["link", "page"] },
              "value": { "type": "string" }
            },
            "if": { "properties": { "type": { "const": "page" } } },
            "then": { "properties": { "value": { "enum": ["title", "project", "start_route", "gallery"] } } }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 5: Verify the new schemas compile and validate correctly**

Run this ad hoc check (nothing here is written to disk — it's a throwaway verification, not a new test file):

```bash
node -e "
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });
const text = require('./src/data/schemas/text.schema.json');
const splash = require('./src/data/schemas/splash.schema.json');
const options = require('./src/data/schemas/options.schema.json');
const vText = ajv.compile(text);
const vSplash = ajv.compile(splash);
const vOptions = ajv.compile(options);
console.log('text valid:', vText({ 'template-type': 'text', title: 't', text: 'x' }));
console.log('text invalid (missing text):', vText({ 'template-type': 'text', title: 't' }), JSON.stringify(vText.errors));
console.log('splash valid:', vSplash({ 'template-type': 'splash', image: 'a.jpg', title: 't', shader: 'duotone', effect: 'confetti', 'repeat-effect': { cooldown: 10, max: 3 }, anchor: { horizontal: 'center', vertical: 'bottom' } }));
console.log('splash invalid (bad shader):', vSplash({ 'template-type': 'splash', image: 'a.jpg', title: 't', shader: 'sepia' }), JSON.stringify(vSplash.errors));
console.log('options valid link:', vOptions({ 'template-type': 'options', title: 't', options: [{ text: 'Go', target: { type: 'link', value: 'https://x.com' } }] }));
console.log('options valid page:', vOptions({ 'template-type': 'options', title: 't', options: [{ text: 'Go', target: { type: 'page', value: 'gallery' } }] }));
console.log('options invalid page value:', vOptions({ 'template-type': 'options', title: 't', options: [{ text: 'Go', target: { type: 'page', value: 'nope' } }] }), JSON.stringify(vOptions.errors));
"
```

Expected: the three `valid` lines print `true`; the three `invalid` lines print `false` followed by a non-empty errors array.

- [ ] **Step 6: Wire the new schemas into `scripts/validate-yaml.js`**

Replace the whole file with:

```js
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import Ajv from "ajv";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA_DIR = join(ROOT, "src", "data", "text", "en", "projects");

function loadSchema(name) {
  const schemaPath = join(ROOT, "src", "data", "schemas", name);
  return JSON.parse(readFileSync(schemaPath, "utf8"));
}

const ajv = new Ajv({ allErrors: true });
const validateLoc = ajv.compile(loadSchema("location.schema.json"));
const validateForm = ajv.compile(loadSchema("form.schema.json"));
const validateText = ajv.compile(loadSchema("text.schema.json"));
const validateSplash = ajv.compile(loadSchema("splash.schema.json"));
const validateOptions = ajv.compile(loadSchema("options.schema.json"));

function findFiles(dir, pattern) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return findFiles(fullPath, pattern);
    }
    if (pattern.test(entry.name)) {
      return [fullPath];
    }
    return [];
  });
}

function formatError(err) {
  const path = err.instancePath || "(root)";
  const extra = err.params?.additionalProperty
    ? ` ('${err.params.additionalProperty}')`
    : "";
  return `${path}: ${err.message}${extra}`;
}

function checkFile(filePath, validator) {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content);
  if (validator(data)) {
    return [];
  }
  return (validator.errors ?? []).map(formatError);
}

const LOC_PATTERN = /^\d+_loc_.*\.yaml$/;
const FORM_PATTERN = /^\d+_form_.*\.yaml$/;
const TEXT_PATTERN = /^\d+_text_.*\.yaml$/;
const SPLASH_PATTERN = /^\d+_splash_.*\.yaml$/;
const OPTIONS_PATTERN = /^\d+_options_.*\.yaml$/;

const violations = [
  ...findFiles(DATA_DIR, LOC_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateLoc).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, FORM_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateForm).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, TEXT_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateText).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, SPLASH_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateSplash).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, OPTIONS_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateOptions).map((msg) => ({ filePath, msg })),
  ),
];

violations.forEach(({ filePath, msg }) => {
  const rel = filePath.slice(ROOT.length);
  console.error(`ERROR: ${rel}: ${msg}`);
});

if (violations.length > 0) {
  process.exit(1);
}
```

- [ ] **Step 7: Run the validator against existing content**

Run: `npm run validate:yaml`
Expected: exits 0, no errors (no `*_text_*`/`*_splash_*`/`*_options_*` files exist yet, and `location.schema.json`'s change is additive-only).

- [ ] **Step 8: Wire IDE schema mapping in `.vscode/settings.json`**

```json
{
  "yaml.schemas": {
    "./src/data/schemas/location.schema.json": "*_loc_*.yaml",
    "./src/data/schemas/form.schema.json": "*_form_*.yaml",
    "./src/data/schemas/text.schema.json": "*_text_*.yaml",
    "./src/data/schemas/splash.schema.json": "*_splash_*.yaml",
    "./src/data/schemas/options.schema.json": "*_options_*.yaml"
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add src/data/schemas scripts/validate-yaml.js .vscode/settings.json
git commit -m "feat: add JSON schemas and validation wiring for text/splash/options templates"
```

---

### Task 4: Splash effect repeat/cooldown util

**Files:**
- Create: `src/utils/splashEffectHistory.ts`
- Test: `src/test/splashEffectHistory.test.ts`

**Interfaces:**
- Produces: `EffectHistory`, `EffectFireRecord`, `RepeatEffect`, `shouldFireEffect(history, index, repeatEffect, now): boolean`, `recordEffectFired(history, index, now): EffectHistory` — consumed by `RouteScreen.svelte` (Task 10) and `RoutePage.svelte` (Task 11).

- [ ] **Step 1: Write the failing tests**

Create `src/test/splashEffectHistory.test.ts`:

```ts
import { shouldFireEffect, recordEffectFired, type EffectHistory } from "../utils/splashEffectHistory";

test("fires the first time an index is seen, with no repeat-effect config", () => {
  expect(shouldFireEffect({}, 3, undefined, 1000)).toBe(true);
});

test("does not fire again after the first time with no repeat-effect config", () => {
  const history: EffectHistory = { 3: { count: 1, lastFiredAt: 1000 } };
  expect(shouldFireEffect(history, 3, undefined, 999999)).toBe(false);
});

test("does not re-fire before the cooldown has elapsed", () => {
  const history: EffectHistory = { 3: { count: 1, lastFiredAt: 1000 } };
  expect(shouldFireEffect(history, 3, { cooldown: 30, max: 3 }, 1000 + 29_000)).toBe(false);
});

test("re-fires once the cooldown has elapsed", () => {
  const history: EffectHistory = { 3: { count: 1, lastFiredAt: 1000 } };
  expect(shouldFireEffect(history, 3, { cooldown: 30, max: 3 }, 1000 + 30_000)).toBe(true);
});

test("stops firing once max repeats is reached, even past cooldown", () => {
  const history: EffectHistory = { 3: { count: 3, lastFiredAt: 1000 } };
  expect(shouldFireEffect(history, 3, { cooldown: 10, max: 3 }, 999_999)).toBe(false);
});

test("recordEffectFired increments count and stamps the fire time for that index only", () => {
  const history: EffectHistory = { 3: { count: 1, lastFiredAt: 1000 } };
  const updated = recordEffectFired(history, 3, 5000);
  expect(updated).toEqual({ 3: { count: 2, lastFiredAt: 5000 } });
});

test("recordEffectFired initializes a fresh record for an unseen index", () => {
  const updated = recordEffectFired({}, 7, 2000);
  expect(updated).toEqual({ 7: { count: 1, lastFiredAt: 2000 } });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/splashEffectHistory.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `src/utils/splashEffectHistory.ts`**

```ts
export interface EffectFireRecord {
  count: number;
  lastFiredAt: number;
}

export type EffectHistory = Record<number, EffectFireRecord>;

export interface RepeatEffect {
  cooldown: number;
  max: number;
}

export function shouldFireEffect(
  history: EffectHistory,
  index: number,
  repeatEffect: RepeatEffect | undefined,
  now: number,
): boolean {
  const record = history[index];
  if (!record) {
    return true;
  }
  if (!repeatEffect) {
    return false;
  }
  if (record.count >= repeatEffect.max) {
    return false;
  }
  return now - record.lastFiredAt >= repeatEffect.cooldown * 1000;
}

export function recordEffectFired(
  history: EffectHistory,
  index: number,
  now: number,
): EffectHistory {
  const prev = history[index];
  return {
    ...history,
    [index]: { count: (prev?.count ?? 0) + 1, lastFiredAt: now },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/splashEffectHistory.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/splashEffectHistory.ts src/test/splashEffectHistory.test.ts
git commit -m "feat: add splash effect cooldown/repeat-count util"
```

---

### Task 5: `ScreenHero` shared top-image component

**Files:**
- Create: `src/components/ScreenHero.svelte`
- Create: `src/components/ScreenHero.css`
- Test: `src/test/ScreenHero.test.ts`

**Interfaces:**
- Consumes: `fetchImage`, `getCachedImageUrl` from `src/assets/AssetManager.ts` (existing).
- Produces: `<ScreenHero image? title>` — consumed by `TextScreen.svelte` (Task 7) and `OptionsScreen.svelte` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `src/test/ScreenHero.test.ts`:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import ScreenHero from "../components/ScreenHero.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

test("renders the title", () => {
  render(ScreenHero, { props: { title: "Welcome" } });
  expect(screen.getByText("Welcome")).toBeInTheDocument();
});

test("renders no image when image prop is absent", () => {
  render(ScreenHero, { props: { title: "Welcome" } });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("renders the cached image with the title as alt text", async () => {
  render(ScreenHero, { props: { title: "Welcome", image: "hero.jpg" } });
  const img = await screen.findByRole("img");
  expect(img).toHaveAttribute("src", "blob:test");
  expect(img).toHaveAttribute("alt", "Welcome");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/ScreenHero.test.ts`
Expected: FAIL — component doesn't exist

- [ ] **Step 3: Implement `src/components/ScreenHero.svelte`**

```svelte
<script lang="ts">
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
  import "./ScreenHero.css";

  let { image, title }: { image?: string; title: string } = $props();

  let heroSrc = $state<string | null>(null);

  $effect.pre(() => {
    heroSrc = image ? (getCachedImageUrl(image) ?? null) : null;
  });

  $effect(() => {
    if (!image || getCachedImageUrl(image)) {
      return undefined;
    }
    let cancelled = false;
    fetchImage(image).then((url) => {
      if (!cancelled) {
        heroSrc = url;
      }
    });
    return () => {
      cancelled = true;
    };
  });
</script>

<div class="screen-hero">
  {#if heroSrc}
    <img src={heroSrc} alt={title} class="screen-hero__img" />
  {/if}
  <h1 class="screen-hero__title">{title}</h1>
</div>
```

- [ ] **Step 4: Implement `src/components/ScreenHero.css`**

```css
/* src/components/ScreenHero.css */

.screen-hero {
  background: var(--color-background);
}

.screen-hero__img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}

.screen-hero__title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
  padding: 16px;
  margin: 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/ScreenHero.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/ScreenHero.svelte src/components/ScreenHero.css src/test/ScreenHero.test.ts
git commit -m "feat: add shared ScreenHero top-image component"
```

---

### Task 6: Splash entrance effect components (confetti / shooting-stars / fireworks)

**Files:**
- Modify: `src/styles/global.css`
- Create: `src/components/effects/ConfettiEffect.svelte`, `ConfettiEffect.css`
- Create: `src/components/effects/ShootingStarsEffect.svelte`, `ShootingStarsEffect.css`
- Create: `src/components/effects/FireworksEffect.svelte`, `FireworksEffect.css`
- Test: `src/test/ConfettiEffect.test.ts`, `src/test/ShootingStarsEffect.test.ts`, `src/test/FireworksEffect.test.ts`

**Interfaces:**
- Produces: `<ConfettiEffect>`, `<ShootingStarsEffect>`, `<FireworksEffect>` (no props) — consumed by `SplashScreen.svelte` (Task 8).

- [ ] **Step 1: Write the three failing tests**

Create `src/test/ConfettiEffect.test.ts`:

```ts
import { render } from "@testing-library/svelte/svelte5";
import ConfettiEffect from "../components/effects/ConfettiEffect.svelte";

test("renders 24 confetti particles", () => {
  const { container } = render(ConfettiEffect);
  expect(container.querySelectorAll(".confetti-effect__particle")).toHaveLength(24);
});
```

Create `src/test/ShootingStarsEffect.test.ts`:

```ts
import { render } from "@testing-library/svelte/svelte5";
import ShootingStarsEffect from "../components/effects/ShootingStarsEffect.svelte";

test("renders 6 shooting stars", () => {
  const { container } = render(ShootingStarsEffect);
  expect(container.querySelectorAll(".shooting-stars-effect__star")).toHaveLength(6);
});
```

Create `src/test/FireworksEffect.test.ts`:

```ts
import { render } from "@testing-library/svelte/svelte5";
import FireworksEffect from "../components/effects/FireworksEffect.svelte";

test("renders 3 firework bursts of 10 dots each", () => {
  const { container } = render(FireworksEffect);
  expect(container.querySelectorAll(".fireworks-effect__burst")).toHaveLength(3);
  expect(container.querySelectorAll(".fireworks-effect__dot")).toHaveLength(30);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/ConfettiEffect.test.ts src/test/ShootingStarsEffect.test.ts src/test/FireworksEffect.test.ts`
Expected: FAIL — components don't exist

- [ ] **Step 3: Add shared keyframes to `src/styles/global.css`**

Append after the existing `slideInFromLeft` keyframe (`src/styles/global.css:34-43`):

```css
@keyframes confettiFall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0.9;
  }
  100% {
    transform: translateY(320px) rotate(540deg);
    opacity: 0;
  }
}

@keyframes shootingStarStreak {
  0% {
    transform: translate(0, 0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate(220px, 140px);
    opacity: 0;
  }
}

@keyframes fireworkBurst {
  0% {
    transform: translate(0, 0);
    opacity: 1;
  }
  100% {
    transform: translate(var(--dx), var(--dy));
    opacity: 0;
  }
}
```

- [ ] **Step 4: Implement `src/components/effects/ConfettiEffect.svelte`**

```svelte
<script lang="ts">
  import "./ConfettiEffect.css";

  const COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#a855f7"];
  const PARTICLE_COUNT = 24;

  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    left: (i / PARTICLE_COUNT) * 100 + (Math.random() * 4 - 2),
    delay: Math.random() * 0.4,
    duration: 1.2 + Math.random() * 0.8,
    color: COLORS[i % COLORS.length],
  }));
</script>

<div class="confetti-effect" aria-hidden="true">
  {#each particles as p, i (i)}
    <span
      class="confetti-effect__particle"
      style="left: {p.left}%; background: {p.color}; animation-duration: {p.duration}s; animation-delay: {p.delay}s"
    ></span>
  {/each}
</div>
```

`src/components/effects/ConfettiEffect.css`:

```css
/* src/components/effects/ConfettiEffect.css */

.confetti-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.confetti-effect__particle {
  position: absolute;
  top: -10px;
  width: 8px;
  height: 14px;
  opacity: 0.9;
  animation-name: confettiFall;
  animation-timing-function: ease-in;
  animation-fill-mode: forwards;
}
```

- [ ] **Step 5: Implement `src/components/effects/ShootingStarsEffect.svelte`**

```svelte
<script lang="ts">
  import "./ShootingStarsEffect.css";

  const STAR_COUNT = 6;

  const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
    top: (i / STAR_COUNT) * 70 + Math.random() * 10,
    left: Math.random() * 40,
    delay: i * 0.25 + Math.random() * 0.2,
    duration: 0.9 + Math.random() * 0.4,
  }));
</script>

<div class="shooting-stars-effect" aria-hidden="true">
  {#each stars as s, i (i)}
    <span
      class="shooting-stars-effect__star"
      style="top: {s.top}%; left: {s.left}%; animation-duration: {s.duration}s; animation-delay: {s.delay}s"
    ></span>
  {/each}
</div>
```

`src/components/effects/ShootingStarsEffect.css`:

```css
/* src/components/effects/ShootingStarsEffect.css */

.shooting-stars-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.shooting-stars-effect__star {
  position: absolute;
  width: 3px;
  height: 3px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 6px 2px rgba(255, 255, 255, 0.8);
  animation-name: shootingStarStreak;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
```

- [ ] **Step 6: Implement `src/components/effects/FireworksEffect.svelte`**

```svelte
<script lang="ts">
  import "./FireworksEffect.css";

  const BURST_COUNT = 3;
  const DOTS_PER_BURST = 10;
  const COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#a855f7"];

  const bursts = Array.from({ length: BURST_COUNT }, (_, b) => ({
    top: 20 + Math.random() * 40,
    left: 15 + (b / BURST_COUNT) * 70 + Math.random() * 10,
    delay: b * 0.3,
    dots: Array.from({ length: DOTS_PER_BURST }, (_, d) => {
      const angle = (d / DOTS_PER_BURST) * 2 * Math.PI;
      return {
        dx: Math.cos(angle) * 60,
        dy: Math.sin(angle) * 60,
        color: COLORS[d % COLORS.length],
      };
    }),
  }));
</script>

<div class="fireworks-effect" aria-hidden="true">
  {#each bursts as burst, b (b)}
    <div
      class="fireworks-effect__burst"
      style="top: {burst.top}%; left: {burst.left}%;"
    >
      {#each burst.dots as dot, d (d)}
        <span
          class="fireworks-effect__dot"
          style="background: {dot.color}; --dx: {dot.dx}px; --dy: {dot.dy}px; animation-delay: {burst.delay}s"
        ></span>
      {/each}
    </div>
  {/each}
</div>
```

`src/components/effects/FireworksEffect.css`:

```css
/* src/components/effects/FireworksEffect.css */

.fireworks-effect {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.fireworks-effect__burst {
  position: absolute;
  width: 0;
  height: 0;
}

.fireworks-effect__dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation-name: fireworkBurst;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
  animation-duration: 900ms;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/test/ConfettiEffect.test.ts src/test/ShootingStarsEffect.test.ts src/test/FireworksEffect.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add src/styles/global.css src/components/effects src/test/ConfettiEffect.test.ts src/test/ShootingStarsEffect.test.ts src/test/FireworksEffect.test.ts
git commit -m "feat: add hand-rolled confetti/shooting-stars/fireworks splash effects"
```

---

### Task 7: `TextScreen` component

**Files:**
- Create: `src/components/TextScreen.svelte`
- Create: `src/components/TextScreen.css`
- Test: `src/test/TextScreen.test.ts`

**Interfaces:**
- Consumes: `ScreenHero` (Task 5), `MarkdownText` (existing, `src/components/MarkdownText.svelte`).
- Produces: `<TextScreen image? title text margin?>` — consumed by `RouteScreen.svelte` (Task 10).

- [ ] **Step 1: Write the failing tests**

Create `src/test/TextScreen.test.ts`:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import TextScreen from "../components/TextScreen.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

test("renders the title and markdown text", () => {
  render(TextScreen, { props: { title: "Welcome", text: "Hello **world**" } });
  expect(screen.getByText("Welcome")).toBeInTheDocument();
  expect(screen.getByText("world")).toBeInTheDocument();
});

test("applies the margin style to the text body when given", () => {
  const { container } = render(TextScreen, {
    props: { title: "Welcome", text: "Hi", margin: "1rem 2rem" },
  });
  const body = container.querySelector(".text-screen__body") as HTMLElement;
  expect(body.style.margin).toBe("1rem 2rem");
});

test("has no inline margin style when margin is absent", () => {
  const { container } = render(TextScreen, { props: { title: "Welcome", text: "Hi" } });
  const body = container.querySelector(".text-screen__body") as HTMLElement;
  expect(body.getAttribute("style")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/TextScreen.test.ts`
Expected: FAIL — component doesn't exist

- [ ] **Step 3: Implement `src/components/TextScreen.svelte`**

```svelte
<script lang="ts">
  import ScreenHero from "./ScreenHero.svelte";
  import MarkdownText from "./MarkdownText.svelte";
  import "./TextScreen.css";

  let {
    image,
    title,
    text,
    margin,
  }: { image?: string; title: string; text: string; margin?: string } = $props();
</script>

<div class="text-screen">
  <ScreenHero {image} {title} />
  <div class="text-screen__body" style={margin ? `margin: ${margin}` : undefined}>
    <MarkdownText {text} />
  </div>
</div>
```

- [ ] **Step 4: Implement `src/components/TextScreen.css`**

```css
/* src/components/TextScreen.css */

.text-screen {
  background: var(--color-background);
}

.text-screen__body {
  padding: 16px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/TextScreen.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/TextScreen.svelte src/components/TextScreen.css src/test/TextScreen.test.ts
git commit -m "feat: add TextScreen route entry template"
```

---

### Task 8: `SplashScreen` component

**Files:**
- Create: `src/components/SplashScreen.svelte`
- Create: `src/components/SplashScreen.css`
- Test: `src/test/SplashScreen.test.ts`

**Interfaces:**
- Consumes: `ConfettiEffect`/`ShootingStarsEffect`/`FireworksEffect` (Task 6), `fetchImage`/`getCachedImageUrl` from `AssetManager` (existing), `SplashShader`/`SplashEffectName`/`SplashAnchor` types (Task 1).
- Produces: `<SplashScreen image title shader? effect? anchor? playEffect entryKey onEffectPlayed?>` — consumed by `RouteScreen.svelte` (Task 10). `playEffect: boolean` and `entryKey: number` are supplied by the caller (computed from `splashEffectHistory`, Task 4) — `SplashScreen` itself holds no cross-visit state.

- [ ] **Step 1: Write the failing tests**

Create `src/test/SplashScreen.test.ts`:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import SplashScreen from "../components/SplashScreen.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

test("renders the title", () => {
  render(SplashScreen, {
    props: { image: "x.jpg", title: "You Found It!", entryKey: 1, playEffect: false },
  });
  expect(screen.getByText("You Found It!")).toBeInTheDocument();
});

test("applies the grayscale shader class", () => {
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", shader: "grayscale", entryKey: 1, playEffect: false },
  });
  expect(container.querySelector(".splash-screen")).toHaveClass("splash-screen--grayscale");
});

test("renders a vignette overlay for the vignette shader", () => {
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", shader: "vignette", entryKey: 1, playEffect: false },
  });
  expect(container.querySelector(".splash-screen__overlay--vignette")).toBeInTheDocument();
});

test("plays the confetti effect and reports it fired when playEffect is true", () => {
  const onEffectPlayed = vi.fn();
  const { container } = render(SplashScreen, {
    props: {
      image: "x.jpg",
      title: "T",
      effect: "confetti",
      entryKey: 1,
      playEffect: true,
      onEffectPlayed,
    },
  });
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();
  expect(onEffectPlayed).toHaveBeenCalledTimes(1);
});

test("does not play the effect when playEffect is false", () => {
  const onEffectPlayed = vi.fn();
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", effect: "confetti", entryKey: 1, playEffect: false, onEffectPlayed },
  });
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
  expect(onEffectPlayed).not.toHaveBeenCalled();
});

test("re-fires the effect when entryKey changes and playEffect is true again", async () => {
  const onEffectPlayed = vi.fn();
  const { rerender } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", effect: "confetti", entryKey: 1, playEffect: true, onEffectPlayed },
  });
  expect(onEffectPlayed).toHaveBeenCalledTimes(1);
  await rerender({ image: "x.jpg", title: "T2", effect: "confetti", entryKey: 4, playEffect: true, onEffectPlayed });
  expect(onEffectPlayed).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/SplashScreen.test.ts`
Expected: FAIL — component doesn't exist

- [ ] **Step 3: Implement `src/components/SplashScreen.svelte`**

```svelte
<script lang="ts">
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
  import ConfettiEffect from "./effects/ConfettiEffect.svelte";
  import ShootingStarsEffect from "./effects/ShootingStarsEffect.svelte";
  import FireworksEffect from "./effects/FireworksEffect.svelte";
  import type { SplashShader, SplashEffectName, SplashAnchor } from "../types/data";
  import "./SplashScreen.css";

  let {
    image,
    title,
    shader = "none",
    effect = undefined,
    anchor = { horizontal: "center", vertical: "center" },
    playEffect = false,
    entryKey,
    onEffectPlayed = undefined,
  }: {
    image: string;
    title: string;
    shader?: SplashShader;
    effect?: SplashEffectName;
    anchor?: SplashAnchor;
    playEffect?: boolean;
    entryKey: number;
    onEffectPlayed?: () => void;
  } = $props();

  let bgSrc = $state<string | null>(null);
  let showEffect = $state(false);

  $effect.pre(() => {
    bgSrc = getCachedImageUrl(image) ?? null;
  });

  $effect(() => {
    if (getCachedImageUrl(image)) {
      return undefined;
    }
    let cancelled = false;
    fetchImage(image).then((url) => {
      if (!cancelled) {
        bgSrc = url;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  // entryKey (the array index this instance currently displays) is read here
  // purely to force this effect to re-run every time the caller swaps in a
  // different splash entry — in carousel/peek swipe mode a single SplashScreen
  // instance is reused across many different entries via prop changes rather
  // than being remounted, so re-triggering must be keyed off entry identity,
  // not component lifecycle.
  $effect(() => {
    const key = entryKey;
    if (playEffect && effect) {
      showEffect = true;
      onEffectPlayed?.();
    } else {
      showEffect = false;
    }
  });
</script>

<div
  class="splash-screen"
  class:splash-screen--grayscale={shader === "grayscale"}
  class:splash-screen--duotone={shader === "duotone"}
  style={bgSrc ? `background-image: url(${bgSrc})` : undefined}
>
  {#if shader === "vignette"}
    <div class="splash-screen__overlay splash-screen__overlay--vignette"></div>
  {:else if shader === "darken"}
    <div class="splash-screen__overlay splash-screen__overlay--darken"></div>
  {/if}

  {#if showEffect}
    {#if effect === "confetti"}
      <ConfettiEffect />
    {:else if effect === "shooting-stars"}
      <ShootingStarsEffect />
    {:else if effect === "fireworks"}
      <FireworksEffect />
    {/if}
  {/if}

  <div
    class="splash-screen__title-wrap"
    class:splash-screen__title-wrap--h-left={anchor.horizontal === "left"}
    class:splash-screen__title-wrap--h-right={anchor.horizontal === "right"}
    class:splash-screen__title-wrap--v-top={anchor.vertical === "top"}
    class:splash-screen__title-wrap--v-bottom={anchor.vertical === "bottom"}
  >
    <h1 class="splash-screen__title">{title}</h1>
  </div>
</div>
```

- [ ] **Step 4: Implement `src/components/SplashScreen.css`**

```css
/* src/components/SplashScreen.css */

.splash-screen {
  position: relative;
  width: 100%;
  min-height: 400px;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-color: var(--color-background);
  overflow: hidden;
}

.splash-screen--grayscale {
  filter: grayscale(1);
}

.splash-screen--duotone {
  filter: grayscale(1) sepia(1) hue-rotate(320deg) saturate(3);
}

.splash-screen__overlay {
  position: absolute;
  inset: 0;
}

.splash-screen__overlay--darken {
  background: rgba(0, 0, 0, 0.45);
}

.splash-screen__overlay--vignette {
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.65) 100%);
}

.splash-screen__title-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.splash-screen__title-wrap--h-left {
  justify-content: flex-start;
}

.splash-screen__title-wrap--h-right {
  justify-content: flex-end;
}

.splash-screen__title-wrap--v-top {
  align-items: flex-start;
}

.splash-screen__title-wrap--v-bottom {
  align-items: flex-end;
}

.splash-screen__title {
  font-size: var(--font-size-3xl);
  font-weight: 800;
  color: #fff;
  text-align: center;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  margin: 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/SplashScreen.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/SplashScreen.svelte src/components/SplashScreen.css src/test/SplashScreen.test.ts
git commit -m "feat: add SplashScreen route entry template"
```

---

### Task 9: `OptionsScreen` component

**Files:**
- Create: `src/components/OptionsScreen.svelte`
- Create: `src/components/OptionsScreen.css`
- Test: `src/test/OptionsScreen.test.ts`

**Interfaces:**
- Consumes: `ScreenHero` (Task 5), `OptionTarget` type (Task 1), `push` from `svelte-spa-router` (existing).
- Produces: `<OptionsScreen image? title options project city route>` — consumed by `RouteScreen.svelte` (Task 10).

- [ ] **Step 1: Write the failing tests**

Create `src/test/OptionsScreen.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import OptionsScreen from "../components/OptionsScreen.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("svelte-spa-router", () => ({ push: pushMock }));

const baseProps = { project: "demo", city: "new_york", route: "brooklyn_route" };

beforeEach(() => {
  pushMock.mockClear();
  localStorage.clear();
});

test("renders the title and each option's text", () => {
  render(OptionsScreen, {
    props: {
      ...baseProps,
      title: "Where next?",
      options: [
        { text: "Go home", target: { type: "page", value: "title" } },
        { text: "Visit our site", target: { type: "link", value: "https://example.org" } },
      ],
    },
  });
  expect(screen.getByText("Where next?")).toBeInTheDocument();
  expect(screen.getByText("Go home")).toBeInTheDocument();
  expect(screen.getByText("Visit our site")).toBeInTheDocument();
});

test("renders a link-type option as a real external anchor", () => {
  render(OptionsScreen, {
    props: {
      ...baseProps,
      title: "T",
      options: [{ text: "Visit our site", target: { type: "link", value: "https://example.org" } }],
    },
  });
  const link = screen.getByText("Visit our site").closest("a");
  expect(link).toHaveAttribute("href", "https://example.org");
  expect(link).toHaveAttribute("target", "_blank");
});

test("navigates to the city page for target value 'title'", async () => {
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "title" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york");
});

test("navigates to the project page for target value 'project'", async () => {
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "project" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(pushMock).toHaveBeenCalledWith("/demo");
});

test("navigates to the gallery page for target value 'gallery'", async () => {
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "gallery" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york/gallery");
});

test("clears the saved route position and restarts for target value 'start_route'", async () => {
  localStorage.setItem("demo/new_york/brooklyn_route", "6");
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "start_route" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(localStorage.getItem("demo/new_york/brooklyn_route")).toBeNull();
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york/brooklyn_route");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/OptionsScreen.test.ts`
Expected: FAIL — component doesn't exist

- [ ] **Step 3: Implement `src/components/OptionsScreen.svelte`**

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import ScreenHero from "./ScreenHero.svelte";
  import type { OptionTarget } from "../types/data";
  import "./OptionsScreen.css";

  let {
    image,
    title,
    options,
    project,
    city,
    route,
  }: {
    image?: string;
    title: string;
    options: Array<{ text: string; target: OptionTarget }>;
    project: string;
    city: string;
    route: string;
  } = $props();

  function handlePageSelect(value: "title" | "project" | "start_route" | "gallery") {
    if (value === "title") {
      push(`/${project}/${city}`);
    } else if (value === "project") {
      push(`/${project}`);
    } else if (value === "gallery") {
      push(`/${project}/${city}/gallery`);
    } else {
      localStorage.removeItem(`${project}/${city}/${route}`);
      push(`/${project}/${city}/${route}`);
    }
  }
</script>

<div class="options-screen">
  <ScreenHero {image} {title} />
  <div class="options-screen__buttons">
    {#each options as option, i (i)}
      {#if option.target.type === "link"}
        <a
          class="options-screen__button"
          href={option.target.value}
          target="_blank"
          rel="noopener noreferrer"
        >
          {option.text}
        </a>
      {:else}
        <button
          class="options-screen__button"
          type="button"
          onclick={() => handlePageSelect(option.target.value)}
        >
          {option.text}
        </button>
      {/if}
    {/each}
  </div>
</div>
```

- [ ] **Step 4: Implement `src/components/OptionsScreen.css`**

```css
/* src/components/OptionsScreen.css */

.options-screen {
  background: var(--color-background);
}

.options-screen__buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.options-screen__button {
  display: block;
  text-align: center;
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: var(--color-accent);
  color: #000;
  font-size: var(--font-size-base);
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/OptionsScreen.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/OptionsScreen.svelte src/components/OptionsScreen.css src/test/OptionsScreen.test.ts
git commit -m "feat: add OptionsScreen route entry template"
```

---

### Task 10: `RouteScreen` dispatcher component

**Files:**
- Create: `src/components/RouteScreen.svelte`
- Test: `src/test/RouteScreen.test.ts`

**Interfaces:**
- Consumes: `ChallengeCard` (existing), `TextScreen`/`SplashScreen`/`OptionsScreen` (Tasks 7-9), `isLocationEntry` (Task 1, for reference only — not required inside this component since the template-type check happens directly on `entry`), `shouldFireEffect` (Task 4), `RouteEntry`/`EffectHistory` types.
- Produces: `<RouteScreen entry index isLast? routeId? cityId? project? storeFormsInLocalStorage? allowResubmit? badgeStatus? onFormStatusChange? splashEffectHistory? onSplashEffectPlayed?>` — consumed by `RoutePage.svelte` (Task 11).

- [ ] **Step 1: Write the failing tests**

Create `src/test/RouteScreen.test.ts`:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import RouteScreen from "../components/RouteScreen.svelte";

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
vi.mock("svelte-spa-router", () => ({ push: vi.fn() }));

const location = {
  title: "Binnenhof",
  name: { value: "Binnenhof" },
  coordinates: { latitude: 52.08, longitude: 4.31 },
  storyline: "s",
  breadcrumb: "b",
  challenge: { name: "", description: "d", form: [] },
};

test("renders ChallengeCard for a location entry", () => {
  render(RouteScreen, { props: { entry: location as any, index: 1 } });
  expect(screen.getByText("Binnenhof")).toBeInTheDocument();
  expect(screen.getByTestId("location-badge")).toHaveTextContent("1");
});

test("renders TextScreen for a text entry", () => {
  render(RouteScreen, {
    props: { entry: { "template-type": "text", title: "Intro", text: "hi" } as any, index: 2 },
  });
  expect(screen.getByText("Intro")).toBeInTheDocument();
});

test("renders OptionsScreen for an options entry", () => {
  render(RouteScreen, {
    props: {
      entry: {
        "template-type": "options",
        title: "Pick one",
        options: [{ text: "Go", target: { type: "page", value: "title" } }],
      } as any,
      index: 3,
      project: "demo",
      cityId: "new_york",
      routeId: "brooklyn_route",
    },
  });
  expect(screen.getByText("Pick one")).toBeInTheDocument();
  expect(screen.getByText("Go")).toBeInTheDocument();
});

test("renders SplashScreen for a splash entry and reports the effect firing", () => {
  const onSplashEffectPlayed = vi.fn();
  const { container } = render(RouteScreen, {
    props: {
      entry: { "template-type": "splash", image: "x.jpg", title: "Yay", effect: "confetti" } as any,
      index: 4,
      splashEffectHistory: {},
      onSplashEffectPlayed,
    },
  });
  expect(screen.getByText("Yay")).toBeInTheDocument();
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();
  expect(onSplashEffectPlayed).toHaveBeenCalledWith(4);
});

test("does not re-report a splash effect that history says already fired without repeat-effect", () => {
  const onSplashEffectPlayed = vi.fn();
  const { container } = render(RouteScreen, {
    props: {
      entry: { "template-type": "splash", image: "x.jpg", title: "Yay", effect: "confetti" } as any,
      index: 4,
      splashEffectHistory: { 4: { count: 1, lastFiredAt: Date.now() } },
      onSplashEffectPlayed,
    },
  });
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
  expect(onSplashEffectPlayed).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/RouteScreen.test.ts`
Expected: FAIL — component doesn't exist

- [ ] **Step 3: Implement `src/components/RouteScreen.svelte`**

```svelte
<script lang="ts">
  import ChallengeCard from "./ChallengeCard.svelte";
  import TextScreen from "./TextScreen.svelte";
  import SplashScreen from "./SplashScreen.svelte";
  import OptionsScreen from "./OptionsScreen.svelte";
  import { shouldFireEffect, type EffectHistory } from "../utils/splashEffectHistory";
  import type { RouteEntry, LocationEntry } from "../types/data";

  let {
    entry,
    index,
    isLast = false,
    routeId = undefined,
    cityId = undefined,
    project = "",
    storeFormsInLocalStorage = true,
    allowResubmit = true,
    badgeStatus = undefined,
    onFormStatusChange = undefined,
    splashEffectHistory = {},
    onSplashEffectPlayed = undefined,
  }: {
    entry: RouteEntry;
    index: number;
    isLast?: boolean;
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
    splashEffectHistory?: EffectHistory;
    onSplashEffectPlayed?: (index: number) => void;
  } = $props();
</script>

{#if entry["template-type"] === "text"}
  <TextScreen image={entry.image} title={entry.title} text={entry.text} margin={entry.margin} />
{:else if entry["template-type"] === "splash"}
  <SplashScreen
    image={entry.image}
    title={entry.title}
    shader={entry.shader}
    effect={entry.effect}
    anchor={entry.anchor}
    playEffect={shouldFireEffect(splashEffectHistory, index, entry["repeat-effect"], Date.now())}
    entryKey={index}
    onEffectPlayed={() => onSplashEffectPlayed?.(index)}
  />
{:else if entry["template-type"] === "options"}
  <OptionsScreen
    image={entry.image}
    title={entry.title}
    options={entry.options}
    project={project}
    city={cityId ?? ""}
    route={routeId ?? ""}
  />
{:else}
  <ChallengeCard
    location={entry as LocationEntry}
    {isLast}
    {index}
    {routeId}
    {cityId}
    {project}
    {storeFormsInLocalStorage}
    {allowResubmit}
    {onFormStatusChange}
    {badgeStatus}
  />
{/if}
```

If `svelte-check` (Task 11's typecheck step) flags the final `{:else}` branch because it can't narrow `entry` down to `LocationEntry` through the cascading `{:else if}` chain, the explicit `as LocationEntry` cast already there is the intended fallback — no further change needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/RouteScreen.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/RouteScreen.svelte src/test/RouteScreen.test.ts
git commit -m "feat: add RouteScreen dispatcher for location/text/splash/options entries"
```

---

### Task 11: Wire `RouteScreen` into `RoutePage`

**Files:**
- Modify: `src/pages/RoutePage.svelte`
- Modify: `src/test/RoutePage.test.ts`

**Interfaces:**
- Consumes: `RouteScreen` (Task 10), `isLocationEntry`/`locationTotal`/`locationOrdinalAt` (Task 1), `recordEffectFired` (Task 4), `RouteEntry` type (Task 1).

- [ ] **Step 1: Replace the `<script>` block in `RoutePage.svelte`**

Replace the entire second `<script lang="ts">` block (`src/pages/RoutePage.svelte:5-299`) with:

```svelte
<script lang="ts">
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
  import { isLocationEntry, locationTotal, locationOrdinalAt } from "../utils/routeEntries";
  import { recordEffectFired, type EffectHistory } from "../utils/splashEffectHistory";
  import { swipe } from "../actions/swipe";
  import { preloadImages } from "../assets/AssetManager";
  import RouteScreen from "../components/RouteScreen.svelte";
  import Toast from "../components/Toast.svelte";
  import type { RoutesData, RouteEntry } from "../types/data";
  import { untrack } from "svelte";
  import "./RoutePage.css";

  let { params }: { params: { project: string; city: string; route: string } } =
    $props();

  let storageKey = $derived(`${params.project}/${params.city}/${params.route}`);
  let routesText = $state<RoutesData | null>(null);
  let routeData = $derived(routesText?.[params.route] ?? null);
  let locationPaths = $derived(
    routeData
      ? routeData.locations.map(
          (id: string) => `projects/${params.project}/${params.city}/${id}`,
        )
      : [],
  );
  let entries = $state<RouteEntry[]>([]);

  // use localStorage to remember the last visited location index for this route
  // we use untrack to avoid svelte warnings
  const _savedIndex = localStorage.getItem(untrack(() => storageKey));
  const _parsedIndex = _savedIndex ? parseInt(_savedIndex, 10) : 0;
  let currentIndex = $state<number>(isNaN(_parsedIndex) ? 0 : _parsedIndex);
  let direction = $state<"next" | "prev">("next");

  let dragOffset = $state(0);
  let isAnimating = $state(false);
  let pendingCommit = $state<"next" | "prev" | null>(null);
  let currentSlotIndex = $state(1); // which of the 3 divs is the "current" slot

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

  $effect(() => {
    const lang = $languageStore.currentLang;
    if (locationPaths.length > 0) {
      loadLocations(lang, locationPaths).then((locs) => {
        entries = locs;
      });
    }
  });

  $effect(() => {
    titleBarStore.set({
      title: params.route.replace(/_/g, " "),
      progress:
        locationTotal(entries) > 0
          ? { current: locationOrdinalAt(entries, currentIndex), total: locationTotal(entries) }
          : null,
      backPath: `/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    localStorage.setItem(storageKey, String(currentIndex));
  });

  $effect(() => {
    if (entries.length > 0) {
      const images = entries.flatMap((entry) => (entry.image ? [entry.image] : []));
      preloadImages(images);
    }
  });

  function handleDragMove(delta: number) {
    if (!isAnimating) {
      if (swipeMode !== "snap") {
        const atStart = currentIndex === 0;
        const atEnd = currentIndex === entries.length - 1;

        if (delta > 0 && atStart) {
          dragOffset = elasticOffset(delta); // elastic resistance — no prev card
        } else if (delta < 0 && atEnd) {
          dragOffset = elasticOffset(delta); // elastic resistance — no next card
        } else {
          dragOffset = delta;
        }
      }
    }
  }

  function handleDragEnd(delta: number) {
    if (!isAnimating) {
      if (swipeMode === "snap") {
        // snap mode: instant index change, no drag animation
        if (delta < -60) {
          if (canAdvance) {
            direction = "next";
            currentIndex = clampedNext(currentIndex, entries.length);
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
        const atEnd = currentIndex === entries.length - 1;
        const goingNext = delta < 0;
        const goingPrev = delta > 0;

        if (goingNext && !atEnd && shouldCommitSwipe(delta, cardWidth)) {
          if (canAdvance) {
            pendingCommit = "next";
            isAnimating = true;
            dragOffset = -cardWidth;
          } else {
            triggerBlockedToast();
            // Only animate a spring-back if there's actually an offset to spring
            // back from (a real drag). A Next-button click never set dragOffset,
            // so it's already 0 here — setting it to 0 again produces no CSS
            // transform change, `transitionend` never fires, and isAnimating
            // would stay stuck true forever, silently no-op'ing every future
            // handleDragEnd call (including the next click).
            if (dragOffset !== 0) {
              isAnimating = true;
              dragOffset = 0;
            }
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

  function handleTransitionEnd(e: TransitionEvent) {
    if (e.propertyName === "transform") {
      isAnimating = false;
      if (pendingCommit === "next") {
        direction = "next";
        currentIndex = clampedNext(currentIndex, entries.length);
        currentSlotIndex = (currentSlotIndex + 1) % 3;
      } else if (pendingCommit === "prev") {
        direction = "prev";
        currentIndex = clampedPrev(currentIndex);
        currentSlotIndex = (currentSlotIndex + 2) % 3;
      }
      pendingCommit = null;
      dragOffset = 0;
    }
  }

  let currentEntry = $derived(entries[currentIndex]);

  let formStatusByIndex = $state<Record<number, { submitted: boolean; missingLabels: string[] }>>({});
  let skippedIndices = $state<Set<number>>(new Set());
  let showToast = $state(false);
  let toastMissingLabels = $state<string[]>([]);
  let splashEffectHistory = $state<EffectHistory>({});

  $effect(() => {
    if (entries.length > 0 && huntSettings.storeFormsInLocalStorage) {
      const restoredStatus: Record<number, { submitted: boolean; missingLabels: string[] }> = {};
      const restoredSkipped = new Set<number>();
      entries.forEach((_entry, i) => {
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
    // This is invoked synchronously from deep inside AppForm's own $effect (via
    // ChallengeForm -> ChallengeCard -> RouteScreen -> here), so a plain
    // `{...formStatusByIndex}` read here gets attributed as a dependency of THAT
    // effect, and the write right after looks like the same effect writing its
    // own dependency — Svelte's infinite-loop guard (effect_update_depth_exceeded)
    // trips on exactly this shape. untrack() keeps the read from being
    // attributed to whichever effect is currently running up the call stack.
    const current = untrack(() => formStatusByIndex);
    formStatusByIndex = { ...current, [locationId]: status };
  }

  function handleSplashEffectPlayed(index: number) {
    // Same untrack() reasoning as handleFormStatusChange above — this fires
    // synchronously from SplashScreen's own $effect.
    const current = untrack(() => splashEffectHistory);
    splashEffectHistory = recordEffectFired(current, index, Date.now());
  }

  function computeBadgeStatus(locationId: number, hasForm: boolean): "submitted" | "skipped" | undefined {
    if (!hasForm) {
      return undefined;
    }
    if (formStatusByIndex[locationId]?.submitted) {
      return "submitted";
    }
    if (skippedIndices.has(locationId)) {
      return "skipped";
    }
    return undefined;
  }

  let currentLocationId = $derived(currentIndex + 1);
  let currentHasForm = $derived(
    currentEntry !== undefined &&
      isLocationEntry(currentEntry) &&
      (currentEntry.challenge.form?.length ?? 0) > 0,
  );
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
      currentIndex = clampedNext(currentIndex, entries.length);
    } else {
      pendingCommit = "next";
      isAnimating = true;
      dragOffset = -cardWidth;
    }
  }

  let swipeMode = $derived($themeStore.theme.swipe.mode);
  let hint = $derived(swipeMode === "snap" ? 0 : $themeStore.theme.swipe.hint);

  let windowWidth = $state(window.innerWidth);
  $effect(() => {
    function onResize() { windowWidth = window.innerWidth; }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });
  let cardWidth = $derived(windowWidth - 2 * hint);
</script>
```

- [ ] **Step 2: Replace the two `<ChallengeCard>` render blocks in the markup**

In the `snap` mode branch (`src/pages/RoutePage.svelte:307-325` in the original), replace:

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

with:

```svelte
        <RouteScreen
          entry={currentEntry}
          isLast={currentIndex === entries.length - 1}
          index={currentIndex + 1}
          routeId={params.route}
          cityId={params.city}
          project={params.project}
          storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
          allowResubmit={huntSettings.allowResubmit}
          onFormStatusChange={handleFormStatusChange}
          badgeStatus={computeBadgeStatus(currentIndex + 1, currentHasForm)}
          {splashEffectHistory}
          onSplashEffectPlayed={handleSplashEffectPlayed}
        />
```

And in the carousel-strip branch, replace the `{#each [0, 1, 2] ...}` block's contents (original `src/pages/RoutePage.svelte:328-361`):

```svelte
      <div class="route-page__strip">
        {#each [0, 1, 2] as slotIdx (slotIdx)}
          {@const roleRaw = (slotIdx - currentSlotIndex + 3) % 3}
          {@const role = roleRaw === 2 ? -1 : roleRaw}
          {@const locIdx = currentIndex + role}
          {@const slotEntry = locIdx >= 0 && locIdx < entries.length ? entries[locIdx] : null}
          {@const translateX = hint + role * cardWidth + dragOffset}
          {#if slotEntry}
            <div
              class="route-page__slot"
              class:route-page__slot--animating={isAnimating}
              style="width: {cardWidth}px; transform: translateX({translateX}px)"
              ontransitionend={role === 0 ? handleTransitionEnd : undefined}
            >
              <RouteScreen
                entry={slotEntry}
                isLast={locIdx === entries.length - 1}
                index={locIdx + 1}
                routeId={params.route}
                cityId={params.city}
                project={params.project}
                storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
                allowResubmit={huntSettings.allowResubmit}
                onFormStatusChange={handleFormStatusChange}
                badgeStatus={computeBadgeStatus(locIdx + 1, isLocationEntry(slotEntry) && (slotEntry.challenge.form?.length ?? 0) > 0)}
                {splashEffectHistory}
                onSplashEffectPlayed={handleSplashEffectPlayed}
              />
            </div>
          {:else}
            <div
              class="route-page__slot route-page__slot--empty"
              style="width: {cardWidth}px; transform: translateX({hint + role * cardWidth}px)"
            ></div>
          {/if}
        {/each}
      </div>
```

Also update the two remaining `locations.length` references in the template's conditional guards (`{#if locations.length > 0 && currentLocation}` and the nav `{#if currentIndex > 0}` / `{#if currentIndex < locations.length - 1}`) to `entries.length` / `currentEntry`.

- [ ] **Step 3: Run the existing RoutePage test suite to confirm no regressions**

Run: `npx vitest run src/test/RoutePage.test.ts src/test/RoutePage.swipe.test.ts`
Expected: PASS — all pre-existing tests pass unchanged (mock `loadLocations` fixtures have no `template-type`, so `isLocationEntry` treats them as locations exactly as before).

- [ ] **Step 4: Add mixed-entry tests to `src/test/RoutePage.test.ts`**

Add near the top of the file, alongside the existing `mockLocations` fixture in the `vi.hoisted` block:

```ts
const { mockLocations, mockMixedEntries, huntSettingsFixture } = vi.hoisted(() => ({
  mockLocations: [ /* ...unchanged, keep the existing two-item array... */ ],
  mockMixedEntries: [
    {
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
    },
    { "template-type": "text", title: "Between Stops", text: "Take a breath." },
    {
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
    },
    {
      "template-type": "options",
      title: "The End",
      options: [{ text: "Start over", target: { type: "page", value: "start_route" } }],
    },
  ],
  huntSettingsFixture: {} as Record<string, unknown>,
}));
```

(Keep the rest of the existing `mockLocations` array contents exactly as they are today — only add the new `mockMixedEntries` sibling.)

Then append these tests at the end of the file:

```ts
test("counts only location entries in the progress indicator, holding steady through template screens", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as any);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  let progress: { current: number; total: number } | null = null;
  titleBarStore.subscribe((s) => (progress = s.progress))();
  expect(progress).toEqual({ current: 1, total: 2 });

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i })); // -> text screen (index 1)
  await screen.findByText("Between Stops");
  titleBarStore.subscribe((s) => (progress = s.progress))();
  expect(progress).toEqual({ current: 1, total: 2 }); // holds at last location's ordinal
});

test("renders TextScreen and OptionsScreen entries within a route", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as any);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Between Stops")).toBeInTheDocument();
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("The End")).toBeInTheDocument();
  expect(await screen.findByText("Start over")).toBeInTheDocument();
});

test("does not render a numbered badge for template-type screens", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as any);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Between Stops");
  expect(screen.queryByTestId("location-badge")).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Run the full RoutePage test file**

Run: `npx vitest run src/test/RoutePage.test.ts`
Expected: PASS — all existing tests plus the 3 new ones.

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm run test:run && npm run typecheck`
Expected: all green. If `svelte-check` reports a narrowing issue on `RouteScreen.svelte`'s final `{:else}` branch, apply the `as LocationEntry` fallback noted in Task 10 Step 3 (it's already in the code above — this step is just confirming no other new type errors were introduced).

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/RoutePage.svelte src/test/RoutePage.test.ts
git commit -m "feat: dispatch route entries through RouteScreen and count only locations in progress"
```

---

### Task 12: Demo content — one of each template type, wired into a real route

**Files:**
- Create: `src/data/text/en/projects/demo/new_york/031_splash_brooklyn_checkpoint.yaml`
- Create: `src/data/text/en/projects/demo/new_york/032_text_dumbo_intro.yaml`
- Create: `src/data/text/en/projects/demo/new_york/033_options_end_of_route.yaml`
- Modify: `src/data/text/en/projects/demo/new_york/routes.yaml`

- [ ] **Step 1: Create the splash entry**

`src/data/text/en/projects/demo/new_york/031_splash_brooklyn_checkpoint.yaml`:

```yaml
template-type: splash
image: placeholder.jpg
shader: duotone
effect: confetti
repeat-effect:
  cooldown: 20
  max: 3
title: "You Made It Across!"
anchor:
  horizontal: center
  vertical: bottom
```

- [ ] **Step 2: Create the text entry**

`src/data/text/en/projects/demo/new_york/032_text_dumbo_intro.yaml`:

```yaml
template-type: text
image: placeholder.jpg
title: "Welcome to DUMBO"
text: |
  Down Under the Manhattan Bridge Overpass — once a gritty industrial
  waterfront, now one of Brooklyn's most photographed neighborhoods. Take
  a breath before the next stop.
margin: "0 1.5rem"
```

- [ ] **Step 3: Create the options entry**

`src/data/text/en/projects/demo/new_york/033_options_end_of_route.yaml`:

```yaml
template-type: options
image: placeholder.jpg
title: "You've Reached the End!"
options:
  - text: "Back to Brooklyn's routes"
    target: { type: page, value: title }
  - text: "See all New York routes"
    target: { type: page, value: project }
  - text: "Walk it again"
    target: { type: page, value: start_route }
  - text: "Browse the photo gallery"
    target: { type: page, value: gallery }
```

- [ ] **Step 4: Wire the three new entries into `brooklyn_route`**

In `src/data/text/en/projects/demo/new_york/routes.yaml`, replace the `brooklyn_route` block with:

```yaml
brooklyn_route:
  description: "A route across the Brooklyn Bridge and along the waterfront to Coney Island — 10 stops."
  locations:
    - 021_loc_brooklyn_bridge
    - 031_splash_brooklyn_checkpoint
    - 022_loc_south_street_seaport
    - 023_loc_brooklyn_bridge_park
    - 032_text_dumbo_intro
    - 024_loc_dumbo
    - 025_loc_brooklyn_heights_promenade
    - 026_loc_domino_park
    - 027_loc_williamsburg_waterfront
    - 028_loc_prospect_park
    - 029_loc_brooklyn_museum
    - 030_loc_coney_island
    - 033_options_end_of_route
```

- [ ] **Step 5: Validate the new content**

Run: `npm run validate:yaml`
Expected: exits 0, no errors.

- [ ] **Step 6: Manual QA in the browser**

Run: `npm run dev`, then in a browser:
1. Log in / navigate to the `demo` project → `new_york` city → `brooklyn_route`.
2. Confirm the progress indicator reads "1 of 10" on the first location (`021_loc_brooklyn_bridge`), not "1 of 12".
3. Swipe/click Next past `021_loc_brooklyn_bridge` — confirm the splash screen appears full-bleed with the duotone filter, title anchored bottom-center, and confetti plays once.
4. Continue forward, swipe back onto the splash screen again within 20 seconds — confirm confetti does NOT replay (cooldown). Wait past 20s (or re-test with a shorter cooldown temporarily) and confirm it replays, up to 3 times total.
5. Continue to `032_text_dumbo_intro` — confirm the markdown body renders with the configured margin.
6. Continue to the very end — confirm the options screen renders 4 buttons; click "Walk it again" and confirm the route restarts at `021_loc_brooklyn_bridge` (progress "1 of 10"), not wherever you left off.
7. Confirm the progress indicator never counted the splash/text/options screens toward the "of 10" total anywhere in the walkthrough.

- [ ] **Step 7: Commit**

```bash
git add src/data/text/en/projects/demo/new_york/031_splash_brooklyn_checkpoint.yaml src/data/text/en/projects/demo/new_york/032_text_dumbo_intro.yaml src/data/text/en/projects/demo/new_york/033_options_end_of_route.yaml src/data/text/en/projects/demo/new_york/routes.yaml
git commit -m "feat: add demo splash/text/options screens to the Brooklyn route"
```

---

### Task 13: Update `doc/architecture.md`

**Files:**
- Modify: `doc/architecture.md`

- [ ] **Step 1: Document the new data model**

Add a new subsection right after the existing `projects/<projectId>/<cityId>/<locationId>.yaml` — Location detail section (after the line ending `...Reference: src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml is the canonical complete example.`):

```markdown
### Route entry templates (`template-type`)

A route's `locations` list can mix ordinary locations with non-location screens. Every entry file has an optional `template-type` field — absent (or `"location"`) means the existing location shape above; three other values render a different template instead:

| `template-type` | File pattern | Renders |
|---|---|---|
| `text` | `NNN_text_<slug>.yaml` | Top image (optional) + centered title + markdown body |
| `splash` | `NNN_splash_<slug>.yaml` | Full-bleed image with an optional CSS shader/overlay, anchored title, optional one-shot entrance effect |
| `options` | `NNN_options_<slug>.yaml` | Top image (optional) + centered title + a list of buttons, each linking externally or navigating to a named in-app screen |

Existing `NNN_loc_*.yaml` files are unaffected. Each template type has its own JSON Schema in `src/data/schemas/` (`text.schema.json`, `splash.schema.json`, `options.schema.json`), validated the same three ways as location/form YAML (IDE via `.vscode/settings.json`, CI via `npm run validate:yaml`).

`RouteEntry` (`src/types/data.ts`) is the discriminated union of all four shapes. `loadLocations.ts` passes non-location entries through unresolved (no `challenge.form` to resolve); `RoutePage.svelte` renders each entry via a new `RouteScreen.svelte` dispatcher, which picks `ChallengeCard`/`TextScreen`/`SplashScreen`/`OptionsScreen` based on `template-type`.

Only `location`-type entries count toward the route's progress indicator ("N of M") and get a numbered badge — `src/utils/routeEntries.ts`'s `locationTotal`/`locationOrdinalAt` compute this separately from the raw array index used for swipe navigation and localStorage keys. While viewing a template screen, the progress indicator holds at the last-passed location's number.

Splash screen entrance effects (`confetti | shooting-stars | fireworks`, `src/components/effects/`) are hand-rolled CSS, no animation library. `repeat-effect: { cooldown, max }` controls whether the effect replays on re-entering the same screen; the fire-count/last-fired state lives in `RoutePage`'s `splashEffectHistory` (`src/utils/splashEffectHistory.ts`), not inside `SplashScreen` itself, since carousel/peek swipe mode reuses one component instance across many different entries via prop changes rather than remounting per entry.

The admin editor does not yet support authoring these template types — they're hand-authored YAML for now, same validation safety net as locations.
```

- [ ] **Step 2: Add the new components to the File Structure listing**

In the `components/` section of the file tree (`doc/architecture.md:38-45`), add:

```
    RouteScreen.svelte  — Dispatches a route entry to ChallengeCard/TextScreen/SplashScreen/OptionsScreen by template-type
    TextScreen.svelte   — Route entry template: top image + title + markdown
    SplashScreen.svelte — Route entry template: full-bleed image, shader/overlay, anchored title, entrance effect
    OptionsScreen.svelte — Route entry template: top image + title + navigation buttons
    ScreenHero.svelte   — Shared top-image component used by TextScreen/OptionsScreen
    effects/            — ConfettiEffect, ShootingStarsEffect, FireworksEffect (hand-rolled CSS)
```

And in the `utils/` section, add:

```
    routeEntries.ts     — isLocationEntry/locationTotal/locationOrdinalAt — location-vs-template discrimination
    splashEffectHistory.ts — shouldFireEffect/recordEffectFired — splash entrance-effect cooldown/repeat tracking
```

- [ ] **Step 3: Commit**

```bash
git add doc/architecture.md
git commit -m "docs: document route entry templates in architecture.md"
```

---

### Task 14: Devlog entry

**Files:**
- Modify: `doc/devlog/_devlog.md`

- [ ] **Step 1: Add the entry**

Prepend to the `## Entries:` section of `doc/devlog/_devlog.md`, above the most recent entry:

```markdown
**26/07/2026, Claude**: [FEATURE] Route entry templates — text/splash/options screens alongside locations, via `template-type`.
- Spec + 14-task plan: `doc/superpowers/specs/2026-07-26-route-entry-templates-design.md`, `doc/superpowers/plans/2026-07-26-route-entry-templates.md`.
- New `RouteEntry` discriminated union (`src/types/data.ts`), `RouteScreen.svelte` dispatcher, `TextScreen`/`SplashScreen`/`OptionsScreen`/`ScreenHero` components, hand-rolled confetti/shooting-stars/fireworks effects (no new dependency).
- Only `location`-type entries count toward the route progress indicator/badge numbering (`routeEntries.ts`); splash entrance-effect cooldown/repeat state lives in `RoutePage` (`splashEffectHistory.ts`) since carousel swipe mode reuses component instances across entries rather than remounting.
- New JSON schemas + `validate-yaml.js`/`.vscode/settings.json` wiring for `NNN_text_*`/`NNN_splash_*`/`NNN_options_*.yaml` naming.
- Admin editor UI support explicitly deferred — these templates are hand-authored YAML for now.
```

- [ ] **Step 2: Commit**

```bash
git add doc/devlog/_devlog.md
git commit -m "docs: add devlog entry for route entry templates"
```
