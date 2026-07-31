import {
  postFormSubmit,
  postPhotoUpload,
  fetchEditorLocation,
  saveEditorLocation,
  fetchEditorLocations,
  fetchPrStatuses,
  postLogin,
  postVerifyCode,
  postLogout,
  fetchAuthMe,
  fetchGalleryPhotos,
  fetchRandomPhotos,
  postDemoSignup,
  fetchResultsSubmissions,
  postConsentUpdate,
  fetchConsentVersion,
} from "../utils/api";

function mockFetch(response: unknown, status = 200) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    json: async () => response,
    status,
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
    locationId: "1",
    routeId: "short_loop",
    cityId: "den_haag",
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
    locationId: "1",
    cityId: "den_haag",
    teamName: "",
    contact: "",
    answers: {},
  });
  expect(result.ok).toBe(false);
});

test("postPhotoUpload POSTs to /upload with FormData", async () => {
  mockFetch({ ok: true, id: "photo-1", key: "1_123" }, 200);
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const result = await postPhotoUpload({
    locationId: "1",
    cityId: "den_haag",
    routeId: "short_loop",
    taskTitle: "The Final Civic Act",
    file,
  });
  expect(fetch).toHaveBeenCalledWith(
    "/upload",
    expect.objectContaining({ method: "POST" }),
  );
  expect(result).toEqual({ ok: true, id: "photo-1", key: "1_123", httpCode: 200 });
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

test("fetchPrStatuses GETs /editor/pr-status with project and comma-joined numbers", async () => {
  mockFetch({ ok: true, statuses: { "42": "open" } });
  const result = await fetchPrStatuses(["42", "43"], "democrats_abroad");
  expect(fetch).toHaveBeenCalledWith(
    "/editor/pr-status?project=democrats_abroad&numbers=42,43",
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

test("postVerifyCode POSTs to /auth/verify-code with the code", async () => {
  mockFetch({ ok: true, mode: "project", project: "democrats_abroad" });
  const result = await postVerifyCode("letmein");
  expect(fetch).toHaveBeenCalledWith("/auth/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "letmein" }),
  });
  expect(result.ok).toBe(true);
  expect(result.mode).toBe("project");
  expect(result.project).toBe("democrats_abroad");
});

test("postVerifyCode returns ok:false for an unrecognized code", async () => {
  mockFetch({ ok: false, error: "Invalid code" });
  const result = await postVerifyCode("nope");
  expect(result.ok).toBe(false);
});

test("postLogin omits contact from the request body when not provided", async () => {
  mockFetch({ ok: true, teamName: "Team A", isAdmin: false });
  const payload = { project: "democrats_abroad", teamName: "Team A", password: "secret" };
  await postLogin(payload);
  expect(fetch).toHaveBeenCalledWith("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

test("fetchGalleryPhotos GETs /gallery/:project/:city/photos", async () => {
  mockFetch({ ok: true, photos: [] });
  await fetchGalleryPhotos("democrats_abroad", "den_haag");
  expect(fetch).toHaveBeenCalledWith("/gallery/democrats_abroad/den_haag/photos");
});

test("fetchGalleryPhotos appends team/task filters as query params", async () => {
  mockFetch({ ok: true, photos: [] });
  await fetchGalleryPhotos("democrats_abroad", "den_haag", { team: "Team A", task: "Plaque" });
  expect(fetch).toHaveBeenCalledWith(
    "/gallery/democrats_abroad/den_haag/photos?team=Team+A&task=Plaque",
  );
});

test("fetchRandomPhotos GETs /gallery/:project/:city/photos/random", async () => {
  mockFetch({ ok: true, photos: [] });
  await fetchRandomPhotos("democrats_abroad", "den_haag");
  expect(fetch).toHaveBeenCalledWith("/gallery/democrats_abroad/den_haag/photos/random");
});

// ---------------------------------------------------------------------------
// Demo participant signup
// ---------------------------------------------------------------------------

test("postDemoSignup POSTs to /auth/participant-signup and returns the response", async () => {
  mockFetch({ ok: true, teamName: "Team Test", contact: "t@test.com", isAdmin: false });
  const result = await postDemoSignup({
    project: "demo", email: "t@test.com", teamName: "Team Test", password: "password123",
  });
  expect(fetch).toHaveBeenCalledWith(
    "/auth/participant-signup",
    expect.objectContaining({ method: "POST" }),
  );
  expect(result).toEqual({ ok: true, teamName: "Team Test", contact: "t@test.com", isAdmin: false });
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

test("fetchResultsSubmissions GETs /results/:project/:city/submissions", async () => {
  mockFetch({ ok: true, submissions: [] });
  const result = await fetchResultsSubmissions("demo", "paris");
  expect(fetch).toHaveBeenCalledWith("/results/demo/paris/submissions");
  expect(result.ok).toBe(true);
});

test("fetchResultsSubmissions returns ok: false on server error", async () => {
  mockFetch({ ok: false, error: "Forbidden" });
  const result = await fetchResultsSubmissions("demo", "paris");
  expect(result.ok).toBe(false);
  expect(result.error).toBe("Forbidden");
});

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

test("postConsentUpdate posts to /consent with city/route query params and the acknowledge flag", async () => {
  mockFetch({ ok: true, record: {} });
  await postConsentUpdate("den_haag", "short_loop", { allSixteenPlus: true, promoConsent: false, acknowledge: true });
  expect(fetch).toHaveBeenCalledWith(
    "/consent?city=den_haag&route=short_loop",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ allSixteenPlus: true, promoConsent: false, acknowledge: true }),
    }),
  );
});

test("fetchConsentVersion GETs /consent/version with project/city/route", async () => {
  mockFetch({ ok: true, consentVersion: 2 });
  const res = await fetchConsentVersion("den_haag", "den_haag", "short_loop");
  expect(fetch).toHaveBeenCalledWith("/consent/version?project=den_haag&city=den_haag&route=short_loop");
  expect(res.consentVersion).toBe(2);
});
