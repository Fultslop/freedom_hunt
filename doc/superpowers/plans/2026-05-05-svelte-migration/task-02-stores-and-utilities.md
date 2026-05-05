# Task 02 — Stores + Utilities

**Files:**
- Create: `src/stores/themeStore.ts`
- Create: `src/stores/fontSizeStore.ts`
- Create: `src/stores/titleBarStore.ts`
- Create: `src/stores/languageStore.ts`
- Create: `src/stores/authStore.ts`
- Create: `src/utils/loadText.ts`
- Create: `src/utils/loadLocations.ts`
- Modify: `src/test/setup.ts`
- Test: `src/test/stores.test.ts`
- Test: `src/test/loadText.test.ts`

Replaces: `src/theme/ThemeContext.tsx`, `src/theme/FontSizeContext.tsx`, `src/theme/TitleBarContext.tsx`, `src/i18n/LanguageContext.tsx`, `src/auth/AuthContext.tsx`, `src/hooks/useCssVars.ts`, `src/hooks/useText.ts`, `src/hooks/useLocations.ts`.

Do not delete the old files yet — that happens in Task 09.

---

- [ ] **Step 1: Write failing store tests**

Create `src/test/stores.test.ts`:

```typescript
import { get } from "svelte/store";
import { themeStore } from "../stores/themeStore";
import { fontSizeStore, FONT_SIZES } from "../stores/fontSizeStore";
import { titleBarStore } from "../stores/titleBarStore";
import { languageStore } from "../stores/languageStore";

describe("themeStore", () => {
  it("defaults to app theme", () => {
    const state = get(themeStore);
    expect(state.themeName).toBe("app");
    expect(state.theme.background).toBe("#0f172a");
  });

  it("setThemeName persists to localStorage and updates theme", () => {
    themeStore.setThemeName("GWC");
    const state = get(themeStore);
    expect(state.themeName).toBe("GWC");
    expect(state.theme.background).toBe("#ffffff");
    expect(localStorage.setItem).toHaveBeenCalledWith("themeName", "GWC");
  });
});

describe("fontSizeStore", () => {
  it("defaults to small", () => {
    expect(get(fontSizeStore).fontSize).toBe("small");
  });

  it("exposes FONT_SIZES constant", () => {
    expect(FONT_SIZES).toEqual(["small", "medium", "large"]);
  });

  it("setFontSize updates state and persists", () => {
    fontSizeStore.setFontSize("large");
    expect(get(fontSizeStore).fontSize).toBe("large");
    expect(localStorage.setItem).toHaveBeenCalledWith("fontSizePref", "large");
  });
});

describe("titleBarStore", () => {
  it("has default title", () => {
    const state = get(titleBarStore);
    expect(state.title).toBe("Freedom Hunt");
    expect(state.progress).toBeNull();
    expect(state.backPath).toBeNull();
  });

  it("can be updated directly", () => {
    titleBarStore.set({ title: "Den Haag", progress: { current: 2, total: 5 }, backPath: "/test" });
    const state = get(titleBarStore);
    expect(state.title).toBe("Den Haag");
    expect(state.progress).toEqual({ current: 2, total: 5 });
  });
});

describe("languageStore", () => {
  it("defaults to en", () => {
    expect(get(languageStore).currentLang).toBe("en");
  });

  it("setLang updates language", () => {
    languageStore.setLang("nl");
    expect(get(languageStore).currentLang).toBe("nl");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- src/test/stores.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `src/stores/themeStore.ts`**

```typescript
import { writable } from "svelte/store";
import { themes, DEFAULT_THEME } from "../theme/themes";
import type { Theme, ThemeName } from "../types/theme";

interface ThemeStoreState {
  themeName: ThemeName;
  theme: Theme;
}

const STORAGE_KEY = "themeName";

function createThemeStore() {
  const initialName =
    (localStorage.getItem(STORAGE_KEY) as ThemeName) ?? DEFAULT_THEME;
  const { subscribe, set } = writable<ThemeStoreState>({
    themeName: initialName,
    theme: themes[initialName] ?? themes[DEFAULT_THEME],
  });

  function setThemeName(name: ThemeName) {
    localStorage.setItem(STORAGE_KEY, name);
    set({ themeName: name, theme: themes[name] ?? themes[DEFAULT_THEME] });
  }

  return { subscribe, setThemeName };
}

export const themeStore = createThemeStore();
```

- [ ] **Step 4: Create `src/stores/fontSizeStore.ts`**

```typescript
import { writable } from "svelte/store";

export type FontSize = "small" | "medium" | "large";
export const FONT_SIZES: FontSize[] = ["small", "medium", "large"];

const LS_KEY = "fontSizePref";

function createFontSizeStore() {
  const initial = (localStorage.getItem(LS_KEY) as FontSize) || "small";
  const { subscribe, set } = writable<{ fontSize: FontSize }>({
    fontSize: initial,
  });

  function setFontSize(size: FontSize) {
    localStorage.setItem(LS_KEY, size);
    set({ fontSize: size });
  }

  return { subscribe, setFontSize };
}

export const fontSizeStore = createFontSizeStore();
```

- [ ] **Step 5: Create `src/stores/titleBarStore.ts`**

```typescript
import { writable } from "svelte/store";

export interface TitleBarState {
  title?: string;
  progress?: { current: number; total: number } | null;
  backPath?: string | null;
}

export const titleBarStore = writable<TitleBarState>({
  title: "Freedom Hunt",
  progress: null,
  backPath: null,
});
```

- [ ] **Step 6: Create `src/stores/languageStore.ts`**

```typescript
import { writable } from "svelte/store";

function createLanguageStore() {
  const { subscribe, set } = writable<{ currentLang: string }>({
    currentLang: "en",
  });
  return { subscribe, setLang: (lang: string) => set({ currentLang: lang }) };
}

export const languageStore = createLanguageStore();
```

- [ ] **Step 7: Create `src/stores/authStore.ts`**

```typescript
import { writable, get } from "svelte/store";
import { replace } from "svelte-spa-router";
import type { AuthState } from "../types/auth";

interface AuthStoreState {
  activeAuth: AuthState | null;
  authLoading: boolean;
  isLoggingOut: boolean;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthStoreState>({
    activeAuth: null,
    authLoading: true,
    isLoggingOut: false,
  });

  async function init() {
    try {
      const res = await fetch("/auth/me");
      const data = (await res.json()) as Record<string, unknown>;
      if (data.ok) {
        update((state) => ({
          ...state,
          activeAuth: {
            projectId: data.project as string,
            teamName: data.teamName as string,
            contact: (data.contact as string) ?? null,
            isAdmin: (data.isAdmin as boolean) ?? false,
          },
        }));
      }
    } catch {
      /* ignore network errors on auth check */
    }
    update((state) => ({ ...state, authLoading: false }));
  }

  function login(
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin = false,
  ) {
    update((state) => ({
      ...state,
      activeAuth: { projectId, teamName, contact, isAdmin },
    }));
  }

  async function logout() {
    update((state) => ({ ...state, isLoggingOut: true }));
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch {
      /* ignore logout errors */
    }
    set({ activeAuth: null, authLoading: false, isLoggingOut: false });
    replace("/");
  }

  return { subscribe, init, login, logout };
}

export const authStore = createAuthStore();
```

- [ ] **Step 8: Run store tests — expect pass**

```bash
npm run test:run -- src/test/stores.test.ts
```

Expected: all store tests PASS.

- [ ] **Step 9: Write failing loadText test**

Create `src/test/loadText.test.ts`:

```typescript
import { loadText } from "../utils/loadText";
import { loadLocations } from "../utils/loadLocations";
import type { Location } from "../types/data";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn(),
}));

describe("loadLocations", () => {
  it("returns empty array for empty paths", async () => {
    const result = await loadLocations("en", []);
    expect(result).toEqual([]);
  });

  it("filters null results", async () => {
    vi.mocked(loadText).mockResolvedValueOnce(null);
    const result = await loadLocations("en", ["projects/x/y/missing"]);
    expect(result).toEqual([]);
  });

  it("returns loaded locations in order", async () => {
    const loc = { locationId: 1, title: "Binnenhof" } as Location;
    vi.mocked(loadText).mockResolvedValueOnce(loc);
    const result = await loadLocations("en", ["projects/x/y/001_loc_binnenhof"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Binnenhof");
  });
});
```

- [ ] **Step 10: Run loadText tests — expect fail**

```bash
npm run test:run -- src/test/loadText.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 11: Create `src/utils/loadText.ts`**

```typescript
type YamlModules = Record<string, () => Promise<{ default: unknown }>>;

const modules = import.meta.glob(
  "../data/text/**/*.yaml",
) as YamlModules;

export async function loadText<T = Record<string, unknown>>(
  lang: string,
  path: string,
): Promise<T | null> {
  const key = `../data/text/${lang}/${path}.yaml`;
  const loader = modules[key];
  if (!loader) return null;
  try {
    const mod = await loader();
    return mod.default as T;
  } catch {
    return null;
  }
}
```

- [ ] **Step 12: Create `src/utils/loadLocations.ts`**

```typescript
import { loadText } from "./loadText";
import type { Location } from "../types/data";

export async function loadLocations(
  lang: string,
  paths: string[],
): Promise<Location[]> {
  if (paths.length === 0) return [];
  const results = await Promise.all(
    paths.map((path) => loadText<Location>(lang, path)),
  );
  return results.filter((loc): loc is Location => loc !== null);
}
```

- [ ] **Step 13: Run loadText tests — expect pass**

```bash
npm run test:run -- src/test/loadText.test.ts
```

Expected: all PASS.

- [ ] **Step 14: Run full test suite — worker tests should still pass**

```bash
npm run test:run
```

Expected: worker tests pass, new store/utility tests pass. React component tests will fail — that is expected and will be fixed in later tasks.

- [ ] **Step 15: Commit**

```bash
git add src/stores/ src/utils/ src/test/stores.test.ts src/test/loadText.test.ts
git commit -m "feat: add Svelte stores and data-loading utilities"
```
