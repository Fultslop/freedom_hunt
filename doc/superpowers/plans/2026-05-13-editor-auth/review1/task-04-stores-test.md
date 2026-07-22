# Task 04: Add `stores.test.ts` Editor Session Tests

**Files:**
- Modify: `src/test/stores.test.ts`

**Background:** Task 08 of the original plan required adding editor-session tests to `stores.test.ts`, but they were not staged. The `authStore.init()` dual-shape logic and the new `loginEditor`/`loginParticipant` methods have no direct test coverage.

`stores.test.ts` currently tests `themeStore`, `fontSizeStore`, `titleBarStore`, and `languageStore`. The `authStore` is not tested in this file yet. The test harness uses Vitest with `vi.spyOn(globalThis, "fetch")` for mocking network calls.

---

- [ ] **Step 1: Add authStore imports to `src/test/stores.test.ts`**

At the top of the file, after the existing imports, add:

```typescript
import { get } from "svelte/store";
import { authStore } from "../stores/authStore";
```

Then add `beforeEach` cleanup so each `authStore` test starts fresh. Add this block after the existing `languageStore` describe block at the bottom of the file:

```typescript
describe("authStore", () => {
  beforeEach(() => {
    authStore.setForTest({ activeAuth: null, authLoading: true, isLoggingOut: false });
    vi.restoreAllMocks();
  });
```

---

- [ ] **Step 2: Write failing tests**

Complete the `describe("authStore", ...)` block opened in Step 1:

```typescript
describe("authStore", () => {
  beforeEach(() => {
    authStore.setForTest({ activeAuth: null, authLoading: true, isLoggingOut: false });
    vi.restoreAllMocks();
  });

  describe("init() — editor session", () => {
    it("sets EditorAuthState when /auth/me returns userId", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            userId: "u1",
            email: "a@b.com",
            username: "alice",
            capabilities: ["editor"],
          }),
        ),
      );
      await authStore.init();
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
      expect(state.activeAuth?.kind).toBe("editor");
      if (state.activeAuth?.kind === "editor") {
        expect(state.activeAuth.userId).toBe("u1");
        expect(state.activeAuth.email).toBe("a@b.com");
        expect(state.activeAuth.username).toBe("alice");
        expect(state.activeAuth.capabilities).toEqual(["editor"]);
      }
    });

    it("sets capabilities to empty array when /auth/me omits capabilities", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, userId: "u2", email: "b@c.com", username: "bob" })),
      );
      await authStore.init();
      const state = get(authStore);
      expect(state.activeAuth?.kind).toBe("editor");
      if (state.activeAuth?.kind === "editor") {
        expect(state.activeAuth.capabilities).toEqual([]);
      }
    });
  });

  describe("init() — participant session", () => {
    it("sets ParticipantAuthState when /auth/me returns project", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            project: "democrats_abroad",
            teamName: "Team A",
            contact: "a@b.com",
            isAdmin: false,
          }),
        ),
      );
      await authStore.init();
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
      expect(state.activeAuth?.kind).toBe("participant");
      if (state.activeAuth?.kind === "participant") {
        expect(state.activeAuth.projectId).toBe("democrats_abroad");
        expect(state.activeAuth.teamName).toBe("Team A");
        expect(state.activeAuth.isAdmin).toBe(false);
      }
    });
  });

  describe("init() — unauthenticated", () => {
    it("leaves activeAuth null when /auth/me returns ok: false", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: "Not authenticated" }), { status: 401 }),
      );
      await authStore.init();
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
      expect(state.activeAuth).toBeNull();
    });

    it("leaves activeAuth null and does not throw when fetch rejects", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
      await authStore.init();
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
      expect(state.activeAuth).toBeNull();
    });
  });

  describe("loginEditor", () => {
    it("sets EditorAuthState immediately", () => {
      authStore.loginEditor("u3", "c@d.com", "carol", ["organizer"]);
      const state = get(authStore);
      expect(state.activeAuth?.kind).toBe("editor");
      if (state.activeAuth?.kind === "editor") {
        expect(state.activeAuth.userId).toBe("u3");
        expect(state.activeAuth.capabilities).toEqual(["organizer"]);
      }
    });
  });

  describe("loginParticipant", () => {
    it("sets ParticipantAuthState immediately", () => {
      authStore.loginParticipant("proj_x", "Team B", "b@c.com", false);
      const state = get(authStore);
      expect(state.activeAuth?.kind).toBe("participant");
      if (state.activeAuth?.kind === "participant") {
        expect(state.activeAuth.projectId).toBe("proj_x");
        expect(state.activeAuth.teamName).toBe("Team B");
        expect(state.activeAuth.isAdmin).toBe(false);
      }
    });

    it("defaults isAdmin to false when omitted", () => {
      authStore.loginParticipant("proj_y", "Team C", "c@d.com");
      const state = get(authStore);
      if (state.activeAuth?.kind === "participant") {
        expect(state.activeAuth.isAdmin).toBe(false);
      }
    });
  });
});
```

---

- [ ] **Step 3: Run the new tests**

```
npm run test:run -- src/test/stores.test.ts
```

Expected: all new tests pass (the implementations already exist — this task adds missing test coverage for correct code).

---

- [ ] **Step 4: Run the full test suite**

```
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 5: Commit**

```
git add src/test/stores.test.ts
git commit -m "test: add authStore editor/participant session tests to stores.test.ts"
```
