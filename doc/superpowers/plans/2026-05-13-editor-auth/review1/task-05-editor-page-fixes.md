# Task 05: `EditorPage` Hardcoded Project + Restore Redirect Test

**Files:**
- Modify: `src/pages/editor/EditorPage.svelte`
- Modify: `src/test/EditorPage.test.ts`

Two small fixes:

1. `handleInvite` passes the string literal `"democrats_abroad"` to `postInviteCreate` instead of using the already-derived `project` variable. When a second project is added, invite creation will silently target the wrong project for any non-DA editor. The `project` variable is already derived correctly at line 17 and should be used.

2. The `"does not redirect when auth has loaded with valid editor session"` test was deleted from `EditorPage.test.ts` during the `requireAdmin → requireEditorAccess` migration, leaving the guard's happy path without a test.

---

- [ ] **Step 1: Add the missing happy-path redirect guard test**

In `src/test/EditorPage.test.ts`, find the `describe("auth guard effect", ...)` block. It currently contains only the negative case ("redirects to /editor/login when..."). Add the positive case after it:

```typescript
test("does not redirect when auth has loaded with a valid editor session", async () => {
  authStore.setForTest({
    activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "admin", capabilities: ["organizer"] },
    authLoading: false,
    isLoggingOut: false,
  });
  render(EditorPage);
  await Promise.resolve();
  await Promise.resolve();
  expect(replace).not.toHaveBeenCalled();
});
```

Run: `npm run test:run -- src/test/EditorPage.test.ts`

Expected: new test passes (the guard is already correct — we're just adding the missing coverage).

---

- [ ] **Step 2: Update `handleInvite` in `src/pages/editor/EditorPage.svelte`**

Find the call (line 38):

```typescript
const data = await postInviteCreate("democrats_abroad", "editor");
```

Replace with:

```typescript
const data = await postInviteCreate(project, "editor");
```

`project` is the `$derived` value declared at line 17. No other changes needed.

---

- [ ] **Step 3: Run the full test suite**

```
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 4: Commit**

```
git add src/pages/editor/EditorPage.svelte src/test/EditorPage.test.ts
git commit -m "fix: use derived project variable in EditorPage invite; restore auth guard happy-path test"
```
