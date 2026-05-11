# Task 12: Update Existing Component Tests

**Files:**
- Modify: `src/test/ChallengeForm.test.ts`
- Modify: `src/test/EditorLocationForm.test.ts`
- Modify: `src/test/EditorLocationList.test.ts`
- Modify: `src/test/EditorLoginPage.test.ts`
- No changes needed: `src/test/LoginPage.test.ts` (only tests render, never mocks fetch), `src/test/stores.test.ts` (only tests themeStore, fontSizeStore, titleBarStore, languageStore)

---

## `ChallengeForm.test.ts`

`ChallengeForm` no longer calls `fetch` directly — it calls `postFormSubmit` and `postPhotoUpload` from `api.ts`. Mock `api.ts` instead.

- [ ] **Step 1: Replace `ChallengeForm.test.ts`**

```typescript
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import ChallengeForm from "../components/ChallengeForm.svelte";
import { postFormSubmit, postPhotoUpload } from "../utils/api";

vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true }),
}));

const form = [
  { id: "found_it", type: "boolean" as const, label: "Did you find it?" },
  { id: "note", type: "string" as const, label: "Your note" },
];

beforeEach(() => {
  authStore.login("test_project", "Team A", "team@test.com");
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders form fields", () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  expect(screen.getByText("Did you find it?")).toBeInTheDocument();
  expect(screen.getByText("Your note")).toBeInTheDocument();
});

test("shows validation error when required field is empty", async () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText("Required")).toBeInTheDocument();
  expect(screen.queryByText(/submit your answers/i)).not.toBeInTheDocument();
});

test("shows confirmation dialog when all required fields are filled", async () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText(/submit your answers/i)).toBeInTheDocument();
});

test("calls postFormSubmit with correct payload on confirm", async () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(postFormSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      locationId: 1,
      routeId: "short_loop",
      teamName: "Team A",
      contact: "team@test.com",
    }),
  );
});

test("renders two ornamental dividers framing the field list", () => {
  const { container } = render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  expect(container.querySelectorAll(".cf-divider")).toHaveLength(2);
});

test("multiple field: blocks selection beyond max and shows warning", async () => {
  const multiForm = [
    {
      id: "flags",
      type: "multiple" as const,
      label: "Pick flags",
      min: 1,
      max: 2,
      options: ["Dutch", "EU", "American"],
    },
  ];
  render(ChallengeForm, { props: { form: multiForm, locationId: 1 } });
  await fireEvent.click(screen.getByLabelText("Dutch"));
  await fireEvent.click(screen.getByLabelText("EU"));
  await fireEvent.click(screen.getByLabelText("American"));
  expect(screen.getByText(/you can only select 2/i)).toBeInTheDocument();
  expect(
    (screen.getByLabelText("American") as HTMLInputElement).checked,
  ).toBe(false);
});

test("photo field uses label as button text", () => {
  const photoForm = [
    { id: "pic", type: "photo" as const, label: "Take a photo" },
  ];
  render(ChallengeForm, { props: { form: photoForm, locationId: 1 } });
  expect(
    screen.getByRole("button", { name: /take a photo/i }),
  ).toBeInTheDocument();
});
```

---

## `EditorLocationForm.test.ts`

`EditorLocationForm` now loads YAML via `loadText` and calls `fetchEditorLocation` / `saveEditorLocation` from api.ts. Mock both.

- [ ] **Step 2: Replace `EditorLocationForm.test.ts`**

```typescript
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte/svelte5";
import EditorLocationForm from "../pages/editor/EditorLocationForm.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue([
    { id: "identity", type: "string", label: "Id" },
    { id: "title", type: "string", label: "Title" },
    { id: "storyline", type: "textarea", label: "Storyline" },
  ]),
}));

vi.mock("../utils/api", () => ({
  fetchEditorLocation: vi.fn().mockResolvedValue({ ok: false }),
  saveEditorLocation: vi
    .fn()
    .mockResolvedValue({ ok: true, prUrl: "https://github.com/org/repo/pull/42" }),
}));

test("renders form in new-location mode", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  expect(
    await screen.findByRole("button", { name: /submit for review/i }),
  ).toBeInTheDocument();
});

test("renders identity section once YAML loads", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  expect(await screen.findByText(/^Id$/i)).toBeInTheDocument();
});

test("submits form and shows success state", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "A great place." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );
  await waitFor(() => {
    expect(
      screen.getByText(/changes submitted for review/i),
    ).toBeInTheDocument();
  });
});
```

---

## `EditorLocationList.test.ts`

`EditorLocationList` now calls `fetchEditorLocations` from api.ts. Mock api.ts instead of `globalThis.fetch`.

- [ ] **Step 3: Replace `EditorLocationList.test.ts`**

```typescript
import { render, screen } from "@testing-library/svelte/svelte5";
import EditorLocationList from "../pages/editor/EditorLocationList.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  fetchEditorLocations: vi.fn().mockResolvedValue({
    ok: true,
    locations: [
      {
        filename: "001_loc_binnenhof.yaml",
        sha: "abc123",
        location: {
          locationId: 1,
          title: "Binnenhof",
          address: "Binnenhof 1",
          coordinates: { latitude: 52.0799, longitude: 4.3133 },
          storyline: "",
          breadcrumb: "",
          name: { label: "", value: "Binnenhof" },
          challenge: { name: "", description: "", notes: "", form: [] },
        },
      },
    ],
  }),
  fetchPrStatuses: vi.fn().mockResolvedValue({ ok: true, statuses: {} }),
  saveEditorLocation: vi.fn().mockResolvedValue({ ok: true }),
}));

test("renders location list", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(await screen.findByText("Binnenhof")).toBeInTheDocument();
});

test("renders Add location button", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(
    await screen.findByRole("button", { name: /add location/i }),
  ).toBeInTheDocument();
});
```

---

## `EditorLoginPage.test.ts`

`EditorLoginPage` now calls `postLogin` from api.ts.

- [ ] **Step 4: Replace `EditorLoginPage.test.ts`**

```typescript
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte/svelte5";
import EditorLoginPage from "../pages/editor/EditorLoginPage.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  postLogin: vi.fn().mockResolvedValue({ ok: true, isAdmin: true }),
}));

test("renders password field", () => {
  render(EditorLoginPage);
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

test("navigates to /editor on successful admin login", async () => {
  const { push } = await import("svelte-spa-router");
  render(EditorLoginPage);
  await fireEvent.input(screen.getByLabelText(/password/i), {
    target: { value: "secret" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/editor"));
});
```

---

- [ ] **Step 5: Run all tests**

```
npm test
```

Expected: all tests pass, including previously-failing ones.

- [ ] **Step 6: Commit**

```
git add src/test/ChallengeForm.test.ts src/test/EditorLocationForm.test.ts src/test/EditorLocationList.test.ts src/test/EditorLoginPage.test.ts
git commit -m "test: update component tests to mock api.ts instead of globalThis.fetch"
```
