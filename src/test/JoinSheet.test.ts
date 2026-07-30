import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import JoinSheet from "../components/JoinSheet.svelte";
import * as api from "../utils/api";
import * as huntSummaryApi from "../utils/huntSummary";
import * as loadTextApi from "../utils/loadText";
import { authStore } from "../stores/authStore";

const MOCK_PROJECT_META: Record<string, string> = { "project.title": "Democrats Abroad" };

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  authStore.setForTest({ activeAuth: null, authLoading: false, isLoggingOut: false });
});

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onResolved: vi.fn(),
    onJoin: vi.fn(),
    onContinue: vi.fn(),
    onDemo: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("JoinSheet — empty state", () => {
  it("disables Find hunt until at least 3 characters are entered", async () => {
    render(JoinSheet, { props: baseProps() });
    const button = screen.getByRole("button", { name: /find hunt/i });
    expect(button).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "ab" } });
    expect(button).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "abc" } });
    expect(button).not.toBeDisabled();
  });

  it("calls onDemo when the demo button is tapped, without calling postVerifyCode", async () => {
    const onDemo = vi.fn();
    const spy = vi.spyOn(api, "postVerifyCode");
    render(JoinSheet, { props: baseProps({ onDemo }) });
    await fireEvent.click(screen.getByRole("button", { name: /try the demo/i }));
    expect(onDemo).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("JoinSheet — checking/invalid states", () => {
  it("shows a busy state on submit and calls postVerifyCode with the raw trimmed input", async () => {
    const spy = vi.spyOn(api, "postVerifyCode").mockImplementation(
      () => new Promise(() => {}),
    );
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: " letmein " } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    expect(spy).toHaveBeenCalledWith("letmein");
    expect(screen.getByRole("button", { name: /checking/i })).toBeInTheDocument();
  });

  it("shows an inline, accessible error and does not call onResolved when the code is invalid", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: false, error: "Invalid code" });
    const onResolved = vi.fn();
    render(JoinSheet, { props: baseProps({ onResolved }) });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "wrong" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() =>
      expect(screen.getByText("No hunt with that code. Check it with your organiser.")).toBeInTheDocument(),
    );
    const error = screen.getByText("No hunt with that code. Check it with your organiser.");
    expect(error).toHaveAttribute("aria-live", "polite");
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("calls onResolved with the project id on success", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    const onResolved = vi.fn();
    render(JoinSheet, { props: baseProps({ onResolved }) });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("democrats_abroad"));
  });

  it("auto-submits immediately when initialCode is set (deep link), without waiting for a form submit", () => {
    const spy = vi.spyOn(api, "postVerifyCode").mockImplementation(() => new Promise(() => {}));
    render(JoinSheet, { props: baseProps({ initialCode: "letmein" }) });
    expect(spy).toHaveBeenCalledWith("letmein");
  });
});

describe("JoinSheet — found state", () => {
  it("shows the found state with chips when the project resolves to a single city/route", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue({
      cityId: "den_haag", routeId: "short_loop", stopCount: 15, distanceMeters: 2400, durationMinutes: 120,
    });
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(screen.getByText("15 stops")).toBeInTheDocument());
    expect(screen.getByText("No account needed. You'll pick a team name next.")).toBeInTheDocument();
  });

  it("shows the project's display name (project.title), not the raw project id", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(screen.getByText("Democrats Abroad")).toBeInTheDocument());
    expect(screen.queryByText("democrats_abroad")).not.toBeInTheDocument();
  });

  it("shows the found state without chips when the project has more than one city/route", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() =>
      expect(
        screen.getByText("No account needed. You'll pick a team name, then a city and route, next."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/stops/)).not.toBeInTheDocument();
  });

  it("cold-loading with initialCode set lands directly in the found state, never flashing the empty form", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    render(JoinSheet, { props: baseProps({ initialCode: "letmein" }) });
    expect(screen.queryByRole("button", { name: /find hunt/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /join this hunt/i })).toBeInTheDocument());
  });

  it("calls onJoin (not onResolved again) when 'Join this hunt' is tapped", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    const onJoin = vi.fn();
    render(JoinSheet, { props: baseProps({ onJoin }) });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /join this hunt/i })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole("button", { name: /join this hunt/i }));
    expect(onJoin).toHaveBeenCalledWith("democrats_abroad");
  });

  it("stashes pendingHuntAuth with the resolved project and code when 'Join this hunt' is tapped", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /join this hunt/i })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole("button", { name: /join this hunt/i }));
    expect(JSON.parse(sessionStorage.getItem("pendingHuntAuth")!)).toEqual({
      project: "democrats_abroad",
      password: "letmein",
    });
  });

  it("saves the code to localStorage as soon as it resolves, before 'Join this hunt' is ever tapped", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(localStorage.getItem("lastHuntCode")).toBe("letmein"));
  });
});

describe("JoinSheet — already-authenticated participant", () => {
  it("offers 'Continue as [team]' instead of 'Join this hunt' when already signed into the resolved project", async () => {
    authStore.setForTest({
      activeAuth: { kind: "participant", projectId: "democrats_abroad", teamName: "Rowdy Herring", contact: null, isAdmin: false },
      authLoading: false,
      isLoggingOut: false,
    });
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue({
      cityId: "den_haag", routeId: "short_loop", stopCount: 15, distanceMeters: 2400, durationMinutes: 120,
    });
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue as rowdy herring/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /^join this hunt$/i })).not.toBeInTheDocument();
  });

  it("'Continue as [team]' navigates straight to the project page, skipping team setup", async () => {
    authStore.setForTest({
      activeAuth: { kind: "participant", projectId: "democrats_abroad", teamName: "Rowdy Herring", contact: null, isAdmin: false },
      authLoading: false,
      isLoggingOut: false,
    });
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue({
      cityId: "den_haag", routeId: "short_loop", stopCount: 15, distanceMeters: 2400, durationMinutes: 120,
    });
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    const onContinue = vi.fn();
    const onJoin = vi.fn();
    render(JoinSheet, { props: baseProps({ onContinue, onJoin }) });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => screen.getByRole("button", { name: /continue as rowdy herring/i }));
    await fireEvent.click(screen.getByRole("button", { name: /continue as rowdy herring/i }));
    expect(onContinue).toHaveBeenCalledWith("/democrats_abroad");
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("'Not you?' falls through to the normal new-team join flow", async () => {
    authStore.setForTest({
      activeAuth: { kind: "participant", projectId: "democrats_abroad", teamName: "Rowdy Herring", contact: null, isAdmin: false },
      authLoading: false,
      isLoggingOut: false,
    });
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    const onJoin = vi.fn();
    render(JoinSheet, { props: baseProps({ onJoin }) });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => screen.getByRole("button", { name: /not you/i }));
    await fireEvent.click(screen.getByRole("button", { name: /not you/i }));
    expect(onJoin).toHaveBeenCalledWith("democrats_abroad");
    expect(JSON.parse(sessionStorage.getItem("pendingHuntAuth")!)).toEqual({
      project: "democrats_abroad",
      password: "letmein",
    });
  });

  it("still shows 'Join this hunt' when signed into a different project", async () => {
    authStore.setForTest({
      activeAuth: { kind: "participant", projectId: "other_project", teamName: "Rowdy Herring", contact: null, isAdmin: false },
      authLoading: false,
      isLoggingOut: false,
    });
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue(MOCK_PROJECT_META);
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^join this hunt$/i })).toBeInTheDocument());
  });
});

describe("JoinSheet — hunt-code prefill", () => {
  it("prefills the code field from the last resolved code on mount", () => {
    localStorage.setItem("lastHuntCode", "letmein");
    render(JoinSheet, { props: baseProps() });
    expect(screen.getByLabelText("Hunt code")).toHaveValue("letmein");
  });

  it("prefers a deep-link initialCode over the stored last code", () => {
    localStorage.setItem("lastHuntCode", "oldcode");
    vi.spyOn(api, "postVerifyCode").mockImplementation(() => new Promise(() => {}));
    render(JoinSheet, { props: baseProps({ initialCode: "newcode" }) });
    expect(screen.getByLabelText("Hunt code")).toHaveValue("newcode");
  });

  it("enables native autocomplete on the field", () => {
    render(JoinSheet, { props: baseProps() });
    expect(screen.getByLabelText("Hunt code")).toHaveAttribute("autocomplete", "on");
  });
});
