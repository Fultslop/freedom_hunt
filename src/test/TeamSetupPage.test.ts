import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { push } from "svelte-spa-router";
import TeamSetupPage from "../pages/TeamSetupPage.svelte";
import * as huntSummaryApi from "../utils/huntSummary";
import * as loadTextApi from "../utils/loadText";
import * as api from "../utils/api";

vi.mock("svelte-spa-router", () => ({ push: vi.fn() }));
vi.mock("../stores/titleBarStore", () => ({
  titleBarStore: { set: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

function stubProject(summary: huntSummaryApi.HuntSummary | null = null) {
  vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(summary);
  vi.spyOn(loadTextApi, "loadText").mockResolvedValue({ "project.title": "Democrats Abroad" } as Record<
    string,
    string
  >);
}

describe("TeamSetupPage", () => {
  it("renders the DepthWordmark with the resolved project name and the approved copy", async () => {
    stubProject();
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => expect(screen.getByText("Democrats Abroad")).toBeInTheDocument());
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Name your team")).toBeInTheDocument();
    expect(screen.getByText("It shows on the leaderboard and on every photo you take.")).toBeInTheDocument();
  });

  it("renders a prefilled team name field with a reroll dice button, never empty", async () => {
    stubProject();
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => {
      const input = screen.getByLabelText("Team name") as HTMLInputElement;
      expect(input.value.length).toBeGreaterThan(0);
    });
    expect(screen.getByRole("button", { name: /suggest another name/i })).toBeInTheDocument();
  });

  it("rerolling changes the team name", async () => {
    stubProject();
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => screen.getByLabelText("Team name"));
    const input = screen.getByLabelText("Team name") as HTMLInputElement;
    const before = input.value;
    // Rerolling from a pool of 1,024 combos should essentially never repeat.
    await fireEvent.click(screen.getByRole("button", { name: /suggest another name/i }));
    expect(input.value).not.toBe(before);
  });

  it("prefills from a previously stored team name instead of a fresh random one", async () => {
    localStorage.setItem("teamName:democrats_abroad", "The Lost Socks");
    stubProject();
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => {
      expect((screen.getByLabelText("Team name") as HTMLInputElement).value).toBe("The Lost Socks");
    });
  });

  it("the submit button says 'Continue'", async () => {
    stubProject();
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument());
  });

  it("calls postLogin with the stashed code as password on Continue", async () => {
    sessionStorage.setItem(
      "pendingHuntAuth",
      JSON.stringify({ project: "democrats_abroad", password: "letmein" }),
    );
    stubProject();
    const loginSpy = vi
      .spyOn(api, "postLogin")
      .mockResolvedValue({ ok: true, teamName: "Rowdy Herring", isAdmin: false });
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => screen.getByRole("button", { name: "Continue" }));
    await fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(loginSpy).toHaveBeenCalledWith(
        expect.objectContaining({ project: "democrats_abroad", password: "letmein" }),
      ),
    );
  });

  it("navigates to the project page after a successful login, even when a single city/route is known", async () => {
    sessionStorage.setItem(
      "pendingHuntAuth",
      JSON.stringify({ project: "democrats_abroad", password: "letmein" }),
    );
    stubProject({
      cityId: "den_haag",
      routeId: "short_loop",
      stopCount: 2,
      distanceMeters: null,
      durationMinutes: 24,
    });
    vi.spyOn(api, "postLogin").mockResolvedValue({ ok: true, teamName: "Rowdy Herring", isAdmin: false });
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => screen.getByRole("button", { name: "Continue" }));
    await fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/democrats_abroad"));
  });

  it("navigates to the project's city picker when more than one city/route exists", async () => {
    sessionStorage.setItem(
      "pendingHuntAuth",
      JSON.stringify({ project: "democrats_abroad", password: "letmein" }),
    );
    stubProject(null);
    vi.spyOn(api, "postLogin").mockResolvedValue({ ok: true, teamName: "Rowdy Herring", isAdmin: false });
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => screen.getByRole("button", { name: "Continue" }));
    await fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/democrats_abroad"));
  });

  it("surfaces the returned error on a failed login without navigating", async () => {
    sessionStorage.setItem(
      "pendingHuntAuth",
      JSON.stringify({ project: "democrats_abroad", password: "wrong" }),
    );
    stubProject();
    vi.spyOn(api, "postLogin").mockResolvedValue({ ok: false, error: "Incorrect password" });
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => screen.getByRole("button", { name: "Continue" }));
    await fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText("Incorrect password")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalledWith(expect.stringMatching(/^\/democrats_abroad/));
  });

  it("returns to /start instead of logging in when the stashed code is missing", async () => {
    stubProject();
    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await waitFor(() => screen.getByRole("button", { name: "Continue" }));
    await fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/start"));
  });
});
