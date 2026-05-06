# Task 03 — App Shell

**Files:**
- Modify: `src/App.svelte`
- (already created `src/main.ts` in Task 01)

Creates the routing skeleton with stub pages. All four hunt routes and all five editor routes resolve correctly. Auth guards are added in Task 06 after the real pages exist.

---

- [ ] **Step 1: Create stub page components**

These are temporary placeholders replaced in Tasks 07 and 08. Create each file exactly as shown.

`src/pages/AppPage.svelte`:
```svelte
<p>AppPage stub</p>
```

`src/pages/LoginPage.svelte`:
```svelte
<p>LoginPage stub</p>
```

`src/pages/ProjectPage.svelte`:
```svelte
<p>ProjectPage stub</p>
```

`src/pages/CityPage.svelte`:
```svelte
<p>CityPage stub</p>
```

`src/pages/RoutePage.svelte`:
```svelte
<p>RoutePage stub</p>
```

`src/pages/editor/EditorLoginPage.svelte`:
```svelte
<p>EditorLoginPage stub</p>
```

`src/pages/editor/EditorPage.svelte`:
```svelte
<p>EditorPage stub</p>
```

`src/pages/editor/EditorLocationList.svelte`:
```svelte
<p>EditorLocationList stub</p>
```

`src/pages/editor/EditorLocationForm.svelte`:
```svelte
<p>EditorLocationForm stub</p>
```

- [ ] **Step 2: Replace `src/App.svelte` with the full routing shell**

```svelte
<script lang="ts">
  import Router from "svelte-spa-router";
  import { onMount } from "svelte";
  import { authStore } from "./stores/authStore";
  import { themeStore } from "./stores/themeStore";
  import { fontSizeStore } from "./stores/fontSizeStore";
  import AppPage from "./pages/AppPage.svelte";
  import LoginPage from "./pages/LoginPage.svelte";
  import ProjectPage from "./pages/ProjectPage.svelte";
  import CityPage from "./pages/CityPage.svelte";
  import RoutePage from "./pages/RoutePage.svelte";
  import EditorLoginPage from "./pages/editor/EditorLoginPage.svelte";
  import EditorPage from "./pages/editor/EditorPage.svelte";
  import EditorLocationList from "./pages/editor/EditorLocationList.svelte";
  import EditorLocationForm from "./pages/editor/EditorLocationForm.svelte";

  const routes = {
    "/": AppPage,
    "/login/:project": LoginPage,
    "/:project": ProjectPage,
    "/:project/:city": CityPage,
    "/:project/:city/:route": RoutePage,
    "/editor/login": EditorLoginPage,
    "/editor": EditorPage,
    "/editor/locations/:project/:city": EditorLocationList,
    "/editor/locations/:project/:city/new": EditorLocationForm,
    "/editor/locations/:project/:city/edit/:filename": EditorLocationForm,
  };

  // Sync theme tokens to CSS custom properties on <html>
  $effect(() => {
    const { theme } = $themeStore;
    const root = document.documentElement;
    root.style.setProperty("--font-family", theme.fontFamily);
    root.style.setProperty("--color-background", theme.background);
    root.style.setProperty("--color-surface", theme.surface);
    root.style.setProperty("--color-border", theme.border);
    root.style.setProperty("--color-text", theme.text);
    root.style.setProperty("--color-text-secondary", theme.textSecondary);
    root.style.setProperty("--color-text-muted", theme.textMuted);
    root.style.setProperty("--color-accent", theme.accent);
    root.style.setProperty("--color-bar-background", theme.barBackground);
    root.style.setProperty("--color-bar-border", theme.barBorder);
    root.style.setProperty("--color-bar-text", theme.barText);
    root.style.setProperty(
      "--color-bar-text-secondary",
      theme.barTextSecondary,
    );
    root.style.setProperty("--color-progress-track", theme.progressTrack);
    root.style.setProperty("--color-progress-fill", theme.progressFill);
    root.style.setProperty("--color-clue-background", theme.clueBackground);
    root.style.setProperty(
      "--color-clue-border-color",
      theme.clueBorderColor,
    );
    document.body.style.background = theme.background;
  });

  // Sync font size to data-fontsize attribute on <html>
  $effect(() => {
    document.documentElement.dataset.fontsize = $fontSizeStore.fontSize;
  });

  onMount(() => {
    authStore.init();
  });
</script>

<Router {routes} />
```

- [ ] **Step 3: Verify the app builds and runs**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser. Expected: page renders without errors. Navigate to `http://localhost:5173/#/` — should show "AppPage stub".

- [ ] **Step 4: Verify all routes resolve**

Navigate to each of these hash URLs and confirm the correct stub text renders:
- `#/` → "AppPage stub"
- `#/login/democrats_abroad` → "LoginPage stub"
- `#/democrats_abroad` → "ProjectPage stub"
- `#/democrats_abroad/den_haag` → "CityPage stub"
- `#/democrats_abroad/den_haag/short_loop` → "RoutePage stub"
- `#/editor/login` → "EditorLoginPage stub"
- `#/editor` → "EditorPage stub"

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/pages/
git commit -m "feat: add Svelte app shell with stub pages and route map"
```
