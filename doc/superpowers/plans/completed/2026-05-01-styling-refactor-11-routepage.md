# Task 11 — RoutePage: remove `<style>` tag + keyframes, inline styles → className

**Depends on:** [Task 01 — CSS infrastructure](2026-05-01-styling-refactor-01-css-infrastructure.md) (keyframes already in global.css)
**Next:** [Task 12 — LoginPage](2026-05-01-styling-refactor-12-loginpage.md)

**Files:**

- Create: `src/pages/RoutePage.css`
- Modify: `src/pages/RoutePage.jsx`

The `<style>` tag containing the `html, body, #root` reset and both `@keyframes` is removed. The keyframes are already in `global.css` from Task 01. The card animation (`slideInFromRight` / `slideInFromLeft`) uses the `direction` state — this must stay inline since it's a runtime value. The fixed bottom nav bar keeps inline `border-top` and `background` as they reference theme tokens in a position-fixed element.

---

- [ ] **Step 1: Create `src/pages/RoutePage.css`**

```css
/* src/pages/RoutePage.css */

.route-page {
  user-select: none;
  background: var(--color-background);
  min-height: 100vh;
}

.route-page__cards {
  padding-bottom: 60px;
}

.route-page__nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.route-page__nav-slot {
  width: 80px;
}

.route-page__nav-slot--right {
  width: 80px;
  display: flex;
  justify-content: flex-end;
}

.route-page__prev-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  cursor: pointer;
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px;
}

.route-page__exit-btn {
  padding: 8px 14px;
  cursor: pointer;
  background: transparent;
  color: var(--color-text-muted);
  border: none;
  font-size: 12px;
}

.route-page__next-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  cursor: pointer;
  background: var(--color-accent);
  color: #000;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
}
```

- [ ] **Step 2: Rewrite `src/pages/RoutePage.jsx`**

Remove the `<style>` tag entirely. The card div's `animation` inline style stays because the animation name depends on runtime `direction` state. Loading/error states keep inline styles.

```jsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useLocations } from "../hooks/useLocations";
import { useTheme } from "../theme/ThemeContext";
import { useTitleBar } from "../theme/TitleBarContext";
import ChallengeCard from "../components/ChallengeCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./RoutePage.css";

export function clampedNext(current, total) {
  if (total <= 0) return 0;
  return Math.min(current + 1, total - 1);
}

export function clampedPrev(current) {
  return Math.max(current - 1, 0);
}

export default function RoutePage() {
  const { project, city, route } = useParams();
  const navigate = useNavigate();
  const storageKey = `${project}/${city}/${route}`;
  const { theme } = useTheme();

  const { text: routesText, loading: routesLoading } = useText(
    `projects/${project}/${city}/routes`,
  );

  const routeData = !routesLoading && routesText ? routesText[route] : null;
  const locationPaths = routeData
    ? routeData.locations.map((id) => `projects/${project}/${city}/${id}`)
    : [];

  const { locations, loading: locationsLoading } = useLocations(locationPaths);

  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? parseInt(saved, 10) : 0;
    return isNaN(parsed) ? 0 : parsed;
  });
  const [direction, setDirection] = useState("next");

  const touchStartX = useRef(null);

  useEffect(() => {
    localStorage.setItem(storageKey, currentIndex);
  }, [storageKey, currentIndex]);

  useTitleBar({
    title: route.replace(/_/g, " "),
    progress:
      locations.length > 0
        ? { current: currentIndex + 1, total: locations.length }
        : null,
    backPath: `/${project}/${city}`,
  });

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta < -60) {
      setDirection("next");
      setCurrentIndex((i) => clampedNext(i, locations.length));
    } else if (delta > 60) {
      setDirection("prev");
      setCurrentIndex((i) => clampedPrev(i));
    }
  };

  if (routesLoading || locationsLoading) {
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        Loading…
      </div>
    );
  }

  if (!routeData) {
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        Route not found.
      </div>
    );
  }

  const location = locations[currentIndex];
  if (!location) {
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        No locations found for this route.
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="route-page"
    >
      <div className="route-page__cards">
        <div
          key={currentIndex}
          style={{
            animation: `${direction === "next" ? "slideInFromRight" : "slideInFromLeft"} 250ms ease-out`,
          }}
        >
          <ChallengeCard
            location={location}
            isLast={currentIndex === locations.length - 1}
            index={currentIndex + 1}
          />
        </div>
      </div>

      <div className="route-page__nav">
        <div className="route-page__nav-slot">
          {currentIndex > 0 && (
            <button
              aria-label="Previous stop"
              onClick={() => {
                setDirection("prev");
                setCurrentIndex((i) => clampedPrev(i));
              }}
              className="route-page__prev-btn"
            >
              <ChevronLeft size={16} aria-hidden /> Prev
            </button>
          )}
        </div>

        <button
          onClick={() => navigate(`/${project}/${city}`)}
          className="route-page__exit-btn"
        >
          Exit
        </button>

        <div className="route-page__nav-slot--right">
          {currentIndex < locations.length - 1 && (
            <button
              aria-label="Next stop"
              onClick={() => {
                setDirection("next");
                setCurrentIndex((i) => clampedNext(i, locations.length));
              }}
              className="route-page__next-btn"
            >
              Next <ChevronRight size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass. RoutePage tests check `clampedNext`/`clampedPrev` logic, not styles.

- [ ] **Step 4: Visual smoke test**

Open a route. Verify:

- Cards slide in from the correct direction when advancing/retreating
- Bottom nav bar is fixed with correct colours in all themes
- Swipe gestures still work on mobile

- [ ] **Step 5: Commit**

```
git add src/pages/RoutePage.css src/pages/RoutePage.jsx
git commit -m "refactor: migrate RoutePage to className + remove inline keyframes"
```
