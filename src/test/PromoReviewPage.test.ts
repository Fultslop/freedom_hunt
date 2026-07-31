import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { vi } from "vitest";
import PromoReviewPage from "../pages/editor/PromoReviewPage.svelte";
import * as api from "../utils/api";

beforeEach(() => vi.clearAllMocks());

test("lists photos pending promo approval", async () => {
  vi.spyOn(api, "fetchPromoReviewPhotos").mockResolvedValue({
    ok: true,
    photos: [{ id: "p1", team_name: "Team A", contact: null, task_title: "Find the plaque" }],
  });
  render(PromoReviewPage, { params: { project: "den_haag", city: "den_haag" } });
  expect(await screen.findByText("Team A")).toBeInTheDocument();
});

test("approving removes the row and calls postPromoApprove with the photo's team identity", async () => {
  vi.spyOn(api, "fetchPromoReviewPhotos").mockResolvedValue({
    ok: true,
    photos: [{ id: "p1", team_name: "Team A", contact: null, task_title: "Find the plaque" }],
  });
  const approveSpy = vi.spyOn(api, "postPromoApprove").mockResolvedValue({ ok: true });
  render(PromoReviewPage, { params: { project: "den_haag", city: "den_haag" } });
  await fireEvent.click(await screen.findByRole("button", { name: /approve/i }));
  expect(approveSpy).toHaveBeenCalledWith("den_haag", "Team A", null);
  expect(screen.queryByText("Team A")).not.toBeInTheDocument();
});
