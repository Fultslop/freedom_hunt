# Task 01 — TitleBar Subtitle Rendering

**Goal:** Extend the title bar store with `subtitle` and `isDirty` fields; render a muted subtitle line with an optional `*` indicator.

**Files:**
- Modify: `src/stores/titleBarStore.ts`
- Modify: `src/components/TitleBar.svelte`
- Modify: `src/components/TitleBar.css`
- Test: `src/test/TitleBar.test.ts`

---

- [ ] **Step 1: Write failing tests**

Open `src/test/TitleBar.test.ts` and add three tests after the existing five:

```ts
test("does not render subtitle when subtitle is not set", () => {
  render(TitleBar);
  expect(screen.queryByTestId("titlebar-subtitle")).not.toBeInTheDocument();
});

test("renders subtitle without asterisk when isDirty is false", () => {
  titleBarStore.set({
    title: "Test",
    progress: null,
    backPath: null,
    subtitle: "Dam Square",
    isDirty: false,
  });
  render(TitleBar);
  expect(screen.getByTestId("titlebar-subtitle")).toHaveTextContent(
    "Dam Square",
  );
});

test("renders subtitle with asterisk when isDirty is true", () => {
  titleBarStore.set({
    title: "Test",
    progress: null,
    backPath: null,
    subtitle: "Dam Square",
    isDirty: true,
  });
  render(TitleBar);
  expect(screen.getByTestId("titlebar-subtitle")).toHaveTextContent(
    "Dam Square *",
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test -- TitleBar
```

Expected: 3 failures — `queryByTestId("titlebar-subtitle")` returns null even when subtitle is set.

- [ ] **Step 3: Extend TitleBarState**

In `src/stores/titleBarStore.ts`, add the two optional fields to the interface:

```ts
export interface TitleBarState {
  title?: string;
  progress?: { current: number; total: number } | null;
  backPath?: string | null;
  subtitle?: string;
  isDirty?: boolean;
}
```

No other changes needed in this file.

- [ ] **Step 4: Add CSS for subtitle**

In `src/components/TitleBar.css`, append at the end:

```css
.titlebar__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.titlebar__subtitle {
  font-size: 11px;
  color: var(--color-bar-text-secondary);
  font-weight: 400;
  line-height: 1.2;
}
```

- [ ] **Step 5: Update TitleBar template**

In `src/components/TitleBar.svelte`, find this block inside `<div class="titlebar__left">`:

```svelte
      <span class="titlebar__title">{$titleBarStore.title}</span>
```

Replace it with:

```svelte
      <div class="titlebar__title-wrap">
        <span class="titlebar__title">{$titleBarStore.title}</span>
        {#if $titleBarStore.subtitle}
          <span
            class="titlebar__subtitle"
            data-testid="titlebar-subtitle"
          >{$titleBarStore.subtitle}{$titleBarStore.isDirty ? " *" : ""}</span>
        {/if}
      </div>
```

- [ ] **Step 6: Run tests to verify they pass**

```
npm run test -- TitleBar
```

Expected: all 8 tests pass.

- [ ] **Step 7: Run lint**

```
npm run lint
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```
git add src/stores/titleBarStore.ts src/components/TitleBar.svelte src/components/TitleBar.css src/test/TitleBar.test.ts
git commit -m "feat: add subtitle and isDirty fields to TitleBar"
```
