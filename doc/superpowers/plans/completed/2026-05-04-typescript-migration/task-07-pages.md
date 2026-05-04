# Task 07: Pages

**Files (rename .jsx → .tsx, remove PropTypes, 9 files):**
- `src/pages/AppPage.jsx` → `.tsx`
- `src/pages/LoginPage.jsx` → `.tsx`
- `src/pages/ProjectPage.jsx` → `.tsx`
- `src/pages/CityPage.jsx` → `.tsx`
- `src/pages/RoutePage.jsx` → `.tsx`
- `src/pages/editor/EditorLoginPage.jsx` → `.tsx`
- `src/pages/editor/EditorPage.jsx` → `.tsx`
- `src/pages/editor/EditorLocationList.jsx` → `.tsx`
- `src/pages/editor/EditorLocationForm.jsx` → `.tsx`

None of these components receive external props — they read everything from router params and context. The conversion is: rename, update imports to `.tsx`/`.ts`, type local state, and remove PropTypes.

---

- [ ] **Step 1: Convert `src/pages/AppPage.tsx`**

Key changes from the `.jsx` version:

```typescript
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useTheme } from "../theme/ThemeContext";
import { useTitleBar } from "../theme/TitleBarContext";
import MarkdownText from "../components/MarkdownText";
import { fetchImage } from "../assets/AssetManager";
import type { ApplicationText, ProjectsText } from "../types/data";
import "./AppPage.css";

export default function AppPage() {
  const navigate = useNavigate();
  const { text: appText, loading: appLoading } =
    useText<ApplicationText>("application");
  const { text: projectsText, loading: projectsLoading } =
    useText<ProjectsText>("projects/projects");
  const { theme, setThemeName } = useTheme();
  const [landingImageUrl, setLandingImageUrl] = useState<string | null>(null);
  const [imgHeight, setImgHeight] = useState(0);
  const [projectImageUrls, setProjectImageUrls] = useState<
    Record<string, string>
  >({});

  useTitleBar({
    title: appText?.["app.title"],
    progress: null,
    backPath: null,
  });

  // ... all useEffect and JSX unchanged from .jsx source ...
}
```

Copy the full JSX body from the existing `AppPage.jsx`. Fix one typing issue: `onLoad` event needs `(e: React.SyntheticEvent<HTMLImageElement>)` instead of `(e)` — replace:

```typescript
// Before
onLoad={(e) => setImgHeight(e.target.offsetHeight)}

// After
onLoad={(e: React.SyntheticEvent<HTMLImageElement>) =>
  setImgHeight(e.currentTarget.offsetHeight)
}
```

---

- [ ] **Step 2: Convert `src/pages/LoginPage.tsx`**

Key changes:

```typescript
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import "./LoginPage.css";

export default function LoginPage() {
  const { project } = useParams<{ project: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [teamName, setTeamName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, teamName, contact, password }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        teamName?: string;
        contact?: string;
        isAdmin?: boolean;
      };
      if (data.ok) {
        login(project!, data.teamName ?? "", data.contact ?? "", data.isAdmin ?? false);
        navigate(data.isAdmin ? "/editor" : `/${project}`);
      } else {
        setError(data.error || "Incorrect password. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ... JSX unchanged from .jsx source ...
}
```

---

- [ ] **Step 3: Convert `src/pages/ProjectPage.tsx`**

ProjectPage loads cities and renders `CitySelector` cards. Key changes:

```typescript
import { useParams } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useTitleBar } from "../theme/TitleBarContext";
import CitySelector from "../components/CitySelector";
import type { CitiesText } from "../types/data";
import "./ProjectPage.css";

export default function ProjectPage() {
  const { project } = useParams<{ project: string }>();
  const { text: citiesText, loading } = useText<CitiesText>(
    `projects/${project}/cities`,
  );

  useTitleBar({ title: project?.replace(/_/g, " "), progress: null, backPath: "/" });

  // ... JSX unchanged from .jsx source ...
}
```

---

- [ ] **Step 4: Convert `src/pages/CityPage.tsx`**

CityPage loads routes and renders `RouteSelector` cards. Key changes:

```typescript
import { useParams } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useTitleBar } from "../theme/TitleBarContext";
import RouteSelector from "../components/RouteSelector";
import type { RoutesData } from "../types/data";
import "./CityPage.css";

export default function CityPage() {
  const { project, city } = useParams<{ project: string; city: string }>();
  const { text: routesText, loading } = useText<RoutesData>(
    `projects/${project}/${city}/routes`,
  );

  useTitleBar({
    title: city?.replace(/_/g, " "),
    progress: null,
    backPath: `/${project}`,
  });

  // ... JSX unchanged from .jsx source ...
}
```

---

- [ ] **Step 5: Convert `src/pages/RoutePage.tsx`**

RoutePage is the most complex page. Key changes:

```typescript
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useLocations } from "../hooks/useLocations";
import { useTheme } from "../theme/ThemeContext";
import { useTitleBar } from "../theme/TitleBarContext";
import ChallengeCard from "../components/ChallengeCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RoutesData } from "../types/data";
import "./RoutePage.css";

export function clampedNext(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(current + 1, total - 1);
}

export function clampedPrev(current: number): number {
  return Math.max(current - 1, 0);
}

export default function RoutePage() {
  const { project, city, route } = useParams<{
    project: string;
    city: string;
    route: string;
  }>();
  const navigate = useNavigate();
  const storageKey = `${project}/${city}/${route}`;
  const { theme } = useTheme();

  const { text: routesText, loading: routesLoading } = useText<RoutesData>(
    `projects/${project}/${city}/routes`,
  );

  const routeData =
    !routesLoading && routesText && route ? routesText[route] : null;
  const locationPaths = routeData
    ? routeData.locations.map((id) => `projects/${project}/${city}/${id}`)
    : [];

  const { locations, loading: locationsLoading } = useLocations(locationPaths);

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? parseInt(saved, 10) : 0;
    return isNaN(parsed) ? 0 : parsed;
  });
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, String(currentIndex));
  }, [storageKey, currentIndex]);

  // ... rest of useTitleBar call and JSX unchanged from .jsx source ...
}
```

---

- [ ] **Step 6: Convert editor pages**

The four editor pages (`EditorLoginPage`, `EditorPage`, `EditorLocationList`, `EditorLocationForm`) follow the same pattern: rename to `.tsx`, update import extensions, type local state, remove any PropTypes.

For each editor page file:

1. Rename to `.tsx` with `git mv`
2. Update all imports ending in `.jsx` → `.tsx` and `.js` → `.ts`
3. Type `useState` calls explicitly where TypeScript cannot infer from the initial value:
   - `useState(null)` → `useState<SomeType | null>(null)`
   - `useState([])` → `useState<SomeType[]>([])`
   - `useState("")` can stay as-is (infers `string`)
4. Type event handler parameters: `(e)` → `(e: React.ChangeEvent<HTMLInputElement>)` etc.
5. Remove `import PropTypes from "prop-types"` (editor pages are unlikely to have PropTypes but double-check)

Run typecheck after each editor page to catch errors early.

---

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

---

- [ ] **Step 8: Run tests**

```bash
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 9: Commit**

Stage: all 9 converted page files
Message: `refactor: convert pages to TypeScript`
