# Task 05 — Final magic-value sweep

> **Index:** [worker-refactor](2026-05-02-worker-refactor.md) | **Depends on:** Task 04

**Goal:** Find and name any remaining magic literals across all worker source files. Most were handled during extraction; this task closes the gaps.

**Files:**

- Modify: `src/worker/auth.js`
- Modify: `src/worker/routes/authRoutes.js`
- Modify: `src/worker/routes/uploadRoute.js`

---

- [ ] **Step 1: Audit all worker source files for magic values**

Run:

```
grep -rn "2592000\|Max-Age\|image/png\|image/jpeg\|freedom_hunt\|rl:\|admin:\|auth:\|60000\|60 \|> 5" src/worker
```

Expected remaining hits after Task 04:

- `TOKEN_TTL_SECONDS` used in `Max-Age` — already a constant ✓
- `rl:` prefix in `checkRateLimit` key — name it
- `admin:` and `auth:` key prefixes in login handler — name them
- `image/png` mime check in `buildR2Key` — name it

---

- [ ] **Step 2: Add KV key prefix constants to `src/worker/auth.js`**

Add at the top of `src/worker/auth.js` with the other constants:

```js
export const KV_PREFIX_ADMIN = "admin:";
export const KV_PREFIX_PARTICIPANT = "auth:";
```

Update `checkRateLimit` — the `rl:` prefix is already fine as a local string (only used once, in one function). Leave it as-is.

---

- [ ] **Step 3: Use KV prefix constants in `src/worker/routes/authRoutes.js`**

Import the new constants:

```js
import { ..., KV_PREFIX_ADMIN, KV_PREFIX_PARTICIPANT } from '../auth.js'
```

Replace in the login handler:

```js
// was:
const adminPw = await env.AUTH_STORE.get(`admin:${project}`);
const participantPw = await env.AUTH_STORE.get(`auth:${project}`);

// becomes:
const adminPw = await env.AUTH_STORE.get(`${KV_PREFIX_ADMIN}${project}`);
const participantPw = await env.AUTH_STORE.get(
  `${KV_PREFIX_PARTICIPANT}${project}`,
);
```

---

- [ ] **Step 4: Name the PNG mime type in `src/worker/routes/uploadRoute.js`**

Add a constant:

```js
const MIME_PNG = "image/png";
```

Update `buildR2Key`:

```js
// was:
const ext = mimeType === "image/png" ? "png" : "jpg";

// becomes:
const ext = mimeType === MIME_PNG ? "png" : "jpg";
```

---

- [ ] **Step 5: Run the full test suite**

```
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/worker/auth.js src/worker/routes/authRoutes.js src/worker/routes/uploadRoute.js
git commit -m "refactor: name remaining magic values in worker modules"
```
