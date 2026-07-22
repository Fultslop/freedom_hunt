# Task 03: Refresh `authStore` After Invite Acceptance

**Files:**
- Modify: `src/utils/api.ts`
- Modify: `src/pages/editor/EditorLoginPage.svelte`
- Modify: `src/pages/SignupPage.svelte`
- Modify: `src/pages/InviteAcceptPage.svelte`
- Modify: `src/test/EditorLoginPage.test.ts`
- Modify: `src/test/SignupPage.test.ts`
- Modify: `src/test/InviteAcceptPage.test.ts`

**Background (critical bug):** Three pages call `postInviteAccept()` but discard its response. The server returns `{ ok, userId, email, username, capabilities, projectId }` — but the store is never updated. A brand-new user's login/signup response has `capabilities: []`. After `postInviteAccept` grants them `editor`, the store still shows `[]`. `requireEditorAccess()` sees an empty capabilities array and redirects them back to login — a permanent redirect loop.

The fix in all three pages: after `postInviteAccept` returns `ok: true`, call `authStore.loginEditor()` with the response's data to replace the stale store state.

The `InviteAcceptResponse` interface in `api.ts` is also missing `userId`, `email`, and `username` fields that the backend already returns.

**Test context note:** Each file mocks differently:
- `EditorLoginPage.test.ts` — does NOT mock `authStore`, uses the real store. Use `get(authStore)` to assert.
- `SignupPage.test.ts` — mocks `authStore` as `{ loginEditor: vi.fn(), subscribe: vi.fn(...) }`. Use `expect(authStore.loginEditor).toHaveBeenCalledWith(...)` to assert.
- `InviteAcceptPage.test.ts` — does NOT mock `authStore`, uses `authStore.setForTest()`. Use `get(authStore)` to assert.

---

- [ ] **Step 1: Update `InviteAcceptResponse` in `src/utils/api.ts` and fix trailing newline**

Find the existing interface (search for `InviteAcceptResponse`):

```typescript
export interface InviteAcceptResponse {
  ok: boolean;
  projectId?: string;
  capabilities?: string[];
  error?: string;
}
```

Replace with:

```typescript
export interface InviteAcceptResponse {
  ok: boolean;
  projectId?: string;
  capabilities?: string[];
  userId?: string;
  email?: string;
  username?: string;
  error?: string;
}
```

Also ensure the file ends with a single `\n` after the last closing `}`.

---

- [ ] **Step 2: Write a failing test for `EditorLoginPage`**

In `src/test/EditorLoginPage.test.ts`, find the `"accepts a pending invite after login"` test inside `describe("EditorLoginPage — new fields", ...)`:

```typescript
it("accepts a pending invite after login", async () => {
  const api = await import("../utils/api");
  sessionStorage.setItem("pendingInvite", "tok456");
  vi.mocked(api.postUserLogin).mockResolvedValue({
    ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: ["editor"],
  });
  vi.mocked(api.postInviteAccept).mockResolvedValue({ ok: true, capabilities: ["editor"] });
  ...
```

The login mock already returns `capabilities: ["editor"]`, so the bug (empty caps after login+invite) is not exercised. Change the login mock to return `capabilities: []` (the realistic new-user case) and update the invite accept mock to return full user data. Also add imports for `authStore` and `get`, and assert the store has been updated.

Add these imports near the top of the test file (after existing imports):

```typescript
import { get } from "svelte/store";
import { authStore } from "../stores/authStore";
```

Replace the entire `"accepts a pending invite after login"` test with:

```typescript
it("updates authStore with invite capabilities after login with pending invite", async () => {
  const api = await import("../utils/api");
  sessionStorage.setItem("pendingInvite", "tok456");
  // Login returns no capabilities — user just registered
  vi.mocked(api.postUserLogin).mockResolvedValue({
    ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: [],
  });
  // Invite accept grants editor
  vi.mocked(api.postInviteAccept).mockResolvedValue({
    ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: ["editor"],
  });
  render(EditorLoginPage);
  await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
  await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
  await fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => {
    expect(api.postInviteAccept).toHaveBeenCalledWith("tok456");
    expect(sessionStorage.getItem("pendingInvite")).toBeNull();
    const state = get(authStore);
    expect(state.activeAuth?.kind).toBe("editor");
    if (state.activeAuth?.kind === "editor") {
      expect(state.activeAuth.capabilities).toContain("editor");
    }
  });
});
```

Run: `npm run test:run -- src/test/EditorLoginPage.test.ts`

Expected: FAIL — the `waitFor` assertion on `state.activeAuth.capabilities` fails because the store still holds `[]` after the invite accept.

---

- [ ] **Step 3: Fix `src/pages/editor/EditorLoginPage.svelte`**

Find the pending invite block (around lines 30–34):

```typescript
const pendingInvite = sessionStorage.getItem("pendingInvite");
if (pendingInvite) {
  sessionStorage.removeItem("pendingInvite");
  await postInviteAccept(pendingInvite);
}
```

Replace with:

```typescript
const pendingInvite = sessionStorage.getItem("pendingInvite");
if (pendingInvite) {
  sessionStorage.removeItem("pendingInvite");
  const inviteData = await postInviteAccept(pendingInvite);
  if (inviteData.ok && inviteData.userId) {
    authStore.loginEditor(
      inviteData.userId,
      inviteData.email ?? data.email ?? email,
      inviteData.username ?? data.username ?? "",
      inviteData.capabilities ?? [],
    );
  }
}
```

---

- [ ] **Step 4: Run EditorLoginPage tests**

```
npm run test:run -- src/test/EditorLoginPage.test.ts
```

Expected: all tests pass.

---

- [ ] **Step 5: Write a failing test for `SignupPage`**

`SignupPage.test.ts` mocks `authStore` as a plain object:
```typescript
vi.mock("../stores/authStore", () => ({
  authStore: { loginEditor: vi.fn(), subscribe: vi.fn(() => () => {}) },
}));
```
So use `expect(authStore.loginEditor).toHaveBeenCalledWith(...)` to assert the correct capabilities, not `get(authStore)`.

In `src/test/SignupPage.test.ts`, find the existing test:

```typescript
it("accepts a pending invite after signup and navigates to /editor", async () => {
  sessionStorage.setItem("pendingInvite", "tok123");
  vi.mocked(api.postSignup).mockResolvedValue({
    ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: [],
  });
  vi.mocked(api.postInviteAccept).mockResolvedValue({ ok: true, capabilities: ["editor"] });
  ...
  await waitFor(() => {
    expect(api.postInviteAccept).toHaveBeenCalledWith("tok123");
    expect(sessionStorage.getItem("pendingInvite")).toBeNull();
    expect(push).toHaveBeenCalledWith("/editor");
  });
});
```

Update the `postInviteAccept` mock to return full user data, and extend the `waitFor` assertion to check that `loginEditor` was called with the invite capabilities (`["editor"]`), not the empty ones from signup:

```typescript
it("accepts a pending invite after signup and navigates to /editor", async () => {
  sessionStorage.setItem("pendingInvite", "tok123");
  vi.mocked(api.postSignup).mockResolvedValue({
    ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: [],
  });
  vi.mocked(api.postInviteAccept).mockResolvedValue({
    ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: ["editor"],
  });
  render(SignupPage);
  await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
  await fireEvent.input(screen.getByLabelText(/username/i), { target: { value: "alice" } });
  await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
  await fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => {
    expect(api.postInviteAccept).toHaveBeenCalledWith("tok123");
    expect(sessionStorage.getItem("pendingInvite")).toBeNull();
    expect(push).toHaveBeenCalledWith("/editor");
    // loginEditor must be called with the invite capabilities, not the empty [] from signup
    expect(authStore.loginEditor).toHaveBeenLastCalledWith(
      "u1", "a@b.com", "alice", ["editor"],
    );
  });
});
```

Run: `npm run test:run -- src/test/SignupPage.test.ts`

Expected: FAIL — `loginEditor` is called only once with `[]` from signup; the invite capabilities are discarded.

---

- [ ] **Step 6: Fix `src/pages/SignupPage.svelte`**

Find the pending invite block (around lines 39–43):

```typescript
const pendingInvite = sessionStorage.getItem("pendingInvite");
if (pendingInvite) {
  sessionStorage.removeItem("pendingInvite");
  await postInviteAccept(pendingInvite);
}
```

Replace with:

```typescript
const pendingInvite = sessionStorage.getItem("pendingInvite");
if (pendingInvite) {
  sessionStorage.removeItem("pendingInvite");
  const inviteData = await postInviteAccept(pendingInvite);
  if (inviteData.ok && inviteData.userId) {
    authStore.loginEditor(
      inviteData.userId,
      inviteData.email ?? data.email ?? email,
      inviteData.username ?? data.username ?? username,
      inviteData.capabilities ?? [],
    );
  }
}
```

---

- [ ] **Step 7: Run SignupPage tests**

```
npm run test:run -- src/test/SignupPage.test.ts
```

Expected: all tests pass.

---

- [ ] **Step 8: Write a failing test for `InviteAcceptPage`**

`InviteAcceptPage.test.ts` does not mock `authStore` — it uses the real store via `authStore.setForTest()`. So `get(authStore)` works.

In `src/test/InviteAcceptPage.test.ts`, find the test "calls postInviteAccept and navigates to /editor on accept":

```typescript
it("calls postInviteAccept and navigates to /editor on accept", async () => {
  vi.mocked(api.fetchInviteToken).mockResolvedValue({
    ok: true, projectId: "proj", capability: "editor", expiresAt: 9999999999,
  });
  vi.mocked(api.postInviteAccept).mockResolvedValue({
    ok: true, capabilities: ["editor"], projectId: "proj",
  });
  render(InviteAcceptPage, { params: { token: "tok123" } });
  await waitFor(() => screen.getByRole("button", { name: /accept/i }));
  await fireEvent.click(screen.getByRole("button", { name: /accept/i }));
  await waitFor(() => {
    expect(api.postInviteAccept).toHaveBeenCalledWith("tok123");
    expect(push).toHaveBeenCalledWith("/editor");
  });
});
```

Update the `postInviteAccept` mock to include `userId`, `email`, `username`. Add a store assertion to `waitFor`. Also add `get` to the imports at the top (it's not currently imported):

```typescript
import { get } from "svelte/store";
```

Replace the test:

```typescript
it("calls postInviteAccept, updates authStore capabilities, and navigates to /editor", async () => {
  vi.mocked(api.fetchInviteToken).mockResolvedValue({
    ok: true, projectId: "proj", capability: "editor", expiresAt: 9999999999,
  });
  vi.mocked(api.postInviteAccept).mockResolvedValue({
    ok: true,
    userId: "u1",
    email: "a@b.com",
    username: "alice",
    capabilities: ["editor"],
    projectId: "proj",
  });
  render(InviteAcceptPage, { params: { token: "tok123" } });
  await waitFor(() => screen.getByRole("button", { name: /accept/i }));
  await fireEvent.click(screen.getByRole("button", { name: /accept/i }));
  await waitFor(() => {
    expect(api.postInviteAccept).toHaveBeenCalledWith("tok123");
    expect(push).toHaveBeenCalledWith("/editor");
    const state = get(authStore);
    expect(state.activeAuth?.kind).toBe("editor");
    if (state.activeAuth?.kind === "editor") {
      expect(state.activeAuth.capabilities).toContain("editor");
    }
  });
});
```

Run: `npm run test:run -- src/test/InviteAcceptPage.test.ts`

Expected: FAIL — `handleAccept` doesn't call `authStore.loginEditor`, so capabilities remain `[]`.

---

- [ ] **Step 9: Fix `src/pages/InviteAcceptPage.svelte`**

Add `authStore` to the imports at the top of the script (it's already imported via `authStore` for `get(authStore)` in `validateToken`, but check if it's already imported):

The file already imports: `import { authStore } from "../stores/authStore";`

Find `handleAccept` (around lines 52–66):

```typescript
async function handleAccept() {
  accepting = true;
  error = null;
  try {
    const data = await postInviteAccept(params.token);
    if (data.ok) {
      push("/editor");
    } else {
      error = data.error ?? "Could not accept invite.";
    }
  } catch {
    error = "Connection error. Please try again.";
  } finally {
    accepting = false;
  }
}
```

Replace with:

```typescript
async function handleAccept() {
  accepting = true;
  error = null;
  try {
    const data = await postInviteAccept(params.token);
    if (data.ok) {
      if (data.userId) {
        authStore.loginEditor(
          data.userId,
          data.email ?? "",
          data.username ?? "",
          data.capabilities ?? [],
        );
      }
      push("/editor");
    } else {
      error = data.error ?? "Could not accept invite.";
    }
  } catch {
    error = "Connection error. Please try again.";
  } finally {
    accepting = false;
  }
}
```

---

- [ ] **Step 10: Run InviteAcceptPage tests**

```
npm run test:run -- src/test/InviteAcceptPage.test.ts
```

Expected: all tests pass.

---

- [ ] **Step 11: Run the full test suite**

```
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 12: Commit**

```
git add src/utils/api.ts src/pages/editor/EditorLoginPage.svelte src/pages/SignupPage.svelte src/pages/InviteAcceptPage.svelte src/test/EditorLoginPage.test.ts src/test/SignupPage.test.ts src/test/InviteAcceptPage.test.ts
git commit -m "fix: refresh authStore capabilities after invite acceptance to prevent redirect loop"
```
