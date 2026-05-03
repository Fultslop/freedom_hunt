import { createContext, useContext, useState, useEffect } from "react";

const SIZES = ["small", "medium", "large"];
const LS_KEY = "fontSizePref";

const FontSizeContext = createContext(null);

export function FontSizeProvider({ children }) {
  const [fontSize, setFontSize] = useState(
    () => localStorage.getItem(LS_KEY) || "small",
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

export function useFontSize() {
  return useContext(FontSizeContext);
}
