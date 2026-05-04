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