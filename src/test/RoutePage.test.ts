import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { titleBarStore } from "../stores/titleBarStore";
import { themeStore } from "../stores/themeStore";
import RoutePage from "../pages/RoutePage.svelte";

const { mockLocations, huntSettingsFixture } = vi.hoisted(() => ({
  mockLocations: [
    {
      locationId: 1,
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: {
        name: "Challenge 1",
        description: "Desc 1",
        form: [{ id: "note", type: "string" as const, label: "Your note", isRequired: true }],
      },
    },
    {
      locationId: 2,
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
    },
  ],
  huntSettingsFixture: {} as Record<string, unknown>,
}));

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockImplementation(async (_lang: string, path: string) => {
    if (path.endsWith("routes")) {
      return {
        short_loop: { description: "2.5h route", locations: ["001", "002"] },
        long_loop: {
          description: "4h route",
          locations: ["001", "002", "003"],
        },
      };
    }
    if (path === "projects/democrats_abroad/democrats_abroad") {
      return huntSettingsFixture;
    }
    if (path.includes("/001")) {
      return mockLocations[0];
    }
    if (path.includes("/002")) {
      return mockLocations[1];
    }
    return null;
  }),
}));

vi.mock("../utils/loadLocations", () => ({
  loadLocations: vi.fn().mockResolvedValue(mockLocations),
}));

vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true, httpCode: 200 }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
  themeStore.setThemeName("wireframe");
});

afterEach(() => {
  delete huntSettingsFixture["project.form_required"];
  delete huntSettingsFixture["project.can_forms_skip"];
  themeStore.setThemeName("app");
});

test("renders challenge card", async () => {
  render(RoutePage, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        route: "short_loop",
      },
    },
  });
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
});

test("Next stays enabled and un-styled when form_required is not set", async () => {
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => {
    expect(nextBtn).not.toHaveClass("route-page__next-btn--pending");
  });
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("blocks Next and shows a toast listing missing fields when form_required and the form is incomplete", async () => {
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => {
    expect(nextBtn).toHaveClass("route-page__next-btn--pending");
  });
  await fireEvent.click(nextBtn);
  expect(await screen.findByText(/please complete: your note/i)).toBeInTheDocument();
  expect(screen.getByText("Location 1")).toBeInTheDocument();
});

test("allows Next once the required form has been submitted", async () => {
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).not.toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("shows a Skip button in the toast when can_forms_skip is true, and skipping advances", async () => {
  huntSettingsFixture["project.form_required"] = true;
  huntSettingsFixture["project.can_forms_skip"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  await fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("does not show a Skip button in the toast when can_forms_skip is false", async () => {
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  await screen.findByText(/please complete/i);
  expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
});

test("blocked Next can be clicked repeatedly in carousel swipe mode without getting stuck", async () => {
  // Regression test: the "app"/"GWC" themes use carousel/peek swipe mode, not snap.
  // A blocked Next-button click used to set isAnimating=true with dragOffset
  // already 0, which never fires a real CSS transition, so isAnimating never
  // reset and every subsequent handleDragEnd call (including later clicks) was
  // silently dropped.
  huntSettingsFixture["project.form_required"] = true;
  themeStore.setThemeName("app");
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));

  await fireEvent.click(nextBtn);
  expect(await screen.findByText(/please/i)).toBeInTheDocument();
  await fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
  await waitFor(() => expect(screen.queryByText(/please/i)).not.toBeInTheDocument());

  await fireEvent.click(nextBtn);
  expect(await screen.findByText(/please/i)).toBeInTheDocument();
});

test("shows a generic message when form_required is blocking but no individual field is marked required", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce([
    {
      ...mockLocations[0],
      challenge: {
        name: "Challenge 1",
        description: "Desc 1",
        form: [{ id: "note", type: "string" as const, label: "Your note" }],
      },
    },
    mockLocations[1],
  ]);
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Please submit the form to continue.")).toBeInTheDocument();
});

test("renders a submitted badge on a location after its form is submitted", async () => {
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(await screen.findByTestId("badge-status-submitted")).toBeInTheDocument();
});
