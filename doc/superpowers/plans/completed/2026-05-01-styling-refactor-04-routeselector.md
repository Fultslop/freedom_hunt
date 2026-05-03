# Task 04 — RouteSelector: inline styles → className

**Depends on:** [Task 02 — App wiring](2026-05-01-styling-refactor-02-app-wiring.md)
**Next:** [Task 05 — ChallengeForm](2026-05-01-styling-refactor-05-challengeform.md)

**Files:**
- Create: `src/components/RouteSelector.css`
- Modify: `src/components/RouteSelector.jsx`

---

- [ ] **Step 1: Create `src/components/RouteSelector.css`**

Hardcoded colours `#ddd`, `#666`, `#aaa` are replaced with CSS custom properties.

```css
/* src/components/RouteSelector.css */

.route-card {
  padding: 16px 20px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 12px;
}

.route-card__name {
  font-weight: 600;
  font-size: 17px;
  text-transform: capitalize;
}

.route-card__description {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.route-card__stops {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
}
```

- [ ] **Step 2: Rewrite `src/components/RouteSelector.jsx`**

```jsx
import { useNavigate } from 'react-router-dom'
import './RouteSelector.css'

export default function RouteSelector({ project, city, routeId, route }) {
  const navigate = useNavigate()
  const handleNav = () => navigate(`/${project}/${city}/${routeId}`)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleNav()}
      className="route-card"
    >
      <div className="route-card__name">
        {routeId.replace(/_/g, ' ')}
      </div>
      <div className="route-card__description">{route.description}</div>
      <div className="route-card__stops">
        {route.locations.length} stop{route.locations.length !== 1 ? 's' : ''}
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

Navigate to a city page. Route cards should render with correct spacing, border, and text colours. Switch themes and confirm colours update.

- [ ] **Step 5: Commit**

```
git add src/components/RouteSelector.css src/components/RouteSelector.jsx
git commit -m "refactor: migrate RouteSelector to className + CSS custom properties"
```
