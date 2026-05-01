# Task 5: Wire up App.jsx

State: Completed

**Part of:** [Theming & Title Bar](2026-04-29-theming-titlebar.md)  
**Depends on:** [Task 4 — TitleBar component](2026-04-29-theming-04-titlebar-component.md)  
**Next:** [Task 6 — Data JSON](2026-04-29-theming-06-data-json.md)

**Files:**
- Modify: `src/App.jsx`

Wrap the app in `ThemeProvider` and `TitleBarProvider`. Add `ThemeBodySync` (a render-null component that syncs `theme.background` to `document.body` so the full viewport follows the active theme). Render `TitleBar` once inside `BrowserRouter`, above `<Routes>`.

---

- [ ] **Step 1: Replace `src/App.jsx`**

```jsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import { TitleBarProvider } from './theme/TitleBarContext'
import TitleBar from './components/TitleBar'
import AppPage from './pages/AppPage'
import ProjectPage from './pages/ProjectPage'
import CityPage from './pages/CityPage'
import RoutePage from './pages/RoutePage'

function ThemeBodySync() {
  const { theme } = useTheme()
  useEffect(() => {
    document.body.style.background = theme.background
  }, [theme])
  return null
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <TitleBarProvider>
          <BrowserRouter>
            <ThemeBodySync />
            <TitleBar />
            <Routes>
              <Route path="/" element={<AppPage />} />
              <Route path="/:project" element={<ProjectPage />} />
              <Route path="/:project/:city" element={<CityPage />} />
              <Route path="/:project/:city/:route" element={<RoutePage />} />
            </Routes>
          </BrowserRouter>
        </TitleBarProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}
```

- [ ] **Step 2: Run full suite — expect all still passing**

```bash
npm run test:run
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire ThemeProvider, TitleBarProvider, and TitleBar into App"
```
