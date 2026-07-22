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

export function isUserToken(payload: AnyTokenPayload): payload is UserTokenPayload {
  return "user_id" in payload && (payload as UserTokenPayload).user_id !== null;
}

export function isBootstrapToken(payload: AnyTokenPayload): payload is BootstrapTokenPayload {
  return "isBootstrap" in payload && (payload as BootstrapTokenPayload).isBootstrap === true;
}

export function isParticipantToken(payload: AnyTokenPayload): payload is ParticipantTokenPayload {
  return !("user_id" in payload);
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
