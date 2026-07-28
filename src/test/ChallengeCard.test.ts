import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import ChallengeCard from "../components/ChallengeCard.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));

vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true, httpCode: 200 }),
}));

const location = {
  title: "The Binnenhof",
  image: "binnenhof.jpg",
  name: { label: "", value: "Binnenhof" },
  address: "Binnenhof 1",
  coordinates: { latitude: 52.0799, longitude: 4.3133 },
  storyline: "A historic place.",
  breadcrumb: "Look for the gate.",
  challenge: {
    name: "",
    description: "Find the plaque.",
    notes: "",
    form: [{ id: "found_it", type: "boolean" as const, label: "Found it?" }],
  },
};

beforeEach(() => {
  localStorage.clear();
  authStore.loginParticipant("test_project", "Team A", "team@test.com");
});

test("renders location title", () => {
  render(ChallengeCard, { props: { location } });
  expect(screen.getByText("The Binnenhof")).toBeInTheDocument();
});

test("renders location badge with index", () => {
  render(ChallengeCard, { props: { location, index: 3 } });
  expect(screen.getByTestId("location-badge")).toHaveTextContent("3");
});

test("renders challenge form when form fields present", () => {
  render(ChallengeCard, { props: { location } });
  expect(screen.getByText("Found it?")).toBeInTheDocument();
});

test("hides breadcrumb when isLast=true", () => {
  render(ChallengeCard, { props: { location, isLast: true } });
  expect(screen.queryByText("Look for the gate.")).not.toBeInTheDocument();
});

test("renders storyline hook markup through Storyline blocks", () => {
  const withHook = {
    ...location,
    storyline: "## A ==historic== place.",
  };
  render(ChallengeCard, { props: { location: withHook } });
  expect(document.querySelector(".story-hook mark")).toHaveTextContent("historic");
});

// ---------------------------------------------------------------------------
// Badge status overlay
// ---------------------------------------------------------------------------

test("renders a submitted checkmark overlay on the badge", () => {
  render(ChallengeCard, { props: { location, index: 1, badgeStatus: "submitted" } });
  expect(screen.getByTestId("badge-status-submitted")).toBeInTheDocument();
});

test("renders a skipped dash overlay on the badge", () => {
  render(ChallengeCard, { props: { location, index: 1, badgeStatus: "skipped" } });
  expect(screen.getByTestId("badge-status-skipped")).toBeInTheDocument();
});

test("renders no status overlay when badgeStatus is unset", () => {
  render(ChallengeCard, { props: { location, index: 1 } });
  expect(screen.queryByTestId("badge-status-submitted")).not.toBeInTheDocument();
  expect(screen.queryByTestId("badge-status-skipped")).not.toBeInTheDocument();
});

test("forwards form status changes tagged with the location's index", async () => {
  const onFormStatusChange = vi.fn();
  render(ChallengeCard, {
    props: { location, index: 3, onFormStatusChange },
  });
  await waitFor(() => {
    expect(onFormStatusChange).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ submitted: false }),
    );
  });
});

test("challenge card sections are capped at --content-max width", () => {
  const css = readFileSync(
    join(__dirname, "../components/ChallengeCard.css"),
    "utf-8",
  );
  const sectionRule = css.match(/\.cc-section\s*\{[^}]*\}/)?.[0] ?? "";
  expect(sectionRule).toMatch(/max-width:\s*var\(--content-max\)/);
});

test("remounts the challenge form and resets submitted state when the location index changes", async () => {
  const { rerender } = render(ChallengeCard, {
    props: { location, index: 1, allowResubmit: false },
  });
  await fireEvent.click(screen.getByLabelText("Found it?"));
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(await screen.findByText("Submitted! ✓")).toBeInTheDocument();
  await rerender({ index: 2 });
  expect(screen.queryByText("Submitted! ✓")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Found it?")).toBeInTheDocument();
});
