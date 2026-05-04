# Task 04 — Extract route handlers + thin dispatcher

> **Index:** [worker-refactor](2026-05-02-worker-refactor.md) | **Depends on:** Tasks 02, 03

**Goal:** Move each route group into its own file, reduce `src/worker.js` to a dispatcher loop, and update test imports to point at the new module locations (removing the temporary re-exports added in Task 02).

**Files:**

- Create: `src/worker/utils.js`
- Create: `src/worker/routes/authRoutes.js`
- Create: `src/worker/routes/uploadRoute.js`
- Create: `src/worker/routes/formSubmitRoute.js`
- Create: `src/worker/routes/editorRoutes.js`
- Modify: `src/worker.js` (replace entirely)
- Modify: `src/test/worker.test.js` (update imports)

---

- [ ] **Step 1: Create `src/worker/utils.js`** (shared response helper)

```js
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
```

---

- [ ] **Step 2: Create `src/worker/routes/authRoutes.js`**

Each handler returns a `Response` when it matches, or `null` to pass through to the next handler.

```js
import {
  checkRateLimit,
  createToken,
  requireAuth,
  COOKIE_NAME,
  TOKEN_TTL_SECONDS,
  AUTH_COOKIE_ATTRS,
} from "../auth.js";
import { json } from "../utils.js";

export async function handleAuthRoutes(request, url, env) {
  if (request.method === "POST" && url.pathname === "/auth/login") {
    try {
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
      if (await checkRateLimit(clientIP, env)) {
        return json(
          { ok: false, error: "Too many attempts. Please wait a moment." },
          429,
        );
      }
      const { project, teamName, contact, password } = await request.json();
      if (!project || !password)
        return json({ ok: false, error: "Missing required fields" }, 400);

      const adminPw = await env.AUTH_STORE.get(`admin:${project}`);
      const participantPw = await env.AUTH_STORE.get(`auth:${project}`);
      if (adminPw === null && participantPw === null) {
        return json({ ok: false, error: "Project not found" }, 401);
      }

      let isAdmin = false;
      if (adminPw !== null && password === adminPw) {
        isAdmin = true;
      } else if (participantPw === null || password !== participantPw) {
        return json({ ok: false, error: "Incorrect password" }, 401);
      }

      const payload = {
        project,
        teamName: teamName || "",
        contact: contact || "",
        isAdmin,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      };
      const token = await createToken(payload, env.AUTH_SECRET);
      return json(
        {
          ok: true,
          teamName: payload.teamName,
          contact: payload.contact,
          isAdmin,
        },
        200,
        {
          "Set-Cookie": `${COOKIE_NAME}=${token}; ${AUTH_COOKIE_ATTRS}; Max-Age=${TOKEN_TTL_SECONDS}`,
        },
      );
    } catch {
      return json({ ok: false, error: "Login failed" }, 500);
    }
  }

  if (request.method === "GET" && url.pathname === "/auth/me") {
    const payload = await requireAuth(request, env);
    if (!payload) return json({ ok: false, error: "Not authenticated" }, 401);
    return json({
      ok: true,
      project: payload.project,
      teamName: payload.teamName,
      contact: payload.contact,
      isAdmin: payload.isAdmin ?? false,
    });
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    return json({ ok: true }, 200, {
      "Set-Cookie": `${COOKIE_NAME}=; ${AUTH_COOKIE_ATTRS}; Max-Age=0`,
    });
  }

  return null;
}
```

> Note: `Max-Age=2592000` in the original login cookie was the numeric value of `TOKEN_TTL_SECONDS`. This task replaces the hardcoded number with the constant.

---

- [ ] **Step 3: Create `src/worker/routes/uploadRoute.js`**

```js
import { requireAuth } from "../auth.js";
import { json } from "../utils.js";

export function buildR2Key(locationId, mimeType, timestamp) {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  return `${locationId}_${timestamp}.${ext}`;
}

export async function handleUploadRoute(request, url, env) {
  if (request.method !== "POST" || url.pathname !== "/upload") return null;

  const authPayload = await requireAuth(request, env);
  if (!authPayload) return json({ ok: false, error: "Unauthorized" }, 401);

  try {
    const formData = await request.formData();
    const photo = formData.get("photo");
    const locationId = formData.get("locationId") || "unknown";
    const key = buildR2Key(locationId, photo.type, Date.now());
    await env.PHOTOS.put(key, photo.stream(), {
      httpMetadata: { contentType: photo.type },
    });
    return json({ ok: true, key });
  } catch {
    return json({ ok: false, error: "Upload failed" }, 500);
  }
}
```

---

- [ ] **Step 4: Create `src/worker/routes/formSubmitRoute.js`**

```js
import { requireAuth } from "../auth.js";
import { json } from "../utils.js";

export async function handleFormSubmitRoute(request, url, env) {
  if (request.method !== "POST" || url.pathname !== "/form-submit") return null;

  const authPayload = await requireAuth(request, env);
  if (!authPayload) return json({ ok: false, error: "Unauthorized" }, 401);

  try {
    const body = await request.text();
    const scriptRes = await fetch(env.FORM_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const scriptData = await scriptRes.json();
    return json({ ok: scriptData.ok ?? true });
  } catch {
    return json({ ok: false, error: "Submission failed" }, 500);
  }
}
```

---

- [ ] **Step 5: Create `src/worker/routes/editorRoutes.js`**

```js
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
```

---

- [ ] **Step 6: Replace `src/worker.js` with the thin dispatcher**

```js
import { handleAuthRoutes } from "./worker/routes/authRoutes.js";
import { handleUploadRoute } from "./worker/routes/uploadRoute.js";
import { handleFormSubmitRoute } from "./worker/routes/formSubmitRoute.js";
import { handleEditorRoutes } from "./worker/routes/editorRoutes.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    return (
      (await handleAuthRoutes(request, url, env)) ??
      (await handleUploadRoute(request, url, env)) ??
      (await handleFormSubmitRoute(request, url, env)) ??
      (await handleEditorRoutes(request, url, env)) ??
      (env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 }))
    );
  },
};
```

> The `??` chain short-circuits: if a handler returns a `Response`, the remaining handlers are never called.

---

- [ ] **Step 7: Update `src/test/worker.test.js` to import from new locations**

Replace the import line at the top:

```js
// was:
import worker, { buildR2Key, createToken } from "../worker.js";

// becomes:
import worker from "../worker.js";
import { buildR2Key } from "../worker/routes/uploadRoute.js";
import { createToken } from "../worker/auth.js";
```

- [ ] **Step 8: Run the full test suite**

```
npm run test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```
git add src/worker/utils.js src/worker/routes/ src/worker.js src/test/worker.test.js
git commit -m "refactor: extract route handlers, worker.js is now a thin dispatcher"
```
