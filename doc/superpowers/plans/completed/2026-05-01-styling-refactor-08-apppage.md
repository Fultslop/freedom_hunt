# Task 08 — AppPage: remove `<style>` tag, inline styles → className

**Depends on:** [Task 02 — App wiring](2026-05-01-styling-refactor-02-app-wiring.md)
**Next:** [Task 09 — ProjectPage](2026-05-01-styling-refactor-09-projectpage.md)

**Files:**

- Create: `src/pages/AppPage.css`
- Modify: `src/pages/AppPage.jsx`

The `<style>{STYLE_RESET}</style>` tags are removed — `global.css` now handles the reset. The landing image hero relies on computed pixel values (`imgHeight`, `contentMarginTop`) which must remain inline. The gradient overlay uses `theme.background` which is now available as `var(--color-background)`.

---

- [ ] **Step 1: Create `src/pages/AppPage.css`**

```css
/* src/pages/AppPage.css */

.app-page {
  background: var(--color-background);
  min-height: 100vh;
}

.app-page__hero-wrap {
  background: #ffffff;
  overflow: hidden;
  position: relative;
}

.app-page__hero-img {
  display: block;
  width: 100%;
  transform: translateY(-50%);
}

.app-page__hero-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0),
    var(--color-background)
  );
}

.app-page__content {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-background);
  border-radius: 8px;
  position: relative;
}

.app-page__heading {
  margin-bottom: 32px;
}

.app-page__title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
}

.app-page__tagline {
  font-size: 15px;
  color: var(--color-text-secondary);
  margin-top: 8px;
}

.app-page__subtitle {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--color-text);
}

.app-page__project-card {
  padding: 16px 20px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 12px;
  background: var(--color-surface);
}

.app-page__project-name {
  font-weight: 600;
  font-size: 17px;
  color: var(--color-text);
}
```

- [ ] **Step 2: Rewrite `src/pages/AppPage.jsx`**

`STYLE_RESET` const and all `<style>` tags removed. Dynamic computed values (`imgHeight`, `contentMarginTop`) remain inline. `theme.background` references replaced with `'var(--color-background)'` in inline styles where CSS class can't be used (the `linear-gradient` is now in CSS, so the inline gradient is removed entirely).

```jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useTheme } from "../theme/ThemeContext";
import { useTitleBar } from "../theme/TitleBarContext";
import MarkdownText from "../components/MarkdownText";
import { fetchImage } from "../assets/AssetManager";
import "./AppPage.css";

export default function AppPage() {
  const navigate = useNavigate();
  const { text: appText, loading: appLoading } = useText("application");
  const { text: projectsText, loading: projectsLoading } =
    useText("projects/projects");
  const { theme, setThemeName } = useTheme();
  const [landingImageUrl, setLandingImageUrl] = useState(null);
  const [imgHeight, setImgHeight] = useState(0);

  // xxx todo move to data
  useTitleBar({ title: "Way-ward", progress: null, backPath: null });

  useEffect(() => {
    setThemeName("app");
  }, [setThemeName]);
  useEffect(() => {
    fetchImage("landing-page.jpg").then(setLandingImageUrl);
  }, []);

  if (appLoading || projectsLoading)
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        Loading…
      </div>
    );
  if (!projectsText)
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        Content unavailable.
      </div>
    );

  const contentMarginTop = imgHeight
    ? Math.round(-(imgHeight / 2 - window.innerHeight * 0.2))
    : landingImageUrl
      ? -80
      : 0;

  return (
    <div className="app-page">
      {landingImageUrl && (
        <div
          className="app-page__hero-wrap"
          style={{ height: imgHeight ? imgHeight / 2 : "auto" }}
        >
          <img
            src={landingImageUrl}
            alt=""
            onLoad={(e) => setImgHeight(e.target.offsetHeight)}
            className="app-page__hero-img"
          />
          <div className="app-page__hero-gradient" />
        </div>
      )}

      <div
        className="app-page__content"
        style={{ marginTop: contentMarginTop }}
      >
        {appText && (
          <div className="app-page__heading">
            <h1 className="app-page__title">{appText["app.title"]}</h1>
            <p className="app-page__tagline">{appText["app.tagline"]}</p>
          </div>
        )}
        <h2 className="app-page__subtitle">{projectsText["page.subtitle"]}</h2>
        {projectsText.items.map((project) => (
          <div
            key={project.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/${project.id}`)}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && navigate(`/${project.id}`)
            }
            className="app-page__project-card"
          >
            <div className="app-page__project-name">{project.name}</div>
            <MarkdownText
              text={project.description}
              style={{
                fontSize: 13,
                color: theme.textMuted,
                marginTop: 4,
                lineHeight: 1.5,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Note: The loading/error states keep inline styles for `background` and `color` since they're outside the normal render tree. `MarkdownText` keeps its inline style as it's a pass-through prop.

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Visual smoke test**

Open the home page. Verify:

- Landing hero image loads and the parallax-crop effect works
- Gradient strip fades from image to page background
- Project cards render with correct colours in all themes

- [ ] **Step 5: Commit**

```
git add src/pages/AppPage.css src/pages/AppPage.jsx
git commit -m "refactor: migrate AppPage to className + remove style reset tag"
```
