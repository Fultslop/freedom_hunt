# Task 8: Theme ProjectPage

State: Completed

**Part of:** [Theming & Title Bar](2026-04-29-theming-titlebar.md)  
**Depends on:** [Task 7 — AppPage](2026-04-29-theming-07-apppage.md)  
**Next:** [Task 9 — CityPage](2026-04-29-theming-09-citypage.md)

**Files:**

- Modify: `src/pages/ProjectPage.jsx`

ProjectPage currently loads only `projects/${project}/cities`. It now also loads `projects/${project}/${project}` (the project metadata file, e.g. `democrats_abroad.json`) to read the `style` field and call `setThemeName`. This is the moment the theme switches when a user enters a project.

---

- [ ] **Step 1: Replace `src/pages/ProjectPage.jsx`**

```jsx
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useTheme } from "../theme/ThemeContext";
import { useTitleBar } from "../theme/TitleBarContext";
import CitySelector from "../components/CitySelector";

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
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: 24,
        background: theme.background,
        minHeight: "100vh",
      }}
    >
      <style>{`html, body, #root { margin: 0; padding: 0; }`}</style>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 8,
          color: theme.text,
        }}
      >
        {citiesText["page.title"]}
      </h1>
      <div style={{ marginTop: 24 }}>
        {citiesText.items.map((city) => (
          <CitySelector key={city.id} project={project} city={city} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full suite — expect all still passing**

```bash
npm run test:run
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/ProjectPage.jsx
git commit -m "feat: apply theme to ProjectPage, load project style on entry"
```
