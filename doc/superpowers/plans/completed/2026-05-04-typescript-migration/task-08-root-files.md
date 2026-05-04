# Task 08: Root Files

**Files:**
- `src/App.jsx` → `src/App.tsx`
- `src/main.jsx` → `src/main.tsx`

---

- [ ] **Step 1: Convert `src/App.tsx`**

```typescript
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext.tsx";
import { ThemeProvider, useTheme } from "./theme/ThemeContext.tsx";
import { TitleBarProvider } from "./theme/TitleBarContext.tsx";
import { FontSizeProvider } from "./theme/FontSizeContext.tsx";
import { AuthProvider } from "./auth/AuthContext.tsx";
import ProtectedRoute from "./auth/ProtectedRoute.tsx";
import AdminRoute from "./auth/AdminRoute.tsx";
import EditorLoginPage from "./pages/editor/EditorLoginPage.tsx";
import EditorPage from "./pages/editor/EditorPage.tsx";
import EditorLocationList from "./pages/editor/EditorLocationList.tsx";
import EditorLocationForm from "./pages/editor/EditorLocationForm.tsx";
import TitleBar from "./components/TitleBar.tsx";
import AppPage from "./pages/AppPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ProjectPage from "./pages/ProjectPage.tsx";
import CityPage from "./pages/CityPage.tsx";
import RoutePage from "./pages/RoutePage.tsx";
import { useCssVars } from "./hooks/useCssVars.ts";
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
      <FontSizeProvider>
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
                  <Route path="/editor/login" element={<EditorLoginPage />} />
                  <Route
                    path="/editor"
                    element={
                      <AdminRoute>
                        <EditorPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/editor/locations/:project/:city"
                    element={
                      <AdminRoute>
                        <EditorLocationList />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/editor/locations/:project/:city/new"
                    element={
                      <AdminRoute>
                        <EditorLocationForm />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/editor/locations/:project/:city/edit/:filename"
                    element={
                      <AdminRoute>
                        <EditorLocationForm />
                      </AdminRoute>
                    }
                  />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </TitleBarProvider>
        </ThemeProvider>
      </FontSizeProvider>
    </LanguageProvider>
  );
}
```

---

- [ ] **Step 2: Convert `src/main.tsx`**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

The `!` non-null assertion on `getElementById("root")` is required because TypeScript types it as `HTMLElement | null`. The element always exists in `index.html`.

---

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

---

- [ ] **Step 4: Run tests**

```bash
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 5: Smoke-test the dev server**

```bash
npm run dev
```

Open the app in a browser and verify:
- Home page loads
- Theme switching works
- Font size switching works
- Login flow works (if a running Cloudflare Worker is available — if not, verify routing at minimum)

---

- [ ] **Step 6: Commit**

Stage: `src/App.tsx`, `src/main.tsx`
Message: `refactor: convert App and main entry point to TypeScript`
