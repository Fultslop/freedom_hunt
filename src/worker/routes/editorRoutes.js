import { requireAuth } from "../auth.js";
import {
  fetchLocations,
  fetchLocation,
  createLocationPR,
  fetchPRStatuses,
} from "../github.js";
import { json } from "../utils.js";
import yaml from "js-yaml";

function requireAdmin(authPayload) {
  if (!authPayload?.isAdmin) {
    return json({ ok: false, error: "Forbidden" }, authPayload ? 403 : 401);
  }
  return null;
}

export async function handleEditorRoutes(request, url, env) {
  if (request.method === "GET" && url.pathname === "/editor/locations") {
    const authPayload = await requireAuth(request, env);
    const denied = requireAdmin(authPayload);
    if (denied) return denied;
    const project = url.searchParams.get("project");
    const city = url.searchParams.get("city");
    if (!project || !city)
      return json({ ok: false, error: "Missing project or city" }, 400);
    try {
      const locations = await fetchLocations(project, city, env);
      return json({
        ok: true,
        locations: locations.sort(
          (a, b) => (a.location.locationId ?? 0) - (b.location.locationId ?? 0),
        ),
      });
    } catch (err) {
      return json({ ok: false, error: err.message }, 502);
    }
  }

  if (request.method === "GET" && url.pathname === "/editor/location") {
    const authPayload = await requireAuth(request, env);
    const denied = requireAdmin(authPayload);
    if (denied) return denied;
    const project = url.searchParams.get("project");
    const city = url.searchParams.get("city");
    const file = url.searchParams.get("file");
    if (!project || !city || !file)
      return json({ ok: false, error: "Missing params" }, 400);
    try {
      const { filename, sha, location } = await fetchLocation(
        project,
        city,
        file,
        env,
      );
      return json({ ok: true, filename, sha, location });
    } catch (err) {
      return json({ ok: false, error: err.message }, 502);
    }
  }

  // GET /editor/pr-status?numbers=1,2,3
  // Returns { ok: true, statuses: { "27": "open", "28": "closed" } }
  // Used by the location list to auto-clear pending badges for PRs that are
  // no longer open. GitHub uses state "closed" for both merged and rejected PRs.
  if (request.method === "GET" && url.pathname === "/editor/pr-status") {
    const authPayload = await requireAuth(request, env);
    const denied = requireAdmin(authPayload);
    if (denied) return denied;
    const numbers = (url.searchParams.get("numbers") ?? "")
      .split(",")
      .filter(Boolean);
    if (!numbers.length) return json({ ok: true, statuses: {} });
    try {
      const statuses = await fetchPRStatuses(numbers, env);
      return json({ ok: true, statuses });
    } catch (err) {
      return json({ ok: false, error: err.message }, 502);
    }
  }

  if (request.method === "POST" && url.pathname === "/editor/location") {
    const authPayload = await requireAuth(request, env);
    const denied = requireAdmin(authPayload);
    if (denied) return denied;
    try {
      const { project, city, filename, existingSha, location } =
        await request.json();
      if (!project || !city || !filename || !location) {
        return json({ ok: false, error: "Missing fields" }, 400);
      }
      const yamlContent = yaml.dump(location, {
        lineWidth: -1,
        noRefs: true,
        indent: 2,
      });
      const action = location.hidden ? "Hide" : existingSha ? "Edit" : "Add";
      const prTitle = `${action} location: ${location.title || filename}`;
      const result = await createLocationPR(
        project,
        city,
        filename,
        yamlContent,
        existingSha,
        prTitle,
        env,
      );
      return json({ ok: true, ...result });
    } catch (err) {
      return json({ ok: false, error: err.message }, 502);
    }
  }

  return null;
}
