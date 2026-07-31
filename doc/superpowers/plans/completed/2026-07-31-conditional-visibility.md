# Conditional Visibility (`isVisible`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic `isVisible` conditional-visibility concept to `FormField`, resolved by a new pure `evaluateVisibility` function and wired into `AppForm.svelte`, so a field can show/hide based on another field's answer (same form or cross-form).

**Architecture:** A new type module (`src/types/conditions.ts`) defines the YAML-authored condition shape (`VisibilityConfig`/`ConditionNode`/`Operand`). A new pure resolver module (`src/utils/visibility.ts`, no Svelte dependency) evaluates a `VisibilityConfig` against a context (this form's live values + an optional cross-form lookup) into one of three states: `visible` / `hidden` / `error`. `AppForm.svelte` computes this per field reactively, skips rendering/validation for hidden fields, renders an inline error sentinel (reusing the existing unknown-field-type styling) for malformed conditions, and clears a field's stored value the moment it becomes hidden. A small, already-shipped utility (`parseSourceRef`) needs widening first so the cross-form reference format doesn't need to change again later.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + @testing-library/svelte, existing JSON Schema/Ajv content validation (`scripts/validate-yaml.ts`).

## Global Constraints

- TypeScript only; no `.js`/`.jsx`/`.tsx` under `src/`.
- Svelte 5 runes only (`$state`, `$derived`, `$derived.by`, `$effect`, `$props`) — no `$:`.
- No hardcoded hex colors in component CSS; this plan adds no new CSS (reuses `.af-field--unknown`).
- No new runtime dependency.
- Full spec: `doc/superpowers/specs/2026-07-31-conditional-visibility-design.md`. Every task below implements a specific section of it — re-read the relevant section if a step is unclear.
- `parseSourceRef`'s 3-segment widening (`<location_id>.<form_id>.<field_id>`, formId asserted `"form"` today) is **already shipped** (`src/utils/locationFormLookup.ts`, `src/test/locationFormLookup.test.ts`) — do not redo it; Task 1 builds on top of it.
- `evaluateVisibility`'s production-fallback check must stay an **explicit parameter with a lazily-evaluated default** (`options.isProduction ?? import.meta.env.PROD`), never a module-top-level read of `import.meta.env`. `scripts/validate-yaml.ts` runs under plain `tsx` (not Vite), where `import.meta.env` is `undefined` — if anything in the import chain touches it outside a function body, the CI script crashes. Task 8 imports only the pure YAML-scanning helper from `visibility.ts`, never `evaluateVisibility` itself.

---

### Task 1: Types — `src/types/conditions.ts`

**Files:**
- Create: `src/types/conditions.ts`
- Modify: `src/types/data.ts:18-34` (`FormField` interface)
- Test: none (type-only; verified by `npx tsc --noEmit` and by every later task's tests compiling against these types)

**Interfaces:**
- Produces: `ConditionOperator`, `Operand`, `ConditionLeaf`, `ConditionAny`, `ConditionAll`, `ConditionNot`, `ConditionNode`, `VisibilityConfig`, `VisibilityResult` — all exported from `src/types/conditions.ts`. Every later task imports from here.

- [ ] **Step 1: Create the types file**

```ts
// src/types/conditions.ts
export type ConditionOperator =
  | "=" | "!=" | "<" | "<=" | ">" | ">="
  | "like" | "is null" | "is not null";

// A reference string (bare id / dotted cross-form ref), a literal, or a reserved
// function call whose params are themselves Operands — recursive so a future
// max/min/join-style transform can take a source reference (or another function
// call) as an argument without this type changing again. See design spec §4.3/§5.1.
export type Operand =
  | string
  | number
  | boolean
  | { function: string; params?: Operand[] };

export interface ConditionLeaf {
  source: Operand;
  operator: ConditionOperator;
  value?: Operand;
}

export interface ConditionAny {
  any: ConditionNode[];
}

export interface ConditionAll {
  all: ConditionNode[];
}

export interface ConditionNot {
  not: ConditionNode;
}

export type ConditionNode = ConditionLeaf | ConditionAny | ConditionAll | ConditionNot;

export interface VisibilityConfig {
  initially: "visible" | "hidden" | "conditional";
  condition?: ConditionNode;
  any?: ConditionNode[];
  all?: ConditionNode[];
  not?: ConditionNode;
}

export type VisibilityResult =
  | { status: "visible" }
  | { status: "hidden" }
  | { status: "error"; message: string };
```

- [ ] **Step 2: Add `isVisible` to `FormField`**

In `src/types/data.ts`, add the import and the field:

```ts
import type { VisibilityConfig } from "./conditions";
```

Add `isVisible?: VisibilityConfig;` to the `FormField` interface (after `storeDefaultValue?: boolean;`, before `config?: { lineCount?: number };` — exact position doesn't matter, keep it near the other optional per-field behavior flags).

- [ ] **Step 3: Verify the project still typechecks**

Run: `npx tsc --noEmit`
Expected: 0 errors (this step only adds new optional surface; nothing existing references it yet).

- [ ] **Step 4: Commit**

```bash
git add src/types/conditions.ts src/types/data.ts
git commit -m "feat: add isVisible/VisibilityConfig types for conditional field visibility"
```

---

### Task 2: Broaden `getLocationFormValue` to `unknown`

**Files:**
- Modify: `src/utils/locationFormLookup.ts`
- Modify: `src/components/ChallengeForm.svelte:49-63` (the `sourceValues` resolution loop)
- Test: `src/test/locationFormLookup.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `getLocationFormValue(project, city, route, locationId, fieldId): unknown` (was `string | undefined`). Task 3's resolver depends on this returning raw stored values (booleans/numbers), not just strings.

- [ ] **Step 1: Update the failing/changed tests first**

In `src/test/locationFormLookup.test.ts`, replace the `"returns undefined when the stored value isn't a string"` test (it tested behavior that's moving to the call site) with a test of the new, broader contract:

```ts
  it("returns the raw stored value even when it isn't a string", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, {
      values: { manifesto: 42 },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto"),
    ).toBe(42);
  });

  it("returns a boolean value unchanged", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, {
      values: { agreed: true },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "agreed"),
    ).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify the first one fails**

Run: `npx vitest run src/test/locationFormLookup.test.ts`
Expected: FAIL — `getLocationFormValue(...)` currently returns `undefined` for the non-string case (old narrowing), test expects `42`.

- [ ] **Step 3: Broaden `getLocationFormValue`**

In `src/utils/locationFormLookup.ts`, replace the function body:

```ts
export function getLocationFormValue(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
  fieldId: string,
): unknown {
  const key = buildFormStorageKey(project, city, route, locationId);
  return loadFormState(key).values[fieldId];
}
```

- [ ] **Step 4: Move the string-narrowing into `ChallengeForm.svelte`'s call site**

In `src/components/ChallengeForm.svelte`, the `sourceValues` loop (around line 49) currently does:

```ts
        if (ref) {
          const value = getLocationFormValue(project, cityId, routeId, ref.locationId, ref.fieldId);
          if (value !== undefined) {
            result[field.id] = value;
          }
        }
```

Change to:

```ts
        if (ref) {
          const value = getLocationFormValue(project, cityId, routeId, ref.locationId, ref.fieldId);
          if (typeof value === "string") {
            result[field.id] = value;
          }
        }
```

(`result` stays `Record<string, string>` — only strings ever flow into the sourced-textarea feature; this preserves that exactly, just moves the check from callee to caller per the design spec §5.2.)

- [ ] **Step 5: Run tests to verify everything passes**

Run: `npx vitest run src/test/locationFormLookup.test.ts src/test/ChallengeForm.test.ts`
Expected: all PASS (`ChallengeForm.test.ts`'s sourced-textarea tests are unaffected — same observable behavior, different internal narrowing point).

- [ ] **Step 6: Commit**

```bash
git add src/utils/locationFormLookup.ts src/components/ChallengeForm.svelte src/test/locationFormLookup.test.ts
git commit -m "refactor: broaden getLocationFormValue to unknown, narrow to string at its one call site"
```

---

### Task 3: Resolver — `src/utils/visibility.ts` (conditions + combinators)

**Files:**
- Create: `src/utils/visibility.ts`
- Test: `src/test/visibility.test.ts` (new)

**Interfaces:**
- Consumes: `parseSourceRef`, `getLocationFormValue` (`src/utils/locationFormLookup.ts`, Task 2); `VisibilityConfig`, `ConditionNode`, `ConditionLeaf`, `Operand`, `VisibilityResult` (`src/types/conditions.ts`, Task 1).
- Produces: `VisibilityContext` interface; `evaluateVisibility(config, ctx, options?): VisibilityResult`. Task 6 (`AppForm.svelte`) is the real consumer.

This is one task, not split further, because leaf evaluation and combinator evaluation aren't independently useful — `VisibilityConfig` always permits `any`/`all`/`not`, so a resolver handling only leaves wouldn't be a complete, shippable `evaluateVisibility`. Covers design spec §2 (shape), §3 (reference resolution), §4.1–4.2 (evaluation/failure modes). §4.3 (`function` reservation) is Task 4.

Error propagation through combinators (not made fully explicit in the design spec — deciding it here): **if any child of `any`/`all`/`not` errors, the whole combinator errors**, using the first error encountered — a broken branch must not be silently masked by a sibling that happens to pass.

- [ ] **Step 1: Write the failing tests**

Create `src/test/visibility.test.ts`:

```ts
import { evaluateVisibility, type VisibilityContext } from "../utils/visibility";
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";

beforeEach(() => {
  localStorage.clear();
});

function ctx(overrides: Partial<VisibilityContext> = {}): VisibilityContext {
  return { values: {}, fieldIds: new Set(), ...overrides };
}

describe("evaluateVisibility — static states", () => {
  it("is visible when isVisible is absent", () => {
    expect(evaluateVisibility(undefined, ctx())).toEqual({ status: "visible" });
  });

  it("is visible when initially is 'visible'", () => {
    expect(evaluateVisibility({ initially: "visible" }, ctx())).toEqual({ status: "visible" });
  });

  it("is hidden when initially is 'hidden'", () => {
    expect(evaluateVisibility({ initially: "hidden" }, ctx())).toEqual({ status: "hidden" });
  });

  it("errors when initially is 'conditional' with no condition/any/all/not", () => {
    const result = evaluateVisibility({ initially: "conditional" }, ctx());
    expect(result.status).toBe("error");
  });
});

describe("evaluateVisibility — bare-id source resolution (this form)", () => {
  const config = {
    initially: "conditional" as const,
    condition: { source: "all_sixteen_plus", operator: "=" as const, value: "Yes" },
  };

  it("is visible when the referenced field's live value matches", () => {
    const c = ctx({ values: { all_sixteen_plus: "Yes" }, fieldIds: new Set(["all_sixteen_plus"]) });
    expect(evaluateVisibility(config, c)).toEqual({ status: "visible" });
  });

  it("is hidden when the referenced field's live value doesn't match", () => {
    const c = ctx({ values: { all_sixteen_plus: "No" }, fieldIds: new Set(["all_sixteen_plus"]) });
    expect(evaluateVisibility(config, c)).toEqual({ status: "hidden" });
  });

  it("is hidden (not an error) when the referenced field simply hasn't been answered yet", () => {
    const c = ctx({ values: {}, fieldIds: new Set(["all_sixteen_plus"]) });
    expect(evaluateVisibility(config, c)).toEqual({ status: "hidden" });
  });

  it("errors when the bare id matches no field in this form", () => {
    const c = ctx({ values: {}, fieldIds: new Set(["some_other_field"]) });
    const result = evaluateVisibility(config, c);
    expect(result.status).toBe("error");
  });
});

describe("evaluateVisibility — dotted cross-form source resolution", () => {
  const config = {
    initially: "conditional" as const,
    condition: {
      source: "004_loc_lange_voorhout.form.manifesto",
      operator: "=" as const,
      value: "the people",
    },
  };
  const formContext = { project: "demo", city: "den_haag", route: "short_loop" };

  it("is visible when the other location's stored answer matches", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, {
      values: { manifesto: "the people" },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(evaluateVisibility(config, ctx({ formContext }))).toEqual({ status: "visible" });
  });

  it("is hidden (not an error) when the other location hasn't been visited yet", () => {
    expect(evaluateVisibility(config, ctx({ formContext }))).toEqual({ status: "hidden" });
  });

  it("errors when used without formContext", () => {
    const result = evaluateVisibility(config, ctx());
    expect(result.status).toBe("error");
  });
});

describe("evaluateVisibility — value resolution", () => {
  it("treats a bare word in 'value' as a literal, never a same-form field reference", () => {
    const config = {
      initially: "conditional" as const,
      condition: { source: "choice", operator: "=" as const, value: "other_field" },
    };
    const c = ctx({
      values: { choice: "other_field", other_field: "something else entirely" },
      fieldIds: new Set(["choice", "other_field"]),
    });
    // "value: other_field" is the literal string "other_field", not a lookup of
    // the other_field's own value — so this matches.
    expect(evaluateVisibility(config, c)).toEqual({ status: "visible" });
  });
});

describe("evaluateVisibility — operators", () => {
  function leafCtx(sourceValue: unknown) {
    return ctx({ values: { x: sourceValue }, fieldIds: new Set(["x"]) });
  }
  function cond(operator: string, value?: unknown) {
    return { initially: "conditional" as const, condition: { source: "x", operator: operator as never, value: value as never } };
  }

  it("'=' and '!='", () => {
    expect(evaluateVisibility(cond("=", 5), leafCtx(5))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond("!=", 5), leafCtx(5))).toEqual({ status: "hidden" });
  });

  it("numeric ordering operators", () => {
    expect(evaluateVisibility(cond("<", 10), leafCtx(5))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond("<=", 5), leafCtx(5))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond(">", 10), leafCtx(5))).toEqual({ status: "hidden" });
    expect(evaluateVisibility(cond(">=", 6), leafCtx(5))).toEqual({ status: "hidden" });
  });

  it("'like' is case-insensitive substring containment, no wildcards", () => {
    expect(evaluateVisibility(cond("like", "voorhout"), leafCtx("Lange Voorhout"))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond("like", "VOORHOUT"), leafCtx("Lange Voorhout"))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond("like", "amsterdam"), leafCtx("Lange Voorhout"))).toEqual({ status: "hidden" });
  });

  it("'is null' / 'is not null' take no value and read the source's presence", () => {
    const present = { initially: "conditional" as const, condition: { source: "x", operator: "is null" as const } };
    const notNull = { initially: "conditional" as const, condition: { source: "x", operator: "is not null" as const } };
    expect(evaluateVisibility(present, leafCtx(undefined))).toEqual({ status: "visible" });
    expect(evaluateVisibility(notNull, leafCtx(undefined))).toEqual({ status: "hidden" });
    expect(evaluateVisibility(present, leafCtx("something"))).toEqual({ status: "hidden" });
    expect(evaluateVisibility(notNull, leafCtx("something"))).toEqual({ status: "visible" });
  });

  it("'is null' with an accompanying value is a runtime error (schema backstop)", () => {
    const bad = { initially: "conditional" as const, condition: { source: "x", operator: "is null" as const, value: "oops" } };
    expect(evaluateVisibility(bad, leafCtx(undefined)).status).toBe("error");
  });

  it("mismatched types error rather than silently coercing", () => {
    // radio/string field value "2" compared against the number 2
    const result = evaluateVisibility(cond(">", 2), leafCtx("2"));
    expect(result.status).toBe("error");
  });

  it("operator matching is exact/case-sensitive", () => {
    const result = evaluateVisibility(cond("IS NULL"), leafCtx(undefined));
    expect(result.status).toBe("error");
  });

  it("an unknown operator errors", () => {
    const result = evaluateVisibility(cond("~=", "x"), leafCtx("x"));
    expect(result.status).toBe("error");
  });
});

describe("evaluateVisibility — combinators", () => {
  function leafCtx(values: Record<string, unknown>) {
    return { values, fieldIds: new Set(Object.keys(values)) };
  }

  it("'any' is visible if at least one child is visible", () => {
    const config = {
      initially: "conditional" as const,
      any: [
        { source: "a", operator: "=" as const, value: "no-match" },
        { source: "b", operator: "=" as const, value: "yes" },
      ],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x", b: "yes" }))).toEqual({ status: "visible" });
  });

  it("'any' is hidden if every child is hidden", () => {
    const config = {
      initially: "conditional" as const,
      any: [
        { source: "a", operator: "=" as const, value: "no-match" },
        { source: "b", operator: "=" as const, value: "also-no" },
      ],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x", b: "y" }))).toEqual({ status: "hidden" });
  });

  it("'all' is visible only if every child is visible", () => {
    const config = {
      initially: "conditional" as const,
      all: [
        { source: "a", operator: "=" as const, value: "x" },
        { source: "b", operator: "=" as const, value: "y" },
      ],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x", b: "y" }))).toEqual({ status: "visible" });
    expect(evaluateVisibility(config, leafCtx({ a: "x", b: "not-y" }))).toEqual({ status: "hidden" });
  });

  it("'not' inverts its single child", () => {
    const config = {
      initially: "conditional" as const,
      not: { source: "a", operator: "=" as const, value: "x" },
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x" }))).toEqual({ status: "hidden" });
    expect(evaluateVisibility(config, leafCtx({ a: "not-x" }))).toEqual({ status: "visible" });
  });

  it("combinators nest arbitrarily", () => {
    // any( all(a=x, b=y), not(any(c=z)) )
    const config = {
      initially: "conditional" as const,
      any: [
        { all: [{ source: "a", operator: "=" as const, value: "x" }, { source: "b", operator: "=" as const, value: "y" }] },
        { not: { any: [{ source: "c", operator: "=" as const, value: "z" }] } },
      ],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "no", b: "no", c: "not-z" }))).toEqual({ status: "visible" });
    expect(evaluateVisibility(config, leafCtx({ a: "no", b: "no", c: "z" }))).toEqual({ status: "hidden" });
  });

  it("an error in any child propagates out of the combinator", () => {
    const config = {
      initially: "conditional" as const,
      any: [
        { source: "a", operator: "=" as const, value: "x" },
        { source: "does_not_exist", operator: "=" as const, value: "y" },
      ],
    };
    const result = evaluateVisibility(config, leafCtx({ a: "not-x" }));
    expect(result.status).toBe("error");
  });

  it("rejects a config with more than one of condition/any/all/not", () => {
    const config = {
      initially: "conditional" as const,
      condition: { source: "a", operator: "=" as const, value: "x" },
      any: [{ source: "a", operator: "=" as const, value: "x" }],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x" })).status).toBe("error");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/visibility.test.ts`
Expected: FAIL — `../utils/visibility` doesn't exist yet.

- [ ] **Step 3: Implement `src/utils/visibility.ts`**

```ts
import type {
  ConditionLeaf,
  ConditionNode,
  ConditionOperator,
  Operand,
  VisibilityConfig,
  VisibilityResult,
} from "../types/conditions";
import { parseSourceRef, getLocationFormValue } from "./locationFormLookup";

export interface VisibilityContext {
  /** This form's own live (in-progress) values, keyed by field id. */
  values: Record<string, unknown>;
  /** Every field id declared in this form, for bare-id existence checks. */
  fieldIds: Set<string>;
  /** Needed to resolve dotted cross-form references; omit where none are used. */
  formContext?: { project: string; city: string; route?: string };
}

export type { VisibilityResult };

const VISIBLE: VisibilityResult = { status: "visible" };
const HIDDEN: VisibilityResult = { status: "hidden" };

function errorResult(message: string): VisibilityResult {
  return { status: "error", message: `isVisible: ${message}` };
}

interface ResolvedOperand {
  value?: unknown;
  error?: string;
  reservedFunction?: true;
}

function resolveStringOperand(
  str: string,
  ctx: VisibilityContext,
  isSourcePosition: boolean,
): ResolvedOperand {
  const ref = parseSourceRef(str);
  if (ref) {
    if (!ctx.formContext) {
      return { error: `cross-form reference '${str}' used without a formContext` };
    }
    const { project, city, route } = ctx.formContext;
    return { value: getLocationFormValue(project, city, route, ref.locationId, ref.fieldId) };
  }
  if (isSourcePosition) {
    if (!ctx.fieldIds.has(str)) {
      return { error: `source '${str}' does not match any field in this form` };
    }
    return { value: ctx.values[str] };
  }
  return { value: str };
}

function resolveOperand(
  operand: Operand | undefined,
  ctx: VisibilityContext,
  isSourcePosition: boolean,
  isProduction: boolean,
): ResolvedOperand {
  if (operand === undefined) {
    return { value: undefined };
  }
  if (typeof operand === "number" || typeof operand === "boolean") {
    return { value: operand };
  }
  if (typeof operand === "object") {
    if (!isProduction) {
      throw new Error(`isVisible: 'function' operands are not implemented yet (attempted '${operand.function}')`);
    }
    return { reservedFunction: true };
  }
  return resolveStringOperand(operand, ctx, isSourcePosition);
}

function compareOrdered(
  source: string | number,
  operator: "<" | "<=" | ">" | ">=",
  value: string | number,
): VisibilityResult {
  switch (operator) {
    case "<":
      return source < value ? VISIBLE : HIDDEN;
    case "<=":
      return source <= value ? VISIBLE : HIDDEN;
    case ">":
      return source > value ? VISIBLE : HIDDEN;
    case ">=":
      return source >= value ? VISIBLE : HIDDEN;
  }
}

function compare(source: unknown, operator: ConditionOperator, value: unknown): VisibilityResult {
  if (source === undefined || source === null) {
    return HIDDEN;
  }
  if (operator === "like") {
    if (typeof source !== "string" || typeof value !== "string") {
      return errorResult(`'like' requires string operands, got ${typeof source} and ${typeof value}`);
    }
    return source.toLowerCase().includes(value.toLowerCase()) ? VISIBLE : HIDDEN;
  }
  if (typeof source !== typeof value) {
    return errorResult(
      `type mismatch comparing ${typeof source} (${JSON.stringify(source)}) to ${typeof value} (${JSON.stringify(value)}) with operator '${operator}'`,
    );
  }
  switch (operator) {
    case "=":
      return source === value ? VISIBLE : HIDDEN;
    case "!=":
      return source !== value ? VISIBLE : HIDDEN;
    case "<":
    case "<=":
    case ">":
    case ">=":
      if (typeof source === "boolean") {
        return errorResult(`operator '${operator}' is not supported on boolean operands`);
      }
      return compareOrdered(source as string | number, operator, value as string | number);
    default:
      return errorResult(`unknown operator '${operator}'`);
  }
}

function evaluateLeaf(leaf: ConditionLeaf, ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  const sourceResult = resolveOperand(leaf.source, ctx, true, isProduction);
  if (sourceResult.reservedFunction) {
    return HIDDEN;
  }
  if (sourceResult.error) {
    return errorResult(sourceResult.error);
  }

  if (leaf.operator === "is null" || leaf.operator === "is not null") {
    if (leaf.value !== undefined) {
      return errorResult(`'${leaf.operator}' does not take a 'value'`);
    }
    const isNull = sourceResult.value === undefined || sourceResult.value === null;
    const met = leaf.operator === "is null" ? isNull : !isNull;
    return met ? VISIBLE : HIDDEN;
  }

  const valueResult = resolveOperand(leaf.value, ctx, false, isProduction);
  if (valueResult.reservedFunction) {
    return HIDDEN;
  }
  if (valueResult.error) {
    return errorResult(valueResult.error);
  }

  return compare(sourceResult.value, leaf.operator, valueResult.value);
}

function firstError(results: VisibilityResult[]): VisibilityResult | undefined {
  return results.find((r): r is Extract<VisibilityResult, { status: "error" }> => r.status === "error");
}

function evaluateAny(nodes: ConditionNode[], ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  const results = nodes.map((node) => evaluateNode(node, ctx, isProduction));
  return firstError(results) ?? (results.some((r) => r.status === "visible") ? VISIBLE : HIDDEN);
}

function evaluateAll(nodes: ConditionNode[], ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  const results = nodes.map((node) => evaluateNode(node, ctx, isProduction));
  return firstError(results) ?? (results.every((r) => r.status === "visible") ? VISIBLE : HIDDEN);
}

function evaluateNot(node: ConditionNode, ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  const result = evaluateNode(node, ctx, isProduction);
  if (result.status === "error") {
    return result;
  }
  return result.status === "visible" ? HIDDEN : VISIBLE;
}

function evaluateNode(node: ConditionNode, ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  if ("any" in node) {
    return evaluateAny(node.any, ctx, isProduction);
  }
  if ("all" in node) {
    return evaluateAll(node.all, ctx, isProduction);
  }
  if ("not" in node) {
    return evaluateNot(node.not, ctx, isProduction);
  }
  return evaluateLeaf(node, ctx, isProduction);
}

function topLevelNode(config: VisibilityConfig): { node?: ConditionNode; error?: string } {
  const present = (["condition", "any", "all", "not"] as const).filter((key) => config[key] !== undefined);
  if (present.length > 1) {
    return { error: `only one of condition/any/all/not may be present (got ${present.join(", ")})` };
  }
  if (config.condition) {
    return { node: config.condition };
  }
  if (config.any) {
    return { node: { any: config.any } };
  }
  if (config.all) {
    return { node: { all: config.all } };
  }
  if (config.not) {
    return { node: { not: config.not } };
  }
  return {};
}

export function evaluateVisibility(
  config: VisibilityConfig | undefined,
  ctx: VisibilityContext,
  options: { isProduction?: boolean } = {},
): VisibilityResult {
  if (!config || config.initially === "visible") {
    return VISIBLE;
  }
  if (config.initially === "hidden") {
    return HIDDEN;
  }
  const { node, error } = topLevelNode(config);
  if (error) {
    return errorResult(error);
  }
  if (!node) {
    return errorResult("'initially' is 'conditional' but no condition/any/all/not was provided");
  }
  const isProduction = options.isProduction ?? import.meta.env.PROD;
  return evaluateNode(node, ctx, isProduction);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/visibility.test.ts`
Expected: all PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/visibility.ts src/test/visibility.test.ts
git commit -m "feat: evaluateVisibility resolver — conditions, operators, source/value resolution, combinators"
```

---

### Task 4: `function` operand reservation + authoring-time scanner

**Files:**
- Modify: `src/utils/visibility.ts`
- Test: `src/test/visibility.test.ts`

**Interfaces:**
- Consumes: everything from Task 3.
- Produces: `findReservedFunctionUsage(fields: unknown[]): string[]`, exported from `src/utils/visibility.ts`. Task 8 (`scripts/validate-yaml.ts`) consumes this — and only this — from the module; it must never import or call `evaluateVisibility`.

Task 3 already implemented and wired the throw-in-dev / hidden-in-prod behavior (`resolveOperand`'s `typeof operand === "object"` branch, threaded through `isProduction`). This task adds tests proving it, plus the separate CI-facing scanner.

- [ ] **Step 1: Write the failing tests**

Append to `src/test/visibility.test.ts`:

```ts
describe("evaluateVisibility — reserved 'function' operand", () => {
  const config = {
    initially: "conditional" as const,
    condition: { source: { function: "team_size_over", params: [4] }, operator: "=" as const, value: true },
  };

  it("throws when not production (default — matches dev/test)", () => {
    expect(() => evaluateVisibility(config, { values: {}, fieldIds: new Set() })).toThrow(/not implemented/);
  });

  it("throws when isProduction is explicitly false", () => {
    expect(() =>
      evaluateVisibility(config, { values: {}, fieldIds: new Set() }, { isProduction: false }),
    ).toThrow(/not implemented/);
  });

  it("falls back to hidden, never throws, when isProduction is true", () => {
    expect(
      evaluateVisibility(config, { values: {}, fieldIds: new Set() }, { isProduction: true }),
    ).toEqual({ status: "hidden" });
  });
});

describe("findReservedFunctionUsage", () => {
  it("flags a field whose isVisible uses a function operand", () => {
    const fields = [
      { id: "a", type: "boolean", label: "A" },
      {
        id: "b",
        type: "boolean",
        label: "B",
        isVisible: {
          initially: "conditional",
          condition: { source: { function: "team_size_over", params: [4] }, operator: "=", value: true },
        },
      },
    ];
    const messages = findReservedFunctionUsage(fields);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("'b'");
  });

  it("flags a function operand nested inside a combinator", () => {
    const fields = [
      {
        id: "c",
        type: "boolean",
        label: "C",
        isVisible: {
          initially: "conditional",
          any: [{ source: { function: "max", params: ["scores"] }, operator: ">", value: 10 }],
        },
      },
    ];
    expect(findReservedFunctionUsage(fields)).toHaveLength(1);
  });

  it("returns no messages for fields without isVisible, or with plain conditions", () => {
    const fields = [
      { id: "a", type: "boolean", label: "A" },
      {
        id: "b",
        type: "boolean",
        label: "B",
        isVisible: { initially: "conditional", condition: { source: "a", operator: "=", value: true } },
      },
    ];
    expect(findReservedFunctionUsage(fields)).toEqual([]);
  });
});
```

Also add `findReservedFunctionUsage` to the existing `import { evaluateVisibility, type VisibilityContext } from "../utils/visibility";` line at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/visibility.test.ts`
Expected: the `function` operand tests should already PASS (Task 3 implemented this); `findReservedFunctionUsage` tests FAIL — not exported yet.

- [ ] **Step 3: Implement `findReservedFunctionUsage`**

Append to `src/utils/visibility.ts`:

```ts
function containsFunctionOperand(node: unknown): boolean {
  if (node === null || typeof node !== "object") {
    return false;
  }
  if ("function" in (node as Record<string, unknown>)) {
    return true;
  }
  if (Array.isArray(node)) {
    return node.some(containsFunctionOperand);
  }
  return Object.values(node as Record<string, unknown>).some(containsFunctionOperand);
}

/**
 * Authoring-time (CI) scanner — no relation to evaluateVisibility's runtime path.
 * Consumed only by scripts/validate-yaml.ts, which runs under plain tsx (no Vite),
 * so this must never call evaluateVisibility or otherwise touch import.meta.env.
 */
export function findReservedFunctionUsage(fields: unknown[]): string[] {
  const messages: string[] = [];
  for (const field of fields) {
    if (field && typeof field === "object" && "isVisible" in field) {
      const isVisible = (field as { isVisible?: unknown }).isVisible;
      if (containsFunctionOperand(isVisible)) {
        const typed = field as { id?: string; label?: string };
        const fieldId = typed.id ?? typed.label ?? "(unknown field)";
        messages.push(`'${fieldId}': isVisible uses a 'function' operand, which is not implemented yet`);
      }
    }
  }
  return messages;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/visibility.test.ts`
Expected: all PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/visibility.ts src/test/visibility.test.ts
git commit -m "feat: reserved-function throw/hidden behavior tests + findReservedFunctionUsage CI scanner"
```

---

### Task 5: `AppForm.svelte` — wire `isVisible` into rendering, validation, and value-clearing

**Files:**
- Modify: `src/components/AppForm.svelte`
- Test: `src/test/AppForm.test.ts`

**Interfaces:**
- Consumes: `evaluateVisibility`, `VisibilityContext` (`src/utils/visibility.ts`, Tasks 3–4).
- Produces: `AppForm` gains an optional `formContext?: { project: string; city: string; route?: string }` prop. Task 6 (`ChallengeForm.svelte`) passes this through.

- [ ] **Step 1: Write the failing tests**

Append to `src/test/AppForm.test.ts` (reuse the existing `render`/`screen`/`fireEvent` imports already at the top of that file):

```ts
test("a field with isVisible hidden by default does not render", () => {
  const fields: FormField[] = [
    { id: "age", type: "radio", label: "Age", options: ["Yes", "No"] },
    {
      id: "promo",
      type: "boolean",
      label: "Promo consent",
      isVisible: { initially: "conditional", condition: { source: "age", operator: "=", value: "Yes" } },
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.queryByText("Promo consent")).not.toBeInTheDocument();
});

test("a conditional field appears when its driving field's answer matches", async () => {
  const fields: FormField[] = [
    { id: "age", type: "radio", label: "Age", options: ["Yes", "No"] },
    {
      id: "promo",
      type: "boolean",
      label: "Promo consent",
      isVisible: { initially: "conditional", condition: { source: "age", operator: "=", value: "Yes" } },
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  await fireEvent.click(screen.getByLabelText("Yes"));
  expect(screen.getByText("Promo consent")).toBeInTheDocument();
});

test("switching the driving field away clears the dependent field's value and hides it again", async () => {
  const onValuesChange = vi.fn();
  const fields: FormField[] = [
    { id: "age", type: "radio", label: "Age", options: ["Yes", "No"] },
    {
      id: "promo",
      type: "boolean",
      label: "Promo consent",
      isVisible: { initially: "conditional", condition: { source: "age", operator: "=", value: "Yes" } },
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onValuesChange } });
  await fireEvent.click(screen.getByLabelText("Yes"));
  await fireEvent.click(screen.getByRole("checkbox"));
  expect(onValuesChange).toHaveBeenLastCalledWith(expect.objectContaining({ promo: true }));

  await fireEvent.click(screen.getByLabelText("No"));
  expect(screen.queryByText("Promo consent")).not.toBeInTheDocument();
  expect(onValuesChange).toHaveBeenLastCalledWith(
    expect.not.objectContaining({ promo: expect.anything() }),
  );
});

test("a malformed isVisible condition renders a visible error sentinel, not a crash", () => {
  const fields: FormField[] = [
    {
      id: "orphan",
      type: "boolean",
      label: "Orphan",
      isVisible: {
        initially: "conditional",
        condition: { source: "does_not_exist", operator: "=", value: "x" },
      },
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByText(/isVisible:.*does_not_exist/)).toBeInTheDocument();
});

test("a hidden required field does not block submit", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const fields: FormField[] = [
    { id: "age", type: "radio", label: "Age", options: ["Yes", "No"] },
    {
      id: "promo",
      type: "string",
      label: "Promo detail",
      isRequired: true,
      isVisible: { initially: "conditional", condition: { source: "age", operator: "=", value: "Yes" } },
    },
  ];
  render(AppForm, { props: { fields, onSubmit, alwaysSubmittable: true } });
  // "age" left unanswered — "promo" stays hidden and required-but-empty.
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalled();
});

test("formContext resolves a cross-form isVisible reference", () => {
  localStorage.setItem(
    "demo/den_haag/short_loop/004_loc_lange_voorhout/form",
    JSON.stringify({
      version: "1.2",
      values: { manifesto: "the people" },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    }),
  );
  const fields: FormField[] = [
    {
      id: "echo",
      type: "boolean",
      label: "Echo",
      isVisible: {
        initially: "conditional",
        condition: { source: "004_loc_lange_voorhout.form.manifesto", operator: "=", value: "the people" },
      },
    },
  ];
  render(AppForm, {
    props: {
      fields,
      onSubmit: vi.fn(),
      formContext: { project: "demo", city: "den_haag", route: "short_loop" },
    },
  });
  expect(screen.getByText("Echo")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: FAIL — `isVisible`/`formContext` aren't wired into `AppForm.svelte` yet.

- [ ] **Step 3: Add the `formContext` prop and imports**

In `src/components/AppForm.svelte`, add to the imports:

```ts
  import { evaluateVisibility, type VisibilityContext } from "../utils/visibility";
  import type { VisibilityResult } from "../types/conditions";
```

Add `formContext` to the props destructure and its type (near `sourceValues`):

```ts
    sourceValues = {},
    formContext = undefined,
    onSubmit,
```

```ts
    sourceValues?: Record<string, string>;
    formContext?: { project: string; city: string; route?: string };
    onSubmit: (values: Record<string, unknown>) => Promise<void>;
```

- [ ] **Step 4: Compute per-field visibility reactively**

Add after the existing `hasChanges`/`liveErrors` derivations (anywhere before the template is fine, but keep it near `liveErrors` since validation depends on it):

```ts
  function fieldKey(field: FormField): string {
    return field.id ?? field.label;
  }

  const fieldIds = $derived(
    new Set(fields.map((f) => f.id).filter((id): id is string => !!id)),
  );

  const visibilityByKey = $derived.by(() => {
    const ctx: VisibilityContext = { values: values as Record<string, unknown>, fieldIds, formContext };
    const result = new Map<string, VisibilityResult>();
    for (const field of fields) {
      result.set(fieldKey(field), evaluateVisibility(field.isVisible, ctx));
    }
    return result;
  });

  function visibilityFor(field: FormField): VisibilityResult {
    return visibilityByKey.get(fieldKey(field)) ?? { status: "visible" };
  }
```

- [ ] **Step 5: Exclude non-visible fields from validation**

`validateValues()` currently starts `for (const field of fields) { if (!field.id || canSkipValidation(field) || !field.isRequired) { ... } else if (...) }`. Add a visibility guard as the very first check inside the loop:

```ts
  function validateValues(): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const field of fields) {
      if (visibilityFor(field).status !== "visible") {
        // hidden or errored — never validated, never blocks submit
      } else if (!field.id || canSkipValidation(field) || !field.isRequired) {
        // skip validation for these types
      } else if (field.type === STR_STRING || field.type === STR_TEXTAREA || field.type === STR_RANDOM_VALUE) {
```

(Keep every existing `else if` branch unchanged below this — only the entry condition gains one more `if` in front of the chain.)

Do the same in `handleSubmit`'s `checkDefinition` loop:

```ts
  function handleSubmit() {
    const defErrors: Record<string, string> = {};
    for (const field of fields) {
      if (!field.id || field.type === STR_SECTION || visibilityFor(field).status !== "visible") {
        // skip def check for section, hidden, and errored fields
      } else {
```

- [ ] **Step 6: Clear a field's value when it becomes hidden**

Add a new `$effect` (place it near the other `$effect` blocks, after the `touchedFieldSet` effect is fine):

```ts
  $effect(() => {
    for (const field of fields) {
      if (!field.id) continue;
      if (visibilityFor(field).status === "hidden" && Object.prototype.hasOwnProperty.call(values, field.id)) {
        const next = { ...values };
        delete next[field.id];
        values = next;
      }
    }
  });
```

- [ ] **Step 7: Render hidden/error/visible per field**

In the template, the existing structure is:

```svelte
  {#each fields as field (field.id ?? field.label)}
    {#if !VALID_TYPES.includes(field.type)}
      ...
    {:else if field.type === "section"}
      ...
    {:else}
      ...
    {/if}
  {/each}
```

Wrap it with a visibility check as the outermost conditional:

```svelte
  {#each fields as field (field.id ?? field.label)}
    {@const visibility = visibilityFor(field)}
    {#if visibility.status === "hidden"}
    {:else if visibility.status === "error"}
      <div class="af-field af-field--unknown">{visibility.message}</div>
    {:else if !VALID_TYPES.includes(field.type)}
      ...(unchanged)
    {:else if field.type === "section"}
      ...(unchanged)
    {:else}
      ...(unchanged)
    {/if}
  {/each}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: all PASS, including every pre-existing `AppForm.test.ts` test (no regressions — fields without `isVisible` always resolve to `{ status: "visible" }`).

- [ ] **Step 9: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/AppForm.svelte`
Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/AppForm.svelte src/test/AppForm.test.ts
git commit -m "feat: AppForm renders/validates/clears fields per isVisible, supports cross-form formContext"
```

---

### Task 6: `ChallengeForm.svelte` — pass `formContext` through

**Files:**
- Modify: `src/components/ChallengeForm.svelte`
- Test: `src/test/ChallengeForm.test.ts`

**Interfaces:**
- Consumes: `AppForm`'s new `formContext` prop (Task 5).
- Produces: every real in-app form (every location's challenge form) can now author cross-form `isVisible` conditions, since `ChallengeForm` already knows `project`/`cityId`/`routeId`.

- [ ] **Step 1: Write the failing test**

Add to `src/test/ChallengeForm.test.ts` (check the top of that file for its existing render/mock conventions and match them — it already renders `ChallengeForm` with `project`/`cityId`/`routeId` props for the sourced-textarea tests):

```ts
test("passes formContext through to AppForm so cross-form isVisible conditions resolve", () => {
  localStorage.setItem(
    "demo/den_haag/short_loop/004_loc_lange_voorhout/form",
    JSON.stringify({
      version: "1.2",
      values: { manifesto: "the people" },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    }),
  );
  const form: FormField[] = [
    {
      id: "echo",
      type: "boolean",
      label: "Echo",
      isVisible: {
        initially: "conditional",
        condition: { source: "004_loc_lange_voorhout.form.manifesto", operator: "=", value: "the people" },
      },
    },
  ];
  render(ChallengeForm, {
    props: { form, locationId: "1", project: "demo", cityId: "den_haag", routeId: "short_loop" },
  });
  expect(screen.getByText("Echo")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/ChallengeForm.test.ts`
Expected: FAIL — `AppForm` never receives `formContext`, so the cross-form reference errors with "used without a formContext" and the field renders the error sentinel, not "Echo".

- [ ] **Step 3: Pass `formContext` from `ChallengeForm` to `AppForm`**

In `src/components/ChallengeForm.svelte`, add `formContext` to the `<AppForm>` invocation (in the template, alongside the existing `{sourceValues}`):

```svelte
        {sourceValues}
        formContext={{ project, city: cityId, route: routeId }}
        onSubmit={handleSubmit}
```

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx vitest run src/test/ChallengeForm.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChallengeForm.svelte src/test/ChallengeForm.test.ts
git commit -m "feat: ChallengeForm passes project/city/route as AppForm's formContext"
```

---

### Task 7: Schema — `form.schema.json`

**Files:**
- Modify: `src/data/schemas/form.schema.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: `isVisible` becomes a recognized, schema-validated property on form fields — both the IDE (`redhat.vscode-yaml`, via existing `.vscode/settings.json` wiring, no changes needed there) and CI (`npm run validate:yaml`) now understand the shape.

- [ ] **Step 1: Read the current file, then add the schema definitions**

Read `src/data/schemas/form.schema.json` first to confirm its exact current `items.properties` list (it has no existing `definitions` block to merge with — this adds the first one). Replace the whole file with:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Form",
  "type": "array",
  "definitions": {
    "operand": {
      "oneOf": [
        { "type": "string" },
        { "type": "number" },
        { "type": "boolean" },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["function"],
          "properties": {
            "function": { "type": "string" },
            "params": { "type": "array", "items": { "$ref": "#/definitions/operand" } }
          }
        }
      ]
    },
    "conditionLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": ["source", "operator"],
      "properties": {
        "source": { "$ref": "#/definitions/operand" },
        "operator": { "enum": ["=", "!=", "<", "<=", ">", ">=", "like", "is null", "is not null"] },
        "value": { "$ref": "#/definitions/operand" }
      },
      "if": { "properties": { "operator": { "enum": ["is null", "is not null"] } }, "required": ["operator"] },
      "then": { "not": { "required": ["value"] } }
    },
    "conditionNode": {
      "oneOf": [
        { "$ref": "#/definitions/conditionLeaf" },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["any"],
          "properties": { "any": { "type": "array", "items": { "$ref": "#/definitions/conditionNode" } } }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["all"],
          "properties": { "all": { "type": "array", "items": { "$ref": "#/definitions/conditionNode" } } }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["not"],
          "properties": { "not": { "$ref": "#/definitions/conditionNode" } }
        }
      ]
    },
    "visibilityConfig": {
      "type": "object",
      "additionalProperties": false,
      "required": ["initially"],
      "properties": {
        "initially": { "enum": ["visible", "hidden", "conditional"] },
        "condition": { "$ref": "#/definitions/conditionNode" },
        "any": { "type": "array", "items": { "$ref": "#/definitions/conditionNode" } },
        "all": { "type": "array", "items": { "$ref": "#/definitions/conditionNode" } },
        "not": { "$ref": "#/definitions/conditionNode" }
      },
      "if": { "properties": { "initially": { "const": "conditional" } }, "required": ["initially"] },
      "then": {
        "oneOf": [
          { "required": ["condition"] },
          { "required": ["any"] },
          { "required": ["all"] },
          { "required": ["not"] }
        ]
      },
      "else": {
        "not": {
          "anyOf": [
            { "required": ["condition"] },
            { "required": ["any"] },
            { "required": ["all"] },
            { "required": ["not"] }
          ]
        }
      }
    }
  },
  "items": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type", "label"],
    "properties": {
      "id":    { "type": "string" },
      "type":  {
        "type": "string",
        "enum": ["boolean", "string", "number", "radio", "multiple", "photo", "video", "textarea", "section", "random_value"]
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
      },
      "source":  { "type": "string" },
      "reroll":   { "type": "boolean" },
      "editable": { "type": "boolean" },
      "isVisible": { "$ref": "#/definitions/visibilityConfig" }
    }
  }
}
```

(Every existing property is preserved verbatim — only `"definitions"` and the `"isVisible"` line are new. The `then`/`else` blocks rely on `oneOf`'s "exactly one branch may match" semantics to enforce both "at least one of condition/any/all/not when conditional" and "none of them when visible/hidden" — no separate mutual-exclusion logic needed.)

- [ ] **Step 2: Verify schema validity with a one-off script**

Run this (not a permanent file) to confirm the schema compiles and enforces what it should before relying on it — includes both the "no condition provided" bad case and the "condition present alongside a static initially" bad case:

```bash
node -e "
const Ajv = require('ajv');
const schema = require('./src/data/schemas/form.schema.json');
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const good = [
  { id:'a', type:'boolean', label:'A' },
  { id:'b', type:'boolean', label:'B', isVisible: { initially:'conditional', condition: { source:'a', operator:'=', value:true } } },
];
const badNoCondition = [{ id:'c', type:'boolean', label:'C', isVisible: { initially:'conditional' } }];
const badStaticWithCondition = [{ id:'d', type:'boolean', label:'D', isVisible: { initially:'visible', condition: { source:'a', operator:'=', value:true } } }];
console.log('good valid (expect true):', validate(good));
console.log('badNoCondition valid (expect false):', validate(badNoCondition));
console.log('badStaticWithCondition valid (expect false):', validate(badStaticWithCondition));
"
```

Expected: `good valid (expect true): true`, both bad cases `false`.

- [ ] **Step 3: Run the full YAML content validation**

Run: `npm run validate:yaml`
Expected: passes with 0 violations (no existing content uses `isVisible` yet, so nothing changes for real content — this only proves the schema change itself doesn't break validation of the existing corpus).

- [ ] **Step 4: Commit**

```bash
git add src/data/schemas/form.schema.json
git commit -m "feat: add isVisible schema definitions to form.schema.json"
```

---

### Task 8: CI — reject `function` operands in authored YAML

**Files:**
- Modify: `scripts/validate-yaml.ts`

**Interfaces:**
- Consumes: `findReservedFunctionUsage` (`src/utils/visibility.ts`, Task 4).
- Produces: `npm run validate:yaml` fails the build if any `*_form_*.yaml` file authors a `{ function: ... }` operand.

- [ ] **Step 1: Add the import and a check function**

In `scripts/validate-yaml.ts`, add the import near the top (alongside the existing `storylineBlocks` import):

```ts
import { findReservedFunctionUsage } from "../src/utils/visibility";
```

Add a check function near `checkStoryline`/`checkStatsFile`:

```ts
function checkVisibilityFunctions(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content);
  if (!Array.isArray(data)) {
    return [];
  }
  return findReservedFunctionUsage(data).map(
    (msg) => `${msg} (not yet implemented — see doc/superpowers/specs/2026-07-31-conditional-visibility-design.md §4.3)`,
  );
}
```

- [ ] **Step 2: Wire it into the `FORM_PATTERN` violations list**

Change:

```ts
  ...findFiles(DATA_DIR, FORM_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateForm).map((msg) => ({ filePath, msg })),
  ),
```

to:

```ts
  ...findFiles(DATA_DIR, FORM_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateForm).map((msg) => ({ filePath, msg })),
    ...checkVisibilityFunctions(filePath).map((msg) => ({ filePath, msg })),
  ]),
```

- [ ] **Step 3: Manually verify the rejection with a scratch fixture**

Create a temporary file to prove the check fires, then delete it — this is a manual verification step, not a permanent fixture:

```bash
cat > src/data/text/en/projects/demo/paris/999_form_scratch_test.yaml << 'EOF'
- id: a
  type: boolean
  label: A
  isVisible:
    initially: conditional
    condition:
      source: { function: team_size_over, params: [4] }
      operator: "="
      value: true
EOF
npm run validate:yaml
```

Expected: exits non-zero, prints an `ERROR:` line for `999_form_scratch_test.yaml` containing "not yet implemented".

Then delete the scratch file and re-run to confirm it was the cause:

```bash
rm src/data/text/en/projects/demo/paris/999_form_scratch_test.yaml
npm run validate:yaml
```

Expected: passes again (0 violations).

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-yaml.ts
git commit -m "feat: validate:yaml rejects isVisible function operands (not yet implemented)"
```

---

### Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: every test passes, including all pre-existing tests (no regressions) and everything added in Tasks 1–8.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 4: YAML content validation**

Run: `npm run validate:yaml`
Expected: 0 violations.

- [ ] **Step 5: Confirm no regression in the two features this touches**

Run: `npx vitest run src/test/locationFormLookup.test.ts src/test/ChallengeForm.test.ts src/test/AppForm.test.ts src/test/visibility.test.ts`
Expected: all pass — this is the exact set of files Tasks 1–8 modified or created.

No manual browser verification is included in this plan (per project convention, that's the user's own step, not an automated one) — the acceptance checklist in the design spec (§7) is otherwise fully covered by the automated tests above field-by-field.
