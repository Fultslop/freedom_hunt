# Task 09 — ProjectPage: remove `<style>` tag, inline styles → className

**Depends on:** [Task 02 — App wiring](2026-05-01-styling-refactor-02-app-wiring.md)
**Next:** [Task 10 — CityPage](2026-05-01-styling-refactor-10-citypage.md)

**Files:**

- Create: `src/pages/ProjectPage.css`
- Modify: `src/pages/ProjectPage.jsx`

---

- [ ] **Step 1: Create `src/pages/ProjectPage.css`**

```css
/* src/pages/ProjectPage.css */

.project-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: var(--color-background);
  min-height: 100vh;
}

.project-page__title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--color-text);
}

.project-page__city-list {
  margin-top: 24px;
}
```

- [ ] **Step 2: Rewrite `src/pages/ProjectPage.jsx`**

Remove the inline `<style>` tag and all `style` props that reference theme tokens.

```jsx
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useTheme } from "../theme/ThemeContext";
import { useTitleBar } from "../theme/TitleBarContext";
import CitySelector from "../components/CitySelector";
import "./ProjectPage.css";

export default function ProjectPage() {
  const { project } = useParams();
  const { text: projectMeta } = useText(`projects/${project}/${project}`);
  const { text: citiesText, loading: citiesLoading } = useText(
    `projects/${project}/cities`,
  );
  const { theme, setThemeName } = useTheme();

  useEffect(() => {
    if (projectMeta) setThemeName(projectMeta.style ?? "app");
  }, [projectMeta, setThemeName]);

  useTitleBar({
    title: citiesText?.["page.title"] ?? project,
    progress: null,
    backPath: "/",
  });

  if (citiesLoading)
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        Loading…
      </div>
    );
  if (!citiesText)
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        Project not found.
      </div>
    );

  return (
    <div className="project-page">
      <h1 className="project-page__title">{citiesText["page.title"]}</h1>
      <div className="project-page__city-list">
        {citiesText.items.map((city) => (
          <CitySelector key={city.id} project={project} city={city} />
        ))}
      </div>
    </div>
  );
}
```

Note: loading/error states keep inline styles (transient, outside the normal layout tree).

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Visual smoke test**

Navigate to a project. City list renders correctly with CitySelector cards.

- [ ] **Step 5: Commit**

```
git add src/pages/ProjectPage.css src/pages/ProjectPage.jsx
git commit -m "refactor: migrate ProjectPage to className + remove style reset tag"
```
