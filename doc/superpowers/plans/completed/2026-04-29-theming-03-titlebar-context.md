# Task 3: TitleBarContext

State: Completed

**Part of:** [Theming & Title Bar](2026-04-29-theming-titlebar.md)  
**Depends on:** [Task 2 — ThemeContext](2026-04-29-theming-02-theme-context.md)  
**Next:** [Task 4 — TitleBar component](2026-04-29-theming-04-titlebar-component.md)

**Files:**

- Create: `src/theme/TitleBarContext.jsx`
- Create: `src/test/TitleBarContext.test.jsx`

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/TitleBarContext.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { TitleBarProvider, useTitleBar } from "../theme/TitleBarContext";

function Consumer({ config }) {
  const { titleBar } = useTitleBar(config);
  return (
    <>
      <span data-testid="title">{titleBar.title}</span>
      <span data-testid="back">{titleBar.backPath ?? "none"}</span>
      <span data-testid="progress">
        {titleBar.progress
          ? `${titleBar.progress.current}/${titleBar.progress.total}`
          : "none"}
      </span>
    </>
  );
}

test("defaults to Freedom Hunt with no config", () => {
  render(
    <TitleBarProvider>
      <Consumer />
    </TitleBarProvider>,
  );
  expect(screen.getByTestId("title")).toHaveTextContent("Freedom Hunt");
  expect(screen.getByTestId("back")).toHaveTextContent("none");
  expect(screen.getByTestId("progress")).toHaveTextContent("none");
});

test("sets title and backPath from config", () => {
  render(
    <TitleBarProvider>
      <Consumer
        config={{
          title: "Short Walk",
          progress: null,
          backPath: "/da/den_haag",
        }}
      />
    </TitleBarProvider>,
  );
  expect(screen.getByTestId("title")).toHaveTextContent("Short Walk");
  expect(screen.getByTestId("back")).toHaveTextContent("/da/den_haag");
});

test("sets progress from config", () => {
  render(
    <TitleBarProvider>
      <Consumer
        config={{
          title: "Test",
          progress: { current: 2, total: 3 },
          backPath: null,
        }}
      />
    </TitleBarProvider>,
  );
  expect(screen.getByTestId("progress")).toHaveTextContent("2/3");
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/test/TitleBarContext.test.jsx
```

Expected: 3 failures (module not found).

- [ ] **Step 3: Implement `src/theme/TitleBarContext.jsx`**

```jsx
import { createContext, useState, useContext, useEffect } from "react";

const DEFAULT_TITLE_BAR = {
  title: "Freedom Hunt",
  progress: null,
  backPath: null,
};

export const TitleBarContext = createContext(null);

export function TitleBarProvider({ children }) {
  const [titleBar, setTitleBar] = useState(DEFAULT_TITLE_BAR);
  return (
    <TitleBarContext.Provider value={{ titleBar, setTitleBar }}>
      {children}
    </TitleBarContext.Provider>
  );
}

export function useTitleBar(config) {
  const ctx = useContext(TitleBarContext);
  useEffect(() => {
    if (config !== undefined) ctx.setTitleBar(config);
  }, [JSON.stringify(config)]); // eslint-disable-line react-hooks/exhaustive-deps
  return ctx;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/test/TitleBarContext.test.jsx
```

Expected: 3 passing.

- [ ] **Step 5: Run full suite — expect all still passing**

```bash
npm run test:run
```

- [ ] **Step 6: Commit**

```bash
git add src/theme/TitleBarContext.jsx src/test/TitleBarContext.test.jsx
git commit -m "feat: add TitleBarContext and useTitleBar hook"
```
