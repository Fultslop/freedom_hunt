# Task 05: Contexts and Auth Guards

**Files (rename .jsx → .tsx, remove PropTypes, 7 files):**
- `src/i18n/LanguageContext.jsx` → `.tsx`
- `src/theme/ThemeContext.jsx` → `.tsx`
- `src/theme/TitleBarContext.jsx` → `.tsx`
- `src/theme/FontSizeContext.jsx` → `.tsx`
- `src/auth/AuthContext.jsx` → `.tsx`
- `src/auth/AdminRoute.jsx` → `.tsx`
- `src/auth/ProtectedRoute.jsx` → `.tsx`

For each file: rename with `git mv`, replace with the typed version below. Delete the `prop-types` import and all `.propTypes = { ... }` assignments.

---

- [ ] **Step 1: Convert `src/i18n/LanguageContext.tsx`**

```typescript
import { createContext, useState } from "react";

interface LanguageContextValue {
  currentLang: string;
  setLang: (lang: string) => void;
}

export const LanguageContext = createContext<LanguageContextValue>({
  currentLang: "en",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLang, setLang] = useState("en");
  return (
    <LanguageContext.Provider value={{ currentLang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}
```

---

- [ ] **Step 2: Convert `src/theme/ThemeContext.tsx`**

```typescript
import { createContext, useState, useContext } from "react";
import { themes, DEFAULT_THEME } from "./themes";
import type { Theme, ThemeName } from "../types/theme";

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "themeName";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemeName) ?? DEFAULT_THEME,
  );
  const theme = themes[themeName] ?? themes[DEFAULT_THEME];

  function setThemeName(name: ThemeName) {
    localStorage.setItem(STORAGE_KEY, name);
    setThemeNameState(name);
  }

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
```

---

- [ ] **Step 3: Convert `src/theme/TitleBarContext.tsx`**

```typescript
import { createContext, useState, useContext, useEffect } from "react";

export interface TitleBarState {
  title?: string;
  progress?: number | null;
  backPath?: string | null;
}

interface TitleBarContextValue {
  titleBar: TitleBarState;
  setTitleBar: React.Dispatch<React.SetStateAction<TitleBarState>>;
}

const DEFAULT_TITLE_BAR: TitleBarState = {
  title: "Freedom Hunt",
  progress: null,
  backPath: null,
};

export const TitleBarContext = createContext<TitleBarContextValue | null>(null);

export function TitleBarProvider({ children }: { children: React.ReactNode }) {
  const [titleBar, setTitleBar] = useState<TitleBarState>(DEFAULT_TITLE_BAR);
  return (
    <TitleBarContext.Provider value={{ titleBar, setTitleBar }}>
      {children}
    </TitleBarContext.Provider>
  );
}

export function useTitleBar(config?: TitleBarState): TitleBarContextValue {
  const ctx = useContext(TitleBarContext);
  if (!ctx) throw new Error("useTitleBar must be used inside TitleBarProvider");
  useEffect(() => {
    if (config !== undefined) ctx.setTitleBar(config);
  }, [JSON.stringify(config)]); // eslint-disable-line react-hooks/exhaustive-deps
  return ctx;
}
```

---

- [ ] **Step 4: Convert `src/theme/FontSizeContext.tsx`**

```typescript
import { createContext, useContext, useState, useEffect } from "react";

type FontSize = "small" | "medium" | "large";

interface FontSizeContextValue {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  SIZES: FontSize[];
}

const SIZES: FontSize[] = ["small", "medium", "large"];
const LS_KEY = "fontSizePref";

const FontSizeContext = createContext<FontSizeContextValue | null>(null);

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSize] = useState<FontSize>(
    () => (localStorage.getItem(LS_KEY) as FontSize) || "small",
  );

  useEffect(() => {
    document.documentElement.dataset.fontsize = fontSize;
    localStorage.setItem(LS_KEY, fontSize);
  }, [fontSize]);

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize, SIZES }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize(): FontSizeContextValue {
  const ctx = useContext(FontSizeContext);
  if (!ctx)
    throw new Error("useFontSize must be used inside FontSizeProvider");
  return ctx;
}
```

---

- [ ] **Step 5: Convert `src/auth/AuthContext.tsx`**

```typescript
import {
  createContext,
  useContext,
  useState,
  useEffect,
  startTransition,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { AuthState } from "../types/auth";

interface AuthContextValue {
  activeAuth: AuthState | null;
  authLoading: boolean;
  isLoggingOut: boolean;
  login: (
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin?: boolean,
  ) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeAuth, setActiveAuth] = useState<AuthState | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Reset the logout flag once navigation has committed (location changed).
  // We can't reset it inside logout() because React 18 batches it with
  // setActiveAuth(null), which defeats the ProtectedRoute guard.
  useEffect(() => {
    startTransition(() => {
      setIsLoggingOut(false);
    });
  }, [location.pathname]);

  useEffect(() => {
    fetch("/auth/me")
      .then((r) => r.json() as Promise<Record<string, unknown>>)
      .then((data) => {
        if (data.ok) {
          setActiveAuth({
            projectId: data.project as string,
            teamName: data.teamName as string,
            contact: (data.contact as string) ?? null,
            isAdmin: (data.isAdmin as boolean) ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  function login(
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin = false,
  ) {
    setActiveAuth({ projectId, teamName, contact, isAdmin });
  }

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch {
      /* ignore logout errors */
    }
    setActiveAuth(null);
    navigate("/", { replace: true });
  }

  return (
    <AuthContext.Provider
      value={{ activeAuth, authLoading, login, logout, isLoggingOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
```

---

- [ ] **Step 6: Convert `src/auth/AdminRoute.tsx`**

```typescript
import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

export default function AdminRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeAuth, authLoading, isLoggingOut } = useAuth();
  if (authLoading || isLoggingOut) return null;
  if (!activeAuth?.isAdmin) return <Navigate to="/" replace />;
  return children;
}
```

---

- [ ] **Step 7: Convert `src/auth/ProtectedRoute.tsx`**

```typescript
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeAuth, authLoading, isLoggingOut } = useAuth();
  const { project } = useParams();
  if (authLoading || isLoggingOut) return null;
  if (!activeAuth) return <Navigate to={`/login/${project}`} replace />;
  return children;
}
```

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

Expected: all tests pass. Test files still import from the old paths without extensions — TypeScript resolves them correctly because Vite handles the extension mapping.

---

- [ ] **Step 10: Commit**

Stage: all 7 converted files
Message: `refactor: convert contexts and auth guards to TypeScript`
