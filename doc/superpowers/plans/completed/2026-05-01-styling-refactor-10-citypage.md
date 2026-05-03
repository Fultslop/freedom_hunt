# Task 10 — CityPage: remove `<style>` tags, inline styles → className

**Depends on:** [Task 02 — App wiring](2026-05-01-styling-refactor-02-app-wiring.md)
**Next:** [Task 11 — RoutePage](2026-05-01-styling-refactor-11-routepage.md)

**Files:**
- Create: `src/pages/CityPage.css`
- Modify: `src/pages/CityPage.jsx`

---

- [ ] **Step 1: Create `src/pages/CityPage.css`**

```css
/* src/pages/CityPage.css */

.city-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-background);
  min-height: 100vh;
}

.city-page__intro {
  margin-bottom: 24px;
}

.city-page__title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
}

.city-page__subtitle {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--color-text);
}
```

- [ ] **Step 2: Rewrite `src/pages/CityPage.jsx`**

Remove all `<style>` reset tags and `style` props that reference theme tokens. The `MarkdownText` component keeps its inline style (pass-through prop with dynamic colour).

```jsx
import { useParams } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'
import RouteSelector from '../components/RouteSelector'
import MarkdownText from '../components/MarkdownText'
import './CityPage.css'

export default function CityPage() {
  const { project, city } = useParams()
  const { text: cityText, loading: cityLoading } = useText(
    `projects/${project}/${city}/${city}`
  )
  const { text: routesText, loading: routesLoading } = useText(
    `projects/${project}/${city}/routes`
  )
  const { theme } = useTheme()

  useTitleBar({
    title: cityText?.['city.title'] ?? city,
    progress: null,
    backPath: `/${project}`,
  })

  if (cityLoading || routesLoading) return (
    <div style={{ padding: 24, background: theme.background, color: theme.text }}>Loading…</div>
  )
  if (!routesText) return (
    <div style={{ padding: 24, background: theme.background, color: theme.text }}>City not found.</div>
  )

  return (
    <div className="city-page">
      {cityText && (
        <div className="city-page__intro">
          <h1 className="city-page__title">{cityText['city.title']}</h1>
          <MarkdownText
            text={cityText['city.description']}
            style={{ fontSize: 14, color: theme.textSecondary, marginTop: 8, lineHeight: 1.6 }}
          />
        </div>
      )}
      <h2 className="city-page__subtitle">Choose a route</h2>
      {Object.entries(routesText).map(([routeId, route]) => (
        <RouteSelector
          key={routeId}
          project={project}
          city={city}
          routeId={routeId}
          route={route}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Visual smoke test**

Navigate to a city. City description renders via MarkdownText. Route cards appear below.

- [ ] **Step 5: Commit**

```
git add src/pages/CityPage.css src/pages/CityPage.jsx
git commit -m "refactor: migrate CityPage to className + remove style reset tags"
```
