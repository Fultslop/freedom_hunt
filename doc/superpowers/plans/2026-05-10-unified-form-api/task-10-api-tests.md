# Task 10: Add `src/test/api.test.ts`

**Files:**
- Create: `src/test/api.test.ts`

One test per exported function in `api.ts`. Each test: mocks `globalThis.fetch`, calls the function, asserts correct URL + method + body + return value.

---

- [ ] **Step 1: Create `src/test/api.test.ts`**

```typescript
import {
  postFormSubmit,
  postPhotoUpload,
  fetchEditorLocation,
  saveEditorLocation,
  fetchEditorLocations,
  fetchPrStatuses,
  postLogin,
  postLogout,
  fetchAuthMe,
} from "../utils/api";

function mockFetch(response: unknown) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    json: async () => response,
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Challenge
// ---------------------------------------------------------------------------

test("postFormSubmit POSTs to /form-submit with payload and returns response", async () => {
  mockFetch({ ok: true });
  const payload = {
    locationId: 1,
    routeId: "short_loop",
    teamName: "Team A",
    contact: "a@b.com",
    answers: { note: "yes" },
  };
  const result = await postFormSubmit(payload);
  expect(fetch).toHaveBeenCalledWith("/form-submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  expect(result).toEqual({ ok: true });
});

test("postFormSubmit returns ok: false on server error", async () => {
  mockFetch({ ok: false });
  const result = await postFormSubmit({
    locationId: 1,
    teamName: "",
    contact: "",
    answers: {},
  });
  expect(result.ok).toBe(false);
});

test("postPhotoUpload POSTs to /upload with FormData", async () => {
  mockFetch({ ok: true, key: "1_123.jpg" });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const result = await postPhotoUpload(1, file);
  expect(fetch).toHaveBeenCalledWith(
    "/upload",
    expect.objectContaining({ method: "POST" }),
  );
  expect(result).toEqual({ ok: true, key: "1_123.jpg" });
});

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

test("fetchEditorLocation GETs /editor/location with query params", async () => {
  mockFetch({ ok: true, sha: "abc", location: { title: "Test" } });
  const result = await fetchEditorLocation(
    "democrats_abroad",
    "den_haag",
    "001_loc_binnenhof.yaml",
  );
  expect(fetch).toHaveBeenCalledWith(
    "/editor/location?project=democrats_abroad&city=den_haag&file=001_loc_binnenhof.yaml",
  );
  expect(result.ok).toBe(true);
  expect(result.sha).toBe("abc");
});

test("saveEditorLocation POSTs to /editor/location with payload", async () => {
  mockFetch({ ok: true, prUrl: "https://github.com/org/repo/pull/42" });
  const payload = {
    project: "democrats_abroad",
    city: "den_haag",
    filename: "001_loc_binnenhof.yaml",
    existingSha: "abc",
    location: { title: "Binnenhof" },
  };
  const result = await saveEditorLocation(payload);
  expect(fetch).toHaveBeenCalledWith("/editor/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  expect(result.prUrl).toBe("https://github.com/org/repo/pull/42");
});

test("fetchEditorLocations GETs /editor/locations", async () => {
  mockFetch({ ok: true, locations: [] });
  const result = await fetchEditorLocations("democrats_abroad", "den_haag");
  expect(fetch).toHaveBeenCalledWith(
    "/editor/locations?project=democrats_abroad&city=den_haag",
  );
  expect(result.ok).toBe(true);
});

test("fetchPrStatuses GETs /editor/pr-status with comma-joined numbers", async () => {
  mockFetch({ ok: true, statuses: { "42": "open" } });
  const result = await fetchPrStatuses(["42", "43"]);
  expect(fetch).toHaveBeenCalledWith(
    "/editor/pr-status?numbers=42,43",
  );
  expect(result.statuses).toEqual({ "42": "open" });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

test("postLogin POSTs to /auth/login with payload", async () => {
  mockFetch({ ok: true, teamName: "Team A", isAdmin: false });
  const payload = {
    project: "democrats_abroad",
    teamName: "Team A",
    contact: "a@b.com",
    password: "secret",
  };
  const result = await postLogin(payload);
  expect(fetch).toHaveBeenCalledWith("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  expect(result.ok).toBe(true);
  expect(result.teamName).toBe("Team A");
});

test("postLogin returns error message on failure", async () => {
  mockFetch({ ok: false, error: "Wrong password" });
  const result = await postLogin({
    project: "p",
    teamName: "",
    contact: "",
    password: "bad",
  });
  expect(result.ok).toBe(false);
  expect(result.error).toBe("Wrong password");
});

test("postLogout POSTs to /auth/logout", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({} as Response);
  await postLogout();
  expect(fetch).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
});

test("fetchAuthMe GETs /auth/me and returns parsed response", async () => {
  mockFetch({ ok: true, project: "democrats_abroad", teamName: "A", isAdmin: false });
  const result = await fetchAuthMe();
  expect(fetch).toHaveBeenCalledWith("/auth/me");
  expect(result.ok).toBe(true);
  expect(result.project).toBe("democrats_abroad");
});

test("fetchAuthMe returns ok: false when not logged in", async () => {
  mockFetch({ ok: false });
  const result = await fetchAuthMe();
  expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Run the new tests**

```
npm test -- api.test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```
git add src/test/api.test.ts
git commit -m "test: add api.test.ts — unit tests for all api.ts functions"
```
