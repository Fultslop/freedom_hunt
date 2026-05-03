# Task 3: Rewrite ChallengeCard tests (failing)

**Part of:** [ChallengeCard Redesign](2026-04-29-challenge-card-redesign.md)
**Depends on:** [Task 2 — Add image field to Binnenhof YAML](2026-04-29-challenge-card-02-image-field.md)
**Next:** [Task 4 — Implement redesigned ChallengeCard](2026-04-29-challenge-card-04-implement.md)

**Files:**

- Modify: `src/test/ChallengeCard.test.jsx`

`react-leaflet` and `leaflet` must be mocked — Leaflet manipulates the DOM in ways JSDOM cannot handle. The hero image is never loaded in tests (the async dynamic import fails silently in JSDOM), so all tests run against the no-hero path.

---

- [ ] **Step 1: Replace the entire test file**

```jsx
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "../theme/ThemeContext";
import ChallengeCard from "../components/ChallengeCard";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
}));

vi.mock("leaflet", () => ({
  default: { divIcon: () => ({}) },
}));

const location = {
  locationId: 1,
  title: "The Final Civic Act",
  name: { value: "Binnenhof / Het Plein" },
  address: "Binnenhof 1",
  storyline: "The Binnenhof is the oldest seat of parliament.",
  coordinates: { latitude: 52.0799, longitude: 4.3133 },
  challenge: { description: "Register to vote." },
  breadcrumb: "Find the inner courtyard.",
};

function Wrapper({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

test("renders locationId badge", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("1")).toBeInTheDocument();
});

test("renders title", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("The Final Civic Act")).toBeInTheDocument();
});

test("renders name.value when present", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("Binnenhof / Het Plein")).toBeInTheDocument();
});

test("omits name when value is empty", () => {
  const loc = { ...location, name: { value: "" } };
  render(
    <Wrapper>
      <ChallengeCard location={loc} />
    </Wrapper>,
  );
  expect(screen.queryByText("Binnenhof / Het Plein")).not.toBeInTheDocument();
});

test("renders address when present", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("Binnenhof 1")).toBeInTheDocument();
});

test("omits address when empty", () => {
  const loc = { ...location, address: "" };
  render(
    <Wrapper>
      <ChallengeCard location={loc} />
    </Wrapper>,
  );
  expect(screen.queryByText("Binnenhof 1")).not.toBeInTheDocument();
});

test("renders storyline", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(
    screen.getByText("The Binnenhof is the oldest seat of parliament."),
  ).toBeInTheDocument();
});

test("renders map", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByTestId("map")).toBeInTheDocument();
});

test("renders challenge description", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("Register to vote.")).toBeInTheDocument();
});

test("renders breadcrumb", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("Find the inner courtyard.")).toBeInTheDocument();
});

test("does not render hero image when image field absent", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests — expect failures**

```bash
npm run test:run
```

Expected: tests for `locationId`, `name.value`, `address`, `map`, and `hero absent` will fail because the component has not been updated yet. `title`, `storyline`, `breadcrumb`, and `challenge description` tests may pass.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/test/ChallengeCard.test.jsx
git commit -m "test: rewrite ChallengeCard tests for new layout (failing)"
```
