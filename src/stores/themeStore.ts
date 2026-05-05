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