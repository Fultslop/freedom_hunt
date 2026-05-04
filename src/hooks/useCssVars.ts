import { useEffect } from "react";
import { useTheme } from "../theme/ThemeContext";

function toKebab(key: string): string {
  return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

export function useCssVars(): void {
  const ctx = useTheme();
  useEffect(() => {
    if (!ctx) return;
    const { theme, themeName } = ctx;
    const root = document.documentElement;
    root.dataset.theme = themeName;
    Object.entries(theme).forEach(([key, value]) => {
      if (key === "fontFamily") {
        root.style.setProperty("--font-family", value as string);
      } else {
        root.style.setProperty(`--color-${toKebab(key)}`, value as string);
      }
    });
  }, [ctx]);
}