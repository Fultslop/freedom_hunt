// @ts-nocheck
import { describe, it, expect } from "vitest";
import { insertFormSubmission, listFormSubmissions } from "../worker/db";

function makeDb() {
  const submissions: Record<string, unknown>[] = [];

  const prepare = (sql: string) => {
    const args: unknown[] = [];
    const stmt = {
      bind: (...values: unknown[]) => {
        args.push(...values);
        return stmt;
      },
      run: async () => {
        if (sql.startsWith("INSERT INTO form_submissions")) {
          submissions.push({
            id: args[0],
            project_id: args[1],
            city_id: args[2],
            route_id: args[3],
            location_id: args[4],
            team_name: args[5],
            contact: args[6],
            answers: args[7],
            submitted_at: args[8],
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      all: async () => {
        if (sql.includes("FROM form_submissions") && sql.includes("WHERE project_id")) {
          const [projectId, cityId] = args;
          const matched = submissions
            .filter((row) => row.project_id === projectId && row.city_id === cityId)
            .sort((rowA, rowB) => (rowA.submitted_at as number) - (rowB.submitted_at as number));
          return { results: matched };
        }
        return { results: [] };
      },
    };
    return stmt;
  };

  return { prepare };
}

describe("listFormSubmissions", () => {
  it("returns only submissions for the given project+city, ordered by submitted_at ASC", async () => {
    const db = makeDb();
    await insertFormSubmission(db, {
      id: "s2", project_id: "demo", city_id: "paris", route_id: "riverside_route",
      location_id: "1", team_name: "Team B", contact: null,
      answers: JSON.stringify({ found: true }), submitted_at: 200,
    });
    await insertFormSubmission(db, {
      id: "s1", project_id: "demo", city_id: "paris", route_id: "riverside_route",
      location_id: "1", team_name: "Team A", contact: null,
      answers: JSON.stringify({ found: true }), submitted_at: 100,
    });
    await insertFormSubmission(db, {
      id: "s3", project_id: "demo", city_id: "new_york", route_id: "manhattan_route",
      location_id: "1", team_name: "Team C", contact: null,
      answers: JSON.stringify({ found: true }), submitted_at: 50,
    });
    const result = await listFormSubmissions(db, "demo", "paris");
    expect(result.map((row) => row.id)).toEqual(["s1", "s2"]);
  });

  it("returns an empty array when no submissions match", async () => {
    const db = makeDb();
    const result = await listFormSubmissions(db, "demo", "oslo");
    expect(result).toEqual([]);
  });
});
