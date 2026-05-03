# Task 06 — TitleBar: inline styles → className

**Depends on:** [Task 02 — App wiring](2026-05-01-styling-refactor-02-app-wiring.md)
**Next:** [Task 07 — ChallengeCard](2026-05-01-styling-refactor-07-challengecard.md)

**Files:**

- Create: `src/components/TitleBar.css`
- Modify: `src/components/TitleBar.jsx`

TitleBar is the most complex component. Most styles move to CSS. A small number of values remain inline because they are conditional on runtime state (`menuView`, `themeName`, `name === themeName`, `progress`).

---

- [ ] **Step 1: Create `src/components/TitleBar.css`**

```css
/* src/components/TitleBar.css */

.titlebar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bar-background);
  border-bottom: 1px solid var(--color-bar-border);
}

.titlebar__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
}

.titlebar__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.titlebar__back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-bar-text-secondary);
  font-size: 18px;
  padding: 0;
  line-height: 1;
}

.titlebar__title {
  font-weight: 700;
  font-size: 15px;
  color: var(--color-bar-text);
}

.titlebar__menu-wrap {
  position: relative;
}

.titlebar__menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-bar-text-secondary);
  font-size: 18px;
  padding: 4px;
  line-height: 1;
}

.titlebar__dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-width: 180px;
  z-index: 200;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.titlebar__menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  text-align: left;
}

.titlebar__menu-item:last-child {
  border-bottom: none;
}

.titlebar__menu-item-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.titlebar__menu-item-arrow {
  font-size: 14px;
  color: var(--color-text-muted);
}

.titlebar__submenu-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: var(--color-bar-background);
  border: none;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  text-align: left;
}

.titlebar__submenu-back {
  font-size: 14px;
  color: var(--color-bar-text);
}

.titlebar__submenu-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-bar-text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.titlebar__profile-body {
  padding: 16px;
}

.titlebar__profile-field {
  margin-bottom: 12px;
}

.titlebar__profile-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin-bottom: 2px;
}

.titlebar__profile-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.titlebar__profile-value--contact {
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text);
}

.titlebar__signout-btn {
  width: 100%;
  padding: 9px;
  background: transparent;
  color: var(--color-accent);
  border: 1.5px solid var(--color-accent);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 4px;
}

.titlebar__theme-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
  font-size: 13px;
}

.titlebar__theme-check {
  font-size: 11px;
}

.titlebar__progress-track {
  background: var(--color-progress-track);
  height: 6px;
}

.titlebar__progress-fill {
  height: 100%;
  transition: width 0.2s ease;
  background: var(--color-progress-fill);
}
```

- [ ] **Step 2: Rewrite `src/components/TitleBar.jsx`**

Inline styles remain only for:

- `width` on progress fill (dynamic percentage)
- `background` and `color` on theme buttons (depend on `name === themeName` condition)

```jsx
import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { TitleBarContext } from "../theme/TitleBarContext";
import { themes } from "../theme/themes";
import { useAuth } from "../auth/AuthContext";
import "./TitleBar.css";

export default function TitleBar() {
  const { theme, themeName, setThemeName } = useTheme();
  const { titleBar } = useContext(TitleBarContext);
  const { title, progress, backPath } = titleBar;
  const { activeAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [menuView, setMenuView] = useState(null);

  function closeMenu() {
    setMenuView(null);
  }

  return (
    <div className="titlebar">
      <div className="titlebar__row">
        <div className="titlebar__left">
          {backPath && (
            <button
              onClick={() => navigate(backPath)}
              aria-label="Back"
              className="titlebar__back-btn"
            >
              ←
            </button>
          )}
          <span className="titlebar__title">{title}</span>
        </div>

        <div className="titlebar__menu-wrap">
          <button
            onClick={() => setMenuView((v) => (v ? null : "root"))}
            aria-label="Menu"
            className="titlebar__menu-btn"
          >
            ☰
          </button>

          {menuView && (
            <div className="titlebar__dropdown">
              {menuView === "root" && (
                <>
                  <button
                    onClick={() => setMenuView("profile")}
                    className="titlebar__menu-item"
                  >
                    <span className="titlebar__menu-item-label">Profile</span>
                    <span className="titlebar__menu-item-arrow">›</span>
                  </button>
                  <button
                    onClick={() => setMenuView("themes")}
                    className="titlebar__menu-item"
                  >
                    <span className="titlebar__menu-item-label">Themes</span>
                    <span className="titlebar__menu-item-arrow">›</span>
                  </button>
                </>
              )}

              {menuView === "profile" && (
                <>
                  <button
                    onClick={() => setMenuView("root")}
                    aria-label="Back to menu"
                    className="titlebar__submenu-header"
                  >
                    <span className="titlebar__submenu-back">‹</span>
                    <span className="titlebar__submenu-title">Profile</span>
                  </button>
                  <div className="titlebar__profile-body">
                    <div className="titlebar__profile-field">
                      <div className="titlebar__profile-label">Team</div>
                      <div className="titlebar__profile-value">
                        {activeAuth?.teamName || "—"}
                      </div>
                    </div>
                    <div
                      className="titlebar__profile-field"
                      style={{ marginBottom: 16 }}
                    >
                      <div className="titlebar__profile-label">Contact</div>
                      <div className="titlebar__profile-value--contact">
                        {activeAuth?.contact || "—"}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await logout();
                        closeMenu();
                        navigate("/");
                      }}
                      className="titlebar__signout-btn"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}

              {menuView === "themes" && (
                <>
                  <button
                    onClick={() => setMenuView("root")}
                    aria-label="Back to menu"
                    className="titlebar__submenu-header"
                  >
                    <span className="titlebar__submenu-back">‹</span>
                    <span className="titlebar__submenu-title">Themes</span>
                  </button>
                  {Object.keys(themes).map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setThemeName(name);
                        closeMenu();
                      }}
                      className="titlebar__theme-btn"
                      style={{
                        background:
                          name === themeName ? theme.accent : "transparent",
                        color: name === themeName ? "#ffffff" : theme.text,
                        fontWeight: name === themeName ? 700 : 400,
                      }}
                    >
                      <span>{name}</span>
                      {name === themeName && (
                        <span className="titlebar__theme-check">✓</span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {progress && (
        <div data-testid="progress-bar" className="titlebar__progress-track">
          <div
            className="titlebar__progress-fill"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass. TitleBar tests use `data-testid="progress-bar"` which is preserved.

- [ ] **Step 4: Visual smoke test**

Open the app. Verify:

- TitleBar renders correctly in all themes
- Back button appears on sub-pages
- ☰ menu opens, Profile and Themes sub-panels work
- Active theme is highlighted in the Themes panel
- Progress bar appears on the route page and fills as you advance

- [ ] **Step 5: Commit**

```
git add src/components/TitleBar.css src/components/TitleBar.jsx
git commit -m "refactor: migrate TitleBar to className + CSS custom properties"
```
