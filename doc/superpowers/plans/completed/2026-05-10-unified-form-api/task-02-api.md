# Task 02: Create `src/utils/api.ts`

**Files:**
- Create: `src/utils/api.ts`

All client-side `fetch()` calls in the app go through this module. No component or store calls `fetch()` directly after this refactor.

---

- [ ] **Step 1: Create the file**

Create `src/utils/api.ts` with the following content:

```typescript
import type { Location } from "../types/data";

// ---------------------------------------------------------------------------
// Challenge
// ---------------------------------------------------------------------------

export interface FormSubmitPayload {
  locationId: number;
  routeId?: string;
  teamName: string;
  contact: string;
  answers: Record<string, unknown>;
}

export async function postFormSubmit(
  payload: FormSubmitPayload,
): Promise<{ ok: boolean }> {
  const res = await fetch("/form-submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean }>;
}

export async function postPhotoUpload(
  locationId: number,
  file: File,
): Promise<{ ok: boolean; key?: string }> {
  const body = new FormData();
  body.append("photo", file);
  body.append("locationId", String(locationId));
  const res = await fetch("/upload", { method: "POST", body });
  return res.json() as Promise<{ ok: boolean; key?: string }>;
}

// ---------------------------------------------------------------------------
// Editor — locations
// ---------------------------------------------------------------------------

export interface LocationListEntry {
  filename: string;
  sha: string;
  location: Location;
}

export interface EditorLocationPayload {
  project: string;
  city: string;
  filename: string;
  existingSha: string | null;
  location: Record<string, unknown>;
}

export async function fetchEditorLocation(
  project: string,
  city: string,
  file: string,
): Promise<{ ok: boolean; sha?: string; location?: Record<string, unknown> }> {
  const res = await fetch(
    `/editor/location?project=${project}&city=${city}&file=${file}`,
  );
  return res.json() as Promise<{
    ok: boolean;
    sha?: string;
    location?: Record<string, unknown>;
  }>;
}

export async function saveEditorLocation(
  payload: EditorLocationPayload,
): Promise<{ ok: boolean; prUrl?: string; error?: string }> {
  const res = await fetch("/editor/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; prUrl?: string; error?: string }>;
}

export async function fetchEditorLocations(
  project: string,
  city: string,
): Promise<{ ok: boolean; locations?: LocationListEntry[]; error?: string }> {
  const res = await fetch(
    `/editor/locations?project=${project}&city=${city}`,
  );
  return res.json() as Promise<{
    ok: boolean;
    locations?: LocationListEntry[];
    error?: string;
  }>;
}

export async function fetchPrStatuses(
  numbers: string[],
): Promise<{ ok: boolean; statuses?: Record<string, string> }> {
  const res = await fetch(
    `/editor/pr-status?numbers=${numbers.join(",")}`,
  );
  return res.json() as Promise<{
    ok: boolean;
    statuses?: Record<string, string>;
  }>;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginPayload {
  project: string;
  teamName: string;
  contact: string;
  password: string;
}

export interface LoginResponse {
  ok: boolean;
  teamName?: string;
  contact?: string;
  isAdmin?: boolean;
  error?: string;
}

export async function postLogin(
  payload: LoginPayload,
): Promise<LoginResponse> {
  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<LoginResponse>;
}

export async function postLogout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST" });
}

export interface AuthMeResponse {
  ok: boolean;
  project?: string;
  teamName?: string;
  contact?: string;
  isAdmin?: boolean;
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const res = await fetch("/auth/me");
  return res.json() as Promise<AuthMeResponse>;
}
```

- [ ] **Step 2: Run lint**

```
npm run lint
```

Expected: passes cleanly (this file has no imports from files being changed).

- [ ] **Step 3: Commit**

```
git add src/utils/api.ts
git commit -m "feat: add src/utils/api.ts — centralised client HTTP functions"
```
