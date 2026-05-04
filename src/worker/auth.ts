import type { Env } from "../types/worker";
import type { TokenPayload } from "../types/auth";

export const COOKIE_NAME = "freedom_hunt_auth";
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
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
  payload: TokenPayload,
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
  const sig = await crypto.subtle.sign(
    AUTH_ALGO.name,
    key,
    enc.encode(encoded),
  );
  const sigB64 = b64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
  return `${encoded}.${sigB64}`;
}

// Returns null instead of throwing so callers can treat any invalid token as unauthenticated.
export async function verifyToken(
  token: string,
  secret: string,
): Promise<TokenPayload | null> {
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
    const payload = JSON.parse(b64urlDecode(encoded)) as TokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

// Sliding window: resets the counter when more than RATE_LIMIT_WINDOW_MS has passed since windowStart.
// Returns true if the request should be blocked.
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

export async function requireAuth(
  request: Request,
  env: Env,
): Promise<TokenPayload | null> {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1], env.AUTH_SECRET);
}