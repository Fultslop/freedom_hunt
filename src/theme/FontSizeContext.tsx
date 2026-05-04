import { createContext, useContext, useState, useEffect } from "react";

export type FontSize = "small" | "medium" | "large";

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