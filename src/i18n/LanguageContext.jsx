import { createContext, useState } from "react";

export const LanguageContext = createContext({
  currentLang: "en",
  setLang: () => {},
});

export function LanguageProvider({ children }) {
  const [currentLang, setLang] = useState("en");
  return (
    <LanguageContext.Provider value={{ currentLang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}
