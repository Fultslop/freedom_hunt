# Challenge & Form Screen UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the stop screen's five readability/affordance problems (no content measure, low-contrast field borders, an unclear submit button, a bare photo-upload tile, and space-wasting dividers) and one unrelated production bug (an unguarded photo-preview decode), per `doc/superpowers/specs/2026-07-28-challenge-form-ui-polish-design.md`.

**Architecture:** Eleven independently-testable tasks. No new components — every change is CSS-token introduction, targeted CSS edits, small `AppForm.svelte`/`ChallengeForm.svelte` state/markup changes, or a one-line YAML data fix. `src/styles/tokens.css` gains a `--content-max` token and a spacing/field-sizing scale that don't exist anywhere in this repo today.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte/svelte5`, plain CSS custom properties (no CSS framework).

## Global Constraints

- TypeScript only, `.svelte` files use `<script lang="ts">` — no `.js`/`.jsx`/`.tsx` in `src/`.
- All colour/spacing values via CSS custom properties (`var(--color-*)`, `var(--gap-*)`, etc.) in co-located `.css` files — no CSS modules, no Tailwind, no new inline styles for values that are static per theme.
- Reactivity via Svelte 5 runes (`$state`, `$derived`, `$effect`) — no Svelte 4 `$:`.
- Run `npm run lint` and the relevant Vitest suite after every task; both must pass before committing.
- Never use Playwright or any browser automation to verify — the user verifies visually/on-device manually. Automated tests (Vitest + Testing Library) are the only in-session verification.
- Do not touch `src/utils/formStorage.ts` or the local-storage draft-autosave pipeline — already implemented, out of scope.
- Do not build a desktop-specific multi-column layout — out of scope per spec.

---

## Task 1: Fix the unguarded photo-preview decode (F1 — production bug, unrelated to styling)

**Files:**
- Modify: `src/utils/photoPreview.ts`
- Test: `src/test/photoPreview.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `createPhotoPreview(file: File): Promise<string>` — same signature as today; internal decode is now capped. `AppForm.svelte` calls this unchanged (no caller changes in this task).

**Problem:** `createPhotoPreview` calls `createImageBitmap(file)` with no resize options — an uncapped full-resolution decode. Its sibling `normalizePhotoForUpload` (`src/utils/photoUpload.ts`) caps every decode at 2048px specifically because uncapped decodes of real phone camera photos are a known failure vector in this codebase. When `AppForm.svelte`'s `normalizePhotoForUpload(file).catch(() => file)` fallback fires, `createPhotoPreview` receives the same raw, uncapped file and can fail — leaving the photo tile showing a `Check`-icon fallback instead of the real thumbnail even though the upload itself succeeded.

- [ ] **Step 1: Write the failing test**

Add to `src/test/photoPreview.test.ts`, above the existing crop tests (reuse the file's existing `stubCanvas` helper):

```ts
function stubResizingImageBitmap(nativeWidth: number, nativeHeight: number) {
  const bitmaps: Array<{ width: number; height: number; close: ReturnType<typeof vi.fn> }> = [];
  const createImageBitmap = vi.fn(
    (
      source: File | { width: number; height: number },
      options?: { resizeWidth?: number; resizeHeight?: number },
    ) => {
      const sourceWidth = source instanceof File ? nativeWidth : source.width;
      const sourceHeight = source instanceof File ? nativeHeight : source.height;
      let width = sourceWidth;
      let height = sourceHeight;
      if (options?.resizeWidth) {
        width = options.resizeWidth;
        height = Math.round(sourceHeight * (options.resizeWidth / sourceWidth));
      } else if (options?.resizeHeight) {
        height = options.resizeHeight;
        width = Math.round(sourceWidth * (options.resizeHeight / sourceHeight));
      }
      const bitmap = { width, height, close: vi.fn() };
      bitmaps.push(bitmap);
      return Promise.resolve(bitmap);
    },
  );
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  return { createImageBitmap, bitmaps };
}

test("never performs an uncapped decode of a large source photo", async () => {
  stubCanvas();
  const { createImageBitmap } = stubResizingImageBitmap(8000, 6000);

  const file = new File(["data"], "photo.heic", { type: "image/heic" });
  await createPhotoPreview(file);

  for (const call of createImageBitmap.mock.calls) {
    const options = call[1] as { resizeWidth?: number; resizeHeight?: number } | undefined;
    expect(options?.resizeWidth || options?.resizeHeight).toBeTruthy();
  }
});

test("still crops correctly after a capped decode of a very large landscape photo", async () => {
  const { drawImage } = stubCanvas();
  stubResizingImageBitmap(8000, 6000);

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await createPhotoPreview(file);

  // Capped decode preserves aspect ratio (8000x6000 -> capped, still 4:3),
  // so the center-crop math (side = min(width, height)) still applies to
  // whatever the capped bitmap's dimensions end up being.
  expect(drawImage).toHaveBeenCalled();
  const [, , , cropW, cropH] = drawImage.mock.calls[0];
  expect(cropW).toBe(cropH); // still a square crop
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- photoPreview` (or `npx vitest run src/test/photoPreview.test.ts`)
Expected: FAIL — `createImageBitmap` is called with no options at all (`options?.resizeWidth || options?.resizeHeight` is falsy), so the first new test fails.

- [ ] **Step 3: Write minimal implementation**

Replace `src/utils/photoPreview.ts` with a capped two-pass decode mirroring `normalizePhotoForUpload`'s proven pattern, at a cap sized for a 200×200 output (800px gives ample headroom for the center-crop at far less memory cost than a full-resolution decode):

```ts
const PREVIEW_SIZE = 200;
const PREVIEW_QUALITY = 0.6;
// Mirrors photoUpload.ts's UPLOAD_MAX_DIMENSION cap — createPhotoPreview must
// never decode a source photo at full resolution, independent of whether
// normalizePhotoForUpload succeeded upstream (see devlog: uncapped decodes of
// real phone camera photos are a known OOM/decode-failure vector here).
const PREVIEW_DECODE_MAX_DIMENSION = 800;

export async function createPhotoPreview(file: File): Promise<string> {
  let bitmap = await createImageBitmap(file, {
    resizeWidth: PREVIEW_DECODE_MAX_DIMENSION,
    resizeQuality: "medium",
  });
  if (bitmap.height > PREVIEW_DECODE_MAX_DIMENSION) {
    const capped = await createImageBitmap(bitmap, {
      resizeHeight: PREVIEW_DECODE_MAX_DIMENSION,
      resizeQuality: "medium",
    });
    bitmap.close();
    bitmap = capped;
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const cropX = (bitmap.width - side) / 2;
  const cropY = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("2D canvas context unavailable");
  }
  ctx.drawImage(bitmap, cropX, cropY, side, side, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", PREVIEW_QUALITY);
}
```

- [ ] **Step 4: Update the two existing crop tests for the new capped-bitmap call shape**

The existing tests stub `createImageBitmap` as a single `vi.fn().mockResolvedValue({ width: 400, height: 300, close: vi.fn() })` — under the new implementation this stub now needs to handle the `resizeWidth`/`resizeHeight` options like `stubResizingImageBitmap` does. Replace both existing tests' setup to use `stubResizingImageBitmap(400, 300)` / `stubResizingImageBitmap(300, 500)` respectively (both source dimensions are already under the 800px cap, so a single width-capped pass returns the same 400×300/300×500 dimensions the assertions already expect — no assertion values change, only the stub).

- [ ] **Step 5: Run full test file to verify all tests pass**

Run: `npx vitest run src/test/photoPreview.test.ts`
Expected: PASS, all 5 tests (3 original + 2 new).

- [ ] **Step 6: Run the full suite, lint, typecheck**

Run: `npm test`, `npm run lint`, `npx tsc --noEmit` (or the project's typecheck script)
Expected: all pass — `AppForm.test.ts` already mocks `createPhotoPreview` entirely (`vi.mock("../utils/photoPreview", ...)`), so this change is invisible to it.

- [ ] **Step 7: Commit**

```bash
git add src/utils/photoPreview.ts src/test/photoPreview.test.ts
git commit -m "fix: cap photo-preview decode to prevent intermittent thumbnail-generation failures"
```

---

## Task 2: `source_of_fear` field — string to textarea (one-line content fix)

**Files:**
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/001_form_abc.yaml`

**Interfaces:** None — pure content data change, `textarea` is already a supported `FormFieldType`.

- [ ] **Step 1: Make the change**

In `001_form_abc.yaml`, line 15, change:
```yaml
  type: string
```
to:
```yaml
  type: textarea
```
for the `source_of_fear` field (id at line 14, label "What idea in this book was someone afraid of?").

- [ ] **Step 2: Verify against schema/CI validation**

Run: `node scripts/validate-yaml.js` (or `npm run validate:yaml` if that script exists — check `package.json`)
Expected: passes — `textarea` is already a valid `type` value in `src/data/schemas/form.schema.json`.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — no test currently asserts this field's specific rendered `<input>`/`<textarea>` tag, so nothing should need updating. If a snapshot or explicit assertion does reference it, update the assertion to expect a `<textarea>`, not the underlying behavior.

- [ ] **Step 4: Commit**

```bash
git add src/data/text/en/projects/democrats_abroad/den_haag/001_form_abc.yaml
git commit -m "fix: reflective question field is a textarea, not a single-line input"
```

---

## Task 3: Content-measure token — cap the stop screen at 480px

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/components/ChallengeCard.css`

**Interfaces:**
- Produces: `--content-max: 480px` token in `tokens.css`, consumed by `ChallengeCard.css` (and no one else yet — later tasks don't need it).

**Problem:** Every other page in the app (`AppPage.css`, `CityPage.css`, `ProjectPage.css`, etc.) already caps content at `max-width: 480px; margin: 0 auto;`. `ChallengeCard.svelte`'s sections have no such cap, so on desktop they run full viewport width. Fix by applying the same `max-width` + `margin: auto` + `box-sizing: border-box` pattern `AppPage.css` already uses (`AppPage.css:33-40`), to each of `ChallengeCard`'s already-padded sections individually — this preserves each section's existing padding/margin values (so the phone layout, already narrower than 480px, is visually unchanged) while capping and centering on wider viewports. The hero image (`.cc-hero-wrap`/`.cc-hero-img`) is deliberately left unconstrained — it's the one full-bleed exception.

**Note on test strategy:** no test in this codebase's suite asserts a computed CSS value — `AppForm.test.ts`/`ChallengeForm.test.ts`/`ChallengeCard.test.ts` only assert markup, text, and behavior via Testing Library queries, never `getComputedStyle`. Vitest's `happy-dom` environment does not reliably apply CSS from plain side-effect `.css` imports the way a real browser does, so a `getComputedStyle`-based assertion here would be untrustworthy — it could pass or fail independent of whether the CSS rule is actually correct. Instead, assert against the CSS source text directly (deterministic, no CSS-engine dependency), which is the pattern used below.

- [ ] **Step 1: Write the failing test**

Add to `src/test/ChallengeCard.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("challenge card sections are capped at --content-max width", () => {
  const css = readFileSync(
    join(__dirname, "../components/ChallengeCard.css"),
    "utf-8",
  );
  const sectionRule = css.match(/\.cc-section\s*\{[^}]*\}/)?.[0] ?? "";
  expect(sectionRule).toMatch(/max-width:\s*var\(--content-max\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/ChallengeCard.test.ts`
Expected: FAIL — `.cc-section` currently has no `max-width` rule at all.

- [ ] **Step 3: Add the token**

In `src/styles/tokens.css`, add to the `:root` block (near the other non-theme-specific tokens, e.g. after `--font-size-3xl`):

```css
--content-max: 480px; /* matches the max-width every other page already uses */
```

- [ ] **Step 4: Apply the cap in `ChallengeCard.css`**

Replace these four rules:

```css
.cc-hero-title-wrap {
  position: absolute;
  bottom: -48px;
  left: 0;
  right: 0;
  max-width: var(--content-max);
  margin-inline: auto;
  padding-inline: 16px;
  box-sizing: border-box;
}

.cc-no-hero-wrap {
  max-width: var(--content-max);
  margin: 16px auto;
  padding-inline: 16px;
  box-sizing: border-box;
}

.cc-section {
  max-width: var(--content-max);
  margin-inline: auto;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
}

.cc-section--no-border {
  max-width: var(--content-max);
  margin-inline: auto;
  padding: 16px;
  box-sizing: border-box;
}
```

(`.cc-hero-title-wrap` changes `left:16px;right:16px` to `left:0;right:0` plus `padding-inline:16px` — same visual gutter on mobile via padding instead of inset, but now caps and centers on desktop, matching the standard "stretch + max-width + margin:auto" centering technique for absolutely-positioned elements. `.cc-no-hero-wrap` changes `margin: 16px` to `margin: 16px auto` plus `padding-inline: 16px` — same reasoning: the horizontal gutter moves from margin to padding so it survives `box-sizing: border-box` capping. `.cc-section`/`.cc-section--no-border` keep their existing `padding: 16px` unchanged, just gain the cap.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/ChallengeCard.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full suite, lint**

Run: `npm test`, `npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/styles/tokens.css src/components/ChallengeCard.css src/test/ChallengeCard.test.ts
git commit -m "feat: cap stop screen content at 480px, matching the rest of the app"
```

---

## Task 4: Field border contrast token + non-color focus state

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/components/AppForm.css`

**Interfaces:**
- Produces: `--field-border` and `--field-border-focus` tokens, one value per theme (`:root`, `:root[data-theme="app"]`, `:root[data-theme="GWC"]`), consumed by `.af-input`, `.af-textarea`, `.af-photo-tile`.

**Problem:** `.af-input`/`.af-textarea`/`.af-photo-tile` already have a 1px border, but it's `var(--color-border)`, which measures under 3:1 contrast against `--color-background` in all 3 themes (wireframe ~1.37:1, app ~1.72:1, GWC ~1.24:1 — WCAG 1.4.11 requires ≥3:1). Introduce a dedicated `--field-border` token (not a blanket `--color-border` value change, since that token is reused by non-UI-component hairlines like `.cc-section`'s divider border, which don't need 3:1). Also add a non-color-only focus signal — today's focus state is border-color-only.

**Note on test strategy:** same reasoning as Task 3 — assert against `AppForm.css`'s source text rather than a computed style, since no test in this suite relies on JSDOM CSS computation and it isn't a reliable signal here.

- [ ] **Step 1: Write the failing test**

Add to `src/test/AppForm.test.ts`, or a new `src/test/AppForm.css.test.ts` if the existing file's imports don't already include `node:fs`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("input/textarea/photo-tile borders use the dedicated field-border token", () => {
  const css = readFileSync(join(__dirname, "../components/AppForm.css"), "utf-8");
  const inputRule = css.match(/\.af-input,\s*\n\.af-textarea\s*\{[^}]*\}/)?.[0] ?? "";
  expect(inputRule).toMatch(/border:\s*1px solid var\(--field-border\)/);
  const focusRule = css.match(/\.af-input:focus,\s*\n\.af-textarea:focus\s*\{[^}]*\}/)?.[0] ?? "";
  expect(focusRule).toMatch(/box-shadow:/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/AppForm.test.ts -t "field-border token"`
Expected: FAIL — current rule is `border: 1px solid var(--color-border)`, no `box-shadow` in the focus rule.

- [ ] **Step 3: Add tokens**

In `src/styles/tokens.css`:

`:root` block (wireframe — its own `--color-text-muted` of `#aaaaaa` only reaches ~2.32:1, so this needs a genuinely new value, not a reuse):
```css
--field-border: #8a8a8a;       /* ~3.45:1 against #ffffff */
--field-border-focus: var(--color-accent);
```

`:root[data-theme="app"]` block (reuses the existing `--color-text-muted` value — already ~3.76:1 against `#0f172a`):
```css
--field-border: #64748b;
--field-border-focus: var(--color-accent);
```

`:root[data-theme="GWC"]` block (reuses the existing `--color-text-muted` value — already ~4.83:1 against `#ffffff`):
```css
--field-border: #6b7280;
--field-border-focus: var(--color-accent);
```

- [ ] **Step 4: Update `AppForm.css`**

Replace:
```css
.af-input,
.af-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-base);
  margin-top: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
}

.af-input:focus,
.af-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}
```
with:
```css
.af-input,
.af-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  font-size: var(--font-size-base);
  margin-top: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
}

.af-input:focus,
.af-textarea:focus {
  outline: none;
  border-color: var(--field-border-focus);
  box-shadow: 0 0 0 2px var(--field-border-focus);
}
```

Also change `.af-photo-tile`'s border (`AppForm.css:136`) from `border: 1px solid var(--color-border);` to `border: 1px solid var(--field-border);`.

- [ ] **Step 5: Run test to verify it passes, then full suite + lint**

Run: `npx vitest run src/test/AppForm.test.ts`, `npm test`, `npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "fix: form field borders now meet 3:1 contrast in all 3 themes, with a non-color focus ring"
```

---

## Task 5: Spacing tokens, field min-height, and divider removal (P2 + F3 sequencing — one pass)

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/components/ChallengeForm.svelte`
- Modify: `src/components/ChallengeForm.css`
- Modify: `src/components/ChallengeCard.css`
- Modify: `src/components/AppForm.css`
- Modify: `src/components/Storyline.css`
- Test: `src/test/ChallengeForm.test.ts`

**Interfaces:**
- Produces: `--gap-section`, `--gap-block`, `--gap-field`, `--field-min-height` tokens.
- Consumes: none new.

**Why one task:** `--field-min-height` (raising `.af-input` from ~36px to 44px) and the `--gap-field`/`--gap-block` spacing tokens both retune the same vertical rhythm around form inputs — doing them as separate tasks means visually re-tuning that rhythm twice (per spec Finding F3).

- [ ] **Step 1: Write the failing test for divider removal**

Add to `src/test/ChallengeForm.test.ts`, reusing the file's existing top-level `form` fixture (`form = [{ id: "found_it", type: "boolean", ... }, { id: "note", type: "string", ... }]`, already defined at the top of the file):

```ts
test("no longer renders a flag-glyph divider", () => {
  render(ChallengeForm, { props: { form, locationId: 1, routeId: "short_loop" } });
  expect(document.querySelector(".cf-divider")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/ChallengeForm.test.ts`
Expected: FAIL — two `.cf-divider` elements currently render.

- [ ] **Step 3: Add tokens**

In `src/styles/tokens.css`, `:root` block:
```css
--gap-section: 2.5rem;
--gap-block: 1.5rem;
--gap-field: 0.375rem;
--field-min-height: 2.75rem; /* 44px touch target */
```
(These are not theme-specific — same value in `:root`, `[data-theme="app"]`, `[data-theme="GWC"]`; only colours vary per theme in this codebase's existing convention.)

- [ ] **Step 4: Remove the divider markup**

In `src/components/ChallengeForm.svelte`, remove the `Flag` import (line 3) and both divider blocks:
```svelte
<div class="cf-divider" aria-hidden="true">
  <span class="cf-divider__line"></span>
  <Flag size={12} aria-hidden="true" />
  <span class="cf-divider__line"></span>
</div>
```
(both the one before `<AppForm ...>` and the one after it — the `<AppForm>` block itself is unchanged). Replace the removed top divider with nothing (spacing now comes from `.cf-form-wrap`'s own margin, added below) and remove the bottom one entirely.

- [ ] **Step 5: Update `ChallengeForm.css`**

Remove `.cf-divider`/`.cf-divider__line` (no longer used) and add:
```css
.cf-form-wrap {
  margin-top: var(--gap-block);
}
```
Wrap the `<AppForm ...>` element in `ChallengeForm.svelte` with `<div class="cf-form-wrap">...</div>` so this margin has somewhere to attach (a plain wrapper div, no other behavior change).

- [ ] **Step 6: Apply spacing tokens across `ChallengeCard.css` and `AppForm.css`**

In `ChallengeCard.css`:
- `.cc-challenge-box` — change `margin-top: 14px;` to `margin-top: var(--gap-block);`.
- `.cc-section` / `.cc-section--no-border` — change `padding: 16px;` to `padding: var(--gap-field) var(--gap-block) var(--gap-block);` — wait, reconsider: `--gap-field` (0.375rem = 6px) is too tight for outer section padding, which was 16px. Use `--gap-block` (1.5rem = 24px) for the section's own padding instead, keeping the visual weight closer to the original 16px while unifying to the token: change `padding: 16px;` to `padding: var(--gap-block);` on both `.cc-section` and `.cc-section--no-border`.

In `AppForm.css`:
- `.af-field` — change `margin-bottom: 12px;` to `margin-bottom: var(--gap-field);` — wait, `--gap-field` is meant for "label → help → input, inside one field" per the spec's own intent, not for inter-field spacing. Use `--gap-block` for spacing *between* fields instead: change `.af-field { margin-bottom: 12px; }` to `.af-field { margin-bottom: var(--gap-block); }`.
- `.af-label`/`.af-subtext`/`.af-input` internal spacing (label → subtext → input) — add `--gap-field` between them: `.af-subtext { margin-top: var(--gap-field); margin-bottom: var(--gap-field); }` (was `margin-top: 2px; margin-bottom: 4px;`), and `.af-input, .af-textarea { margin-top: var(--gap-field); }` (was `margin-top: 4px;`).
- `.af-section-heading` — change `margin-top: 20px;` to `margin-top: var(--gap-section);` (section headings are the biggest boundary inside a form, matching `--gap-section`'s intent).

- [ ] **Step 7: Apply `--field-min-height`**

In `AppForm.css`, add `min-height: var(--field-min-height);` to the `.af-input, .af-textarea` rule (the `.af-textarea` rule already separately sets `min-height: 80px` for its multi-line default — leave that one as-is, since `--field-min-height` only needs to raise the single-line `.af-input` from its current ~36px effective height; textareas are already taller).

Split the rule so `--field-min-height` only applies to `.af-input`:
```css
.af-input {
  min-height: var(--field-min-height);
}
```
as a new rule, leaving the shared `.af-input, .af-textarea { ... }` block's other properties unchanged.

- [ ] **Step 8: Apply the same tokens to `Storyline.css` (cross-cutting, per spec)**

Change:
```css
.storyline-root {
  --storyline-gap-block: 32px;
  --storyline-gap-inner: 8px;
  display: flex;
  flex-direction: column;
  gap: var(--storyline-gap-block);
}
```
to:
```css
.storyline-root {
  display: flex;
  flex-direction: column;
  gap: var(--gap-block);
}
```
(Removes the locally-scoped `--storyline-gap-block`/`--storyline-gap-inner` in favor of the new global tokens — check `Storyline.svelte` for any other use of `--storyline-gap-inner` before removing it; if it's used for inner spacing within a single block, replace with `var(--gap-field)` at that site instead of deleting outright.)

- [ ] **Step 9: Run tests to verify divider removal passes, then full suite + lint**

Run: `npx vitest run src/test/ChallengeForm.test.ts`, `npm test`, `npm run lint`
Expected: all pass. Note: `npm test` may surface other tests that assert specific pixel margins/padding via inline style checks (unlikely, since this codebase tests behavior/markup, not computed CSS values, per the patterns seen in `AppForm.test.ts`) — if any such test exists, update its expected value to match the new token-driven value.

- [ ] **Step 10: Commit**

```bash
git add src/styles/tokens.css src/components/ChallengeForm.svelte src/components/ChallengeForm.css src/components/ChallengeCard.css src/components/AppForm.css src/components/Storyline.css src/test/ChallengeForm.test.ts
git commit -m "feat: introduce spacing/field-height tokens, remove flag-glyph dividers, apply to storyline blocks"
```

---

## Task 6: Submit button — quiet disabled state, status line, "Saved ✓" transient state

**Files:**
- Modify: `src/components/AppForm.svelte`
- Modify: `src/components/AppForm.css`
- Test: `src/test/AppForm.test.ts`

**Interfaces:**
- Produces: `SubmitState` type gains `"saved"` (was `"idle" | "submitting" | "error"`, becomes `"idle" | "submitting" | "saved" | "error"`). No prop signature changes — `ChallengeForm.svelte`'s usage is unaffected.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/AppForm.test.ts`:

```ts
test("submit button shows 'Saved ✓' immediately after a successful submit, then reverts", async () => {
  vi.useFakeTimers();
  const fields: FormField[] = [{ id: "title", type: "string", label: "Title" }];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, {
    props: { fields, initialValues: { title: "Binnenhof" }, onSubmit },
  });
  await fireEvent.input(screen.getByLabelText("Title"), {
    target: { value: "Binnenhof Updated" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

  expect(await screen.findByRole("button", { name: /saved/i })).toBeInTheDocument();

  vi.advanceTimersByTime(3000);
  await vi.waitFor(() =>
    expect(screen.getByRole("button", { name: /no changes/i })).toBeInTheDocument(),
  );
  vi.useRealTimers();
});

test("status line reads 'Unsaved changes' when dirty and 'All answers saved' after a clean submit", async () => {
  const fields: FormField[] = [{ id: "title", type: "string", label: "Title" }];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, {
    props: { fields, initialValues: { title: "Binnenhof" }, onSubmit },
  });
  await fireEvent.input(screen.getByLabelText("Title"), {
    target: { value: "Binnenhof Updated" },
  });
  expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await waitFor(() => expect(screen.getByText("All answers saved")).toBeInTheDocument());
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts -t "Saved"`
Expected: FAIL — no "Saved" text/state exists, no status line exists.

- [ ] **Step 3: Implement the "saved" state**

In `AppForm.svelte`, change the `SubmitState` type (line 50):
```ts
type SubmitState = "idle" | "submitting" | "saved" | "error";
```

Add a timeout-tracking variable near `submitState`'s declaration (line 166):
```ts
let submitState = $state<SubmitState>("idle");
let savedTimeoutId: ReturnType<typeof setTimeout> | undefined;
```

Update `doSubmit` (lines 310-322):
```ts
async function doSubmit() {
  showConfirm = false;
  submitState = "submitting";
  try {
    await onSubmit(
      buildNestedValues(values),
    );
    clearTimeout(savedTimeoutId);
    submitState = "saved";
    savedTimeoutId = setTimeout(() => {
      submitState = "idle";
    }, 3000);
    onSuccess?.();
  } catch {
    submitState = "error";
  }
}
```
(Keep whatever `onSubmit(...)` argument `doSubmit` already passes — the diff above only touches the success branch's state transition, not the call itself; confirm the exact current argument by reading `AppForm.svelte:310-322` before editing, since this plan's line numbers may have shifted after Task 5.)

Update the button markup's label ternary (lines 619-632) to add the saved branch ahead of the `!hasChanges` check:
```svelte
{:else if !isPhotoOnlyForm || submitState === "error"}
  <button
    class="af-submit-btn"
    class:af-submit-btn--submitting={submitState === "submitting"}
    class:af-submit-btn--saved={submitState === "saved"}
    class:af-submit-btn--dirty={hasChanges && submitState === "idle"}
    onclick={handleSubmit}
    disabled={submitState === "submitting" || submitState === "saved" || !hasChanges}
  >
    {submitState === "submitting"
      ? "Submitting…"
      : submitState === "saved"
        ? "Saved ✓"
        : !hasChanges
          ? "No changes"
          : submitState === "error"
            ? "Try again"
            : submitLabel}
  </button>
  <p class="af-status-line" aria-live="polite">
    {#if hasChanges}
      Unsaved changes
    {:else if hasSubmittedButNoChanges}
      All answers saved
    {/if}
  </p>
{/if}
```
This introduces `hasSubmittedButNoChanges` — check whether an equivalent derived value already exists (the `hasSubmittedOnce` concept lives in `ChallengeForm.svelte`, not `AppForm.svelte`). Since `AppForm.svelte` doesn't currently track "has this form ever been successfully submitted," add:
```ts
let everSubmittedSuccessfully = $state(false);
```
set to `true` in `doSubmit`'s success branch (alongside `submitState = "saved"`), and derive:
```ts
const hasSubmittedButNoChanges = $derived(!hasChanges && everSubmittedSuccessfully);
```
Use `hasSubmittedButNoChanges` in the status-line snippet above instead of a bare `hasSubmittedOnce` reference.

- [ ] **Step 4: Add CSS**

In `AppForm.css`, add:
```css
.af-submit-btn:disabled {
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.af-submit-btn--dirty {
  background: var(--color-accent);
  color: #fff;
}

.af-submit-btn--saved {
  background: var(--color-success);
  color: #fff;
}

.af-status-line {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--gap-field);
  text-align: center;
}
```
Change the base `.af-submit-btn` rule to drop the unconditional accent fill (now only applied via `--dirty`/`--saved`/default browser styling for the resting non-dirty state, which `:disabled` covers):
```css
.af-submit-btn {
  width: 100%;
  padding: 10px 0;
  border: none;
  border-radius: 6px;
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
  background: var(--color-surface);
  color: var(--color-text-muted);
}
```
(This makes "quiet" the default, with `--dirty`/`--saved`/`--submitting` overriding as needed — `--submitting`'s existing rule already matches the quiet treatment, so it can stay as a harmless duplicate or be removed; leave it in place to avoid an unrelated cleanup in this task.)

- [ ] **Step 5: Run tests to verify they pass, then full suite + lint**

Run: `npx vitest run src/test/AppForm.test.ts`, `npm test`, `npm run lint`
Expected: all pass. Watch specifically for the two pre-existing tests `"submit button shows 'No changes' and is disabled..."` and `"submit button is enabled after user changes a field"` (`AppForm.test.ts:385-416`) — both should still pass unchanged, since neither exercises the saved-state path.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: submit button shows a transient Saved state and a status line instead of a red 'No changes' bar"
```

---

## Task 7: Photo tile empty/uploading state — dashed border, icon, in-tile label

**Files:**
- Modify: `src/components/AppForm.svelte`
- Modify: `src/components/AppForm.css`
- Test: `src/test/AppForm.test.ts`

**Interfaces:** No prop changes.

- [ ] **Step 1: Write the failing test**

```ts
test("empty photo tile shows an in-tile label and hint, not just an icon", () => {
  const fields: FormField[] = [{ id: "pic", type: "photo", label: "Take a photo" }];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onPhotoUpload: vi.fn() } });
  expect(screen.getByText("Add a photo")).toBeInTheDocument();
  expect(screen.getByText("Take one now, or choose a file")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/AppForm.test.ts -t "in-tile label"`
Expected: FAIL — tile currently only renders an `Image` icon, no text.

- [ ] **Step 3: Update markup**

In `AppForm.svelte`, import `Camera` alongside the existing `Image, Check, Dice5` import (line 3):
```ts
import { Image, Check, Camera, Dice5 } from "lucide-svelte";
```
Replace the empty/uploading branch of the photo tile's inner content (lines 397-406 — the `{#if upload?.status === "success" ...}` chain's final `{:else}` branch):
```svelte
{#if upload?.status === "success" && upload.previewDataUrl}
  <img src={upload.previewDataUrl} alt={field.label} class="af-photo-tile__img" />
{:else if upload?.status === "success"}
  <Check size={32} aria-hidden="true" />
{:else if upload?.status === "uploading"}
  <span class="af-photo-tile__spinner" aria-hidden="true"></span>
{:else}
  <Camera size={28} aria-hidden="true" />
  <span class="af-photo-tile__label">Add a photo</span>
  <span class="af-photo-tile__hint">Take one now, or choose a file</span>
{/if}
```
(This also removes the now-redundant separate `{#if upload?.status === "uploading"}<span class="af-photo-tile__spinner">` block a few lines below — the spinner is now the `uploading` branch's sole content, merged into the chain above. Delete that now-duplicate block, lines 404-406 in the pre-Task-1 numbering.)

- [ ] **Step 4: Update CSS**

In `AppForm.css`, change `.af-photo-tile` from a fixed square to an auto-height card for the empty/uploading/error states (the `success` state gets its own, larger class in Task 8):
```css
.af-photo-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  max-width: 320px;
  min-height: 96px;
  padding: 12px;
  border: 1px dashed var(--field-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  box-sizing: border-box;
}

.af-photo-tile__label {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
}

.af-photo-tile__hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
}
```
(Width changes from a fixed `112px` square to `width: 100%; max-width: 320px;` — a dashed square was too narrow to hold "Take one now, or choose a file" without awkward wrapping; `min-height: 96px` matches the spec's tap-target guidance.) Also remove the old `width: 112px; height: 112px;` and `overflow: hidden;` from this rule (overflow moves to the new filled-state class in Task 8, since only the thumbnail image needs corner clipping).

- [ ] **Step 5: Run test to verify it passes, then full suite + lint**

Run: `npx vitest run src/test/AppForm.test.ts`, `npm test`, `npm run lint`
Expected: all pass — watch the pre-existing test `"renders photo button with field label"` (`AppForm.test.ts:87-96`), which queries `getByRole("button", { name: /take a photo/i })` matching the `aria-label`, not the inner text — unaffected by this markup change since the `aria-label` logic (lines 389-393) is untouched in this task.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: photo tile empty state has a dashed border, camera icon, and in-tile label"
```

---

## Task 8: Photo tile uploaded state — larger thumbnail, corner success badge

**Files:**
- Modify: `src/components/AppForm.svelte`
- Modify: `src/components/AppForm.css`
- Test: `src/test/AppForm.test.ts`

**Interfaces:** No prop changes. Depends on Task 7's markup restructure (the `{#if upload?.status === "success"}` branches move out of the shared `.af-photo-tile` button into their own block — see below).

- [ ] **Step 1: Write the failing test**

```ts
test("uploaded photo tile is rendered at the larger filled size with a success badge", () => {
  const fields: FormField[] = [{ id: "pic", type: "photo", label: "Take a photo" }];
  render(AppForm, {
    props: {
      fields,
      onSubmit: vi.fn(),
      onPhotoUpload: vi.fn(),
      initialUploads: { pic: { status: "success", httpCode: 200, previewDataUrl: "data:image/jpeg;base64,X" } },
    },
  });
  const tile = document.querySelector(".af-photo-tile--filled");
  expect(tile).toBeInTheDocument();
  expect(tile!.querySelector(".af-photo-tile__badge")).toBeInTheDocument();
});
```

(`initialUploads` is `AppForm.svelte`'s existing prop that seeds `uploadStates` on mount — confirmed at its `$props()` destructure alongside `baseUploads`/`onUploadsChange`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/AppForm.test.ts -t "filled size"`
Expected: FAIL — no `.af-photo-tile--filled` or `.af-photo-tile__badge` class exists yet.

- [ ] **Step 3: Restructure the success-state markup**

In `AppForm.svelte`, split the single `<button class="af-photo-tile">` into two mutually-exclusive branches — a static filled tile for `success`, and the existing tappable button for every other state:

```svelte
<div class="af-photo-wrap">
  <label class="af-label" class:af-label--required={field.isRequired} for={domId}>{field.label}</label>
  {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}

  {#if upload?.status === "success"}
    <div class="af-photo-tile af-photo-tile--filled">
      {#if upload.previewDataUrl}
        <img src={upload.previewDataUrl} alt={field.label} class="af-photo-tile__img" />
        <span class="af-photo-tile__badge" aria-hidden="true"><Check size={14} /></span>
      {:else}
        <Check size={32} aria-hidden="true" />
      {/if}
    </div>
  {:else}
    <button
      class="af-photo-tile"
      class:af-photo-tile--uploading={upload?.status === "uploading"}
      class:af-photo-tile--error={upload?.status === "error"}
      aria-label={upload?.status === "uploading"
        ? `Uploading photo — ${field.label}`
        : `Take a photo — ${field.label}`}
      onclick={() => (document.getElementById(domId) as HTMLInputElement | null)?.click()}
      disabled={upload?.status === "uploading"}
    >
      {#if upload?.status === "uploading"}
        <span class="af-photo-tile__spinner" aria-hidden="true"></span>
      {:else}
        <Camera size={28} aria-hidden="true" />
        <span class="af-photo-tile__label">Add a photo</span>
        <span class="af-photo-tile__hint">Take one now, or choose a file</span>
      {/if}
    </button>
  {/if}

  <input
    id={domId}
    type="file"
    accept="image/*"
    capture="environment"
    class="af-photo-input"
    onchange={(evt) => handleFileChange(evt, id)}
  />
  {#if upload?.status === "error"}
    <p class="af-photo-error">Upload failed. Try again.</p>
  {/if}
</div>
```
(Task 9 adds Replace/Remove buttons below the filled tile; Task 10 adds the Retry button and error border. This task only handles the filled-tile size/badge split.)

- [ ] **Step 4: Add CSS**

```css
.af-photo-tile--filled {
  position: relative;
  width: 160px;
  height: 160px;
  padding: 0;
  cursor: default;
  overflow: hidden;
  border-style: solid;
}

.af-photo-tile__badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-success);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 5: Run test to verify it passes, then full suite + lint**

Run: `npx vitest run src/test/AppForm.test.ts`, `npm test`, `npm run lint`
Expected: all pass. Check the pre-existing photo-upload success-path tests (search `AppForm.test.ts` for `status: "success"` and `previewDataUrl`) still pass — the `<img>` element and its `src`/`alt` are unchanged, just relocated into the new `.af-photo-tile--filled` wrapper, so `getByAltText`/`querySelector("img")`-style assertions should be unaffected; `aria-label`-based button queries for the *filled* state (previously `"Retake photo — ..."`) will now fail since the filled state is a `<div>`, not a `<button>` — Task 9 reintroduces an equivalent accessible action via the Replace button, so any pre-existing test asserting `getByRole("button", { name: /retake photo/i })` should be updated in Task 9, not this one (note it here, fix it there).

- [ ] **Step 6: Commit**

```bash
git add src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: uploaded photo renders at 160px with a corner success badge, not a 112px chip"
```

---

## Task 9: Photo Replace/Remove actions

**Files:**
- Modify: `src/components/AppForm.svelte`
- Test: `src/test/AppForm.test.ts`

**Interfaces:**
- Produces: `removePhoto(fieldId: string)` internal handler in `AppForm.svelte`. No new props — reuses the existing `onUploadsChange` callback prop that `ChallengeForm.svelte` already wires to `persist()`.

**Note:** this fixes any pre-existing test broken by Task 8's removal of the filled-tile `<button>` (see Task 8 Step 5).

- [ ] **Step 1: Write the failing tests**

```ts
test("Replace and Remove buttons appear below an uploaded photo", () => {
  const fields: FormField[] = [{ id: "pic", type: "photo", label: "Take a photo" }];
  render(AppForm, {
    props: {
      fields,
      onSubmit: vi.fn(),
      onPhotoUpload: vi.fn(),
      initialUploads: { pic: { status: "success", httpCode: 200, previewDataUrl: "data:image/jpeg;base64,X" } },
    },
  });
  expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
});

test("Remove clears the uploaded photo and reverts to the empty tile", async () => {
  const fields: FormField[] = [{ id: "pic", type: "photo", label: "Take a photo" }];
  const onUploadsChange = vi.fn();
  render(AppForm, {
    props: {
      fields,
      onSubmit: vi.fn(),
      onPhotoUpload: vi.fn(),
      onUploadsChange,
      initialUploads: { pic: { status: "success", httpCode: 200, previewDataUrl: "data:image/jpeg;base64,X" } },
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /remove/i }));
  expect(screen.getByText("Add a photo")).toBeInTheDocument();
  expect(onUploadsChange).toHaveBeenCalledWith({});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts -t "Replace and Remove"`
Expected: FAIL — no such buttons exist.

- [ ] **Step 3: Implement**

In `AppForm.svelte`, add near `handleFileChange` (after it, same indentation level):
```ts
function removePhoto(fieldId: string) {
  const next = { ...uploadStates };
  delete next[fieldId];
  uploadStates = next;
  onUploadsChange?.(uploadStates);
}
```
Update the filled-tile markup (from Task 8) to add the action buttons directly below it, inside the same `{#if upload?.status === "success"}` branch, after the closing `</div>` of `.af-photo-tile--filled`:
```svelte
{#if upload?.status === "success"}
  <div class="af-photo-tile af-photo-tile--filled">
    ...
  </div>
  <div class="af-photo-actions">
    <button
      type="button"
      class="af-photo-action"
      aria-label={`Replace photo — ${field.label}`}
      onclick={() => (document.getElementById(domId) as HTMLInputElement | null)?.click()}
    >
      Replace
    </button>
    <button
      type="button"
      class="af-photo-action af-photo-action--remove"
      aria-label={`Remove photo — ${field.label}`}
      onclick={() => removePhoto(id)}
    >
      Remove
    </button>
  </div>
{:else}
```

- [ ] **Step 4: Add CSS**

In `AppForm.css`:
```css
.af-photo-actions {
  display: flex;
  gap: 8px;
}

.af-photo-action {
  padding: 6px 12px;
  border: 1px solid var(--field-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
}

.af-photo-action--remove {
  color: var(--color-error);
  border-color: var(--color-error);
}
```

- [ ] **Step 5: Fix any test broken by Task 8's button-to-div change**

Search `src/test/AppForm.test.ts`, `src/test/ChallengeForm.test.ts`, `src/test/ChallengeCard.test.ts`, `src/test/RouteScreen.test.ts` for `/retake photo/i` — replace any such query with `getByRole("button", { name: /replace/i })`, since "Retake" no longer exists as an accessible name (the filled tile is now a static `<div>`; "Replace" is its functional equivalent).

- [ ] **Step 6: Run tests to verify they pass, then full suite + lint**

Run: `npx vitest run src/test/AppForm.test.ts`, `npm test`, `npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: explicit Replace and Remove actions on an uploaded photo"
```

---

## Task 10: Photo tile error state — border variant, Retry button, live announcement

**Files:**
- Modify: `src/components/AppForm.svelte`
- Modify: `src/components/AppForm.css`
- Test: `src/test/AppForm.test.ts`

**Interfaces:** No new props.

- [ ] **Step 1: Write the failing tests**

```ts
test("errored photo tile has an error-colored border and an explicit Retry button", () => {
  const fields: FormField[] = [{ id: "pic", type: "photo", label: "Take a photo" }];
  render(AppForm, {
    props: {
      fields,
      onSubmit: vi.fn(),
      onPhotoUpload: vi.fn(),
      initialUploads: { pic: { status: "error", httpCode: 0 } },
    },
  });
  expect(document.querySelector(".af-photo-tile--error")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
});

test("upload failure is announced in a live region", () => {
  const fields: FormField[] = [{ id: "pic", type: "photo", label: "Take a photo" }];
  render(AppForm, {
    props: {
      fields,
      onSubmit: vi.fn(),
      onPhotoUpload: vi.fn(),
      initialUploads: { pic: { status: "error", httpCode: 0 } },
    },
  });
  const err = screen.getByText("Upload failed. Try again.");
  expect(err.closest("[aria-live]")).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts -t "error-colored"`
Expected: FAIL — `af-photo-tile--error` class is already conditionally applied from Task 8's Step 3 markup (`class:af-photo-tile--error={upload?.status === "error"}`) but has no CSS rule and no Retry button yet.

- [ ] **Step 3: Add the Retry button and live region**

Update the `{#if upload?.status === "error"}` block at the bottom of the photo field's markup:
```svelte
{#if upload?.status === "error"}
  <p class="af-photo-error" aria-live="polite">Upload failed. Try again.</p>
  <button
    type="button"
    class="af-photo-action"
    aria-label={`Retry photo upload — ${field.label}`}
    onclick={() => (document.getElementById(domId) as HTMLInputElement | null)?.click()}
  >
    Retry
  </button>
{/if}
```

- [ ] **Step 4: Add CSS**

```css
.af-photo-tile--error {
  border-color: var(--color-error);
}
```

- [ ] **Step 5: Run tests to verify they pass, then full suite + lint**

Run: `npx vitest run src/test/AppForm.test.ts`, `npm test`, `npm run lint`
Expected: all pass. The three pre-existing tests asserting `"Upload failed. Try again."` text (`AppForm.test.ts:629,671,741` in pre-Task-1 numbering) should still pass — the text content and position are unchanged, only a new sibling `<button>` and an `aria-live` attribute are added.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: photo upload errors get a visible border, explicit Retry action, and a live announcement"
```

---

## Task 11: `aria-describedby` wiring for text/number/textarea fields

**Files:**
- Modify: `src/components/AppForm.svelte`
- Test: `src/test/AppForm.test.ts`

**Interfaces:** No prop changes.

**Problem:** `AppForm.svelte` has zero `aria-describedby` usage anywhere (confirmed by grep) — subtext and error text render visually adjacent to `.af-input`/`.af-textarea` but aren't programmatically linked, so a screen reader user tabbing into the field doesn't hear the help/error text. This is the one accessibility-floor item the spec calls out for `.af-input`/`.af-textarea` specifically (other field types — radio/multiple/checkbox groups, photo, image-picker, coord-picker — are out of scope for this task; they weren't part of the spec's named P1.2 examples).

- [ ] **Step 1: Write the failing test**

```ts
test("text input is described by its subtext via aria-describedby", () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", subtext: "Keep it short" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  const input = screen.getByLabelText("Your note");
  const describedBy = input.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(screen.getByText("Keep it short").id).toBe(describedBy);
});

test("text input's aria-describedby includes the error message id when invalid", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", isRequired: true },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  const input = screen.getByLabelText("Your note");
  const describedBy = input.getAttribute("aria-describedby") ?? "";
  const errorEl = screen.getByText("Required");
  expect(describedBy.split(" ")).toContain(errorEl.id);
});
```

(Second test assumes clicking Submit while invalid surfaces `errors[id]` — confirm this against `AppForm.svelte`'s existing `handleSubmit`/`validateValues` flow, which already populates `err` used at line 434's `{#if err}` check; if validation instead requires a blur event or different trigger, adjust the test's action accordingly, but keep the assertion on `aria-describedby` containing the error element's `id`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/AppForm.test.ts -t "aria-describedby"`
Expected: FAIL — no `id`/`aria-describedby` attributes exist yet.

- [ ] **Step 3: Implement**

In `AppForm.svelte`, update the shared label/subtext/error block (the `{:else}` branch covering string/textarea/number/radio/multiple, currently):
```svelte
<label class="af-label" class:af-label--required={field.isRequired} for={domId}>{field.label}</label>
{#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
{#if err}<p class="af-error-msg">{err}</p>{/if}
```
to:
```svelte
<label class="af-label" class:af-label--required={field.isRequired} for={domId}>{field.label}</label>
{#if field.subtext}<p class="af-subtext" id={`${domId}-help`}>{field.subtext}</p>{/if}
{#if err}<p class="af-error-msg" id={`${domId}-err`}>{err}</p>{/if}
```
```svelte
{@const describedBy = [field.subtext ? `${domId}-help` : null, err ? `${domId}-err` : null].filter(Boolean).join(" ") || undefined}
```
(add this `{@const}` right after the block above, before the `{#if field.type === "string"}` branch), then add `aria-describedby={describedBy}` to the `string` input (line ~439), the `textarea` (line ~446), and the `number` input (line ~457) — the three element tags that immediately follow this shared block.

- [ ] **Step 4: Run tests to verify they pass, then full suite + lint**

Run: `npx vitest run src/test/AppForm.test.ts`, `npm test`, `npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppForm.svelte src/test/AppForm.test.ts
git commit -m "fix: link input subtext and error text via aria-describedby"
```

---

## Self-Review Notes (for whoever executes this plan)

- **F2 (content mismatch) is dropped** — `004_lange_voorhout.yaml` no longer references `004_form_lange_voorhout.yaml` at all (confirmed by re-reading the file during planning; it was edited independently during this session). The orphaned `004_form_lange_voorhout.yaml` file can be deleted as unrelated cleanup, but that's not part of this plan.
- **Line numbers throughout reference the pre-Task-1 state of each file.** Since tasks are sequential and each edits files touched by earlier tasks, re-read the actual current line numbers before editing rather than trusting a stale line reference from this document.
- **`hasSubmittedButNoChanges` (Task 6)** is new state living in `AppForm.svelte`, distinct from `ChallengeForm.svelte`'s existing `hasSubmittedOnce` — the two are related but not the same variable; don't try to thread `ChallengeForm`'s value down as a prop, since `AppForm.svelte` has no such prop today and adding one is out of scope beyond what Task 6 already specifies.
- Accessibility-floor items are split across tasks by what they touch: submit-state live announcement is in Task 6, upload-error live announcement and Retry are in Task 10, and `aria-describedby` for `.af-input`/`.af-textarea` is Task 11. Non-color focus state is in Task 4. `aria-describedby` for field types outside `.af-input`/`.af-textarea` (radio/multiple groups, photo, image-picker, coord-picker) is **not** covered by any task here — it wasn't named in the spec's P1.2 examples, and adding it is a larger, separately-scoped effort spanning every field-type branch in `AppForm.svelte`.
