import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { vi, beforeEach } from "vitest";
import ConsentScreen from "../components/ConsentScreen.svelte";
import * as api from "../utils/api";

const entry = {
  "template-type": "consent" as const,
  heading: "Before you begin",
  intro: "A few things to know.",
  chips: [
    { icon: "Route", text: "2.4 km" },
    { icon: "Clock", text: "~2 hours" },
  ],
  safety: { heading: "Stay safe", items: [{ icon: "Phone", text: "Call 112." }] },
  photos: { heading: "About your photos", items: [{ icon: "Eye", text: "Others can see your photos." }] },
  fields: [
    { id: "all_sixteen_plus", type: "radio" as const, variant: "segmented" as const, label: "16+?", options: ["Yes", "No"] },
    {
      id: "promo_consent", type: "boolean" as const, label: "Promo consent",
      isVisible: { initially: "conditional" as const, condition: { source: "all_sixteen_plus", operator: "=" as const, value: "Yes" } },
    },
    {
      id: "declined_note", type: "note" as const, label: "Declined note",
      isVisible: { initially: "conditional" as const, condition: { source: "all_sixteen_plus", operator: "=" as const, value: "No" } },
    },
  ],
  primaryButtonText: "I understand — start the hunt",
};

beforeEach(() => vi.clearAllMocks());

test("renders heading, chips, and bullet sections", () => {
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  expect(screen.getByText("Before you begin")).toBeInTheDocument();
  expect(screen.getByText("2.4 km")).toBeInTheDocument();
  expect(screen.getByText("Call 112.")).toBeInTheDocument();
});

test("the primary button is enabled before anything is answered", () => {
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  const button = screen.getByRole("button", { name: entry.primaryButtonText }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
});

test("submitting without answering anything still calls onContinue", async () => {
  vi.spyOn(api, "postConsentUpdate").mockResolvedValue({ ok: true, record: null });
  const onContinue = vi.fn();
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue });
  await fireEvent.click(screen.getByRole("button", { name: entry.primaryButtonText }));
  expect(api.postConsentUpdate).toHaveBeenCalledWith("den_haag", "short_loop", { allSixteenPlus: false, promoConsent: false, acknowledge: true });
  expect(onContinue).toHaveBeenCalled();
});

test("renders markdown emphasis in bullet/chip text instead of literal asterisks", () => {
  const entryWithMarkdown = {
    ...entry,
    safety: { heading: "Stay safe", items: [{ icon: "Phone", text: "In an emergency, call **112**." }] },
  };
  const { container } = render(ConsentScreen, { entry: entryWithMarkdown, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  expect(screen.queryByText(/\*\*112\*\*/)).not.toBeInTheDocument();
  expect(container.querySelector(".consent-screen__bullet-text strong")).not.toBeNull();
  expect(container.querySelector(".consent-screen__bullet-text strong")?.textContent).toBe("112");
});

test("renders a bullet's and a chip's icon as an actual icon, not the raw icon name as text", () => {
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  expect(screen.queryByText("Phone")).not.toBeInTheDocument();
  expect(screen.queryByText("Eye")).not.toBeInTheDocument();
  expect(screen.queryByText("Route")).not.toBeInTheDocument();
});

test("the promo-consent field and the declined-note field expose a data-field-key hook for the consent card CSS", () => {
  const { container } = render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  expect(container.querySelector('[data-field-key="promo_consent"]')).not.toBeNull();
  expect(container.querySelector('[data-field-key="declined_note"]')).not.toBeNull();
});

test("renders the privacy link with the spec copy when a privacyLinkUrl is set", () => {
  render(ConsentScreen, {
    entry: { ...entry, privacyLinkUrl: "https://example.org/privacy" },
    project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {},
  });
  const link = screen.getByText("Read the full privacy notice") as HTMLAnchorElement;
  expect(link.getAttribute("href")).toBe("https://example.org/privacy");
});

test("interpolates {{age_threshold}} in a field's label using the ageThreshold prop", () => {
  const entryWithAgeField = {
    ...entry,
    fields: [
      { id: "all_sixteen_plus", type: "radio" as const, variant: "segmented" as const, label: "Is everyone in your team {{age_threshold}} or over?", options: ["Yes", "No"] },
    ],
  };
  render(ConsentScreen, { entry: entryWithAgeField, project: "den_haag", city: "den_haag", route: "short_loop", ageThreshold: 15, onContinue: () => {} });
  expect(screen.getByText("Is everyone in your team 15 or over?")).toBeInTheDocument();
});

test("submitting posts consent and calls onContinue", async () => {
  vi.spyOn(api, "postConsentUpdate").mockResolvedValue({
    ok: true,
    record: { all_sixteen_plus: 1, promo_consent: 0, promo_approved: 0, consent_version: 1 },
  });
  const onContinue = vi.fn();
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue });
  await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
  await fireEvent.click(screen.getByRole("button", { name: entry.primaryButtonText }));
  expect(api.postConsentUpdate).toHaveBeenCalledWith("den_haag", "short_loop", { allSixteenPlus: true, promoConsent: false, acknowledge: true });
  expect(onContinue).toHaveBeenCalled();
});

test("a failed consent post still calls onContinue (never blocks navigation)", async () => {
  vi.spyOn(api, "postConsentUpdate").mockRejectedValue(new Error("network"));
  const onContinue = vi.fn();
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue });
  await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
  await fireEvent.click(screen.getByRole("button", { name: entry.primaryButtonText }));
  expect(onContinue).toHaveBeenCalled();
});
