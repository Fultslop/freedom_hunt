# Task 01: Move `cookieHeader` to `auth.ts`

**Files:**
- Modify: `src/worker/auth.ts`
- Modify: `src/worker/routes/authRoutes.ts`
- Modify: `src/worker/routes/inviteRoutes.ts`

`cookieHeader` is identical in both route files. Move it to `auth.ts` and import it where needed. No behaviour change — existing tests prove correctness.

---

- [ ] **Step 1: Export `cookieHeader` from `src/worker/auth.ts`**

Add this function at the bottom of the file (after `requireAuth`):

```typescript
export function cookieHeader(token: string, ttl: number): string {
  return `${COOKIE_NAME}=${token}; ${AUTH_COOKIE_ATTRS}; Max-Age=${ttl}`;
}
```

---

- [ ] **Step 2: Update `src/worker/routes/authRoutes.ts`**

Remove the local definition (the block that reads `function cookieHeader(...): string { ... }`) and add `cookieHeader` to the import from `../auth`:

```typescript
import {
  checkRateLimit,
  createToken,
  requireAuth,
  cookieHeader,
  COOKIE_NAME,
  TOKEN_TTL_SECONDS,
  BOOTSTRAP_TTL_SECONDS,
  AUTH_COOKIE_ATTRS,
  KV_PREFIX_ADMIN,
  KV_PREFIX_PARTICIPANT,
} from "../auth";
```

The local `function cookieHeader` near the top of the file (lines starting `function cookieHeader(token: string, ttl: number): string {`) should be deleted.

---

- [ ] **Step 3: Update `src/worker/routes/inviteRoutes.ts`**

Remove the local `function cookieHeader` definition and add `cookieHeader` to the import from `../auth`:

```typescript
import { requireAuth, createToken, cookieHeader, COOKIE_NAME, TOKEN_TTL_SECONDS, AUTH_COOKIE_ATTRS } from "../auth";
```

The local `function cookieHeader` near the top of `inviteRoutes.ts` should be deleted.

---

- [ ] **Step 4: Run the full test suite**

```
npm run test:run
```

Expected: all tests pass (no behaviour change).

---

- [ ] **Step 5: Commit**

```
git add src/worker/auth.ts src/worker/routes/authRoutes.ts src/worker/routes/inviteRoutes.ts
git commit -m "refactor: move cookieHeader helper to auth.ts, remove duplication"
```
