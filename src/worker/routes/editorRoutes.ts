import type { Env } from "../../types/worker";
import type { AnyTokenPayload } from "../../types/auth";
import { isBootstrapToken, isParticipantToken } from "../../types/auth";
import { requireAuth } from "../auth";
import { getUserCaps, getUserById, revokeCap, listProjectUsers } from "../db";
import {
  fetchLocations,
  fetchLocation,
  createFilePR,
  locationFilePath,
  fetchPRStatuses,
} from "../github";
import { json, checkOrigin } from "../utils";
import yaml from "js-yaml";

const SLUG_RE = /^[a-z0-9_]{1,64}$/;
const LOC_FILENAME_RE = /^\d+_loc_.*\.yaml$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const MAX_YAML_BYTES = 50_000;

function validatePostLocation(body: {
  project: string;
  city: string;
  filename: string;
  existingSha?: string | null;
  location: unknown;
}): string | null {
  if (!SLUG_RE.test(body.project)) { return "Invalid project"; }
  if (!SLUG_RE.test(body.city)) { return "Invalid city"; }
  if (body.filename.length > 100 || !LOC_FILENAME_RE.test(body.filename)) {
    return "Invalid filename";
  }
  if (body.existingSha != null && !SHA_RE.test(body.existingSha)) {
    return "Invalid existingSha";
  }
  if (
    typeof body.location !== "object" ||
    body.location === null ||
    Array.isArray(body.location)
  ) {
    return "Invalid location";
  }
  return null;
}

/**
 * Checks that the caller has editor or organizer capability for the project.
 *
 * Allowed:
 *   - User token with editor or organizer cap in D1
 *   - Participant token with isAdmin: true (KV admin fallback)
 *
 * Rejected:
 *   - No token
 *   - Bootstrap token
 *   - User token with no matching cap
 *   - Participant token with isAdmin: false
 */
async function requireEditorCap(
  request: Request,
  env: Env,
  projectId: string,
): Promise<{ payload: AnyTokenPayload; committerName: string } | Response> {
  const payload = await requireAuth(request, env);
  if (!payload) {return json({ ok: false, error: "Not authenticated" }, 401);}
  if (isBootstrapToken(payload)) {return json({ ok: false, error: "Forbidden" }, 403);}

  if (isParticipantToken(payload)) {
    if (!payload.isAdmin) {return json({ ok: false, error: "Forbidden" }, 403);}
    return { payload, committerName: payload.teamName || "admin" };
  }

  // User token — check D1
  const caps = await getUserCaps(env.AUTH_DB, payload.user_id);
  const hasCap = caps.some(
    (c) => c.project_id === projectId && ["editor", "organizer"].includes(c.capability),
  );
  if (!hasCap) {return json({ ok: false, error: "Forbidden" }, 403);}

  const user = await getUserById(env.AUTH_DB, payload.user_id);
  return { payload, committerName: user?.username ?? payload.user_id };
}

/**
 * Same as requireEditorCap but also requires organizer capability.
 */
async function requireOrganizerCap(
  request: Request,
  env: Env,
  projectId: string,
): Promise<{ payload: AnyTokenPayload } | Response> {
  const payload = await requireAuth(request, env);
  if (!payload) {return json({ ok: false, error: "Not authenticated" }, 401);}
  if (isBootstrapToken(payload) || isParticipantToken(payload)) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }
  const caps = await getUserCaps(env.AUTH_DB, payload.user_id);
  const isOrg = caps.some(
    (c) => c.project_id === projectId && c.capability === "organizer",
  );
  if (!isOrg) {return json({ ok: false, error: "Forbidden" }, 403);}
  return { payload };
}

export async function handleEditorRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {

  // -------------------------------------------------------------------------
  // GET /editor/:project/users
  // -------------------------------------------------------------------------
  const usersMatch = url.pathname.match(/^\/editor\/([^/]+)\/users$/);
  if (request.method === "GET" && usersMatch) {
    const projectId = usersMatch[1];
    const authResult = await requireOrganizerCap(request, env, projectId);
    if (authResult instanceof Response) {return authResult;}
    try {
      const users = await listProjectUsers(env.AUTH_DB, projectId);
      return json({ ok: true, users });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 502);
    }
  }

  // -------------------------------------------------------------------------
  // POST /editor/:project/users/:userId/revoke
  // -------------------------------------------------------------------------
  const revokeMatch = url.pathname.match(/^\/editor\/([^/]+)\/users\/([^/]+)\/revoke$/);
  if (request.method === "POST" && revokeMatch) {
    if (!checkOrigin(request)) {return json({ ok: false, error: "Forbidden" }, 403);}
    const [, projectId, targetUserId] = revokeMatch;
    const authResult = await requireOrganizerCap(request, env, projectId);
    if (authResult instanceof Response) {return authResult;}
    try {
      const { capability = "editor" } = (await request.json()) as { capability?: string };
      const revoked = await revokeCap(env.AUTH_DB, targetUserId, projectId, capability);
      return json({ ok: revoked, error: revoked ? undefined : "Capability not found or already revoked" });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 502);
    }
  }

  // -------------------------------------------------------------------------
  // GET /editor/locations
  // -------------------------------------------------------------------------
  if (request.method === "GET" && url.pathname === "/editor/locations") {
    const project = url.searchParams.get("project");
    const city = url.searchParams.get("city");
    if (!project || !city) {
      return json({ ok: false, error: "Missing project or city" }, 400);
    }
    const authResult = await requireEditorCap(request, env, project);
    if (authResult instanceof Response) {return authResult;}
    try {
      const locations = await fetchLocations(project, city, env);
      return json({
        ok: true,
        locations: locations.sort((a, b) => a.filename.localeCompare(b.filename)),
      });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 502);
    }
  }

  // -------------------------------------------------------------------------
  // GET /editor/location
  // -------------------------------------------------------------------------
  if (request.method === "GET" && url.pathname === "/editor/location") {
    const project = url.searchParams.get("project");
    const city = url.searchParams.get("city");
    const file = url.searchParams.get("file");
    if (!project || !city || !file) {
      return json({ ok: false, error: "Missing params" }, 400);
    }
    const authResult = await requireEditorCap(request, env, project);
    if (authResult instanceof Response) {return authResult;}
    try {
      const { filename, sha, location } = await fetchLocation(project, city, file, env);
      return json({ ok: true, filename, sha, location });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 502);
    }
  }

  // -------------------------------------------------------------------------
  // GET /editor/pr-status
  // -------------------------------------------------------------------------
  if (request.method === "GET" && url.pathname === "/editor/pr-status") {
    const project = url.searchParams.get("project") ?? "";
    const authResult = await requireEditorCap(request, env, project);
    if (authResult instanceof Response) {return authResult;}
    const numbers = (url.searchParams.get("numbers") ?? "").split(",").filter(Boolean);
    if (!numbers.length) {return json({ ok: true, statuses: {} });}
    try {
      const statuses = await fetchPRStatuses(numbers, env);
      return json({ ok: true, statuses });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 502);
    }
  }

  // -------------------------------------------------------------------------
  // POST /editor/location
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/editor/location") {
    if (!checkOrigin(request)) {return json({ ok: false, error: "Forbidden" }, 403);}
    try {
      const { project, city, filename, existingSha, location } =
        (await request.json()) as {
          project: string;
          city: string;
          filename: string;
          existingSha?: string | null;
          location: unknown;
        };
      const authResult = await requireEditorCap(request, env, project);
      if (authResult instanceof Response) {return authResult;}
      const validationError = validatePostLocation({ project, city, filename, existingSha, location });
      if (validationError) {
        return json({ ok: false, error: validationError }, 400);
      }
      const yamlContent = yaml.dump(location, {
        lineWidth: -1,
        noRefs: true,
        indent: 2,
      });
      if (yamlContent.length > MAX_YAML_BYTES) {
        return json({ ok: false, error: "Location data too large" }, 400);
      }
      const filePath = locationFilePath(project, city, filename);
      const { prUrl } = await createFilePR(
        filePath,
        yamlContent,
        authResult.committerName,
        env,
      );
      return json({ ok: true, prUrl });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 502);
    }
  }

  return null;
}
