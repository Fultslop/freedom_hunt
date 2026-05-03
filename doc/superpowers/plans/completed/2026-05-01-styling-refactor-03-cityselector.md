# Task 03 — CitySelector: inline styles → className

**Depends on:** [Task 02 — App wiring](2026-05-01-styling-refactor-02-app-wiring.md)
**Next:** [Task 04 — RouteSelector](2026-05-01-styling-refactor-04-routeselector.md)

**Files:**
- Create: `src/components/CitySelector.css`
- Modify: `src/components/CitySelector.jsx`

---

- [ ] **Step 1: Create `src/components/CitySelector.css`**

Hardcoded colours `#ddd`, `#666`, `#888` are replaced with CSS custom properties. No `useTheme()` hook needed in the component — the vars are global.

```css
/* src/components/CitySelector.css */

.city-card {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 12px;
}

.city-card__image {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  margin-right: 16px;
  flex-shrink: 0;
}

.city-card__name {
  font-weight: 600;
  font-size: 17px;
}

.city-card__country {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.city-card__description {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 6px;
}
```

- [ ] **Step 2: Rewrite `src/components/CitySelector.jsx`**

Remove all inline `style` props. Remove the unused `useTheme` import (it was never imported here — CitySelector previously had no theme hook). Add the CSS import.

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchImage } from '../assets/AssetManager'
import './CitySelector.css'

export default function CitySelector({ project, city }) {
  const navigate = useNavigate()
  const [imageSrc, setImageSrc] = useState(null)

  useEffect(() => {
    if (!city.image) { setImageSrc(null); return }
    let cancelled = false
    fetchImage(city.image).then(url => {
      if (!cancelled) setImageSrc(url)
    })
    return () => { cancelled = true }
  }, [city.image])

  const handleNav = () => navigate(`/${project}/${city.id}`)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleNav()}
      className="city-card"
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt={city.name}
          className="city-card__image"
        />
      )}
      <div>
        <div className="city-card__name">{city.name}</div>
        <div className="city-card__country">{city.country}</div>
        {city.description && (
          <div className="city-card__description">{city.description}</div>
        )}
      </div>
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

Open the app and navigate to a project page. City cards should render with correct spacing, border, and text colours for the active theme. Switch themes and confirm colours update.

- [ ] **Step 5: Commit**

```
git add src/components/CitySelector.css src/components/CitySelector.jsx
git commit -m "refactor: migrate CitySelector to className + CSS custom properties"
```
