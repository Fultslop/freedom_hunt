# Task 02: Token Types and Discrimination Helpers

**Files:**
- Modify: `src/types/auth.ts`
- Modify: `src/worker/auth.ts`
- Modify: `src/test/worker.auth.test.ts`

The existing `TokenPayload` interface is kept as a type alias for backward compatibility. Three payload shapes are now distinguished by key presence — `"user_id" in payload` not `payload.user_id` — so the bootstrap shape (`user_id: null`) is distinct from the editor shape (`user_id: string`).

---

- [ ] **Step 1: Write failing tests for token discrimination**

Add to the end of `src/test/worker.auth.test.ts`:

```typescript
import { isUserToken, isBootstrapToken, isParticipantToken } from "../types/auth";
import type { AnyTokenPayload } from "../types/auth";

describe("token discrimination", () => {
  const participantPayload: AnyTokenPayload = {
    project: "p", teamName: "t", contact: "c", isAdmin: false, exp: 9999999999,
  };
  const userPayload: AnyTokenPayload = { user_id: "uuid-123", exp: 9999999999 };
  const bootstrapPayload: AnyTokenPayload = {
    user_id: null, isBootstrap: true, project: "p", exp: 9999999999,
  };

  it("identifies participant token", () => {
    expect(isParticipantToken(participantPayload)).toBe(true);
    expect(isUserToken(participantPayload)).toBe(false);
    expect(isBootstrapToken(participantPayload)).toBe(false);
  });

  it("identifies user token", () => {
    expect(isUserToken(userPayload)).toBe(true);
    expect(isParticipantToken(userPayload)).toBe(false);
    expect(isBootstrapToken(userPayload)).toBe(false);
  });

  it("identifies bootstrap token", () => {
    expect(isBootstrapToken(bootstrapPayload)).toBe(true);
    expect(isUserToken(bootstrapPayload)).toBe(false);
    expect(isParticipantToken(bootstrapPayload)).toBe(false);
  });

  it("round-trips a user token payload", async () => {
    const payload: AnyTokenPayload = { user_id: "abc", exp: 9999999999 };
    const token = await createToken(payload as any, SECRET);
    const result = await verifyToken(token, SECRET);
    expect(result).not.toBeNull();
    expect(isUserToken(result as AnyTokenPayload)).toBe(true);
  });

  it("round-trips a bootstrap token payload", async () => {
    const payload: AnyTokenPayload = { user_id: null, isBootstrap: true, project: "p", exp: 9999999999 };
    const token = await createToken(payload as any, SECRET);
    const result = await verifyToken(token, SECRET);
    expect(result).not.toBeNull();
    expect(isBootstrapToken(result as AnyTokenPayload)).toBe(true);
  });
});
```

Run: `npm run test:run -- src/test/worker.auth.test.ts`
Expected: FAIL — `isUserToken` not exported from `../types/auth`.

---

- [ ] **Step 2: Replace `src/types/auth.ts` with new types**

```typescript
// ---------------------------------------------------------------------------
// Server-side token payload shapes
// ---------------------------------------------------------------------------

/** Existing participant / KV-admin session — unchanged. */
export interface ParticipantTokenPayload {
  project: string;
  teamName: string;
  contact: string;
  isAdmin: boolean;
  exp: number;
}

/** Normal editor / user session issued after D1 login or signup. */
export interface UserTokenPayload {
  user_id: string; // non-null string
  exp: number;
}

/**
 * One-time bootstrap session issued when the maintainer logs in with the KV
 * admin password. user_id is null (key present, value null) so it is distinct
 * from UserTokenPayload where user_id is a non-null string.
 * TTL: 1 hour. Valid only for POST /auth/bootstrap/promote.
 */
export interface BootstrapTokenPayload {
  user_id: null;
  isBootstrap: true;
  project: string;
  exp: number;
}

export type AnyTokenPayload =
  | ParticipantTokenPayload
  | UserTokenPayload
  | BootstrapTokenPayload;

/**
 * Kept as alias for backward compatibility with existing callers that import
 * TokenPayload (authRoutes.ts, editorRoutes.ts, worker.auth.test.ts).
 */
export type TokenPayload = ParticipantTokenPayload;

// ---------------------------------------------------------------------------
// Discrimination helpers
// Key-presence checks, not value-truthiness:
//   "user_id" in p   — distinguishes participant (absent) from user/bootstrap (present)
//   p.user_id !== null  — distinguishes user (non-null) from bootstrap (null)
// ---------------------------------------------------------------------------

export function isUserToken(p: AnyTokenPayload): p is UserTokenPayload {
  return "user_id" in p && (p as UserTokenPayload).user_id !== null;
}

export function isBootstrapToken(p: AnyTokenPayload): p is BootstrapTokenPayload {
  return "isBootstrap" in p && (p as BootstrapTokenPayload).isBootstrap === true;
}

export function isParticipantToken(p: AnyTokenPayload): p is ParticipantTokenPayload {
  return !("user_id" in p);
}

// ---------------------------------------------------------------------------
// Frontend auth state shapes
// ---------------------------------------------------------------------------

export interface EditorAuthState {
  kind: "editor";
  userId: string;
  email: string;
  username: string;
  capabilities: string[];
}

export interface ParticipantAuthState {
  kind: "participant";
  projectId: string;
  teamName: string;
  contact: string | null;
  isAdmin: boolean;
}

/** Union used by authStore.activeAuth. */
export type AuthState = EditorAuthState | ParticipantAuthState;
```

---

- [ ] **Step 3: Update `src/worker/auth.ts` — change `requireAuth` return type**

The `requireAuth` function currently returns `TokenPayload | null`. Change it to return `AnyTokenPayload | null` and add two narrow helpers for route handlers:

```typescript
import type { Env } from "../types/worker";
import type { AnyTokenPayload, TokenPayload } from "../types/auth";

export const COOKIE_NAME = "freedom_hunt_auth";
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const BOOTSTRAP_TTL_SECONDS = 60 * 60; // 1 hour
export const AUTH_COOKIE_ATTRS = "HttpOnly; Secure; SameSite=Strict; Path=/";
export const KV_PREFIX_ADMIN = "admin:";
export const KV_PREFIX_PARTICIPANT = "auth:";

const AUTH_ALGO: HmacKeyGenParams = { name: "HMAC", hash: "SHA-256" };
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_TTL_SECONDS = 60;

function b64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str: string): string {
  return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
}

export async function createToken(
  payload: AnyTokenPayload,
  secret: string,
): Promise<string> {
  const encoded = b64urlEncode(JSON.stringify(payload));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    AUTH_ALGO,
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(AUTH_ALGO.name, key, enc.encode(encoded));
  const sigB64 = b64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
  return `${encoded}.${sigB64}`;
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<AnyTokenPayload | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const encoded = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      AUTH_ALGO,
      false,
      ["verify"],
    );
    const sigBytes = Uint8Array.from(b64urlDecode(sigB64), (c) =>
      c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      AUTH_ALGO.name,
      key,
      sigBytes,
      enc.encode(encoded),
    );
    if (!valid) return null;
    const payload = JSON.parse(b64urlDecode(encoded)) as AnyTokenPayload;
    if ((payload as { exp: number }).exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Returns the verified token payload from the request cookie, or null. */
export async function requireAuth(
  request: Request,
  env: Env,
): Promise<AnyTokenPayload | null> {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1], env.AUTH_SECRET);
}

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

export async function checkRateLimit(ip: string, env: Env): Promise<boolean> {
  const key = `rl:${ip}`;
  const raw = await env.AUTH_STORE.get(key);
  const now = Date.now();
  let record: RateLimitRecord = raw
    ? (JSON.parse(raw) as RateLimitRecord)
    : { count: 0, windowStart: now };
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    record = { count: 0, windowStart: now };
  }
  record.count++;
  await env.AUTH_STORE.put(key, JSON.stringify(record), {
    expirationTtl: RATE_LIMIT_TTL_SECONDS,
  });
  return record.count > RATE_LIMIT_MAX;
}
```

---

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/test/worker.auth.test.ts
```

Expected: all tests pass including the new discrimination tests.

---

- [ ] **Step 5: Run full test suite to verify no regressions**

```bash
npm run test:run
```

Expected: all existing tests pass.

---

- [ ] **Step 6: Commit**

```bash
git add src/types/auth.ts src/worker/auth.ts src/test/worker.auth.test.ts
git commit -m "feat: add user and bootstrap token payload types with discrimination helpers"
```
