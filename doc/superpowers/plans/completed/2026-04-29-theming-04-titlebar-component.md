# Task 4: TitleBar component

State: Completed

**Part of:** [Theming & Title Bar](2026-04-29-theming-titlebar.md)  
**Depends on:** [Task 3 — TitleBarContext](2026-04-29-theming-03-titlebar-context.md)  
**Next:** [Task 5 — App wiring](2026-04-29-theming-05-app-wiring.md)

**Files:**

- Create: `src/components/TitleBar.jsx`
- Create: `src/test/TitleBar.test.jsx`

The bar has three zones: left (back button if `backPath` set), center-left (title), right (☰ style menu). A progress bar row renders below only when `progress` is non-null.

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/TitleBar.test.jsx`:

```jsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeContext";
import { TitleBarProvider, useTitleBar } from "../theme/TitleBarContext";
import TitleBar from "../components/TitleBar";

function Wrapper({ children }) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <TitleBarProvider>{children}</TitleBarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function Setup({ config }) {
  useTitleBar(config);
  return <TitleBar />;
}

test("renders title", () => {
  render(
    <Wrapper>
      <Setup
        config={{ title: "Peace Palace", progress: null, backPath: null }}
      />
    </Wrapper>,
  );
  expect(screen.getByText("Peace Palace")).toBeInTheDocument();
});

test("renders back button when backPath is set", () => {
  render(
    <Wrapper>
      <Setup config={{ title: "Test", progress: null, backPath: "/foo" }} />
    </Wrapper>,
  );
  expect(screen.getByLabelText("Back")).toBeInTheDocument();
});

test("hides back button when backPath is null", () => {
  render(
    <Wrapper>
      <Setup config={{ title: "Test", progress: null, backPath: null }} />
    </Wrapper>,
  );
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
});

test("renders progress bar when progress is set", () => {
  render(
    <Wrapper>
      <Setup
        config={{
          title: "Test",
          progress: { current: 2, total: 3 },
          backPath: null,
        }}
      />
    </Wrapper>,
  );
  expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
});

test("hides progress bar when progress is null", () => {
  render(
    <Wrapper>
      <Setup config={{ title: "Test", progress: null, backPath: null }} />
    </Wrapper>,
  );
  expect(screen.queryByTestId("progress-bar")).not.toBeInTheDocument();
});

test("opens style menu on ☰ click and lists all themes", () => {
  render(
    <Wrapper>
      <Setup config={{ title: "Test", progress: null, backPath: null }} />
    </Wrapper>,
  );
  fireEvent.click(screen.getByLabelText("Style menu"));
  expect(screen.getByText("wireframe")).toBeInTheDocument();
  expect(screen.getByText("app")).toBeInTheDocument();
  expect(screen.getByText("GWC")).toBeInTheDocument();
});

test("selecting a theme closes the style menu", () => {
  render(
    <Wrapper>
      <Setup config={{ title: "Test", progress: null, backPath: null }} />
    </Wrapper>,
  );
  fireEvent.click(screen.getByLabelText("Style menu"));
  fireEvent.click(screen.getByText("wireframe"));
  expect(screen.queryByText("GWC")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/test/TitleBar.test.jsx
```

Expected: 8 failures (module not found).

- [ ] **Step 3: Implement `src/components/TitleBar.jsx`**

```jsx
import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { TitleBarContext } from "../theme/TitleBarContext";
import { themes } from "../theme/themes";

export default function TitleBar() {
  const { theme, themeName, setThemeName } = useTheme();
  const { titleBar } = useContext(TitleBarContext);
  const { title, progress, backPath } = titleBar;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: theme.barBackground,
        borderBottom: `1px solid ${theme.barBorder}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {backPath && (
            <button
              onClick={() => navigate(backPath)}
              aria-label="Back"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: theme.barTextSecondary,
                fontSize: 18,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ←
            </button>
          )}
          <span style={{ fontWeight: 700, fontSize: 15, color: theme.barText }}>
            {title}
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Style menu"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: theme.barTextSecondary,
              fontSize: 18,
              padding: 4,
              lineHeight: 1,
            }}
          >
            ☰
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: 6,
                minWidth: 140,
                zIndex: 200,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {Object.keys(themes).map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setThemeName(name);
                    setMenuOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    background:
                      name === themeName ? theme.accent : "transparent",
                    color: name === themeName ? "#ffffff" : theme.text,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: name === themeName ? 700 : 400,
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {progress && (
        <div style={{ background: theme.progressTrack, height: 3 }}>
          <div
            data-testid="progress-bar"
            style={{
              background: theme.progressFill,
              width: `${(progress.current / progress.total) * 100}%`,
              height: "100%",
              transition: "width 0.2s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/test/TitleBar.test.jsx
```

Expected: 8 passing.

- [ ] **Step 5: Run full suite — expect all still passing**

```bash
npm run test:run
```

- [ ] **Step 6: Commit**

```bash
git add src/components/TitleBar.jsx src/test/TitleBar.test.jsx
git commit -m "feat: add TitleBar with back button, progress bar, and style switcher"
```
