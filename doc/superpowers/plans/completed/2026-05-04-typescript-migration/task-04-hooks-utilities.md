# Task 04: Hooks and Utilities

**Files (rename .js → .ts, 6 files):**
- `src/theme/themes.js` → `src/theme/themes.ts`
- `src/assets/AssetManager.js` → `src/assets/AssetManager.ts`
- `src/hooks/useCssVars.js` → `src/hooks/useCssVars.ts`
- `src/hooks/useText.js` → `src/hooks/useText.ts`
- `src/hooks/useLocations.js` → `src/hooks/useLocations.ts`
- `src/pages/editor/editorStorage.js` → `src/pages/editor/editorStorage.ts`

---

- [ ] **Step 1: Convert `src/theme/themes.ts`**

```typescript
import type { Theme, ThemeName } from "../types/theme.ts";

export const DEFAULT_THEME: ThemeName = "app";

export const themes: Record<ThemeName, Theme> = {
  wireframe: {
    fontFamily: "Arial, sans-serif",
    background: "#ffffff",
    surface: "#f9f9f9",
    border: "#dddddd",
    text: "#111111",
    textSecondary: "#666666",
    textMuted: "#aaaaaa",
    accent: "#555555",
    barBackground: "#ffffff",
    barBorder: "#dddddd",
    barText: "#333333",
    barTextSecondary: "#888888",
    progressTrack: "#eeeeee",
    progressFill: "#555555",
    clueBackground: "transparent",
    clueBorderColor: "transparent",
  },
  app: {
    fontFamily: "'Comfortaa', sans-serif",
    background: "#0f172a",
    surface: "#1e293b",
    border: "#334155",
    text: "#f8fafc",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    accent: "#f59e0b",
    barBackground: "#1e293b",
    barBorder: "#334155",
    barText: "#f8fafc",
    barTextSecondary: "#94a3b8",
    progressTrack: "#0f172a",
    progressFill: "#f59e0b",
    clueBackground: "#1a2744",
    clueBorderColor: "transparent",
  },
  GWC: {
    fontFamily: "'Quicksand', sans-serif",
    background: "#ffffff",
    surface: "#f0f4ff",
    border: "#e5e7eb",
    text: "#002868",
    textSecondary: "#374151",
    textMuted: "#6b7280",
    accent: "#BF0A30",
    barBackground: "#002868",
    barBorder: "#002868",
    barText: "#ffffff",
    barTextSecondary: "#93c5fd",
    progressTrack: "#001a4d",
    progressFill: "#BF0A30",
    clueBackground: "#f0f4ff",
    clueBorderColor: "#002868",
  },
};
```

---

- [ ] **Step 2: Convert `src/assets/AssetManager.ts`**

```typescript
const _cache = new Map<string, string>();

export async function fetchImage(imageName: string): Promise<string | null> {
  if (!imageName) return null;
  if (_cache.has(imageName)) return _cache.get(imageName)!;
  try {
    const res = await fetch(`/assets/img/${imageName}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    _cache.set(imageName, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

export function getCachedImageUrl(imageName: string): string | null {
  return _cache.get(imageName) ?? null;
}

export async function preloadImages(imageNames: string[]): Promise<void> {
  await Promise.all(imageNames.map(fetchImage));
}
```

---

- [ ] **Step 3: Convert `src/hooks/useCssVars.ts`**

```typescript
import { useEffect } from "react";
import { useTheme } from "../theme/ThemeContext";

function toKebab(key: string): string {
  return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

export function useCssVars(): void {
  const { theme, themeName } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeName;
    Object.entries(theme).forEach(([key, value]) => {
      if (key === "fontFamily") {
        root.style.setProperty("--font-family", value);
      } else {
        root.style.setProperty(`--color-${toKebab(key)}`, value);
      }
    });
  }, [theme, themeName]);
}
```

Note: the `.tsx` extension in the import is required for TypeScript with `moduleResolution: "Bundler"` when importing from a JSX file. Apply this pattern to all hooks that import from context files.

---

- [ ] **Step 4: Convert `src/hooks/useText.ts`**

```typescript
import { useState, useEffect, useContext, startTransition } from "react";
import { LanguageContext } from "../i18n/LanguageContext";

type YamlModules = Record<string, () => Promise<{ default: unknown }>>;

const modules = import.meta.glob("../data/text/**/*.yaml") as YamlModules;

export function useText<T = Record<string, unknown>>(
  path: string,
): { text: T | null; loading: boolean } {
  const { currentLang } = useContext(LanguageContext);
  const [text, setText] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    const key = `../data/text/${currentLang}/${path}.yaml`;
    return !!modules[key];
  });

  useEffect(() => {
    const key = `../data/text/${currentLang}/${path}.yaml`;
    const loader = modules[key];
    if (!loader) {
      startTransition(() => {
        setText(null);
        setLoading(false);
      });
      return;
    }
    startTransition(() => {
      setLoading(true);
    });
    loader()
      .then((mod) => {
        setText(mod.default as T);
        setLoading(false);
      })
      .catch(() => {
        setText(null);
        setLoading(false);
      });
  }, [currentLang, path]);

  return { text, loading };
}
```

---

- [ ] **Step 5: Convert `src/hooks/useLocations.ts`**

```typescript
import { useState, useEffect, useContext, startTransition } from "react";
import { LanguageContext } from "../i18n/LanguageContext";
import type { Location } from "../types/data";

type YamlModules = Record<string, () => Promise<{ default: unknown }>>;

const modules = import.meta.glob("../data/text/**/*.yaml") as YamlModules;

export function useLocations(
  paths: string[] | null,
): { locations: Location[]; loading: boolean } {
  const { currentLang } = useContext(LanguageContext);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(
    !paths || paths.length === 0 ? false : true,
  );

  useEffect(() => {
    if (!paths || paths.length === 0) {
      startTransition(() => {
        setLocations([]);
        setLoading(false);
      });
      return;
    }
    startTransition(() => {
      setLoading(true);
    });
    Promise.all(
      paths.map((path) => {
        const key = `../data/text/${currentLang}/${path}.yaml`;
        const loader = modules[key];
        return loader
          ? loader().then((m) => m.default as Location)
          : Promise.resolve(null);
      }),
    )
      .then((results) => {
        setLocations(results.filter((r): r is Location => r !== null));
        setLoading(false);
      })
      .catch(() => {
        setLocations([]);
        setLoading(false);
      });
  }, [currentLang, JSON.stringify(paths)]); // eslint-disable-line react-hooks/exhaustive-deps

  return { locations, loading };
}
```

---

- [ ] **Step 6: Convert `src/pages/editor/editorStorage.ts`**

```typescript
const PREFIX = "editor_pending_";

export interface PendingEntry {
  filename: string;
  [key: string]: unknown;
}

export function getPending(project: string, city: string): PendingEntry[] {
  try {
    const raw = localStorage.getItem(`${PREFIX}${project}_${city}`);
    return raw ? (JSON.parse(raw) as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

export function addPending(
  project: string,
  city: string,
  entry: PendingEntry,
): void {
  const current = getPending(project, city);
  const without = current.filter((e) => e.filename !== entry.filename);
  localStorage.setItem(
    `${PREFIX}${project}_${city}`,
    JSON.stringify([...without, entry]),
  );
}

export function removePending(
  project: string,
  city: string,
  filename: string,
): void {
  const current = getPending(project, city);
  localStorage.setItem(
    `${PREFIX}${project}_${city}`,
    JSON.stringify(current.filter((e) => e.filename !== filename)),
  );
}
```

---

- [ ] **Step 7: Update imports in context files**

`useCssVars.ts` already imports `ThemeContext.tsx`. No other hooks import from context files yet — the contexts are still `.jsx` and `allowJs: true` handles that. No action needed here.

---

- [ ] **Step 8: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

---

- [ ] **Step 9: Run tests**

```bash
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 10: Commit**

Stage: all 6 converted files
Message: `refactor: convert hooks and utilities to TypeScript`
