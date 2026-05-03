# Task 02 — App.jsx: wire useCssVars + import global.css

**Depends on:** [Task 01 — CSS infrastructure](2026-05-01-styling-refactor-01-css-infrastructure.md)
**Next:** [Task 03 — CitySelector](2026-05-01-styling-refactor-03-cityselector.md)

**Files:**

- Modify: `src/App.jsx`

---

- [ ] **Step 1: Open `src/App.jsx` and add two lines**

Add the `global.css` import at the top, and call `useCssVars()` inside `ThemeBodySync` (which is already inside `ThemeProvider` context, so the hook can call `useTheme()`).

Full file after changes:

```jsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import { TitleBarProvider } from "./theme/TitleBarContext";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import TitleBar from "./components/TitleBar";
import AppPage from "./pages/AppPage";
import LoginPage from "./pages/LoginPage";
import ProjectPage from "./pages/ProjectPage";
import CityPage from "./pages/CityPage";
import RoutePage from "./pages/RoutePage";
import { useCssVars } from "./hooks/useCssVars";
import "./styles/global.css";

function ThemeBodySync() {
  const { theme } = useTheme();
  useCssVars();
  useEffect(() => {
    document.body.style.background = theme.background;
  }, [theme]);
  return null;
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <TitleBarProvider>
          <BrowserRouter>
            <AuthProvider>
              <ThemeBodySync />
              <TitleBar />
              <Routes>
                <Route path="/" element={<AppPage />} />
                <Route path="/login/:project" element={<LoginPage />} />
                <Route
                  path="/:project"
                  element={
                    <ProtectedRoute>
                      <ProjectPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:project/:city"
                  element={
                    <ProtectedRoute>
                      <CityPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/:project/:city/:route"
                  element={
                    <ProtectedRoute>
                      <RoutePage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TitleBarProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
```

- [ ] **Step 2: Start the dev server and smoke-test**

```
npm run dev
```

Open `http://localhost:5173` in a browser. Verify:

- The app loads without errors
- Open browser DevTools → Elements → `<html>` element has `data-theme="app"` attribute
- Open DevTools → `<html>` has `--color-background: #0f172a` (and other `--color-*` vars) in its `style` attribute
- Switching theme via the ☰ menu updates both `data-theme` and the `--color-*` values in real time

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add src/App.jsx
git commit -m "feat: wire useCssVars hook and import global.css in App"
```
