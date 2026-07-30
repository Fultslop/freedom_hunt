# TitleBar Menu — Close on Outside Click / Escape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The TitleBar's ☰ menu (Profile / Themes / Text Size) currently only closes when the
user clicks the ☰ button again. Make it also close when the user clicks anywhere outside the
menu, or presses Escape.

**Architecture:** `TitleBar.svelte`'s `.titlebar__menu-wrap` div already wraps both the ☰
button and the dropdown itself. Bind that div via `bind:this`, and add a single always-mounted
`<svelte:window onclick|onkeydown>` pair. The click handler is a no-op while the menu is
closed; while open, it closes the menu (`menuView = null`) whenever the click target isn't
contained within the bound wrapper. The keydown handler closes the menu on `Escape`, mirroring
the existing pattern in `PhotoLightbox.svelte` and `ImagePickerDialog.svelte`. Because the ☰
button lives inside the bound wrapper, the click that opens the menu is never misread as an
"outside" click — no timing hacks needed. Outside click / Escape always closes the menu
completely, regardless of which submenu (root/profile/themes/fontsize) is showing. This was
agreed conversationally during brainstorming (no separate spec doc — the fix is single-file and
self-contained); no new reusable action/abstraction, since no other dropdown-style popover
exists in this codebase today.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte/svelte5`.

## Global Constraints

- TypeScript only — `.svelte` (`<script lang="ts">`) and `.ts`. No `.js`/`.jsx`/`.tsx` in `src/`.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`) — never Svelte 4 `$:`.
- No abstractions for one-off things — implement inline in `TitleBar.svelte`, do not extract a
  reusable `clickOutside` action.
- Never use Playwright or any browser automation to verify this change — this project's
  `CLAUDE.md` reserves manual verification for the user. Verification here is Vitest,
  `npm run typecheck`, and `npm run lint` only.
- **Do not invoke git commands.** This repository's `CLAUDE.md` states the user controls git
  exclusively. The task ends with a "stage for review" step listing changed files — it never
  runs `git add`/`git commit`. Committing is the user's call.
- Test commands: `npx vitest run src/test/TitleBar.test.ts` (single file), `npm run test:run`
  (whole suite), `npm run typecheck`, `npm run lint`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/TitleBar.svelte` | Bind `.titlebar__menu-wrap`; add outside-click / Escape close handlers |
| `src/test/TitleBar.test.ts` | New tests for outside-click-closes, inside-click-does-not-close, Escape-closes, closes-completely-from-a-submenu |

No CSS changes — this is a behavior-only fix.

---

### Task 1: Close the TitleBar menu on outside click and Escape

**Files:**
- Modify: `src/components/TitleBar.svelte:1-25` (script block), `:50-57` (menu-wrap div)
- Test: `src/test/TitleBar.test.ts`

**Interfaces:**
- Consumes: existing `menuView` state and `closeMenu()` function already defined in
  `TitleBar.svelte` (no change to their signatures).
- Produces: no new exports — this task only changes internal component behavior. Nothing else
  in the codebase depends on it.

- [ ] **Step 1: Write the failing tests**

Add these tests to the end of `src/test/TitleBar.test.ts` (after the existing tests, before
end of file). The file already imports `render`, `screen` from
`@testing-library/svelte/svelte5` — add `fireEvent` to that import:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
```

Then append:

```ts
test("closes the menu when clicking outside of it", async () => {
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  expect(screen.getByText("Profile")).toBeInTheDocument();

  await fireEvent.click(document.body);

  expect(screen.queryByText("Profile")).not.toBeInTheDocument();
});

test("does not close the menu when clicking inside the dropdown", async () => {
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));

  await fireEvent.click(screen.getByText("Profile"));

  expect(screen.getByLabelText("Back to menu")).toBeInTheDocument();
});

test("closes the menu completely from a submenu when clicking outside", async () => {
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  await fireEvent.click(screen.getByText("Themes"));
  expect(screen.getByLabelText("Back to menu")).toBeInTheDocument();

  await fireEvent.click(document.body);

  expect(screen.queryByLabelText("Back to menu")).not.toBeInTheDocument();
  expect(screen.queryByText("Profile")).not.toBeInTheDocument();
});

test("closes the menu when Escape is pressed", async () => {
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  expect(screen.getByText("Profile")).toBeInTheDocument();

  await fireEvent.keyDown(window, { key: "Escape" });

  expect(screen.queryByText("Profile")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/test/TitleBar.test.ts`

Expected: the 4 new tests FAIL (the menu stays open after the outside click / Escape, so
`queryByText("Profile")` still finds it).

- [ ] **Step 3: Bind the menu wrapper and add the close handlers**

In `src/components/TitleBar.svelte`, change the script block from:

```svelte
  let menuView = $state<string | null>(null);

  function closeMenu() {
    menuView = null;
  }

  function handleBack() {
    if ($titleBarStore.backPath) {
      push($titleBarStore.backPath);
    }
  }
</script>
```

to:

```svelte
  let menuView = $state<string | null>(null);
  let menuWrapEl: HTMLDivElement | undefined;

  function closeMenu() {
    menuView = null;
  }

  function handleBack() {
    if ($titleBarStore.backPath) {
      push($titleBarStore.backPath);
    }
  }

  function handleWindowClick(event: MouseEvent) {
    if (!menuView) {
      return;
    }
    if (event.target instanceof Node && !menuWrapEl?.contains(event.target)) {
      closeMenu();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (menuView && event.key === "Escape") {
      closeMenu();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />
```

Then change the menu-wrap div (currently `<div class="titlebar__menu-wrap">`) to bind it:

```svelte
    <div class="titlebar__menu-wrap" bind:this={menuWrapEl}>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/TitleBar.test.ts`

Expected: all tests PASS (the 4 new ones plus the pre-existing ones — the pre-existing tests
never open the menu, so they're unaffected).

- [ ] **Step 5: Run typecheck and lint**

Run: `npm run typecheck`
Run: `npm run lint`

Expected: both PASS with no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test:run`

Expected: all tests PASS (no regressions elsewhere).

- [ ] **Step 7: Stage for review**

List the changed files for the user to review and commit themselves (do not run `git add` /
`git commit` — this repo's `CLAUDE.md` reserves git operations for the user):

- `src/components/TitleBar.svelte`
- `src/test/TitleBar.test.ts`
