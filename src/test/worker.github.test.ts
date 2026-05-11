import { describe, it, expect } from "vitest";
import {
  decodeGitHubContent,
  encodeGitHubContent,
  locationFilePath,
  slugify,
  createFilePR,
} from "../worker/github.js";

describe("encodeGitHubContent / decodeGitHubContent", () => {
  it("round-trips ASCII content", () => {
    const original = "locationId: 1\ntitle: Test\n";
    expect(decodeGitHubContent(encodeGitHubContent(original))).toBe(original);
  });

  it("round-trips UTF-8 content (accented characters)", () => {
    const original = "title: Café de Unie\naddress: Plein 1\n";
    expect(decodeGitHubContent(encodeGitHubContent(original))).toBe(original);
  });

  it("strips whitespace from base64 before decoding (GitHub API wraps at 76 chars)", () => {
    const original = "hello: world\n";
    const encoded = encodeGitHubContent(original);
    const withNewlines = encoded.replace(/.{10}/g, "$&\n");
    expect(decodeGitHubContent(withNewlines)).toBe(original);
  });
});

describe("locationFilePath", () => {
  it("builds the canonical data path", () => {
    expect(
      locationFilePath("democrats_abroad", "den_haag", "001_loc_test.yaml"),
    ).toBe(
      "src/data/text/en/projects/democrats_abroad/den_haag/001_loc_test.yaml",
    );
  });
});

describe("slugify", () => {
  it("lowercases and replaces non-alphanumeric runs with hyphens", () => {
    expect(slugify("Team Alpha")).toBe("team-alpha");
  });

  it("handles path separators and dots", () => {
    expect(
      slugify("src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml"),
    ).toBe("src-data-text-en-projects-democrats-abroad-den-haag-001-loc-binnenhof-yaml");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });
});

describe("createFilePR", () => {
  const env = {
    GITHUB_REPO: "myorg/myrepo",
    GITHUB_PAT: "ghp_test",
  } as unknown as import("../types/worker").Env;

  const filePath =
    "src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml";

  function mockFetch(responses: Array<{ status: number; body: unknown }>) {
    let callIndex = 0;
    return vi.fn().mockImplementation(() => {
      const r = responses[callIndex++] ?? { status: 200, body: {} };
      return Promise.resolve({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        text: () => Promise.resolve(JSON.stringify(r.body)),
        json: () => Promise.resolve(r.body),
      });
    });
  }

  it("creates a new branch and PR when none exist", async () => {
    const fetch = mockFetch([
      // GET /git/ref/heads/main → sha for branch base
      { status: 200, body: { object: { sha: "mainsha" } } },
      // GET /git/ref/heads/editor/... → 404, branch does not exist
      { status: 404, body: {} },
      // POST /git/refs → create branch
      { status: 201, body: {} },
      // GET /contents/...?ref=branch → 404, new file
      { status: 404, body: {} },
      // PUT /contents/... → create file on branch
      { status: 201, body: {} },
      // GET /pulls?head=...&state=open → empty, no existing PR
      { status: 200, body: [] },
      // POST /pulls → create PR
      { status: 201, body: { html_url: "https://github.com/myorg/myrepo/pull/1" } },
    ]);
    globalThis.fetch = fetch;

    const result = await createFilePR(filePath, "content: test\n", "Team Alpha", env);
    expect(result.prUrl).toBe("https://github.com/myorg/myrepo/pull/1");
  });

  it("reuses an existing branch and returns existing open PR", async () => {
    const fetch = mockFetch([
      // GET /git/ref/heads/main
      { status: 200, body: { object: { sha: "mainsha" } } },
      // GET /git/ref/heads/editor/... → 200, branch exists
      { status: 200, body: { ref: "refs/heads/editor/team-alpha/src-data-..." } },
      // GET /contents/...?ref=branch → file exists on branch
      { status: 200, body: { sha: "filesha", content: "", encoding: "base64" } },
      // PUT /contents/... → update file on branch
      { status: 200, body: {} },
      // GET /pulls?head=...&state=open → existing PR
      { status: 200, body: [{ html_url: "https://github.com/myorg/myrepo/pull/7" }] },
    ]);
    globalThis.fetch = fetch;

    const result = await createFilePR(filePath, "content: updated\n", "Team Alpha", env);
    expect(result.prUrl).toBe("https://github.com/myorg/myrepo/pull/7");
  });
});
