// @ts-nocheck
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { Response as NodeResponse } from "undici";
import worker from "../worker";
import { createToken } from "../worker/auth";
import type { TokenPayload } from "../types/auth";
import type { Env } from "../types/worker";

// @cf-wasm/photon/workerd can't load in Node.js (WASM import), but
// worker.ts → uploadRoute.ts → imageProcessing.ts imports it statically.
vi.mock("@cf-wasm/photon/workerd", () => ({
  PhotonImage: { new_from_byteslice: vi.fn() },
  resize: vi.fn(),
  rotate: vi.fn(),
  fliph: vi.fn(),
  flipv: vi.fn(),
  SamplingFilter: { Lanczos3: 5 },
}));

const TEST_SECRET = "test-secret";
const TEST_PAYLOAD: TokenPayload = {
  project: "test_project",
  teamName: "Team A",
  contact: "a@b.com",
  isAdmin: false,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

let authToken: string;
beforeEach(async () => {
  authToken = await createToken(TEST_PAYLOAD, TEST_SECRET);
});

describe("/form-submit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("forwards payload to FORM_SCRIPT_URL and returns ok", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const env: Env = {
      FORM_SCRIPT_URL: "https://script.google.com/fake",
      AUTH_STORE: { get: async () => null },
      AUTH_SECRET: TEST_SECRET,
    } as unknown as Env;
    const body = JSON.stringify({
      locationId: "001",
      timestamp: "2026-01-01T00:00:00Z",
      submitterId: "Alice",
      fields: {},
    });
    const request = new Request("https://example.com/form-submit", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        Cookie: `freedom_hunt_auth=${authToken}`,
      },
    });

    const response = await worker.fetch(request, env);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://script.google.com/fake",
      expect.objectContaining({ method: "POST", body }),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it("propagates ok:false from Apps Script response", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: false, error: "Sheet error" }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const env: Env = {
      FORM_SCRIPT_URL: "https://script.google.com/fake",
      AUTH_STORE: { get: async () => null },
      AUTH_SECRET: TEST_SECRET,
    } as unknown as Env;
    const request = new Request("https://example.com/form-submit", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(false);
  });

  it("returns 500 when fetch throws", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("Network error")));
    const env: Env = {
      FORM_SCRIPT_URL: "https://script.google.com/fake",
      AUTH_STORE: { get: async () => null },
      AUTH_SECRET: TEST_SECRET,
    } as unknown as Env;
    const request = new Request("https://example.com/form-submit", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
  });
});

// ── helpers ──────────────────────────────────────────────────────────────
const makeAdminEnv = (): Env => ({
  AUTH_SECRET: TEST_SECRET,
  AUTH_STORE: { get: async () => null },
  GITHUB_PAT: "fake-pat",
  GITHUB_REPO: "owner/repo",
});

const makeAdminToken = (): Promise<string> =>
  createToken({ ...TEST_PAYLOAD, isAdmin: true }, TEST_SECRET);

// ── GET /editor/locations ─────────────────────────────────────────────────
describe("GET /editor/locations", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 for unauthenticated request", async () => {
    const request = new Request(
      "https://example.com/editor/locations?project=p&city=c",
    );
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(401);
  });

  it("returns parsed locations from GitHub", async () => {
    const adminToken = await makeAdminToken();
    const sampleYaml = 'locationId: 1\ntitle: Test Location\naddress: ""\n';
    const encoded = btoa(sampleYaml);

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              name: "001_loc_test.yaml",
              path: "src/data/text/en/projects/p/c/001_loc_test.yaml",
              type: "file",
            },
            {
              name: "cities.yaml",
              path: "src/data/text/en/projects/p/cities.yaml",
              type: "file",
            },
          ]),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: encoded + "\n", sha: "abc123" }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const request = new Request(
      "https://example.com/editor/locations?project=p&city=c",
      {
        headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
      },
    );
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.locations).toHaveLength(1);
    expect(data.locations[0].filename).toBe("001_loc_test.yaml");
    expect(data.locations[0].location.title).toBe("Test Location");
    expect(data.locations[0].sha).toBe("abc123");
  });
});

// ── GET /editor/location ──────────────────────────────────────────────────
describe("GET /editor/location", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns single parsed location", async () => {
    const adminToken = await makeAdminToken();
    const sampleYaml = 'locationId: 2\ntitle: Peace Palace\naddress: ""\n';
    const encoded = btoa(sampleYaml);

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ content: encoded + "\n", sha: "def456" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    const request = new Request(
      "https://example.com/editor/location?project=p&city=c&file=002_loc_peace.yaml",
      { headers: { Cookie: `freedom_hunt_auth=${adminToken}` } },
    );
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.location.title).toBe("Peace Palace");
    expect(data.sha).toBe("def456");
  });
});

// ── POST /editor/location ─────────────────────────────────────────────────
describe("POST /editor/location", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates branch, commits file, opens PR and returns prUrl", async () => {
    const adminToken = await makeAdminToken();

    globalThis.fetch = vi
      .fn()
      // 1. get main SHA
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ object: { sha: "mainsha" } }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      // 2. check if branch exists (404)
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 }))
      // 3. create branch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ref: "refs/heads/editor/team-a/src-data-..." }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      // 4. get file SHA on branch (404)
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 }))
      // 5. PUT file
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ content: { sha: "new-sha" } }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      // 6. search for open PRs (empty)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      // 7. create PR
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            html_url: "https://github.com/owner/repo/pull/1",
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const body = JSON.stringify({
      project: "p",
      city: "c",
      filename: "001_loc_test.yaml",
      existingSha: null,
      location: { locationId: 1, title: "New Location", address: "" },
    });
    const request = new Request("https://example.com/editor/location", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        Cookie: `freedom_hunt_auth=${adminToken}`,
      },
    });
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.prUrl).toBe("https://github.com/owner/repo/pull/1");
  });

  describe("input validation", () => {
    const VALID_BODY = {
      project: "democrats_abroad",
      city: "den_haag",
      filename: "001_loc_test.yaml",
      location: { title: "Test" },
    };

    async function postLocation(
      body: Record<string, unknown>,
      token: string,
    ): Promise<Response> {
      return worker.fetch(
        new Request("https://example.com/editor/location", {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
            Cookie: `freedom_hunt_auth=${token}`,
          },
        }),
        makeAdminEnv(),
      );
    }

    it("rejects project with invalid characters", async () => {
      const token = await makeAdminToken();
      const response = await postLocation({ ...VALID_BODY, project: "bad/proj" }, token);
      expect(response.status).toBe(400);
      expect((await response.json() as Record<string, unknown>).ok).toBe(false);
    });

    it("rejects project exceeding 64 characters", async () => {
      const token = await makeAdminToken();
      const response = await postLocation({ ...VALID_BODY, project: "a".repeat(65) }, token);
      expect(response.status).toBe(400);
    });

    it("rejects city with invalid characters", async () => {
      const token = await makeAdminToken();
      const response = await postLocation({ ...VALID_BODY, city: "bad city!" }, token);
      expect(response.status).toBe(400);
    });

    it("rejects city exceeding 64 characters", async () => {
      const token = await makeAdminToken();
      const response = await postLocation({ ...VALID_BODY, city: "a".repeat(65) }, token);
      expect(response.status).toBe(400);
    });

    it("rejects filename that doesn't match location file pattern", async () => {
      const token = await makeAdminToken();
      const response = await postLocation({ ...VALID_BODY, filename: "bad_name.yaml" }, token);
      expect(response.status).toBe(400);
    });

    it("rejects filename exceeding 100 characters", async () => {
      const token = await makeAdminToken();
      const longFilename = "001_loc_" + "a".repeat(93) + ".yaml";
      const response = await postLocation({ ...VALID_BODY, filename: longFilename }, token);
      expect(response.status).toBe(400);
    });

    it("rejects existingSha that is not a 40-char hex string", async () => {
      const token = await makeAdminToken();
      const response = await postLocation({ ...VALID_BODY, existingSha: "notasha" }, token);
      expect(response.status).toBe(400);
    });

    it("rejects location that is null", async () => {
      const token = await makeAdminToken();
      const response = await postLocation({ ...VALID_BODY, location: null }, token);
      expect(response.status).toBe(400);
    });

    it("rejects location that is an array", async () => {
      const token = await makeAdminToken();
      const response = await postLocation({ ...VALID_BODY, location: [] }, token);
      expect(response.status).toBe(400);
    });

    it("rejects location whose YAML serialization exceeds 50 KB", async () => {
      const token = await makeAdminToken();
      const bigLocation = { title: "x".repeat(60_000) };
      const response = await postLocation({ ...VALID_BODY, location: bigLocation }, token);
      expect(response.status).toBe(400);
    });
  });
});

describe("/editor/pr-status", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 for unauthenticated request", async () => {
    const request = new Request(
      "https://example.com/editor/pr-status?numbers=1",
    );
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(401);
  });

  it("returns empty statuses when numbers param is absent", async () => {
    const adminToken = await makeAdminToken();
    const request = new Request("https://example.com/editor/pr-status", {
      headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
    });
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.statuses).toEqual({});
  });

  it("returns GitHub state for each PR number", async () => {
    const adminToken = await makeAdminToken();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: "open" }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: "closed" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    const request = new Request(
      "https://example.com/editor/pr-status?numbers=27,28",
      {
        headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
      },
    );
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.statuses["27"]).toBe("open");
    expect(data.statuses["28"]).toBe("closed");
  });
});

describe("/auth/logout", () => {
  // happy-dom v20 blocks Set-Cookie from Response.headers.get(); use undici's
  // Response for this block so the cookie-clearing assertion can read the header.
  // Plain assignment (not vi.stubGlobal/unstubAllGlobals) — with isolate:false,
  // unstubAllGlobals reverts global state shared across the whole test run,
  // not just this file, which broke jest-dom matcher registration for every
  // test file that ran afterward in the same thread.
  const originalResponse = globalThis.Response;
  beforeEach(() => {
    globalThis.Response = NodeResponse as unknown as typeof Response;
  });
  afterEach(() => {
    globalThis.Response = originalResponse;
  });

  it("returns 200 with ok: true", async () => {
    const env = { AUTH_SECRET: TEST_SECRET };
    const request = new Request("https://example.com/auth/logout", {
      method: "POST",
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it("clears the auth cookie", async () => {
    const env = { AUTH_SECRET: TEST_SECRET };
    const request = new Request("https://example.com/auth/logout", {
      method: "POST",
    });
    const response = await worker.fetch(request, env);
    const cookie = response.headers.get("Set-Cookie");
    expect(cookie).toMatch(/freedom_hunt_auth=;/);
    expect(cookie).toMatch(/Max-Age=0/);
  });
});

describe("/auth/login — admin tier", () => {
  const makeAuthEnv = () => ({
    AUTH_STORE: {
      get: async (key) => {
        if (key === "admin:test_project") return "adminpass";
        if (key === "auth:test_project") return "userpass";
        if (key.startsWith("rl:")) return null;
        return null;
      },
      put: async () => {},
    },
    AUTH_SECRET: TEST_SECRET,
  });

  it("issues bootstrap token when admin password used", async () => {
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({
        project: "test_project",
        teamName: "Org",
        contact: "",
        password: "adminpass",
      }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
      },
    });
    const response = await worker.fetch(request, makeAuthEnv());
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.isBootstrap).toBe(true);
  });

  it("sets isAdmin false for participant password", async () => {
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({
        project: "test_project",
        teamName: "Team A",
        contact: "",
        password: "userpass",
      }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.5",
      },
    });
    const response = await worker.fetch(request, makeAuthEnv());
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.isAdmin).toBe(false);
  });

  it("returns 401 for wrong password", async () => {
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({
        project: "test_project",
        teamName: "",
        contact: "",
        password: "wrong",
      }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.6",
      },
    });
    const response = await worker.fetch(request, makeAuthEnv());
    expect(response.status).toBe(401);
  });

  it("returns 400 when project field is missing", async () => {
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "pass" }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "9.9.9.1",
      },
    });
    const response = await worker.fetch(request, makeAuthEnv());
    expect(response.status).toBe(400);
  });

  it('returns 401 with "Project not found" for unknown project', async () => {
    const env = {
      AUTH_STORE: {
        get: async () => null,
        put: async () => {},
      },
      AUTH_SECRET: TEST_SECRET,
    };
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({ project: "no_such_project", password: "pass" }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "9.9.9.2",
      },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Project not found");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const env = {
      AUTH_STORE: {
        get: async (key) => {
          if (key.startsWith("rl:")) {
            return JSON.stringify({ count: 5, windowStart: Date.now() });
          }
          return null;
        },
        put: async () => {},
      },
      AUTH_SECRET: TEST_SECRET,
    };
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({ project: "test_project", password: "pass" }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "9.9.9.3",
      },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(429);
  });
});

describe("/auth/me — isAdmin", () => {
  it("includes isAdmin in response", async () => {
    const adminToken = await createToken(
      { ...TEST_PAYLOAD, isAdmin: true },
      TEST_SECRET,
    );
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
    };
    const request = new Request("https://example.com/auth/me", {
      headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
    });
    const response = await worker.fetch(request, env);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.isAdmin).toBe(true);
  });

  it("returns 401 when no auth cookie is present", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
    };
    const request = new Request("https://example.com/auth/me");
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });
});
