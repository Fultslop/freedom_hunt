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
  if (!saltHex || !hashHex) {return false;}
  const salt = new Uint8Array(
    (saltHex.match(/.{2}/g) ?? []).map((hex) => parseInt(hex, 16)),
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
    (hashHex.match(/.{2}/g) ?? []).map((hex) => parseInt(hex, 16)),
  );
  // Constant-time comparison
  if (newHash.length !== storedHash.length) {return false;}
  let diff = 0;
  for (let i = 0; i < newHash.length; i++) {diff |= newHash[i] ^ storedHash[i];}
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
  database: D1Database,
  email: string,
): Promise<DbUser | null> {
  return database
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<DbUser>();
}

export async function getUserById(
  database: D1Database,
  id: string,
): Promise<DbUser | null> {
  return database
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<DbUser>();
}

export async function insertUser(
  database: D1Database,
  user: DbUser,
): Promise<void> {
  await database
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
  database: D1Database,
  userId: string,
): Promise<DbCap[]> {
  const result = await database
    .prepare(
      "SELECT * FROM user_project_caps WHERE user_id = ? AND revoked_at IS NULL",
    )
    .bind(userId)
    .all<DbCap>();
  return result.results;
}

export async function insertCap(
  database: D1Database,
  cap: Omit<DbCap, "revoked_at">,
): Promise<void> {
  await database
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
  database: D1Database,
  userId: string,
  projectId: string,
  capability: string,
): Promise<boolean> {
  const result = await database
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
  database: D1Database,
  projectId: string,
): Promise<Array<DbUser & { capability: string; granted_at: number }>> {
  const result = await database
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
  database: D1Database,
  inv: DbInviteToken,
): Promise<void> {
  await database
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
  database: D1Database,
  token: string,
): Promise<DbInviteToken | null> {
  return database
    .prepare("SELECT * FROM invite_tokens WHERE token = ?")
    .bind(token)
    .first<DbInviteToken>();
}

/**
 * Atomically marks the token used. Returns true if a row was updated
 * (token was valid, unused, unrevoked, and not expired).
 */
export async function acceptInviteToken(
  database: D1Database,
  token: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const result = await database
    .prepare(
      `UPDATE invite_tokens
       SET used_at = ?
       WHERE token = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
    )
    .bind(now, token, now)
    .run();
  return result.meta.changes > 0;
}

// ---------------------------------------------------------------------------
// Photo queries
// ---------------------------------------------------------------------------

export interface DbPhoto {
  id: string;
  project_id: string;
  city_id: string;
  route_id: string | null;
  location_id: string;
  task_title: string;
  team_name: string;
  contact: string | null;
  r2_key: string;
  mime_type: string;
  uploaded_at: number;
}

export async function insertPhoto(
  database: D1Database,
  photo: DbPhoto,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO photos
       (id, project_id, city_id, route_id, location_id, task_title,
        team_name, contact, r2_key, mime_type, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      photo.id, photo.project_id, photo.city_id, photo.route_id ?? null,
      photo.location_id, photo.task_title, photo.team_name,
      photo.contact ?? null, photo.r2_key, photo.mime_type, photo.uploaded_at,
    )
    .run();
}

export async function getPhotoById(
  database: D1Database,
  id: string,
): Promise<DbPhoto | null> {
  return database
    .prepare("SELECT * FROM photos WHERE id = ?")
    .bind(id)
    .first<DbPhoto>();
}

export async function listPhotos(
  database: D1Database,
  projectId: string,
  cityId: string,
): Promise<DbPhoto[]> {
  const result = await database
    .prepare(
      `SELECT * FROM photos
       WHERE project_id = ? AND city_id = ?
       ORDER BY uploaded_at DESC`,
    )
    .bind(projectId, cityId)
    .all<DbPhoto>();
  return result.results;
}

export async function randomPhotos(
  database: D1Database,
  projectId: string,
  cityId: string,
  limit: number,
): Promise<DbPhoto[]> {
  const result = await database
    .prepare(
      `SELECT * FROM photos
       WHERE project_id = ? AND city_id = ?
       ORDER BY RANDOM() LIMIT ?`,
    )
    .bind(projectId, cityId, limit)
    .all<DbPhoto>();
  return result.results;
}
