import type { Env } from "../../types/worker";
import { isUserToken } from "../../types/auth";
import { requireAuth, createToken, cookieHeader, TOKEN_TTL_SECONDS } from "../auth";
import {
  getUserCaps,
  getUserById,
  insertCap,
  insertInviteToken,
  getInviteToken,
  acceptInviteToken,
} from "../db";
import { json, checkOrigin } from "../utils";

const INVITE_TTL_SECONDS = 48 * 60 * 60;
const VALID_CAPABILITIES = new Set(["user", "editor", "organizer"]);

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function handleInviteRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {

  // -------------------------------------------------------------------------
  // POST /auth/invite/create
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/invite/create") {
    if (!checkOrigin(request)) {return json({ ok: false, error: "Forbidden" }, 403);}

    const payload = await requireAuth(request, env);
    if (!payload || !isUserToken(payload)) {
      return json({ ok: false, error: "Not authenticated" }, 401);
    }

    try {
      const { project_id, capability = "editor" } = (await request.json()) as {
        project_id?: string;
        capability?: string;
      };

      if (!project_id) {return json({ ok: false, error: "Missing project_id" }, 400);}
      if (!VALID_CAPABILITIES.has(capability)) {
        return json({ ok: false, error: "Invalid capability" }, 400);
      }

      // Only organizers can create invites
      const caps = await getUserCaps(env.AUTH_DB, payload.user_id);
      const isOrganizer = caps.some(
        (c) => c.project_id === project_id && c.capability === "organizer",
      );
      if (!isOrganizer) {return json({ ok: false, error: "Forbidden" }, 403);}

      const now = Math.floor(Date.now() / 1000);
      const token = generateToken();
      await insertInviteToken(env.AUTH_DB, {
        token,
        project_id,
        capability,
        created_at: now,
        expires_at: now + INVITE_TTL_SECONDS,
        used_at: null,
        revoked_at: null,
        invited_by_user_id: payload.user_id,
      });

      const origin = new URL(request.url).origin;
      return json({ ok: true, token, inviteUrl: `${origin}/#/invite/${token}` });
    } catch {
      return json({ ok: false, error: "Failed to create invite" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // GET /auth/invite/:token
  // -------------------------------------------------------------------------
  const inviteMatch = url.pathname.match(/^\/auth\/invite\/([^/]+)$/);
  if (request.method === "GET" && inviteMatch) {
    const token = inviteMatch[1];
    try {
      const inv = await getInviteToken(env.AUTH_DB, token);
      if (!inv) {return json({ ok: false, error: "Invite not found" }, 404);}

      const now = Math.floor(Date.now() / 1000);
      if (inv.revoked_at !== null) {return json({ ok: false, error: "Invite revoked" }, 410);}
      if (inv.expires_at <= now) {return json({ ok: false, error: "Invite expired" }, 410);}
      if (inv.used_at !== null) {return json({ ok: false, error: "Invite already used" }, 410);}

      return json({
        ok: true,
        projectId: inv.project_id,
        capability: inv.capability,
        expiresAt: inv.expires_at,
      });
    } catch {
      return json({ ok: false, error: "Failed to validate invite" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /auth/invite/accept
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/invite/accept") {
    if (!checkOrigin(request)) {return json({ ok: false, error: "Forbidden" }, 403);}

    const payload = await requireAuth(request, env);
    if (!payload || !isUserToken(payload)) {
      return json({ ok: false, error: "Not authenticated" }, 401);
    }

    try {
      const { token } = (await request.json()) as { token?: string };
      if (!token) {return json({ ok: false, error: "Missing token" }, 400);}

      const inv = await getInviteToken(env.AUTH_DB, token);
      if (!inv) {return json({ ok: false, error: "Invite not found" }, 404);}

      const accepted = await acceptInviteToken(env.AUTH_DB, token);
      if (!accepted) {return json({ ok: false, error: "Invite already used or expired" }, 409);}

      const now = Math.floor(Date.now() / 1000);
      await insertCap(env.AUTH_DB, {
        user_id: payload.user_id,
        project_id: inv.project_id,
        capability: inv.capability,
        granted_at: now,
        granted_by_user_id: inv.invited_by_user_id,
      });

      const caps = await getUserCaps(env.AUTH_DB, payload.user_id);
      const user = await getUserById(env.AUTH_DB, payload.user_id);

      const newToken = await createToken(
        { user_id: payload.user_id, exp: now + TOKEN_TTL_SECONDS },
        env.AUTH_SECRET,
      );

      return json(
        {
          ok: true,
          projectId: inv.project_id,
          capabilities: caps.map((c) => c.capability),
          userId: payload.user_id,
          email: user?.email ?? "",
          username: user?.username ?? "",
        },
        200,
        { "Set-Cookie": cookieHeader(newToken, TOKEN_TTL_SECONDS) },
      );
    } catch {
      return json({ ok: false, error: "Failed to accept invite" }, 500);
    }
  }

  return null;
}
