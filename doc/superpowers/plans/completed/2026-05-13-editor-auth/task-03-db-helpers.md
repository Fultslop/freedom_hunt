# Task 03: D1 Query Helpers

**Files:**
- Create: `src/worker/db.ts`
- Create: `src/test/worker.db.test.ts`

All D1 access goes through this module. Route handlers never call `env.AUTH_DB.prepare()` directly. Password hashing uses PBKDF2 via the Web Crypto API — no external dependency, works natively in Cloudflare Workers.

---

- [ ] **Step 1: Write failing tests**

Create `src/test/worker.db.test.ts`:

```typescript
// @ts-nocheck
import { describe, it, expect, beforeEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  getUserByEmail,
  getUserById,
  getUserCaps,
  insertUser,
  insertCap,
  revokeCap,
  listProjectUsers,
  insertInviteToken,
  getInviteToken,
  acceptInviteToken,
} from "../worker/db";

// Minimal in-memory D1 mock
function makeDb() {
  const tables: Record<string, Record<string, unknown>[]> = {
    users: [],
    user_project_caps: [],
    invite_tokens: [],
  };

  const prepare = (sql: string) => {
    const args: unknown[] = [];
    return {
      bind: (...values: unknown[]) => { args.push(...values); return self; },
      first: async () => {
        const self2 = self;
        // Route by SQL keyword
        if (sql.includes("FROM users WHERE email")) {
          return tables.users.find((u) => u.email === args[0]) ?? null;
        }
        if (sql.includes("FROM users WHERE id")) {
          return tables.users.find((u) => u.id === args[0]) ?? null;
        }
        if (sql.includes("FROM invite_tokens WHERE token")) {
          return tables.invite_tokens.find((t) => t.token === args[0]) ?? null;
        }
        return null;
      },
      run: async () => {
        if (sql.startsWith("INSERT INTO users")) {
          tables.users.push({
            id: args[0], email: args[1], username: args[2],
            password_hash: args[3], created_at: args[4],
            email_consent_results: args[5], email_consent_marketing: args[6],
            email_consent_at: args[7],
          });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("INSERT INTO user_project_caps")) {
          const exists = tables.user_project_caps.find(
            (c) => c.user_id === args[0] && c.project_id === args[1] && c.capability === args[2]
          );
          if (!exists) {
            tables.user_project_caps.push({
              user_id: args[0], project_id: args[1], capability: args[2],
              granted_at: args[3], granted_by_user_id: args[4], revoked_at: null,
            });
          }
          return { meta: { changes: exists ? 0 : 1 } };
        }
        if (sql.startsWith("UPDATE user_project_caps SET revoked_at")) {
          const cap = tables.user_project_caps.find(
            (c) => c.user_id === args[1] && c.project_id === args[2] &&
                   c.capability === args[3] && c.revoked_at === null
          );
          if (cap) { cap.revoked_at = args[0]; return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        }
        if (sql.startsWith("INSERT INTO invite_tokens")) {
          tables.invite_tokens.push({
            token: args[0], project_id: args[1], capability: args[2],
            created_at: args[3], expires_at: args[4],
            used_at: null, revoked_at: null, invited_by_user_id: args[5],
          });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE invite_tokens SET used_at")) {
          const inv = tables.invite_tokens.find(
            (t) => t.token === args[1] && t.used_at === null &&
                   t.revoked_at === null && t.expires_at > args[2]
          );
          if (inv) { inv.used_at = args[0]; return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        }
        return { meta: { changes: 0 } };
      },
      all: async () => {
        if (sql.includes("FROM users u")) {
          const rows = tables.user_project_caps
            .filter((c) => c.project_id === args[0] && c.revoked_at === null)
            .map((c) => {
              const user = tables.users.find((u) => u.id === c.user_id);
              return user ? { ...user, capability: c.capability, granted_at: c.granted_at } : null;
            })
            .filter(Boolean);
          return { results: rows };
        }
        if (sql.includes("FROM user_project_caps")) {
          const results = tables.user_project_caps.filter(
            (c) => c.user_id === args[0] && c.revoked_at === null
          );
          return { results };
        }
        return { results: [] };
      },
      get self() { return this; },
    };
  };

  return { prepare };
}

describe("hashPassword / verifyPassword", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("correct-horse");
    expect(await verifyPassword("correct-horse", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse");
    expect(await verifyPassword("wrong-horse", hash)).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
  });
});

describe("users", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => { db = makeDb(); });

  it("inserts and retrieves a user by email", async () => {
    await insertUser(db as any, {
      id: "u1", email: "alice@example.com", username: "alice",
      password_hash: "hash", created_at: 1000,
      email_consent_results: null, email_consent_marketing: null, email_consent_at: null,
    });
    const user = await getUserByEmail(db as any, "alice@example.com");
    expect(user?.id).toBe("u1");
  });

  it("retrieves a user by id", async () => {
    await insertUser(db as any, {
      id: "u2", email: "bob@example.com", username: "bob",
      password_hash: "hash", created_at: 1000,
      email_consent_results: 1, email_consent_marketing: null, email_consent_at: 1000,
    });
    const user = await getUserById(db as any, "u2");
    expect(user?.email).toBe("bob@example.com");
  });

  it("returns null for unknown email", async () => {
    expect(await getUserByEmail(db as any, "nobody@example.com")).toBeNull();
  });
});

describe("user_project_caps", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => { db = makeDb(); });

  it("inserts and lists active caps", async () => {
    await insertUser(db as any, {
      id: "u1", email: "a@b.com", username: "a", password_hash: "h",
      created_at: 1, email_consent_results: null, email_consent_marketing: null, email_consent_at: null,
    });
    await insertCap(db as any, { user_id: "u1", project_id: "proj", capability: "editor", granted_at: 1, granted_by_user_id: null });
    const caps = await getUserCaps(db as any, "u1");
    expect(caps).toHaveLength(1);
    expect(caps[0].capability).toBe("editor");
  });

  it("ignores duplicate caps (ON CONFLICT DO NOTHING)", async () => {
    await insertUser(db as any, {
      id: "u1", email: "a@b.com", username: "a", password_hash: "h",
      created_at: 1, email_consent_results: null, email_consent_marketing: null, email_consent_at: null,
    });
    await insertCap(db as any, { user_id: "u1", project_id: "proj", capability: "editor", granted_at: 1, granted_by_user_id: null });
    await insertCap(db as any, { user_id: "u1", project_id: "proj", capability: "editor", granted_at: 2, granted_by_user_id: null });
    const caps = await getUserCaps(db as any, "u1");
    expect(caps).toHaveLength(1);
  });

  it("revokes a cap", async () => {
    await insertUser(db as any, {
      id: "u1", email: "a@b.com", username: "a", password_hash: "h",
      created_at: 1, email_consent_results: null, email_consent_marketing: null, email_consent_at: null,
    });
    await insertCap(db as any, { user_id: "u1", project_id: "proj", capability: "editor", granted_at: 1, granted_by_user_id: null });
    const ok = await revokeCap(db as any, "u1", "proj", "editor");
    expect(ok).toBe(true);
    const caps = await getUserCaps(db as any, "u1");
    expect(caps).toHaveLength(0);
  });

  it("returns false when revoking a non-existent cap", async () => {
    const ok = await revokeCap(db as any, "u1", "proj", "editor");
    expect(ok).toBe(false);
  });
});

describe("invite_tokens", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => { db = makeDb(); });

  const now = () => Math.floor(Date.now() / 1000);

  it("inserts and retrieves an invite token", async () => {
    await insertInviteToken(db as any, {
      token: "tok1", project_id: "proj", capability: "editor",
      created_at: now(), expires_at: now() + 3600,
      used_at: null, revoked_at: null, invited_by_user_id: null,
    });
    const t = await getInviteToken(db as any, "tok1");
    expect(t?.token).toBe("tok1");
  });

  it("accepts a valid token atomically", async () => {
    await insertInviteToken(db as any, {
      token: "tok2", project_id: "proj", capability: "editor",
      created_at: now(), expires_at: now() + 3600,
      used_at: null, revoked_at: null, invited_by_user_id: null,
    });
    expect(await acceptInviteToken(db as any, "tok2")).toBe(true);
    // Second accept fails (already used)
    expect(await acceptInviteToken(db as any, "tok2")).toBe(false);
  });

  it("rejects an expired token", async () => {
    await insertInviteToken(db as any, {
      token: "tok3", project_id: "proj", capability: "editor",
      created_at: now() - 7200, expires_at: now() - 3600,
      used_at: null, revoked_at: null, invited_by_user_id: null,
    });
    expect(await acceptInviteToken(db as any, "tok3")).toBe(false);
  });
});
```

Run: `npm run test:run -- src/test/worker.db.test.ts`
Expected: FAIL — `../worker/db` not found.

---

- [ ] **Step 2: Implement `src/worker/db.ts`**

```typescript
import type { D1Database } from "@cloudflare/workers-types";

// ---------------------------------------------------------------------------
// Password hashing — PBKDF2 via Web Crypto API (no external dependency)
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const KEY_LENGTH_BITS = 256;

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
  const toHex = (arr: Uint8Array) =>
    Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [, saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(
    (saltHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)),
  );
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
  const newHash = new Uint8Array(bits);
  const storedHash = new Uint8Array(
    (hashHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)),
  );
  // Constant-time comparison
  if (newHash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < newHash.length; i++) diff |= newHash[i] ^ storedHash[i];
  return diff === 0;
}

// ---------------------------------------------------------------------------
// User types
// ---------------------------------------------------------------------------

export interface DbUser {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: number;
  email_consent_results: number | null;
  email_consent_marketing: number | null;
  email_consent_at: number | null;
}

export interface DbCap {
  user_id: string;
  project_id: string;
  capability: string;
  granted_at: number;
  granted_by_user_id: string | null;
  revoked_at: number | null;
}

export interface DbInviteToken {
  token: string;
  project_id: string;
  capability: string;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  revoked_at: number | null;
  invited_by_user_id: string | null;
}

// ---------------------------------------------------------------------------
// User queries
// ---------------------------------------------------------------------------

export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<DbUser | null> {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<DbUser>();
}

export async function getUserById(
  db: D1Database,
  id: string,
): Promise<DbUser | null> {
  return db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<DbUser>();
}

export async function insertUser(
  db: D1Database,
  user: DbUser,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users
       (id, email, username, password_hash, created_at,
        email_consent_results, email_consent_marketing, email_consent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      user.id, user.email, user.username, user.password_hash, user.created_at,
      user.email_consent_results ?? null,
      user.email_consent_marketing ?? null,
      user.email_consent_at ?? null,
    )
    .run();
}

// ---------------------------------------------------------------------------
// Capability queries
// ---------------------------------------------------------------------------

export async function getUserCaps(
  db: D1Database,
  userId: string,
): Promise<DbCap[]> {
  const result = await db
    .prepare(
      "SELECT * FROM user_project_caps WHERE user_id = ? AND revoked_at IS NULL",
    )
    .bind(userId)
    .all<DbCap>();
  return result.results;
}

export async function insertCap(
  db: D1Database,
  cap: Omit<DbCap, "revoked_at">,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_project_caps
       (user_id, project_id, capability, granted_at, granted_by_user_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
    )
    .bind(
      cap.user_id, cap.project_id, cap.capability,
      cap.granted_at, cap.granted_by_user_id ?? null,
    )
    .run();
}

export async function revokeCap(
  db: D1Database,
  userId: string,
  projectId: string,
  capability: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE user_project_caps
       SET revoked_at = ?
       WHERE user_id = ? AND project_id = ? AND capability = ? AND revoked_at IS NULL`,
    )
    .bind(Math.floor(Date.now() / 1000), userId, projectId, capability)
    .run();
  return result.meta.changes > 0;
}

export async function listProjectUsers(
  db: D1Database,
  projectId: string,
): Promise<Array<DbUser & { capability: string; granted_at: number }>> {
  const result = await db
    .prepare(
      `SELECT u.id, u.email, u.username, u.created_at,
              c.capability, c.granted_at
       FROM users u
       JOIN user_project_caps c ON c.user_id = u.id
       WHERE c.project_id = ? AND c.revoked_at IS NULL
       ORDER BY c.granted_at ASC`,
    )
    .bind(projectId)
    .all<DbUser & { capability: string; granted_at: number }>();
  return result.results;
}

// ---------------------------------------------------------------------------
// Invite token queries
// ---------------------------------------------------------------------------

export async function insertInviteToken(
  db: D1Database,
  inv: DbInviteToken,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO invite_tokens
       (token, project_id, capability, created_at, expires_at, used_at, revoked_at, invited_by_user_id)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
    )
    .bind(
      inv.token, inv.project_id, inv.capability,
      inv.created_at, inv.expires_at, inv.invited_by_user_id ?? null,
    )
    .run();
}

export async function getInviteToken(
  db: D1Database,
  token: string,
): Promise<DbInviteToken | null> {
  return db
    .prepare("SELECT * FROM invite_tokens WHERE token = ?")
    .bind(token)
    .first<DbInviteToken>();
}

/**
 * Atomically marks the token used. Returns true if a row was updated
 * (token was valid, unused, unrevoked, and not expired).
 */
export async function acceptInviteToken(
  db: D1Database,
  token: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      `UPDATE invite_tokens
       SET used_at = ?
       WHERE token = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
    )
    .bind(now, token, now)
    .run();
  return result.meta.changes > 0;
}
```

---

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- src/test/worker.db.test.ts
```

Expected: all 15 tests pass.

---

- [ ] **Step 4: Run full suite**

```bash
npm run test:run
```

Expected: all existing tests still pass.

---

- [ ] **Step 5: Commit**

```bash
git add src/worker/db.ts src/test/worker.db.test.ts
git commit -m "feat: add D1 query helpers and PBKDF2 password hashing"
```
