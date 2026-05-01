# Task 10: Theme RoutePage

State: Completed

**Part of:** [Theming & Title Bar](2026-04-29-theming-titlebar.md)  
**Depends on:** [Task 9 — CityPage](2026-04-29-theming-09-citypage.md)  
**Next:** [Task 11 — ChallengeCard](2026-04-29-theming-11-challengecard.md)

**Files:**
- Modify: `src/pages/RoutePage.jsx`

The `useTitleBar` call here passes live progress `{ current: currentIndex + 1, total: locations.length }`. Because `useTitleBar` serializes its config with `JSON.stringify`, the title bar progress bar updates automatically whenever `currentIndex` changes — no extra effect needed.

The `index` and `total` props are dropped from the `<ChallengeCard>` call since progress now lives in the title bar (Task 11 removes the progress indicator from ChallengeCard).

---

- [ ] **Step 1: Replace `src/pages/RoutePage.jsx`**

```jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useText } from '../hooks/useText'
import { useLocations } from '../hooks/useLocations'
import { useTheme } from '../theme/ThemeContext'
import { useTitleBar } from '../theme/TitleBarContext'
import ChallengeCard from '../components/ChallengeCard'

export function clampedNext(current, total) {
  if (total <= 0) return 0
  return Math.min(current + 1, total - 1)
}

export function clampedPrev(current) {
  return Math.max(current - 1, 0)
}

export default function RoutePage() {
  const { project, city, route } = useParams()
  const navigate = useNavigate()
  const storageKey = `${project}/${city}/${route}`
  const { theme } = useTheme()

  const { text: routesText, loading: routesLoading } = useText(
    `projects/${project}/${city}/routes`
  )

  const routeData = !routesLoading && routesText ? routesText[route] : null
  const locationPaths = routeData
    ? routeData.locations.map(id => `projects/${project}/${city}/${id}`)
    : []

  const { locations, loading: locationsLoading } = useLocations(locationPaths)

  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    const parsed = saved ? parseInt(saved, 10) : 0
    return isNaN(parsed) ? 0 : parsed
  })

  const touchStartX = useRef(null)

  useEffect(() => {
    localStorage.setItem(storageKey, currentIndex)
  }, [storageKey, currentIndex])

  useTitleBar({
    title: route.replace(/_/g, ' '),
    progress: locations.length > 0 ? { current: currentIndex + 1, total: locations.length } : null,
    backPath: `/${project}/${city}`,
  })

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta < -60) setCurrentIndex(i => clampedNext(i, locations.length))
    else if (delta > 60) setCurrentIndex(i => clampedPrev(i))
  }

  if (routesLoading || locationsLoading) {
    return <div style={{ padding: 24, background: theme.background, color: theme.text }}>Loading…</div>
  }

  if (!routeData) {
    return <div style={{ padding: 24, background: theme.background, color: theme.text }}>Route not found.</div>
  }

  const location = locations[currentIndex]
  if (!location) {
    return <div style={{ padding: 24, background: theme.background, color: theme.text }}>No locations found for this route.</div>
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ userSelect: 'none', background: theme.background, minHeight: '100vh' }}
    >
      <style>{`html, body, #root { margin: 0; padding: 0; height: 100%; }`}</style>

      <ChallengeCard location={location} />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderTop: `1px solid ${theme.border}`,
        background: theme.surface,
      }}>
        <button
          onClick={() => setCurrentIndex(i => clampedPrev(i))}
          disabled={currentIndex === 0}
          style={{ padding: '8px 16px', cursor: 'pointer', background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4 }}
        >
          ← Prev
        </button>
        <button
          onClick={() => navigate(`/${project}/${city}`)}
          style={{ padding: '8px 16px', cursor: 'pointer', background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4 }}
        >
          Exit
        </button>
        <button
          onClick={() => setCurrentIndex(i => clampedNext(i, locations.length))}
          disabled={currentIndex === locations.length - 1}
          style={{ padding: '8px 16px', cursor: 'pointer', background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4 }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full suite — expect all still passing**

```bash
npm run test:run
```
Note: `RoutePage.swipe.test.js` only tests the exported pure functions `clampedNext` / `clampedPrev` — those are unchanged and will still pass.

- [ ] **Step 3: Commit**

```bash
git add src/pages/RoutePage.jsx
git commit -m "feat: apply theme to RoutePage, wire progress into TitleBar"
```
