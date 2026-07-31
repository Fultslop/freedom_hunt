// @ts-nocheck
import { describe, it, expect } from "vitest";
import { upsertConsent, getConsent, setPromoApproved, listPromoReviewPhotos } from "../worker/db";

function makeDb() {
  const rows: Record<string, unknown>[] = [];
  const photos: Record<string, unknown>[] = [];

  function findConsent(projectId: string, teamName: string, contact: string) {
    return rows.find(
      (r) => r.project_id === projectId && r.team_name === teamName && r.contact === contact,
    );
  }

  const prepare = (sql: string) => {
    const args: unknown[] = [];
    const stmt = {
      bind: (...values: unknown[]) => { args.push(...values); return stmt; },
      run: async () => {
        if (sql.startsWith("INSERT INTO consent_records")) {
          const [id, project_id, team_name, contact, all_sixteen_plus, promo_consent, consent_version, acknowledged_at, updated_at] = args;
          const existing = findConsent(project_id as string, team_name as string, contact as string);
          if (existing) {
            existing.all_sixteen_plus = all_sixteen_plus;
            existing.promo_consent = promo_consent;
            existing.consent_version = consent_version;
            existing.updated_at = updated_at;
          } else {
            rows.push({ id, project_id, team_name, contact, all_sixteen_plus, promo_consent, promo_approved: 0, consent_version, acknowledged_at, updated_at });
          }
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE consent_records SET promo_approved")) {
          const [updated_at, project_id, team_name, contact] = args;
          const existing = findConsent(project_id as string, team_name as string, contact as string);
          if (existing) { existing.promo_approved = 1; existing.updated_at = updated_at; }
          return { meta: { changes: existing ? 1 : 0 } };
        }
        return { meta: { changes: 0 } };
      },
      first: async () => {
        if (sql.startsWith("SELECT * FROM consent_records")) {
          const [project_id, team_name, contact] = args;
          return findConsent(project_id as string, team_name as string, contact as string) ?? null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes("FROM photos")) {
          const [project_id, city_id] = args;
          const matched = photos.filter((p) => {
            const consent = findConsent(project_id as string, p.team_name as string, (p.contact as string) ?? "");
            return (
              p.project_id === project_id &&
              p.city_id === city_id &&
              consent?.promo_consent === 1 &&
              consent?.promo_approved === 0
            );
          });
          return { results: matched };
        }
        return { results: [] };
      },
    };
    return stmt;
  };

  return { prepare, _photos: photos };
}

describe("upsertConsent", () => {
  it("inserts a new row on first consent", async () => {
    const db = makeDb();
    const record = await upsertConsent(db, { projectId: "den_haag", teamName: "Team A", contact: "" }, {
      allSixteenPlus: true, promoConsent: true, consentVersion: 1,
    });
    expect(record.all_sixteen_plus).toBe(1);
    expect(record.promo_consent).toBe(1);
  });

  it("updates the same row on a second call with the same identity key, never duplicating", async () => {
    const db = makeDb();
    await upsertConsent(db, { projectId: "den_haag", teamName: "Team A", contact: "" }, {
      allSixteenPlus: true, promoConsent: false, consentVersion: 1,
    });
    await upsertConsent(db, { projectId: "den_haag", teamName: "Team A", contact: "" }, {
      allSixteenPlus: true, promoConsent: true, consentVersion: 2,
    });
    const record = await getConsent(db, "den_haag", "Team A", "");
    expect(record?.promo_consent).toBe(1);
    expect(record?.consent_version).toBe(2);
  });

  it("forces promo_consent to 0 when all_sixteen_plus is false, regardless of what was requested", async () => {
    const db = makeDb();
    const record = await upsertConsent(db, { projectId: "den_haag", teamName: "Team B", contact: "" }, {
      allSixteenPlus: false, promoConsent: true, consentVersion: 1,
    });
    expect(record.promo_consent).toBe(0);
  });

  it("distinguishes two individual accounts sharing a team_name by contact", async () => {
    const db = makeDb();
    await upsertConsent(db, { projectId: "demo", teamName: "Squad", contact: "a@x.com" }, {
      allSixteenPlus: true, promoConsent: true, consentVersion: 1,
    });
    await upsertConsent(db, { projectId: "demo", teamName: "Squad", contact: "b@x.com" }, {
      allSixteenPlus: false, promoConsent: false, consentVersion: 1,
    });
    const a = await getConsent(db, "demo", "Squad", "a@x.com");
    const b = await getConsent(db, "demo", "Squad", "b@x.com");
    expect(a?.all_sixteen_plus).toBe(1);
    expect(b?.all_sixteen_plus).toBe(0);
  });
});

describe("setPromoApproved / listPromoReviewPhotos", () => {
  it("lists photos only for teams with promo_consent granted and not yet approved", async () => {
    const db = makeDb();
    await upsertConsent(db, { projectId: "den_haag", teamName: "Team A", contact: "" }, {
      allSixteenPlus: true, promoConsent: true, consentVersion: 1,
    });
    db._photos.push({ id: "p1", project_id: "den_haag", city_id: "den_haag", team_name: "Team A", contact: null });
    const before = await listPromoReviewPhotos(db, "den_haag", "den_haag");
    expect(before.map((p) => p.id)).toEqual(["p1"]);

    const approved = await setPromoApproved(db, "den_haag", "Team A", "");
    expect(approved).toBe(true);
    const after = await listPromoReviewPhotos(db, "den_haag", "den_haag");
    expect(after).toEqual([]);
  });

  it("returns false when no matching consent record exists to approve", async () => {
    const db = makeDb();
    const approved = await setPromoApproved(db, "den_haag", "Nonexistent", "");
    expect(approved).toBe(false);
  });
});
