# Task 09: Refactor Auth Callers to Use api.ts

**Files:**
- Modify: `src/stores/authStore.ts`
- Modify: `src/pages/LoginPage.svelte`
- Modify: `src/pages/editor/EditorLoginPage.svelte`

---

## `authStore.ts`

- [ ] **Step 1: Update imports and replace `fetch` calls in `authStore.ts`**

At the top of `src/stores/authStore.ts`, add the import:

```typescript
import { fetchAuthMe, postLogout } from "../utils/api";
```

Replace the `init` function body:

```typescript
  async function init() {
    try {
      const data = await fetchAuthMe();
      if (data.ok) {
        upd((state) => ({
          ...state,
          activeAuth: {
            projectId: data.project as string,
            teamName: data.teamName as string,
            contact: (data.contact as string) ?? null,
            isAdmin: (data.isAdmin as boolean) ?? false,
          },
        }));
      }
    } catch {
      /* ignore network errors on auth check */
    }
    upd((state) => ({ ...state, authLoading: false }));
  }
```

Replace the `logout` function body:

```typescript
  async function logout() {
    upd((state) => ({ ...state, isLoggingOut: true }));
    try {
      await postLogout();
    } catch {
      /* ignore logout errors */
    }
    set({ activeAuth: null, authLoading: false, isLoggingOut: false });
    replace("/");
  }
```

---

## `LoginPage.svelte`

- [ ] **Step 2: Update `LoginPage.svelte`**

Add import at the top of the `<script>` block:

```typescript
  import { postLogin } from "../utils/api";
```

Replace the `handleSubmit` function body (the `try` block only — keep the `e.preventDefault()`, `error = null`, `loading = true` lines and the `finally`):

```typescript
    try {
      const data = await postLogin({
        project: params.project,
        teamName,
        contact,
        password,
      });
      if (data.ok) {
        authStore.login(
          params.project,
          data.teamName ?? teamName,
          data.contact ?? contact,
          data.isAdmin ?? false,
        );
        push(data.isAdmin ? "/editor" : `/${params.project}`);
      } else {
        error = data.error || "Incorrect password. Please try again.";
      }
    } catch {
      error = "Connection error. Please try again.";
    }
```

---

## `EditorLoginPage.svelte`

- [ ] **Step 3: Update `EditorLoginPage.svelte`**

Add import at the top of the `<script>` block:

```typescript
  import { postLogin } from "../../utils/api";
```

Replace the `handleSubmit` function body (the `try` block only):

```typescript
    try {
      const data = await postLogin({
        project,
        teamName: "",
        contact: "",
        password,
      });
      if (data.ok && data.isAdmin) {
        authStore.login(project, "", "", true);
        push("/editor");
      } else if (data.ok && !data.isAdmin) {
        error = "These credentials do not have organiser access.";
      } else {
        error = data.error ?? "Incorrect password.";
      }
    } catch {
      error = "Connection error. Please try again.";
    }
```

---

- [ ] **Step 4: Run lint**

```
npm run lint
```

Expected: passes cleanly.

- [ ] **Step 5: Run tests**

```
npm test -- LoginPage EditorLoginPage stores
```

Auth-related tests may fail because they mock `globalThis.fetch`. They will be fixed in Task 12.

- [ ] **Step 6: Commit**

```
git add src/stores/authStore.ts src/pages/LoginPage.svelte src/pages/editor/EditorLoginPage.svelte
git commit -m "refactor: authStore, LoginPage, EditorLoginPage use api.ts"
```
