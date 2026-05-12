import type { Env } from "../../types/worker";
import type { TokenPayload } from "../../types/auth";
import { requireAuth } from "../auth";
import {
  fetchLocations,
  fetchLocation,
  createFilePR,
  locationFilePath,
  fetchPRStatuses,
} from "../github";
import { json } from "../utils";
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

function requireAdmin(authPayload: TokenPayload | null): Response | null {
  if (!authPayload?.isAdmin) {
    return json({ ok: false, error: "Forbidden" }, authPayload ? 403 : 401);
  }
  return null;
}

export async function handleEditorRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method === "GET" && url.pathname === "/editor/locations") {
    const authPayload = await requireAuth(request, env);
    const denied = requireAdmin(authPayload);
    if (denied) {
      return denied;
    }
    const project = url.searchParams.get("project");
    const city = url.searchParams.get("city");
    if (!project || !city) {
      return json({ ok: false, error: "Missing project or city" }, 400);
    }
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

  if (request.method === "GET" && url.pathname === "/editor/location") {
    const authPayload = await requireAuth(request, env);
    const denied = requireAdmin(authPayload);
    if (denied) {
      return denied;
    }
    const project = url.searchParams.get("project");
    const city = url.searchParams.get("city");
    const file = url.searchParams.get("file");
    if (!project || !city || !file) {
      return json({ ok: false, error: "Missing params" }, 400);
    }
    try {
      const { filename, sha, location } = await fetchLocation(
        project,
        city,
        file,
        env,
      );
      return json({ ok: true, filename, sha, location });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 502);
    }
  }

  // GET /editor/pr-status?numbers=1,2,3
  // Returns { ok: true, statuses: { "27": "open", "28": "closed" } }
  // Used by the location list to auto-clear pending badges for PRs that are
  // no longer open. GitHub uses state "closed" for both merged and rejected PRs.
  if (request.method === "GET" && url.pathname === "/editor/pr-status") {
    const authPayload = await requireAuth(request, env);
    const denied = requireAdmin(authPayload);
    if (denied) {
      return denied;
    }
    const numbers = (url.searchParams.get("numbers") ?? "")
      .split(",")
      .filter(Boolean);
    if (!numbers.length) {
      return json({ ok: true, statuses: {} });
    }
    try {
      const statuses = await fetchPRStatuses(numbers, env);
      return json({ ok: true, statuses });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 502);
    }
  }

  if (request.method === "POST" && url.pathname === "/editor/location") {
    const authPayload = await requireAuth(request, env);
    const denied = requireAdmin(authPayload);
    if (denied) {
      return denied;
    }
    try {
      const { project, city, filename, existingSha, location } =
        (await request.json()) as {
          project: string;
          city: string;
          filename: string;
          existingSha?: string | null;
          location: unknown;
        };
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
        authPayload!.teamName,
        env,
      );
      return json({ ok: true, prUrl });
    } catch (err) {
      return json({ ok: false, error: (err as Error).message }, 502);
    }
  }

  return null;
}
