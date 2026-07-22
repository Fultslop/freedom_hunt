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
    const stmt = {
      bind: (...values: unknown[]) => { args.push(...values); return stmt; },
      first: async () => {
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
        if (sql.includes("UPDATE user_project_caps") && sql.includes("SET revoked_at")) {
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
        if (sql.includes("UPDATE invite_tokens") && sql.includes("SET used_at")) {
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
    };
    return stmt;
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
