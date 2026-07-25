# DA Content by Reference in the Demo Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Rewritten:** this plan previously copied DA's content into a second project (`democrats_abroad_demo`). It now adds `den_haag`/`oslo` as two more cities inside the single `demo` project, resolved by reference — see `doc/superpowers/specs/2026-07-25-demo-da-content-mirror-design.md` for why.
>
> **Prerequisites:** `doc/superpowers/plans/2026-07-25-form-submit-routing-safety.md` (project-aware form-submit must exist first) **and** `doc/superpowers/plans/2026-07-25-demo-project-content.md` (creates `demo/cities.yaml`, which this plan appends to) must both be implemented first.

**Goal:** Make `den_haag` and `oslo` reachable as cities under the `demo` project, reading DA's real content files live rather than duplicating them.

**Architecture:** A path-alias table inside `src/utils/loadText.ts`, checked before every content lookup. Two new entries in `demo/cities.yaml`. No new files under `demo/den_haag/` or `demo/oslo/` — none are needed.

**Tech Stack:** Existing stack — TypeScript, Vitest, the app's existing `import.meta.glob`-based YAML loading.

## Global Constraints

- The alias must match on a full path-segment boundary (`projects/demo/den_haag` followed by end-of-string or `/`), never a bare string prefix — a path like `projects/demo/den_haag_something_else` (hypothetical, doesn't exist today, but the matching logic must not assume it can't) must NOT be aliased.
- Only `den_haag` and `oslo` prefixes are aliased. `projects/demo/demo`, `projects/demo/cities`, and anything under `projects/demo/paris`/`projects/demo/new_york` must resolve completely unaliased.
- No files are created under `src/data/text/en/projects/demo/den_haag/` or `.../oslo/` — if this plan's implementation creates any, that's a sign the alias isn't working and content is being duplicated instead of referenced, which defeats the point.

---

### Task 1: Path-alias resolution in `loadText.ts`

**Files:**
- Modify: `src/utils/loadText.ts`
- Test: `src/test/loadText.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change to `loadText(lang, path)` — the alias is internal; callers (`CityPage.svelte`, `RoutePage.svelte`, `ProjectPage.svelte`, `loadLocations.ts`) need no changes at all.

- [ ] **Step 1: Write the failing tests**

`src/test/loadText.test.ts` currently tests `loadLocations` (via a mocked `loadText`) — check whether it also has direct `loadText` tests; if not, this is the first. Since `loadText` uses `import.meta.glob`, which Vitest resolves against the real file tree, these tests can run against real content already in the repo (`democrats_abroad/den_haag/den_haag.yaml` exists today):

```ts
import { loadText } from "../utils/loadText";

describe("loadText content aliasing", () => {
  it("resolves projects/demo/den_haag/den_haag to democrats_abroad's real content", async () => {
    const aliased = await loadText("en", "projects/demo/den_haag/den_haag");
    const real = await loadText("en", "projects/democrats_abroad/den_haag/den_haag");
    expect(aliased).toEqual(real);
    expect(aliased).not.toBeNull();
  });

  it("resolves projects/demo/den_haag/routes to democrats_abroad's real routes", async () => {
    const aliased = await loadText("en", "projects/demo/den_haag/routes");
    const real = await loadText("en", "projects/democrats_abroad/den_haag/routes");
    expect(aliased).toEqual(real);
  });

  it("resolves an oslo location path by reference", async () => {
    const aliased = await loadText("en", "projects/demo/oslo/oslo");
    const real = await loadText("en", "projects/democrats_abroad/oslo/oslo");
    expect(aliased).toEqual(real);
    expect(aliased).not.toBeNull();
  });

  it("does not alias projects/demo/demo (the project's own metadata file)", async () => {
    // demo/demo.yaml is created by the demo-project-content plan; this
    // should NOT resolve to democrats_abroad/democrats_abroad.yaml
    const result = await loadText("en", "projects/demo/demo");
    const wronglyAliased = await loadText("en", "projects/democrats_abroad/democrats_abroad");
    expect(result).not.toEqual(wronglyAliased);
  });

  it("does not alias projects/demo/paris paths", async () => {
    // paris content exists from the demo-project-content plan; confirm it
    // resolves to itself, not to some democrats_abroad path
    const result = await loadText("en", "projects/demo/paris/paris");
    expect(result).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/test/loadText.test.ts -t "content aliasing"`
Expected: FAIL — the `den_haag`/`oslo` aliased lookups currently return `null` (no file exists at `projects/demo/den_haag/...` today).

- [ ] **Step 3: Implement the alias**

In `src/utils/loadText.ts`:

```ts
type YamlModules = Record<string, () => Promise<{ default: unknown }>>;

const modules = import.meta.glob("../data/text/**/*.yaml") as YamlModules;

const CONTENT_ALIASES: Record<string, string> = {
  "projects/demo/den_haag": "projects/democrats_abroad/den_haag",
  "projects/demo/oslo": "projects/democrats_abroad/oslo",
};

function resolveAliasedPath(path: string): string {
  for (const [alias, target] of Object.entries(CONTENT_ALIASES)) {
    if (path === alias || path.startsWith(`${alias}/`)) {
      return target + path.slice(alias.length);
    }
  }
  return path;
}

export async function loadText<T = Record<string, unknown>>(
  lang: string,
  path: string,
): Promise<T | null> {
  const resolvedPath = resolveAliasedPath(path);
  const key = `../data/text/${lang}/${resolvedPath}.yaml`;
  const loader = modules[key];
  if (!loader) {
    return null;
  }
  try {
    const mod = await loader();
    return mod.default as T;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/loadText.test.ts`
Expected: PASS — all new alias tests, plus the pre-existing `loadLocations` tests in the same file (which mock `loadText` entirely and are unaffected by this internal change).

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: PASS — confirms no other consumer of `loadText` (ProjectPage, CityPage, RoutePage, the editor pages) broke. The editor's location-loading goes through a completely separate path (`fetchEditorLocations` → GitHub API, not `loadText`), so it's unaffected regardless.

- [ ] **Step 6: Commit**

```bash
git add src/utils/loadText.ts src/test/loadText.test.ts
git commit -m "feat: alias demo/den_haag and demo/oslo content to democrats_abroad's real files"
```

---

### Task 2: List `den_haag` and `oslo` in `demo/cities.yaml`

**Files:**
- Modify: `src/data/text/en/projects/demo/cities.yaml`

**Interfaces:** none — content only.

- [ ] **Step 1: Read the current DA `cities.yaml` entry to copy from**

The real `den_haag` entry to copy is already in `src/data/text/en/projects/democrats_abroad/cities.yaml`:
```yaml
  - id: den_haag
    name: "Den Haag"
    image: den-haag-logo.jpg
    country: "Netherlands"
    description: "The seat of Dutch government and international justice."
    coordinates:
      longitude: 4.3133
      latitude: 52.0799
```
And the commented-out `oslo` entry in the same file:
```yaml
  - id: oslo
    name: "Oslo"
    image: oslo-hero.jpg
    country: "Norway"
    description: "Where democracy was tested, resistance was born, and peace is celebrated every December."
    coordinates:
      latitude: 59.9169
      longitude: 10.7274
```

- [ ] **Step 2: Append both to `demo/cities.yaml`**

Add to the `items` list in `src/data/text/en/projects/demo/cities.yaml` (created by the demo-project-content plan with `paris`/`new_york` already in it):

```yaml
  - id: den_haag
    name: "Den Haag"
    image: den-haag-logo.jpg
    country: "Netherlands"
    description: "The seat of Dutch government and international justice. (Real Democrats Abroad content, shown here for testing.)"
    coordinates:
      longitude: 4.3133
      latitude: 52.0799
  - id: oslo
    name: "Oslo"
    image: oslo-hero.jpg
    country: "Norway"
    description: "Where democracy was tested, resistance was born, and peace is celebrated every December. (Real Democrats Abroad content, shown here for testing.)"
    coordinates:
      latitude: 59.9169
      longitude: 10.7274
```

`oslo` is included uncommented here even though it's disabled in DA's real `cities.yaml` — see the spec's Architecture section for why. The short parenthetical note in each `description` exists so anyone browsing `demo` understands these two cities are real DA content, not synthetic demo content like Paris/New York — unlike `demo/paris`'s and `demo/new_york`'s descriptions, which say nothing of the kind since they don't need to.

- [ ] **Step 3: Validate**

Run: `npm run validate:yaml`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/data/text/en/projects/demo/cities.yaml
git commit -m "feat: list den_haag and oslo as demo project cities"
```

---

### Task 3: Manual verification

**Files:** none — verification only.

- [ ] **Step 1: Confirm no stray files were created**

Run: `ls src/data/text/en/projects/demo/den_haag src/data/text/en/projects/demo/oslo 2>&1`
Expected: both report "No such file or directory" — if either exists, something in Task 1 or 2 went wrong and content was duplicated instead of referenced.

- [ ] **Step 2: Manual smoke test**

Run `npm run dev` (log in via whatever sub-project 4 has shipped, or temporarily bypass auth for local testing per that plan's local dev notes) and confirm:
- `demo`'s city picker shows four cities: `den_haag`, `oslo`, `paris`, `new_york`.
- Opening `den_haag` under `demo` shows the exact same route/location content as opening `den_haag` under the real `democrats_abroad` project (same storyline text, same form).
- Submitting the form on `demo/den_haag`'s `001_loc_abc` succeeds and (per sub-project 1) writes to the `form_submissions` D1 table, not DA's real Google Sheet.

- [ ] **Step 3: No commit** — this task is verification-only; nothing here changes source files unless Step 1 or 2 surfaces a problem, in which case fix it under whichever earlier task it belongs to and re-run this task's checks.
