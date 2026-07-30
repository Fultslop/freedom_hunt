import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import JoinSheet from "../components/JoinSheet.svelte";
import * as api from "../utils/api";
import * as huntSummaryApi from "../utils/huntSummary";
import * as loadTextApi from "../utils/loadText";

const MOCK_PROJECT_META: Record<string, string> = { "project.name": "Democrats Abroad" };

afterEach(() => vi.restoreAllMocks());

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onResolved: vi.fn(),
    onJoin: vi.fn(),
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
});
