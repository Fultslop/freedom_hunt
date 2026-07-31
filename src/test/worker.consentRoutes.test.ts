import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleConsentRoutes } from "../worker/routes/consentRoutes";

vi.mock("../worker/auth", () => ({
  requireAuth: vi.fn(),
}));
vi.mock("../worker/db", () => ({
  upsertConsent: vi.fn(),
  getConsent: vi.fn(),
}));
vi.mock("../worker/consentVersion", () => ({
  getConsentVersion: vi.fn(),
}));

import { requireAuth } from "../worker/auth";
import { upsertConsent, getConsent } from "../worker/db";
import { getConsentVersion } from "../worker/consentVersion";

const env = { AUTH_DB: {}, AUTH_STORE: {} } as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /consent", () => {
  it("rejects unauthenticated requests", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null);
    const req = new Request("https://x/consent", { method: "POST", body: "{}" });
    const res = await handleConsentRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(401);
  });

  it("acknowledge:true stamps consentVersion from getConsentVersion, ignoring any client-sent value", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue(null);
    vi.mocked(getConsentVersion).mockResolvedValue(7);
    vi.mocked(upsertConsent).mockResolvedValue({} as any);
    const req = new Request("https://x/consent?city=den_haag&route=short_loop", {
      method: "POST",
      body: JSON.stringify({ allSixteenPlus: true, promoConsent: true, acknowledge: true, consentVersion: 999 }),
    });
    await handleConsentRoutes(req, new URL(req.url), env);
    expect(upsertConsent).toHaveBeenCalledWith(
      env.AUTH_DB,
      { projectId: "den_haag", teamName: "Team A", contact: "" },
      { allSixteenPlus: true, promoConsent: true, consentVersion: 7 },
    );
  });

  it("acknowledge:false (e.g. the withdrawal menu) preserves the existing record's consent_version instead of re-stamping it", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue({ consent_version: 3 } as any);
    vi.mocked(getConsentVersion).mockResolvedValue(7); // current KV value is newer — must NOT be used here
    vi.mocked(upsertConsent).mockResolvedValue({} as any);
    const req = new Request("https://x/consent", {
      method: "POST",
      body: JSON.stringify({ allSixteenPlus: true, promoConsent: false, acknowledge: false }),
    });
    await handleConsentRoutes(req, new URL(req.url), env);
    expect(upsertConsent).toHaveBeenCalledWith(
      env.AUTH_DB,
      { projectId: "den_haag", teamName: "Team A", contact: "" },
      { allSixteenPlus: true, promoConsent: false, consentVersion: 3 },
    );
    expect(getConsentVersion).not.toHaveBeenCalled();
  });

  it("acknowledge:false with no existing record falls back to the current version (defensive — shouldn't normally happen)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue(null);
    vi.mocked(getConsentVersion).mockResolvedValue(7);
    vi.mocked(upsertConsent).mockResolvedValue({} as any);
    const req = new Request("https://x/consent", {
      method: "POST",
      body: JSON.stringify({ allSixteenPlus: true, promoConsent: false, acknowledge: false }),
    });
    await handleConsentRoutes(req, new URL(req.url), env);
    expect(upsertConsent).toHaveBeenCalledWith(
      env.AUTH_DB,
      { projectId: "den_haag", teamName: "Team A", contact: "" },
      { allSixteenPlus: true, promoConsent: false, consentVersion: 7 },
    );
  });
});

describe("GET /consent", () => {
  it("returns the participant's current record", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue({ promo_consent: 1 } as any);
    const req = new Request("https://x/consent", { method: "GET" });
    const res = await handleConsentRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true, record: { promo_consent: 1 } });
  });

  it("returns record: null when nothing exists yet", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ project: "den_haag", teamName: "Team A", contact: "", isAdmin: false, exp: 0 });
    vi.mocked(getConsent).mockResolvedValue(null);
    const req = new Request("https://x/consent", { method: "GET" });
    const res = await handleConsentRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true, record: null });
  });
});

describe("GET /consent/version", () => {
  it("returns the current version for a project/city/route with no auth required", async () => {
    vi.mocked(getConsentVersion).mockResolvedValue(3);
    const req = new Request("https://x/consent/version?project=den_haag&city=den_haag&route=short_loop", { method: "GET" });
    const res = await handleConsentRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true, consentVersion: 3 });
    expect(requireAuth).not.toHaveBeenCalled();
  });
});
