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