import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleEditorRoutes } from "../worker/routes/editorRoutes";

vi.mock("../worker/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("../worker/db", () => ({
  getUserCaps: vi.fn(),
  listPromoReviewPhotos: vi.fn(),
  setPromoApproved: vi.fn(),
}));

import { requireAuth } from "../worker/auth";
import { getUserCaps, listPromoReviewPhotos, setPromoApproved } from "../worker/db";

const env = { AUTH_DB: {} } as any;

beforeEach(() => vi.clearAllMocks());

describe("GET /promo-review", () => {
  it("requires organizer capability", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user_id: "u1", exp: 0 });
    vi.mocked(getUserCaps).mockResolvedValue([{ project_id: "den_haag", capability: "editor" } as any]);
    const req = new Request("https://x/promo-review?project=den_haag&city=den_haag", { method: "GET" });
    const res = await handleEditorRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(403);
  });

  it("lists photos for an organizer", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user_id: "u1", exp: 0 });
    vi.mocked(getUserCaps).mockResolvedValue([{ project_id: "den_haag", capability: "organizer" } as any]);
    vi.mocked(listPromoReviewPhotos).mockResolvedValue([{ id: "p1" } as any]);
    const req = new Request("https://x/promo-review?project=den_haag&city=den_haag", { method: "GET" });
    const res = await handleEditorRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true, photos: [{ id: "p1" }] });
  });
});

describe("POST /promo-approve", () => {
  it("approves the team's consent record", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user_id: "u1", exp: 0 });
    vi.mocked(getUserCaps).mockResolvedValue([{ project_id: "den_haag", capability: "organizer" } as any]);
    vi.mocked(setPromoApproved).mockResolvedValue(true);
    const req = new Request("https://x/promo-approve", {
      method: "POST",
      body: JSON.stringify({ project: "den_haag", teamName: "Team A", contact: "" }),
    });
    const res = await handleEditorRoutes(req, new URL(req.url), env);
    const body = await res?.json();
    expect(body).toEqual({ ok: true });
    expect(setPromoApproved).toHaveBeenCalledWith(env.AUTH_DB, "den_haag", "Team A", "");
  });
});
