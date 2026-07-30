import type { Env } from "../../types/worker";
import type { UserTokenPayload, BootstrapTokenPayload, ParticipantTokenPayload } from "../../types/auth";
import { isUserToken, isBootstrapToken } from "../../types/auth";
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
import {
  getUserByEmail,
  getUserById,
  getUserCaps,
  insertUser,
  insertCap,
  hashPassword,
  verifyPassword,
  getWhitelistEntry,
  getParticipantAccountByEmail,
  insertParticipantAccount,
} from "../db";
import { json, checkOrigin } from "../utils";
import { normalizeCode } from "../../utils/normalizeCode";

function generateId(): string {
  return crypto.randomUUID();
}

export async function handleAuthRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {

  // -------------------------------------------------------------------------
  // POST /auth/signup
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/signup") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const { email, username, password, email_consent_results, email_consent_marketing } =
        (await request.json()) as {
          email?: string;
          username?: string;
          password?: string;
          email_consent_results?: boolean;
          email_consent_marketing?: boolean;
        };

      if (!email || !username || !password) {
        return json({ ok: false, error: "Missing required fields" }, 400);
      }
      if (password.length < 8) {
        return json({ ok: false, error: "Password must be at least 8 characters" }, 400);
      }

      const normalEmail = email.toLowerCase();
      const existing = await getUserByEmail(env.AUTH_DB, normalEmail);
      if (existing) {
        return json({ ok: false, error: "Email already registered" }, 409);
      }

      const now = Math.floor(Date.now() / 1000);
      const consentAt = (email_consent_results || email_consent_marketing) ? now : null;
      const user = {
        id: generateId(),
        email: normalEmail,
        username,
        password_hash: await hashPassword(password),
        created_at: now,
        email_consent_results: email_consent_results ? 1 : null,
        email_consent_marketing: email_consent_marketing ? 1 : null,
        email_consent_at: consentAt,
      };
      await insertUser(env.AUTH_DB, user);

      const payload: UserTokenPayload = { user_id: user.id, exp: now + TOKEN_TTL_SECONDS };
      const token = await createToken(payload, env.AUTH_SECRET);
      return json(
        { ok: true, userId: user.id, email: normalEmail, username, capabilities: [] },
        200,
        { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
      );
    } catch {
      return json({ ok: false, error: "Signup failed" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /auth/participant-signup
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/participant-signup") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const { project, email, teamName, contact, password } = (await request.json()) as {
        project?: string;
        email?: string;
        teamName?: string;
        contact?: string;
        password?: string;
      };

      if (!project || !email || !password) {
        return json({ ok: false, error: "Missing required fields" }, 400);
      }
      if (password.length < 8) {
        return json({ ok: false, error: "Password must be at least 8 characters" }, 400);
      }

      const normalEmail = email.toLowerCase();
      const whitelisted = await getWhitelistEntry(env.AUTH_DB, normalEmail, project);
      if (!whitelisted) {
        return json(
          { ok: false, error: "This email hasn't been approved for this project yet. Contact the organizer." },
          403,
        );
      }

      const existing = await getParticipantAccountByEmail(env.AUTH_DB, normalEmail, project);
      if (existing) {
        return json({ ok: false, error: "Already registered — log in instead." }, 409);
      }

      // teamName isn't collected at signup — it's set later when the
      // participant actually joins a project/city. Empty for now.
      const resolvedTeamName = teamName || "";
      const resolvedContact = contact || normalEmail;

      const now = Math.floor(Date.now() / 1000);
      await insertParticipantAccount(env.AUTH_DB, {
        id: generateId(),
        email: normalEmail,
        project_id: project,
        team_name: resolvedTeamName,
        contact: resolvedContact,
        password_hash: await hashPassword(password),
        created_at: now,
      });

      const payload: ParticipantTokenPayload = {
        project, teamName: resolvedTeamName, contact: resolvedContact, isAdmin: false, exp: now + TOKEN_TTL_SECONDS,
      };
      const token = await createToken(payload, env.AUTH_SECRET);
      return json(
        { ok: true, teamName: resolvedTeamName, contact: resolvedContact, isAdmin: false },
        200,
        { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
      );
    } catch {
      return json({ ok: false, error: "Signup failed" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /auth/verify-code
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/verify-code") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
      if (await checkRateLimit(clientIP, env)) {
        return json({ ok: false, error: "Too many attempts. Please wait a moment." }, 429);
      }

      const { code } = (await request.json()) as { code?: string };
      const trimmed = (code ?? "").trim();
      if (!trimmed) {
        return json({ ok: false, error: "Missing code" }, 400);
      }

      if (trimmed.toLowerCase() === "demo") {
        return json({ ok: true, mode: "demo" });
      }

      const list = await env.AUTH_STORE.list({ prefix: KV_PREFIX_PARTICIPANT });
      const normalizedInput = normalizeCode(trimmed);
      for (const key of list.keys) {
        const storedPassword = await env.AUTH_STORE.get(key.name);
        if (storedPassword !== null && normalizeCode(storedPassword) === normalizedInput) {
          return json({
            ok: true,
            mode: "project",
            project: key.name.slice(KV_PREFIX_PARTICIPANT.length),
          });
        }
      }

      return json({ ok: false, error: "Invalid code" }, 401);
    } catch {
      return json({ ok: false, error: "Verification failed" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /auth/login
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/login") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
      if (await checkRateLimit(clientIP, env)) {
        return json({ ok: false, error: "Too many attempts. Please wait a moment." }, 429);
      }

      const body = (await request.json()) as {
        project?: string;
        teamName?: string;
        contact?: string;
        password?: string;
        email?: string;
      };

      // ----- Participant / KV-admin path (project field present) -----
      if (body.project) {
        const { project, teamName = "", contact = "", password = "", email } = body;
        if (!password) {return json({ ok: false, error: "Missing password" }, 400);}

        if (email) {
          const account = await getParticipantAccountByEmail(env.AUTH_DB, email.toLowerCase(), project);
          if (!account || !(await verifyPassword(password, account.password_hash))) {
            return json({ ok: false, error: "Incorrect email or password" }, 401);
          }
          const now = Math.floor(Date.now() / 1000);
          const payload: ParticipantTokenPayload = {
            project, teamName: account.team_name, contact: account.contact || "",
            isAdmin: false, exp: now + TOKEN_TTL_SECONDS,
          };
          const token = await createToken(payload, env.AUTH_SECRET);
          return json(
            { ok: true, teamName: account.team_name, contact: account.contact || "", isAdmin: false },
            200,
            { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
          );
        }

        const adminPw = await env.AUTH_STORE.get(`${KV_PREFIX_ADMIN}${project}`);
        const participantPw = await env.AUTH_STORE.get(`${KV_PREFIX_PARTICIPANT}${project}`);

        if (adminPw === null && participantPw === null) {
          return json({ ok: false, error: "Project not found" }, 401);
        }

        const now = Math.floor(Date.now() / 1000);

        if (adminPw !== null && normalizeCode(password) === normalizeCode(adminPw)) {
          // Issue bootstrap token — valid only for /auth/bootstrap/promote
          const payload: BootstrapTokenPayload = {
            user_id: null,
            isBootstrap: true,
            project,
            exp: now + BOOTSTRAP_TTL_SECONDS,
          };
          const token = await createToken(payload, env.AUTH_SECRET);
          return json(
            { ok: true, isBootstrap: true, project },
            200,
            { "Set-Cookie": cookieHeader(token, BOOTSTRAP_TTL_SECONDS) },
          );
        }

        if (participantPw === null || normalizeCode(password) !== normalizeCode(participantPw)) {
          return json({ ok: false, error: "Incorrect password" }, 401);
        }

        const participantPayload = {
          project,
          teamName,
          contact,
          isAdmin: false,
          exp: now + TOKEN_TTL_SECONDS,
        };
        const token = await createToken(participantPayload, env.AUTH_SECRET);
        return json(
          { ok: true, teamName, contact, isAdmin: false },
          200,
          { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
        );
      }

      // ----- D1 user path (email + password) -----
      const { email, password = "" } = body;
      if (!email || !password) {
        return json({ ok: false, error: "Missing email or password" }, 400);
      }

      const user = await getUserByEmail(env.AUTH_DB, email.toLowerCase());
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return json({ ok: false, error: "Incorrect email or password" }, 401);
      }

      const caps = await getUserCaps(env.AUTH_DB, user.id);
      const capabilities = caps.map((c) => c.capability);
      const now = Math.floor(Date.now() / 1000);
      const payload: UserTokenPayload = { user_id: user.id, exp: now + TOKEN_TTL_SECONDS };
      const token = await createToken(payload, env.AUTH_SECRET);
      return json(
        { ok: true, userId: user.id, email: user.email, username: user.username, capabilities },
        200,
        { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
      );
    } catch (err) {
      console.error("[auth/login] error:", err);
      return json({ ok: false, error: "Login failed" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // GET /auth/me
  // -------------------------------------------------------------------------
  if (request.method === "GET" && url.pathname === "/auth/me") {
    const payload = await requireAuth(request, env);
    if (!payload) {return json({ ok: false, error: "Not authenticated" }, 401);}

    if (isBootstrapToken(payload)) {
      // Bootstrap tokens are not valid for /auth/me
      return json({ ok: false, error: "Not authenticated" }, 401);
    }

    if (isUserToken(payload)) {
      const user = await getUserById(env.AUTH_DB, payload.user_id);
      if (!user) {return json({ ok: false, error: "User not found" }, 401);}
      const caps = await getUserCaps(env.AUTH_DB, payload.user_id);
      return json({
        ok: true,
        userId: user.id,
        email: user.email,
        username: user.username,
        capabilities: caps.map((c) => c.capability),
      });
    }

    // Participant shape — unchanged
    return json({
      ok: true,
      project: payload.project,
      teamName: payload.teamName,
      contact: payload.contact,
      isAdmin: payload.isAdmin ?? false,
    });
  }

  // -------------------------------------------------------------------------
  // POST /auth/logout (unchanged)
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/logout") {
    return json({ ok: true }, 200, {
      "Set-Cookie": `${COOKIE_NAME}=; ${AUTH_COOKIE_ATTRS}; Max-Age=0`,
    });
  }

  // -------------------------------------------------------------------------
  // POST /auth/bootstrap/promote
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/bootstrap/promote") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    const payload = await requireAuth(request, env);
    if (!payload || !isBootstrapToken(payload)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const { user_id } = (await request.json()) as { user_id?: string };
      if (!user_id) {
        return json({ ok: false, error: "Missing user_id" }, 400);
      }
      const user = await getUserById(env.AUTH_DB, user_id);
      if (!user) {
        return json({ ok: false, error: "User not found" }, 404);
      }
      const now = Math.floor(Date.now() / 1000);
      await insertCap(env.AUTH_DB, {
        user_id,
        project_id: payload.project,
        capability: "organizer",
        granted_at: now,
        granted_by_user_id: null,
      });
      const caps = await getUserCaps(env.AUTH_DB, user_id);
      const userPayload: UserTokenPayload = { user_id, exp: now + TOKEN_TTL_SECONDS };
      const token = await createToken(userPayload, env.AUTH_SECRET);
      return json(
        { ok: true, userId: user_id, email: user.email, username: user.username, capabilities: caps.map((c) => c.capability) },
        200,
        { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
      );
    } catch {
      return json({ ok: false, error: "Promote failed" }, 500);
    }
  }

  return null;
}
