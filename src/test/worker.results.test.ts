// @ts-nocheck
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../worker";
import { createToken } from "../worker/auth";
import type { TokenPayload } from "../types/auth";
import type { Env } from "../types/worker";

const TEST_SECRET = "test-secret";
const TEST_PAYLOAD: TokenPayload = {
  project: "demo", teamName: "Team A", contact: "a@b.com",
  isAdmin: false, exp: Math.floor(Date.now() / 1000) + 3600,
};

let authToken: string;
beforeEach(async () => {
  authToken = await createToken(TEST_PAYLOAD, TEST_SECRET);
});

const SAMPLE_SUBMISSIONS = [
  {
    id: "s1", project_id: "demo", city_id: "paris", route_id: "riverside_route",
    location_id: "1", team_name: "Team A", contact: "a@b.com",
    answers: JSON.stringify({ found: true }), submitted_at: 100,
  },
  {
    id: "s2", project_id: "demo", city_id: "paris", route_id: "riverside_route",
    location_id: "1", team_name: "Team B", contact: "b@b.com",
    answers: JSON.stringify({ found: false }), submitted_at: 200,
  },
];

function makeDb(submissions = SAMPLE_SUBMISSIONS) {
  return {
    prepare: (sql: string) => {
      const args: unknown[] = [];
      const stmt = {
        bind: (...values: unknown[]) => { args.push(...values); return stmt; },
        all: async () => {
          if (sql.includes("WHERE project_id = ? AND city_id = ?")) {
            const [project, city] = args;
            return {
              results: submissions.filter(
                (row) => row.project_id === project && row.city_id === city,
              ),
            };
          }
          return { results: [] };
        },
      };
      return stmt;
    },
  };
}

describe("GET /results/:project/:city/submissions", () => {
  it("returns 403 when not authenticated", async () => {
    const request = new Request("https://example.com/results/demo/paris/submissions");
    const response = await worker.fetch(
      request,
      { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env,
    );
    expect(response.status).toBe(403);
  });

  it("returns parsed submissions for the project+city, without contact", async () => {
    const request = new Request("https://example.com/results/demo/paris/submissions", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(
      request,
      { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env,
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.submissions).toHaveLength(2);
    expect(data.submissions[0]).toEqual({
      id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
      answers: { found: true }, submittedAt: 100,
    });
    expect(data.submissions[0].contact).toBeUndefined();
  });

  it("returns 403 when the token's project doesn't match the URL", async () => {
    const otherToken = await createToken({ ...TEST_PAYLOAD, project: "other" }, TEST_SECRET);
    const request = new Request("https://example.com/results/demo/paris/submissions", {
      headers: { Cookie: `freedom_hunt_auth=${otherToken}` },
    });
    const response = await worker.fetch(
      request,
      { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env,
    );
    expect(response.status).toBe(403);
  });
});
