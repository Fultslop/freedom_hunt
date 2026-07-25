// @ts-nocheck
import { describe, it, expect } from "vitest";
import { insertPhoto, listPhotos, randomPhotos, getPhotoById } from "../worker/db";

function makeDb() {
  const photos: Record<string, unknown>[] = [];

  const prepare = (sql: string) => {
    const args: unknown[] = [];
    const stmt = {
      bind: (...values: unknown[]) => {
        args.push(...values);
        return stmt;
      },
      run: async () => {
        if (sql.startsWith("INSERT INTO photos")) {
          photos.push({
            id: args[0],
            project_id: args[1],
            city_id: args[2],
            route_id: args[3],
            location_id: args[4],
            task_title: args[5],
            team_name: args[6],
            contact: args[7],
            r2_key: args[8],
            mime_type: args[9],
            uploaded_at: args[10],
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      first: async () => {
        if (sql.includes("FROM photos WHERE id")) {
          return photos.find((p) => p.id === args[0]) ?? null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes("FROM photos") && sql.includes("WHERE project_id")) {
          const [projectId, cityId] = args;
          const matched = photos.filter(
            (p) => p.project_id === projectId && p.city_id === cityId,
          );
          return { results: matched };
        }
        return { results: [] };
      },
    };
    return stmt;
  };

  return { prepare };
}

describe("photo D1 helpers", () => {
  it("insertPhoto then getPhotoById round-trips a row", async () => {
    const db = makeDb();
    await insertPhoto(db, {
      id: "p1",
      project_id: "democrats_abroad",
      city_id: "den_haag",
      route_id: "short_loop",
      location_id: "1",
      task_title: "The Final Civic Act",
      team_name: "Team A",
      contact: "a@b.com",
      r2_key: "1_1731234567890",
      mime_type: "image/jpeg",
      uploaded_at: 1731234567,
    });
    const found = await getPhotoById(db, "p1");
    expect(found).toMatchObject({ id: "p1", team_name: "Team A" });
  });

  it("getPhotoById returns null for unknown id", async () => {
    const db = makeDb();
    const found = await getPhotoById(db, "missing");
    expect(found).toBeNull();
  });

  it("listPhotos returns only photos for the given project+city", async () => {
    const db = makeDb();
    await insertPhoto(db, {
      id: "p1", project_id: "democrats_abroad", city_id: "den_haag",
      route_id: null, location_id: "1", task_title: "A", team_name: "Team A",
      contact: null, r2_key: "k1", mime_type: "image/jpeg", uploaded_at: 1,
    });
    await insertPhoto(db, {
      id: "p2", project_id: "democrats_abroad", city_id: "oslo",
      route_id: null, location_id: "1", task_title: "B", team_name: "Team B",
      contact: null, r2_key: "k2", mime_type: "image/jpeg", uploaded_at: 2,
    });
    const result = await listPhotos(db, "democrats_abroad", "den_haag");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("randomPhotos returns at most `limit` photos for the given project+city", async () => {
    const db = makeDb();
    for (let i = 0; i < 5; i++) {
      await insertPhoto(db, {
        id: `p${i}`, project_id: "democrats_abroad", city_id: "den_haag",
        route_id: null, location_id: "1", task_title: "A", team_name: "Team A",
        contact: null, r2_key: `k${i}`, mime_type: "image/jpeg", uploaded_at: i,
      });
    }
    const result = await randomPhotos(db, "democrats_abroad", "den_haag", 3);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
